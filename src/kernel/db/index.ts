// ============================================================
// BUTLER — DATA LAYER (Kernel)
// SQLite via tauri-plugin-sql (desktop).
// Dexie/IndexedDB fallback for web-only dev mode.
// Modules register their own migrations here.
// ============================================================

// ── Migration types ──────────────────────────────────────────

export interface Migration {
  version: number;
  module: string;
  up: string;   // SQL to run
  down: string; // SQL to rollback
}

// ── DB Adapter interface (SQLite ↔ Dexie abstraction) ────────

export interface DbAdapter {
  execute(sql: string, params?: unknown[]): Promise<void>;
  select<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  selectOne<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | null>;
  transaction(fn: (tx: DbAdapter) => Promise<void>): Promise<void>;
}

// ── SQLite adapter (Tauri) ───────────────────────────────────

class SqliteAdapter implements DbAdapter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private db: any = null;

  async init(): Promise<void> {
    const { default: Database } = await import("@tauri-apps/plugin-sql");
    this.db = await Database.load("sqlite:butler.db");
    await this.enableWAL();
  }

  private async enableWAL(): Promise<void> {
    await this.execute("PRAGMA journal_mode=WAL");
    await this.execute("PRAGMA foreign_keys=ON");
    await this.execute("PRAGMA synchronous=NORMAL");
  }

  async execute(sql: string, params: unknown[] = []): Promise<void> {
    await this.db.execute(sql, params);
  }

  async select<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.db.select(sql, params) as Promise<T[]>;
  }

  async selectOne<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | null> {
    const rows = await this.select<T>(sql, params);
    return rows[0] ?? null;
  }

  async transaction(fn: (tx: DbAdapter) => Promise<void>): Promise<void> {
    await this.execute("BEGIN");
    try {
      await fn(this);
      await this.execute("COMMIT");
    } catch (err) {
      await this.execute("ROLLBACK");
      throw err;
    }
  }
}

// ── In-memory SQL adapter (browser dev fallback via sql.js) ──
// Data lives for the session only — use pnpm tauri dev for persistence.

class MemoryAdapter implements DbAdapter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private db: any = null;

  async init(): Promise<void> {
    // Dynamically import sql.js (only in browser mode)
    try {
      // @ts-expect-error — no types for cdn import
      const initSqlJs = (await import("https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/sql-wasm.js")).default;
      const SQL = await initSqlJs({
        locateFile: () => "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/sql-wasm.wasm",
      });
      this.db = new SQL.Database();
      console.log("[DB] Browser mode: in-memory SQLite via sql.js. Data won't persist across reloads.");
    } catch (err) {
      console.error("[DB] sql.js failed to load:", err);
      throw new Error("Failed to initialize browser SQL adapter. Check network.");
    }
  }

  async execute(sql: string, params: unknown[] = []): Promise<void> {
    try {
      this.db.run(sql, params);
    } catch (err) {
      console.error("[DB:memory] execute error:", err, "\nSQL:", sql, "\nParams:", params);
      throw err;
    }
  }

  async select<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    try {
      const stmt = this.db.prepare(sql);
      stmt.bind(params);
      const rows: T[] = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject() as T);
      }
      stmt.free();
      return rows;
    } catch (err) {
      console.error("[DB:memory] select error:", err, "\nSQL:", sql);
      return [];
    }
  }

  async selectOne<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | null> {
    const rows = await this.select<T>(sql, params);
    return rows[0] ?? null;
  }

  async transaction(fn: (tx: DbAdapter) => Promise<void>): Promise<void> {
    this.db.run("BEGIN");
    try {
      await fn(this);
      this.db.run("COMMIT");
    } catch (err) {
      this.db.run("ROLLBACK");
      throw err;
    }
  }
}

// ── Migration runner ─────────────────────────────────────────

const MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS _migrations (
    version INTEGER PRIMARY KEY,
    module TEXT NOT NULL,
    applied_at TEXT NOT NULL
  )
