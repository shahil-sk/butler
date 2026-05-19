// ============================================================
// DATABASE MODULE — Zustand store
// No cross-module store writes. Use bus.emit() for side effects.
// ============================================================

import { create } from "zustand";
import { db } from "@/kernel/db";
import { bus } from "@/kernel/event-bus";
import { generateId, now } from "@/shared/utils";
import type {
  ID,
  DatabaseTable,
  DatabaseColumn,
  DatabaseRow,
} from "@/shared/types";

// ── View types (module-local, stored in db_views) ────────────

export type ViewType = "grid" | "kanban";

export interface DatabaseView {
  id: ID;
  tableId: ID;
  name: string;
  type: ViewType;
  columnOrder: ID[];
  hiddenColumns: ID[];
  groupByColumnId?: ID;
  createdAt: string;
  updatedAt: string;
}

export type FilterOperator =
  | "eq" | "neq" | "contains" | "not_contains"
  | "is_empty" | "is_not_empty" | "gt" | "lt";

export interface ViewFilter {
  id: ID;
  viewId: ID;
  columnId: ID;
  operator: FilterOperator;
  value?: string;
  filterOrder: number;
}

export interface ViewSort {
  id: ID;
  viewId: ID;
  columnId: ID;
  direction: "asc" | "desc";
  sortOrder: number;
}

// ── Store shape ──────────────────────────────────────────────

interface DatabaseState {
  tables: DatabaseTable[];
  views: DatabaseView[];
  rows: Record<ID, DatabaseRow[]>;     // tableId → rows
  filters: Record<ID, ViewFilter[]>;   // viewId  → filters
  sorts: Record<ID, ViewSort[]>;       // viewId  → sorts
  activeTableId: ID | null;
  activeViewId: ID | null;
  openRowId: ID | null;
  loading: boolean;

  // Table ops
  loadTables: () => Promise<void>;
  createTable: (name: string, description?: string) => Promise<DatabaseTable>;
  updateTable: (id: ID, patch: Partial<Pick<DatabaseTable, "name" | "description" | "linkedProjectId" | "linkedNoteId">>) => Promise<void>;
  deleteTable: (id: ID) => Promise<void>;
  addColumn: (tableId: ID, col: Omit<DatabaseColumn, "id" | "order">) => Promise<void>;
  updateColumn: (tableId: ID, colId: ID, patch: Partial<Omit<DatabaseColumn, "id">>) => Promise<void>;
  deleteColumn: (tableId: ID, colId: ID) => Promise<void>;

  // View ops
  loadViews: (tableId: ID) => Promise<void>;
  createView: (tableId: ID, name: string, type: ViewType) => Promise<DatabaseView>;
  updateView: (viewId: ID, patch: Partial<Pick<DatabaseView, "name" | "columnOrder" | "hiddenColumns" | "groupByColumnId">>) => Promise<void>;
  deleteView: (viewId: ID) => Promise<void>;

  // Row ops
  loadRows: (tableId: ID) => Promise<void>;
  createRow: (tableId: ID) => Promise<DatabaseRow>;
  updateCell: (rowId: ID, columnId: ID, value: unknown) => Promise<void>;
  deleteRow: (rowId: ID, tableId: ID) => Promise<void>;

  // Filter / sort ops
  loadFilters: (viewId: ID) => Promise<void>;
  addFilter: (viewId: ID, columnId: ID, operator: FilterOperator, value?: string) => Promise<void>;
  removeFilter: (filterId: ID, viewId: ID) => Promise<void>;
  loadSorts: (viewId: ID) => Promise<void>;
  addSort: (viewId: ID, columnId: ID, direction: "asc" | "desc") => Promise<void>;
  removeSort: (sortId: ID, viewId: ID) => Promise<void>;

  // UI
  setActiveTable: (tableId: ID | null) => void;
  setActiveView: (viewId: ID | null) => void;
  setOpenRow: (rowId: ID | null) => void;
}

// ── Serialisation helpers ────────────────────────────────────

function parseSchema(json: string): DatabaseColumn[] {
  try { return JSON.parse(json) as DatabaseColumn[]; }
  catch { return []; }
}

