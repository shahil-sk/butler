import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { db } from "@/kernel/db";
import { bus } from "@/kernel/event-bus";
import { nanoid } from "nanoid";
import type {
  DatabaseTable,
  DatabaseColumn,
  DatabaseRow,
  DatabaseView,
  DatabaseFilter,
  DatabaseSort,
  DatabaseColumnType,
} from "@/shared/types";

// ─── Row cell map ─────────────────────────────────────────────────────────────
export type CellMap = Record<string, Record<string, unknown>>; // rowId → colId → value

// ─── Store state ──────────────────────────────────────────────────────────────
interface DatabaseState {
  tables:  DatabaseTable[];
  columns: Record<string, DatabaseColumn[]>;  // tableId → columns
  rows:    Record<string, DatabaseRow[]>;      // tableId → rows
  cells:   Record<string, CellMap>;            // tableId → rowId → colId → value
  views:   Record<string, DatabaseView[]>;     // tableId → views
  filters: Record<string, DatabaseFilter[]>;   // viewId  → filters
  sorts:   Record<string, DatabaseSort[]>;     // viewId  → sorts

  activeTableId: string | null;
  activeViewId:  string | null;
  openRowId:     string | null;

  isLoading: boolean;

  // Actions
  loadTables: () => Promise<void>;
  loadTable:  (tableId: string) => Promise<void>;

  createTable: (payload: { name: string; icon?: string; description?: string }) => Promise<string>;
  updateTable: (tableId: string, patch: Partial<Pick<DatabaseTable, "name" | "icon" | "description">>) => Promise<void>;
  deleteTable: (tableId: string) => Promise<void>;

  addColumn:    (payload: Omit<DatabaseColumn, "id" | "createdAt">) => Promise<string>;
  updateColumn: (columnId: string, patch: Partial<Pick<DatabaseColumn, "name" | "type" | "options" | "position">>) => Promise<void>;
  deleteColumn: (columnId: string) => Promise<void>;

  addRow:    (tableId: string) => Promise<string>;
  deleteRow: (tableId: string, rowId: string) => Promise<void>;
  setCellValue: (tableId: string, rowId: string, columnId: string, value: unknown) => Promise<void>;

  addView:    (payload: Omit<DatabaseView, "id" | "createdAt">) => Promise<string>;
  updateView: (viewId: string, patch: Partial<Pick<DatabaseView, "name" | "type" | "config">>) => Promise<void>;
  deleteView: (viewId: string) => Promise<void>;

  setFilter: (viewId: string, filter: Omit<DatabaseFilter, "id">) => Promise<void>;
  removeFilter: (filterId: string) => Promise<void>;

  setSort: (viewId: string, sort: Omit<DatabaseSort, "id">) => Promise<void>;
  removeSort: (sortId: string) => Promise<void>;

  setActiveTable: (tableId: string | null) => void;
  setActiveView:  (viewId:  string | null) => void;
  setOpenRow:     (rowId:   string | null) => void;
}

const now = () => new Date().toISOString();