`;

async function runMigrations(db: DbAdapter, migrations: Migration[]): Promise<void> {
  await db.execute(MIGRATIONS_TABLE);

  const applied = await db.select<{ version: number }>(
    "SELECT version FROM _migrations ORDER BY version ASC"
  );
  const appliedVersions = new Set(applied.map((r) => r.version));

  const pending = migrations
    .filter((m) => !appliedVersions.has(m.version))
    .sort((a, b) => a.version - b.version);

  for (const migration of pending) {
    console.log(`[DB] Applying migration v${migration.version}: ${migration.module}`);
    await db.transaction(async (tx) => {
      await tx.execute(migration.up);
      await tx.execute(
        "INSERT INTO _migrations (version, module, applied_at) VALUES (?, ?, ?)",
        [migration.version, migration.module, new Date().toISOString()]
      );
    });
  }
}

// ── Kernel migrations (app-level tables) ────────────────────

export const KERNEL_MIGRATIONS: Migration[] = [
  {
    version: 1,
    module: "kernel",
    up: `
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS activity_log (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        action TEXT NOT NULL,
        diff TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_log (entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log (created_at DESC);
    `,
    down: `
      DROP TABLE IF EXISTS app_settings;
      DROP TABLE IF EXISTS activity_log;
    `,
  },
];

// ── DB singleton ─────────────────────────────────────────────

class DatabaseService {
  private adapter: DbAdapter | null = null;
  private migrations: Migration[] = [...KERNEL_MIGRATIONS];
  private initialized = false;

  /** Register module migrations before init() is called */
  registerMigrations(migrations: Migration[]): void {
    this.migrations.push(...migrations);
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    const isTauri = "__TAURI_INTERNALS__" in window;

    if (isTauri) {
      const sqlite = new SqliteAdapter();
      await sqlite.init();
      this.adapter = sqlite;
    } else {
      console.warn("[DB] Browser mode — using in-memory sql.js. Data resets on reload.");
      const mem = new MemoryAdapter();
      await mem.init();
      this.adapter = mem;
    }

    await runMigrations(this.adapter, this.migrations);
    this.initialized = true;
    console.log("[DB] Initialized.");
  }

  get db(): DbAdapter {
    if (!this.adapter) throw new Error("[DB] Not initialized. Call db.init() first.");
    return this.adapter;
  }

  // ── Convenience helpers ──────────────────────────────────

  async execute(sql: string, params?: unknown[]): Promise<void> {
    return this.db.execute(sql, params);
  }

  async select<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
    return this.db.select<T>(sql, params);
  }

  async selectOne<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | null> {
    return this.db.selectOne<T>(sql, params);
  }

  async transaction(fn: (tx: DbAdapter) => Promise<void>): Promise<void> {
    return this.db.transaction(fn);
  }

  // ── Settings helpers ─────────────────────────────────────

  async getSetting<T>(key: string, fallback: T): Promise<T> {
    const row = await this.selectOne<{ value: string }>(
      "SELECT value FROM app_settings WHERE key = ?",
      [key]
    );
    if (!row) return fallback;
    try {
      return JSON.parse(row.value) as T;
    } catch {
      return fallback;
    }
  }

  async setSetting(key: string, value: unknown): Promise<void> {
    await this.execute(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [key, JSON.stringify(value), new Date().toISOString()]
    );
  }

  // ── Activity log ─────────────────────────────────────────

  async logActivity(params: {
    id: string;
    entityType: string;
    entityId: string;
    action: string;
    diff?: Record<string, unknown>;
  }): Promise<void> {
    await this.execute(
      `INSERT INTO activity_log (id, entity_type, entity_id, action, diff, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        params.id,
        params.entityType,
        params.entityId,
        params.action,
        params.diff ? JSON.stringify(params.diff) : null,
        new Date().toISOString(),
      ]
    );
  }
}

export const db = new DatabaseService();
