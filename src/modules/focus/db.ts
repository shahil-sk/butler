// ============================================================
// FOCUS — DB
// Migration v70: initial focus_sessions table
// Migration v71: adds goal + interrupt_count columns
// Register BOTH in main.tsx: db.registerMigrations(FOCUS_MIGRATIONS)
// ============================================================

import type { Migration } from "@/kernel/db";
import { db } from "@/kernel/db";
import type { FocusSession, SessionPause, FocusConfig } from "@/shared/types";
import { generateId, now } from "@/shared/utils";

// ── Migrations ─────────────────────────────────────────────────

export const FOCUS_MIGRATIONS: Migration[] = [
  {
    version: 70,
    module:  "focus",
    up: `
      CREATE TABLE IF NOT EXISTS focus_sessions (
        id               TEXT PRIMARY KEY,
        task_id          TEXT,
        project_id       TEXT,
        type             TEXT NOT NULL DEFAULT 'focus',
        planned_minutes  INTEGER NOT NULL DEFAULT 25,
        actual_minutes   INTEGER,
        state            TEXT NOT NULL DEFAULT 'idle',
        started_at       TEXT,
        completed_at     TEXT,
        notes            TEXT,
        created_at       TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_focus_sessions_task_id
        ON focus_sessions(task_id);
      CREATE INDEX IF NOT EXISTS idx_focus_sessions_project_id
        ON focus_sessions(project_id);
      CREATE INDEX IF NOT EXISTS idx_focus_sessions_started_at
        ON focus_sessions(started_at);
    `,
    down: `DROP TABLE IF EXISTS focus_sessions;`,
  },
  {
    version: 71,
    module:  "focus",
    up: `
      ALTER TABLE focus_sessions ADD COLUMN goal TEXT;
      ALTER TABLE focus_sessions ADD COLUMN interrupt_count INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE focus_sessions ADD COLUMN mood INTEGER;
    `,
    down: `
      -- SQLite does not support DROP COLUMN before 3.35; handled by full table drop on rollback
    `,
  },
  {
    version: 72,
    module: "focus",
    up: `
      DROP TABLE IF EXISTS focus_sessions;
      
      CREATE TABLE focus_sessions (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        task_id TEXT,
        time_block_id TEXT,
        project_id TEXT,
        planned_duration INTEGER NOT NULL,
        actual_duration INTEGER,
        work_duration INTEGER,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        interruption_count INTEGER NOT NULL DEFAULT 0,
        idle_time_minutes INTEGER,
        flow_score INTEGER,
        notes TEXT,
        accomplishment TEXT,
        pomodoro_number INTEGER,
        work_set_id TEXT,
        tags TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        
        planned_minutes INTEGER,
        actual_minutes INTEGER,
        state TEXT,
        goal TEXT,
        interrupt_count INTEGER,
        mood INTEGER
      );

      CREATE TABLE session_pauses (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        paused_at TEXT NOT NULL,
        resumed_at TEXT,
        reason TEXT
      );

      CREATE TABLE pomodoro_work_sets (
        id TEXT PRIMARY KEY,
        sessions TEXT NOT NULL DEFAULT '[]',
        work_sessions INTEGER NOT NULL DEFAULT 4,
        short_break_min INTEGER NOT NULL DEFAULT 5,
        long_break_min INTEGER NOT NULL DEFAULT 15,
        completed_at TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE focus_configs (
        id TEXT PRIMARY KEY,
        default_type TEXT NOT NULL DEFAULT 'pomodoro',
        pomodoro_work_min INTEGER NOT NULL DEFAULT 25,
        pomodoro_short_break INTEGER NOT NULL DEFAULT 5,
        pomodoro_long_break INTEGER NOT NULL DEFAULT 15,
        pomodoro_set_count INTEGER NOT NULL DEFAULT 4,
        deep_work_default_min INTEGER NOT NULL DEFAULT 90,
        auto_start_breaks INTEGER NOT NULL DEFAULT 0,
        auto_start_next_pomodoro INTEGER NOT NULL DEFAULT 0,
        idle_detection_min INTEGER NOT NULL DEFAULT 5,
        block_apps INTEGER NOT NULL DEFAULT 0,
        block_urls TEXT NOT NULL DEFAULT '[]',
        ambient_sound TEXT,
        ambient_volume REAL NOT NULL DEFAULT 0.5,
        end_sound TEXT NOT NULL DEFAULT 'bell'
      );
    `,
    down: `
      DROP TABLE IF EXISTS focus_sessions;
      DROP TABLE IF EXISTS session_pauses;
      DROP TABLE IF EXISTS pomodoro_work_sets;
      DROP TABLE IF EXISTS focus_configs;
    `
  },
  {
    version: 80,
    module: "focus",
    up: `
      CREATE TABLE IF NOT EXISTS time_entries (
        id              TEXT PRIMARY KEY,
        task_id         TEXT,
        project_id      TEXT,
        focus_session_id TEXT,
        description     TEXT,
        start_at        TEXT NOT NULL,
        end_at          TEXT,
        duration_minutes INTEGER,
        is_billable     INTEGER NOT NULL DEFAULT 0,
        tags            TEXT NOT NULL DEFAULT '[]',
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_time_entries_start_at   ON time_entries(start_at);
      CREATE INDEX IF NOT EXISTS idx_time_entries_task_id    ON time_entries(task_id);
      CREATE INDEX IF NOT EXISTS idx_time_entries_project_id ON time_entries(project_id);
    `,
    down: `
      DROP TABLE IF EXISTS time_entries;
    `,
  },
  {
    version: 81,
    module: "focus",
    up: `
      ALTER TABLE time_entries ADD COLUMN is_manual INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE time_entries ADD COLUMN billable_rate REAL;
      ALTER TABLE time_entries ADD COLUMN billable_amount REAL;
      ALTER TABLE time_entries ADD COLUMN category TEXT;
      ALTER TABLE time_entries ADD COLUMN created_by TEXT;

      CREATE TABLE IF NOT EXISTS time_tracking_settings (
        id TEXT PRIMARY KEY,
        default_billable INTEGER NOT NULL DEFAULT 0,
        default_hourly_rate REAL,
        currency TEXT NOT NULL DEFAULT 'USD',
        round_entries TEXT NOT NULL DEFAULT 'none',
        idle_detection_min INTEGER NOT NULL DEFAULT 0,
        reminder_interval_min INTEGER NOT NULL DEFAULT 0,
        work_hours_start TEXT NOT NULL DEFAULT '09:00',
        work_hours_end TEXT NOT NULL DEFAULT '17:00'
      );
    `,
    down: `
      DROP TABLE IF EXISTS time_tracking_settings;
    `
  }
];