export const useDatabaseStore = create<DatabaseState>()(immer((set, get) => ({
  tables:  [],
  columns: {},
  rows:    {},
  cells:   {},
  views:   {},
  filters: {},
  sorts:   {},
  activeTableId: null,
  activeViewId:  null,
  openRowId:     null,
  isLoading:     false,

  // ─────────────────────────────────────────────────────────
  // LOAD
  // ─────────────────────────────────────────────────────────

  loadTables: async () => {
    set((s) => { s.isLoading = true; });
    const rows = await db.select<DatabaseTable>("SELECT * FROM db_tables ORDER BY created_at ASC", []);
    set((s) => { s.tables = rows; s.isLoading = false; });
  },

  loadTable: async (tableId) => {
    const [columns, rows] = await Promise.all([
      db.select<DatabaseColumn>(
        "SELECT * FROM db_columns WHERE table_id = ? ORDER BY position ASC",
        [tableId],
      ),
      db.select<DatabaseRow>(
        "SELECT * FROM db_rows WHERE table_id = ? ORDER BY position ASC",
        [tableId],
      ),
    ]);
    const rowIds = rows.map((r) => r.id);
    // Load cells for all rows
    let cellRows: Array<{ id: string; row_id: string; column_id: string; value: string }> = [];
    if (rowIds.length > 0) {
      const placeholders = rowIds.map(() => "?").join(",");
      cellRows = await db.select(
        `SELECT * FROM db_cells WHERE row_id IN (${placeholders})`,
        rowIds,
      );
    }
    // Load views
    const views = await db.select<DatabaseView>(
      "SELECT * FROM db_views WHERE table_id = ? ORDER BY position ASC",
      [tableId],
    );
    const viewIds = views.map((v) => v.id);
    let filters: DatabaseFilter[] = [];
    let sorts:   DatabaseSort[]   = [];
    if (viewIds.length > 0) {
      const vp = viewIds.map(() => "?").join(",");
      filters = await db.select(`SELECT * FROM db_filters WHERE view_id IN (${vp}) ORDER BY position ASC`, viewIds);
      sorts   = await db.select(`SELECT * FROM db_sorts   WHERE view_id IN (${vp}) ORDER BY position ASC`, viewIds);
    }
    // Build cell map
    const cellMap: CellMap = {};
    for (const cell of cellRows) {
      if (!cellMap[cell.row_id]) cellMap[cell.row_id] = {};
      try { cellMap[cell.row_id][cell.column_id] = JSON.parse(cell.value); }
      catch { cellMap[cell.row_id][cell.column_id] = cell.value; }
    }
    // Build filter/sort maps
    const filterMap: Record<string, DatabaseFilter[]> = {};
    for (const f of filters) {
      if (!filterMap[f.viewId]) filterMap[f.viewId] = [];
      filterMap[f.viewId].push(f);
    }
    const sortMap: Record<string, DatabaseSort[]> = {};
    for (const s of sorts) {
      if (!sortMap[s.viewId]) sortMap[s.viewId] = [];
      sortMap[s.viewId].push(s);
    }
    set((st) => {
      st.columns[tableId] = columns;
      st.rows[tableId]    = rows;
      st.cells[tableId]   = cellMap;
      st.views[tableId]   = views;
      for (const [vid, fv] of Object.entries(filterMap)) st.filters[vid] = fv;
      for (const [vid, sv] of Object.entries(sortMap))   st.sorts[vid]   = sv;
    });
  },

  // ─────────────────────────────────────────────────────────
  // TABLE CRUD
  // ─────────────────────────────────────────────────────────

  createTable: async ({ name, icon, description }) => {
    const id = nanoid();
    const ts = now();
    await db.execute(
      "INSERT INTO db_tables (id, name, icon, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      [id, name, icon ?? null, description ?? null, ts, ts],
    );
    const table: DatabaseTable = { id, name, icon, description, createdAt: ts, updatedAt: ts };
    set((s) => { s.tables.push(table); });
    // Add default primary column "Name"
    await get().addColumn({
      tableId:   id,
      name:      "Name",
      type:      "text" as DatabaseColumnType,
      options:   {},
      position:  0,
      isPrimary: true,
    });
    bus.emit("database:created", { database: table });
    return id;
  },

  updateTable: async (tableId, patch) => {
    const ts = now();
    const fields = Object.keys(patch).map((k) => `${k} = ?`).join(", ");
    await db.execute(
      `UPDATE db_tables SET ${fields}, updated_at = ? WHERE id = ?`,
      [...Object.values(patch), ts, tableId],
    );
    set((s) => {
      const t = s.tables.find((x) => x.id === tableId);
      if (t) Object.assign(t, patch, { updatedAt: ts });
    });
  },

  deleteTable: async (tableId) => {
    await db.execute("DELETE FROM db_tables WHERE id = ?", [tableId]);
    set((s) => {
      s.tables = s.tables.filter((t) => t.id !== tableId);
      delete s.columns[tableId];
      delete s.rows[tableId];
      delete s.cells[tableId];
      delete s.views[tableId];
      if (s.activeTableId === tableId) {
        s.activeTableId = null;
        s.activeViewId  = null;
      }
    });
    bus.emit("database:deleted", { tableId });
  },

  // ─────────────────────────────────────────────────────────
  // COLUMN CRUD
  // ─────────────────────────────────────────────────────────

  addColumn: async ({ tableId, name, type, options, position, isPrimary }) => {
    const id = nanoid();
    const ts = now();
    await db.execute(
      "INSERT INTO db_columns (id, table_id, name, type, options, position, is_primary, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [id, tableId, name, type, JSON.stringify(options ?? {}), position ?? 0, isPrimary ? 1 : 0, ts],
    );
    const col: DatabaseColumn = { id, tableId, name, type, options: options ?? {}, position: position ?? 0, isPrimary: !!isPrimary, createdAt: ts };
    set((s) => {
      if (!s.columns[tableId]) s.columns[tableId] = [];
      s.columns[tableId].push(col);
    });
    return id;
  },

  updateColumn: async (columnId, patch) => {
    const col = Object.values(get().columns).flat().find((c) => c.id === columnId);
    if (!col) return;
    const fields = Object.keys(patch).map((k) => `${k} = ?`).join(", ");
    await db.execute(
      `UPDATE db_columns SET ${fields} WHERE id = ?`,
      [...Object.values(patch), columnId],
    );
    set((s) => {
      const arr = s.columns[col.tableId];
      const idx = arr?.findIndex((c) => c.id === columnId) ?? -1;
      if (idx >= 0) Object.assign(arr[idx], patch);
    });
  },

  deleteColumn: async (columnId) => {
    const col = Object.values(get().columns).flat().find((c) => c.id === columnId);
    if (!col) return;
    await db.execute("DELETE FROM db_columns WHERE id = ?", [columnId]);
    set((s) => {
      s.columns[col.tableId] = s.columns[col.tableId]?.filter((c) => c.id !== columnId) ?? [];
    });
  },

  // ─────────────────────────────────────────────────────────
  // ROW CRUD
  // ─────────────────────────────────────────────────────────

  addRow: async (tableId) => {
    const id = nanoid();
    const ts = now();
    const existing = get().rows[tableId] ?? [];
    const position = existing.length;
    await db.execute(
      "INSERT INTO db_rows (id, table_id, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      [id, tableId, position, ts, ts],
    );
    const row: DatabaseRow = { id, tableId, position, cells: {}, createdAt: ts, updatedAt: ts };
    set((s) => {
      if (!s.rows[tableId]) s.rows[tableId] = [];
      s.rows[tableId].push(row);
      if (!s.cells[tableId]) s.cells[tableId] = {};
      s.cells[tableId][id] = {};
    });
    bus.emit("database:row-created", { tableId, rowId: id });
    return id;
  },

  deleteRow: async (tableId, rowId) => {
    await db.execute("DELETE FROM db_rows WHERE id = ?", [rowId]);
    set((s) => {
      s.rows[tableId] = s.rows[tableId]?.filter((r) => r.id !== rowId) ?? [];
      if (s.cells[tableId]) delete s.cells[tableId][rowId];
      if (s.openRowId === rowId) s.openRowId = null;
    });
    bus.emit("database:row-deleted", { tableId, rowId });
  },

  setCellValue: async (tableId, rowId, columnId, value) => {
    const cellId = nanoid();
    const serialised = JSON.stringify(value);
    await db.execute(
      "INSERT INTO db_cells (id, row_id, column_id, value) VALUES (?, ?, ?, ?) ON CONFLICT(row_id, column_id) DO UPDATE SET value = excluded.value",
      [cellId, rowId, columnId, serialised],
    );
    set((s) => {
      if (!s.cells[tableId]) s.cells[tableId] = {};
      if (!s.cells[tableId][rowId]) s.cells[tableId][rowId] = {};
      s.cells[tableId][rowId][columnId] = value;
      const row = s.rows[tableId]?.find((r) => r.id === rowId);
      if (row) row.updatedAt = now();
    });
  },

  // ─────────────────────────────────────────────────────────
  // VIEW CRUD
  // ─────────────────────────────────────────────────────────

  addView: async ({ tableId, name, type, config, position }) => {
    const id = nanoid();
    const ts = now();
    await db.execute(
      "INSERT INTO db_views (id, table_id, name, type, config, position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [id, tableId, name, type ?? "grid", JSON.stringify(config ?? {}), position ?? 0, ts],
    );
    const view: DatabaseView = { id, tableId, name, type: type ?? "grid", config: config ?? {}, position: position ?? 0, createdAt: ts };
    set((s) => {
      if (!s.views[tableId]) s.views[tableId] = [];
      s.views[tableId].push(view);
    });
    return id;
  },

  updateView: async (viewId, patch) => {
    const view = Object.values(get().views).flat().find((v) => v.id === viewId);
    if (!view) return;
    const fields = Object.keys(patch).map((k) => `${k} = ?`).join(", ");
    await db.execute(
      `UPDATE db_views SET ${fields} WHERE id = ?`,
      [...Object.values(patch), viewId],
    );
    set((s) => {
      const arr = s.views[view.tableId];
      const idx = arr?.findIndex((v) => v.id === viewId) ?? -1;
      if (idx >= 0) Object.assign(arr[idx], patch);
    });
  },

  deleteView: async (viewId) => {
    const view = Object.values(get().views).flat().find((v) => v.id === viewId);
    if (!view) return;
    await db.execute("DELETE FROM db_views WHERE id = ?", [viewId]);
    set((s) => {
      s.views[view.tableId] = s.views[view.tableId]?.filter((v) => v.id !== viewId) ?? [];
      delete s.filters[viewId];
      delete s.sorts[viewId];
      if (s.activeViewId === viewId) s.activeViewId = null;
    });
  },

  // ─────────────────────────────────────────────────────────
  // FILTER / SORT
  // ─────────────────────────────────────────────────────────

  setFilter: async (viewId, { columnId, operator, value, position }) => {
    const id = nanoid();
    await db.execute(
      "INSERT INTO db_filters (id, view_id, column_id, operator, value, position) VALUES (?, ?, ?, ?, ?, ?)",
      [id, viewId, columnId, operator, JSON.stringify(value), position ?? 0],
    );
    const filter: DatabaseFilter = { id, viewId, columnId, operator, value, position: position ?? 0 };
    set((s) => {
      if (!s.filters[viewId]) s.filters[viewId] = [];
      s.filters[viewId].push(filter);
    });
  },

  removeFilter: async (filterId) => {
    await db.execute("DELETE FROM db_filters WHERE id = ?", [filterId]);
    set((s) => {
      for (const vid of Object.keys(s.filters)) {
        s.filters[vid] = s.filters[vid].filter((f) => f.id !== filterId);
      }
    });
  },

  setSort: async (viewId, { columnId, direction, position }) => {
    const id = nanoid();
    await db.execute(
      "INSERT INTO db_sorts (id, view_id, column_id, direction, position) VALUES (?, ?, ?, ?, ?)",
      [id, viewId, columnId, direction ?? "asc", position ?? 0],
    );
    const sort: DatabaseSort = { id, viewId, columnId, direction: direction ?? "asc", position: position ?? 0 };
    set((s) => {
      if (!s.sorts[viewId]) s.sorts[viewId] = [];
      s.sorts[viewId].push(sort);
    });
  },

  removeSort: async (sortId) => {
    await db.execute("DELETE FROM db_sorts WHERE id = ?", [sortId]);
    set((s) => {
      for (const vid of Object.keys(s.sorts)) {
        s.sorts[vid] = s.sorts[vid].filter((s2) => s2.id !== sortId);
      }
    });
  },

  // ─────────────────────────────────────────────────────────
  // UI state
  // ─────────────────────────────────────────────────────────

  setActiveTable: (tableId) => set((s) => { s.activeTableId = tableId; }),
  setActiveView:  (viewId)  => set((s) => { s.activeViewId  = viewId; }),
  setOpenRow:     (rowId)   => set((s) => { s.openRowId     = rowId; }),
})));