function rowFromDb(r: Record<string, unknown>): DatabaseRow {
  return {
    id: r.id as ID,
    tableId: r.table_id as ID,
    cells: JSON.parse((r.cells_json as string) || "{}") as Record<ID, unknown>,
    order: r.row_order as number,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function tableFromDb(r: Record<string, unknown>): DatabaseTable {
  return {
    id: r.id as ID,
    name: r.name as string,
    description: (r.description as string) ?? undefined,
    schema: parseSchema(r.schema_json as string),
    linkedProjectId: (r.linked_project_id as ID) ?? undefined,
    linkedNoteId: (r.linked_note_id as ID) ?? undefined,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function viewFromDb(r: Record<string, unknown>): DatabaseView {
  return {
    id: r.id as ID,
    tableId: r.table_id as ID,
    name: r.name as string,
    type: r.type as ViewType,
    columnOrder: JSON.parse((r.column_order as string) || "[]") as ID[],
    hiddenColumns: JSON.parse((r.hidden_columns as string) || "[]") as ID[],
    groupByColumnId: (r.group_by_column_id as ID) ?? undefined,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

// ── Store ────────────────────────────────────────────────────

export const useDatabaseStore = create<DatabaseState>((set, get) => ({
  tables: [],
  views: [],
  rows: {},
  filters: {},
  sorts: {},
  activeTableId: null,
  activeViewId: null,
  openRowId: null,
  loading: false,

  // ── Tables ────────────────────────────────────────────────

  loadTables: async () => {
    set({ loading: true });
    const rows = await db.select<Record<string, unknown>>("SELECT * FROM db_tables ORDER BY created_at ASC");
    set({ tables: rows.map(tableFromDb), loading: false });
  },

  createTable: async (name, description) => {
    const t: DatabaseTable = {
      id: generateId(),
      name,
      description,
      schema: [],
      createdAt: now(),
      updatedAt: now(),
    };
    await db.execute(
      `INSERT INTO db_tables (id, name, description, linked_project_id, linked_note_id, schema_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [t.id, t.name, t.description ?? null, null, null, "[]", t.createdAt, t.updatedAt]
    );
    set((s) => ({ tables: [...s.tables, t] }));
    bus.emit("database:created", { database: t as unknown as import("@/shared/types").Database });
    return t;
  },

  updateTable: async (id, patch) => {
    const ts = now();
    await db.execute(
      `UPDATE db_tables SET name=?, description=?, linked_project_id=?, linked_note_id=?, updated_at=? WHERE id=?`,
      [patch.name ?? null, patch.description ?? null, patch.linkedProjectId ?? null, patch.linkedNoteId ?? null, ts, id]
    );
    set((s) => ({
      tables: s.tables.map((t) =>
        t.id === id ? { ...t, ...patch, updatedAt: ts } : t
      ),
    }));
  },

  deleteTable: async (id) => {
    await db.execute(`DELETE FROM db_tables WHERE id=?`, [id]);
    set((s) => ({
      tables: s.tables.filter((t) => t.id !== id),
      rows: Object.fromEntries(Object.entries(s.rows).filter(([k]) => k !== id)),
      activeTableId: s.activeTableId === id ? null : s.activeTableId,
    }));
    bus.emit("database:deleted", { databaseId: id });
  },

  addColumn: async (tableId, col) => {
    const table = get().tables.find((t) => t.id === tableId);
    if (!table) return;
    const newCol: DatabaseColumn = { ...col, id: generateId(), order: table.schema.length };
    const schema = [...table.schema, newCol];
    const ts = now();
    await db.execute(
      `UPDATE db_tables SET schema_json=?, updated_at=? WHERE id=?`,
      [JSON.stringify(schema), ts, tableId]
    );
    set((s) => ({
      tables: s.tables.map((t) =>
        t.id === tableId ? { ...t, schema, updatedAt: ts } : t
      ),
    }));
  },

  updateColumn: async (tableId, colId, patch) => {
    const table = get().tables.find((t) => t.id === tableId);
    if (!table) return;
    const schema = table.schema.map((c) => (c.id === colId ? { ...c, ...patch } : c));
    const ts = now();
    await db.execute(
      `UPDATE db_tables SET schema_json=?, updated_at=? WHERE id=?`,
      [JSON.stringify(schema), ts, tableId]
    );
    set((s) => ({
      tables: s.tables.map((t) =>
        t.id === tableId ? { ...t, schema, updatedAt: ts } : t
      ),
    }));
  },

  deleteColumn: async (tableId, colId) => {
    const table = get().tables.find((t) => t.id === tableId);
    if (!table) return;
    const schema = table.schema.filter((c) => c.id !== colId).map((c, i) => ({ ...c, order: i }));
    const ts = now();
    await db.execute(
      `UPDATE db_tables SET schema_json=?, updated_at=? WHERE id=?`,
      [JSON.stringify(schema), ts, tableId]
    );
    set((s) => ({
      tables: s.tables.map((t) =>
        t.id === tableId ? { ...t, schema, updatedAt: ts } : t
      ),
    }));
  },

  // ── Views ─────────────────────────────────────────────────

  loadViews: async (tableId) => {
    const rows = await db.select<Record<string, unknown>>(
      `SELECT * FROM db_views WHERE table_id=? ORDER BY created_at ASC`,
      [tableId]
    );
    set({ views: rows.map(viewFromDb) });
  },

  createView: async (tableId, name, type) => {
    const v: DatabaseView = {
      id: generateId(),
      tableId,
      name,
      type,
      columnOrder: [],
      hiddenColumns: [],
      createdAt: now(),
      updatedAt: now(),
    };
    await db.execute(
      `INSERT INTO db_views (id, table_id, name, type, column_order, hidden_columns, group_by_column_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [v.id, v.tableId, v.name, v.type, "[]", "[]", null, v.createdAt, v.updatedAt]
    );
    set((s) => ({ views: [...s.views, v] }));
    return v;
  },

  updateView: async (viewId, patch) => {
    const ts = now();
    const v = get().views.find((x) => x.id === viewId);
    if (!v) return;
    const updated = { ...v, ...patch, updatedAt: ts };
    await db.execute(
      `UPDATE db_views SET name=?, column_order=?, hidden_columns=?, group_by_column_id=?, updated_at=? WHERE id=?`,
      [
        updated.name,
        JSON.stringify(updated.columnOrder),
        JSON.stringify(updated.hiddenColumns),
        updated.groupByColumnId ?? null,
        ts,
        viewId,
      ]
    );
    set((s) => ({ views: s.views.map((x) => (x.id === viewId ? updated : x)) }));
  },

  deleteView: async (viewId) => {
    await db.execute(`DELETE FROM db_views WHERE id=?`, [viewId]);
    set((s) => ({
      views: s.views.filter((v) => v.id !== viewId),
      filters: Object.fromEntries(Object.entries(s.filters).filter(([k]) => k !== viewId)),
      sorts: Object.fromEntries(Object.entries(s.sorts).filter(([k]) => k !== viewId)),
      activeViewId: s.activeViewId === viewId ? null : s.activeViewId,
    }));
  },

  // ── Rows ──────────────────────────────────────────────────

  loadRows: async (tableId) => {
    const rows = await db.select<Record<string, unknown>>(
      `SELECT * FROM db_rows WHERE table_id=? ORDER BY row_order ASC`,
      [tableId]
    );
    set((s) => ({ rows: { ...s.rows, [tableId]: rows.map(rowFromDb) } }));
  },

  createRow: async (tableId) => {
    const existing = get().rows[tableId] ?? [];
    const order = existing.length;
    const r: DatabaseRow = {
      id: generateId(),
      tableId,
      cells: {},
      order,
      createdAt: now(),
      updatedAt: now(),
    };
    await db.execute(
      `INSERT INTO db_rows (id, table_id, cells_json, row_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [r.id, r.tableId, "{}", r.order, r.createdAt, r.updatedAt]
    );
    set((s) => ({ rows: { ...s.rows, [tableId]: [...(s.rows[tableId] ?? []), r] } }));
    bus.emit("database:row:created", { databaseId: tableId, rowId: r.id });
    return r;
  },

  updateCell: async (rowId, columnId, value) => {
    const ts = now();
    const tableId = Object.keys(get().rows).find((tid) =>
      get().rows[tid].some((r) => r.id === rowId)
    );
    if (!tableId) return;
    const tableRows = get().rows[tableId].map((r) => {
      if (r.id !== rowId) return r;
      const cells = { ...r.cells, [columnId]: value };
      return { ...r, cells, updatedAt: ts };
    });
    const row = tableRows.find((r) => r.id === rowId);
    if (!row) return;
    await db.execute(
      `UPDATE db_rows SET cells_json=?, updated_at=? WHERE id=?`,
      [JSON.stringify(row.cells), ts, rowId]
    );
    set((s) => ({ rows: { ...s.rows, [tableId]: tableRows } }));
  },

  deleteRow: async (rowId, tableId) => {
    await db.execute(`DELETE FROM db_rows WHERE id=?`, [rowId]);
    set((s) => ({
      rows: { ...s.rows, [tableId]: (s.rows[tableId] ?? []).filter((r) => r.id !== rowId) },
      openRowId: s.openRowId === rowId ? null : s.openRowId,
    }));
    bus.emit("database:row:deleted", { databaseId: tableId, rowId });
  },

  // ── Filters ───────────────────────────────────────────────

  loadFilters: async (viewId) => {
    const rows = await db.select<Record<string, unknown>>(
      `SELECT * FROM db_filters WHERE view_id=? ORDER BY filter_order ASC`,
      [viewId]
    );
    const filters: ViewFilter[] = rows.map((r) => ({
      id: r.id as ID,
      viewId: r.view_id as ID,
      columnId: r.column_id as ID,
      operator: r.operator as FilterOperator,
      value: (r.value as string) ?? undefined,
      filterOrder: r.filter_order as number,
    }));
    set((s) => ({ filters: { ...s.filters, [viewId]: filters } }));
  },

  addFilter: async (viewId, columnId, operator, value) => {
    const existing = get().filters[viewId] ?? [];
    const f: ViewFilter = { id: generateId(), viewId, columnId, operator, value, filterOrder: existing.length };
    await db.execute(
      `INSERT INTO db_filters (id, view_id, column_id, operator, value, filter_order) VALUES (?, ?, ?, ?, ?, ?)`,
      [f.id, f.viewId, f.columnId, f.operator, f.value ?? null, f.filterOrder]
    );
    set((s) => ({ filters: { ...s.filters, [viewId]: [...existing, f] } }));
  },

  removeFilter: async (filterId, viewId) => {
    await db.execute(`DELETE FROM db_filters WHERE id=?`, [filterId]);
    set((s) => ({
      filters: { ...s.filters, [viewId]: (s.filters[viewId] ?? []).filter((f) => f.id !== filterId) },
    }));
  },

  // ── Sorts ─────────────────────────────────────────────────

  loadSorts: async (viewId) => {
    const rows = await db.select<Record<string, unknown>>(
      `SELECT * FROM db_sorts WHERE view_id=? ORDER BY sort_order ASC`,
      [viewId]
    );
    const sorts: ViewSort[] = rows.map((r) => ({
      id: r.id as ID,
      viewId: r.view_id as ID,
      columnId: r.column_id as ID,
      direction: r.direction as "asc" | "desc",
      sortOrder: r.sort_order as number,
    }));
    set((s) => ({ sorts: { ...s.sorts, [viewId]: sorts } }));
  },

  addSort: async (viewId, columnId, direction) => {
    const existing = get().sorts[viewId] ?? [];
    const s: ViewSort = { id: generateId(), viewId, columnId, direction, sortOrder: existing.length };
    await db.execute(
      `INSERT INTO db_sorts (id, view_id, column_id, direction, sort_order) VALUES (?, ?, ?, ?, ?)`,
      [s.id, s.viewId, s.columnId, s.direction, s.sortOrder]
    );
    set((st) => ({ sorts: { ...st.sorts, [viewId]: [...existing, s] } }));
  },

  removeSort: async (sortId, viewId) => {
    await db.execute(`DELETE FROM db_sorts WHERE id=?`, [sortId]);
    set((s) => ({
      sorts: { ...s.sorts, [viewId]: (s.sorts[viewId] ?? []).filter((x) => x.id !== sortId) },
    }));
  },

  // ── UI ────────────────────────────────────────────────────

  setActiveTable: (tableId) => set({ activeTableId: tableId }),
  setActiveView: (viewId) => set({ activeViewId: viewId }),
  setOpenRow: (rowId) => set({ openRowId: rowId }),
}));