// ── SQL ───────────────────────────────────────────────────────

const INSERT_SQL = `
  INSERT INTO focus_sessions
    (id, type, status, task_id, time_block_id, project_id, planned_duration,
     actual_duration, work_duration, started_at, ended_at, interruption_count,
     idle_time_minutes, flow_score, notes, accomplishment, pomodoro_number,
     work_set_id, tags, created_at,
     planned_minutes, actual_minutes, state, goal, interrupt_count, mood)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
`;

const UPDATE_SQL = `
  UPDATE focus_sessions
  SET type=?, status=?, task_id=?, time_block_id=?, project_id=?,
      planned_duration=?, actual_duration=?, work_duration=?, started_at=?,
      ended_at=?, interruption_count=?, idle_time_minutes=?, flow_score=?,
      notes=?, accomplishment=?, pomodoro_number=?, work_set_id=?, tags=?,
      planned_minutes=?, actual_minutes=?, state=?, goal=?, interrupt_count=?, mood=?
  WHERE id=?
`;

const SELECT_RECENT_SQL = `
  SELECT * FROM focus_sessions
  ORDER BY created_at DESC
  LIMIT 500
`;

const SELECT_TODAY_SQL = `
  SELECT * FROM focus_sessions
  WHERE date(started_at) = date('now')
  ORDER BY created_at DESC
`;

const SELECT_RANGE_SQL = `
  SELECT * FROM focus_sessions
  WHERE date(started_at) >= ? AND date(started_at) <= ?
  ORDER BY created_at DESC
`;

// ── Param builders — explicit column order, WHERE id last ──────────────────

function insertParams(s: FocusSession): unknown[] {
  return [
    s.id, s.type, s.status, s.taskId ?? null, s.timeBlockId ?? null, s.projectId ?? null,
    s.plannedDuration, s.actualDuration ?? null, s.workDuration ?? null, s.startedAt,
    s.endedAt ?? null, s.interruptionCount, s.idleTimeMinutes ?? null, s.flowScore ?? null,
    s.notes ?? null, s.accomplishment ?? null, s.pomodoroNumber ?? null, s.workSetId ?? null,
    JSON.stringify(s.tags ?? []), s.createdAt,
    s.plannedMinutes ?? null, s.actualMinutes ?? null, s.state ?? null, s.goal ?? null,
    s.interruptCount ?? null, s.mood ?? null
  ];
}

function updateParams(s: FocusSession): unknown[] {
  return [
    s.type, s.status, s.taskId ?? null, s.timeBlockId ?? null, s.projectId ?? null,
    s.plannedDuration, s.actualDuration ?? null, s.workDuration ?? null, s.startedAt,
    s.endedAt ?? null, s.interruptionCount, s.idleTimeMinutes ?? null, s.flowScore ?? null,
    s.notes ?? null, s.accomplishment ?? null, s.pomodoroNumber ?? null, s.workSetId ?? null,
    JSON.stringify(s.tags ?? []),
    s.plannedMinutes ?? null, s.actualMinutes ?? null, s.state ?? null, s.goal ?? null,
    s.interruptCount ?? null, s.mood ?? null,
    s.id, // WHERE last
  ];
}

function rowToSession(row: Record<string, unknown>): FocusSession {
  return {
    id:             row.id as string,
    type:           row.type as FocusSession["type"],
    status:         (row.status || "completed") as FocusSession["status"],
    taskId:         (row.task_id       as string | null) ?? undefined,
    timeBlockId:    (row.time_block_id as string | null) ?? undefined,
    projectId:      (row.project_id    as string | null) ?? undefined,
    plannedDuration: row.planned_duration as number,
    actualDuration: (row.actual_duration as number | null) ?? undefined,
    workDuration:   (row.work_duration as number | null) ?? undefined,
    startedAt:      row.started_at as string,
    endedAt:        (row.ended_at as string | null) ?? undefined,
    interruptionCount: row.interruption_count as number,
    idleTimeMinutes:(row.idle_time_minutes as number | null) ?? undefined,
    flowScore:      (row.flow_score as number | null) ?? undefined,
    notes:          (row.notes as string | null) ?? undefined,
    accomplishment: (row.accomplishment as string | null) ?? undefined,
    pomodoroNumber: (row.pomodoro_number as number | null) ?? undefined,
    workSetId:      (row.work_set_id as string | null) ?? undefined,
    tags:           JSON.parse((row.tags as string) || "[]"),
    createdAt:      row.created_at as string,
    pauses:         [],

    plannedMinutes: (row.planned_minutes as number | null) ?? undefined,
    actualMinutes:  (row.actual_minutes as number | null) ?? undefined,
    state:          (row.state as FocusSession["state"] | null) ?? undefined,
    goal:           (row.goal as string | null) ?? undefined,
    interruptCount: (row.interrupt_count as number | null) ?? undefined,
    mood:           (row.mood as 1|2|3|4|5 | null) ?? undefined,
  };
}

// ── Public DB API ──────────────────────────────────────────────

async function attachPauses(sessions: FocusSession[]): Promise<FocusSession[]> {
  if (sessions.length === 0) return sessions;
  const ids = sessions.map(s => `'${s.id}'`).join(',');
  const pauses = await db.select<Record<string, unknown>>(`SELECT * FROM session_pauses WHERE session_id IN (${ids})`);
  
  for (const s of sessions) {
    s.pauses = pauses
      .filter(p => p.session_id === s.id)
      .map(p => ({
        id: p.id as string,
        sessionId: p.session_id as string,
        pausedAt: p.paused_at as string,
        resumedAt: (p.resumed_at as string | null) ?? undefined,
        reason: (p.reason as any) ?? undefined
      }));
  }
  return sessions;
}

export async function dbLoadSessions(): Promise<FocusSession[]> {
  const rows = await db.select<Record<string, unknown>>(SELECT_RECENT_SQL);
  return attachPauses(rows.map((row) => rowToSession(row)));
}

export async function dbLoadTodaySessions(): Promise<FocusSession[]> {
  const rows = await db.select<Record<string, unknown>>(SELECT_TODAY_SQL);
  return attachPauses(rows.map((row) => rowToSession(row)));
}

export async function dbLoadSessionsInRange(from: string, to: string): Promise<FocusSession[]> {
  const rows = await db.select<Record<string, unknown>>(SELECT_RANGE_SQL, [from, to]);
  return attachPauses(rows.map((row) => rowToSession(row)));
}

export async function dbInsertSession(s: FocusSession): Promise<void> {
  await db.execute(INSERT_SQL, insertParams(s));
  for (const p of s.pauses) {
    await dbInsertPause(p);
  }
}

export async function dbUpdateSession(s: FocusSession): Promise<void> {
  await db.execute(UPDATE_SQL, updateParams(s));
  // Not syncing all pauses on update here to avoid complexity,
  // we will insert/update pauses individually when they happen.
}

export async function dbInsertPause(p: SessionPause): Promise<void> {
  await db.execute(
    `INSERT INTO session_pauses (id, session_id, paused_at, resumed_at, reason) VALUES (?, ?, ?, ?, ?)`,
    [p.id, p.sessionId, p.pausedAt, p.resumedAt ?? null, p.reason ?? null]
  );
}

export async function dbUpdatePause(p: SessionPause): Promise<void> {
  await db.execute(
    `UPDATE session_pauses SET resumed_at=?, reason=? WHERE id=?`,
    [p.resumedAt ?? null, p.reason ?? null, p.id]
  );
}

// ── Factory ───────────────────────────────────────────────────────

export function newSession(overrides: Partial<FocusSession> = {}): FocusSession {
  return {
    id:             generateId(),
    type:           "pomodoro",
    status:         "active",
    plannedDuration: 25,
    startedAt:      now(),
    pauses:         [],
    interruptionCount: 0,
    tags:           [],
    plannedMinutes: 25,
    state:          "idle",
    interruptCount: 0,
    createdAt:      now(),
    ...overrides,
  };
}

// ── Config API ──────────────────────────────────────────────────

export async function dbLoadFocusConfig(): Promise<FocusConfig | null> {
  const rows = await db.select<Record<string, unknown>>("SELECT * FROM focus_configs LIMIT 1");
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id as string,
    defaultType: r.default_type as FocusConfig["defaultType"],
    pomodoroWorkMin: r.pomodoro_work_min as number,
    pomodoroShortBreak: r.pomodoro_short_break as number,
    pomodoroLongBreak: r.pomodoro_long_break as number,
    pomodoroSetCount: r.pomodoro_set_count as number,
    deepWorkDefaultMin: r.deep_work_default_min as number,
    autoStartBreaks: Boolean(r.auto_start_breaks),
    autoStartNextPomodoro: Boolean(r.auto_start_next_pomodoro),
    idleDetectionMin: r.idle_detection_min as number,
    blockApps: Boolean(r.block_apps),
    blockUrls: JSON.parse((r.block_urls as string) || "[]"),
    ambientSound: (r.ambient_sound as FocusConfig["ambientSound"] | null) ?? undefined,
    ambientVolume: r.ambient_volume as number,
    endSound: r.end_sound as FocusConfig["endSound"],
  };
}

export async function dbSaveFocusConfig(c: FocusConfig): Promise<void> {
  await db.execute(
    `INSERT INTO focus_configs (
      id, default_type, pomodoro_work_min, pomodoro_short_break, pomodoro_long_break, 
      pomodoro_set_count, deep_work_default_min, auto_start_breaks, auto_start_next_pomodoro, 
      idle_detection_min, block_apps, block_urls, ambient_sound, ambient_volume, end_sound
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      default_type=excluded.default_type, pomodoro_work_min=excluded.pomodoro_work_min, 
      pomodoro_short_break=excluded.pomodoro_short_break, pomodoro_long_break=excluded.pomodoro_long_break,
      pomodoro_set_count=excluded.pomodoro_set_count, deep_work_default_min=excluded.deep_work_default_min,
      auto_start_breaks=excluded.auto_start_breaks, auto_start_next_pomodoro=excluded.auto_start_next_pomodoro,
      idle_detection_min=excluded.idle_detection_min, block_apps=excluded.block_apps, block_urls=excluded.block_urls,
      ambient_sound=excluded.ambient_sound, ambient_volume=excluded.ambient_volume, end_sound=excluded.end_sound
    `,
    [
      c.id, c.defaultType, c.pomodoroWorkMin, c.pomodoroShortBreak, c.pomodoroLongBreak,
      c.pomodoroSetCount, c.deepWorkDefaultMin, c.autoStartBreaks ? 1 : 0, c.autoStartNextPomodoro ? 1 : 0,
      c.idleDetectionMin, c.blockApps ? 1 : 0, JSON.stringify(c.blockUrls), c.ambientSound ?? null,
      c.ambientVolume, c.endSound
    ]
  );
}
