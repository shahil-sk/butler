/**
 * service.ts — Business logic only. No direct DB calls.
 * All DB access via repository. All events via bus.
 */
import { nanoid } from '@/shared/utils/nanoid';
import { bus } from '@/kernel/event-bus';
import * as repo from './repository';
import type {
  Database, Column, Row, View,
  ColumnType, ViewType,
  Filter, Sort,
  RowWithCells, CellMap,
  DatabaseDetail,
  SelectOption,
} from './types';

// ── Database ──────────────────────────────────────────────────

export async function createDatabase(name: string, icon?: string): Promise<Database> {
  const db = await repo.insertDatabase({ name: name.trim(), icon: icon ?? null, description: null, cover: null, is_archived: false });
  // Auto-create a default "Name" text column + default Grid view
  await repo.insertColumn({
    database_id: db.id,
    name: 'Name',
    type: 'text',
    position: 0,
    width: 240,
    is_hidden: false,
    options: [],
    formula_expression: null,
    relation_target_db_id: null,
    rollup_column_id: null,
    rollup_fn: null,
  });
  await repo.insertView({
    database_id: db.id,
    name: 'Grid',
    type: 'grid',
    position: 0,
    filters: [],
    sorts: [],
    hidden_columns: [],
    group_by_column_id: null,
  });
  bus.emit('database:created', { database: db });
  bus.emit('search:index-invalidated', { entityType: 'database', id: db.id });
  return db;
}

export async function getDatabaseDetail(id: string): Promise<DatabaseDetail | null> {
  const database = await repo.getDatabaseById(id);
  if (!database) return null;
  const [columns, views] = await Promise.all([
    repo.listColumns(id),
    repo.listViews(id),
  ]);
  return { database, columns, views };
}

export async function renameDatabase(id: string, name: string): Promise<void> {
  await repo.updateDatabase(id, { name: name.trim() });
  const updated = await repo.getDatabaseById(id);
  if (updated) bus.emit('database:updated', { database: updated });
}

export async function archiveDatabase(id: string): Promise<void> {
  await repo.updateDatabase(id, { is_archived: true });
  bus.emit('database:deleted', { databaseId: id });
}

export async function listDatabases(): Promise<Database[]> {
  return repo.listDatabases();
}

// ── Column ────────────────────────────────────────────────────

export async function addColumn(
  database_id: string,
  name: string,
  type: ColumnType,
  options?: SelectOption[]
): Promise<Column> {
  const existing = await repo.listColumns(database_id);
  const position = existing.length;
  return repo.insertColumn({
    database_id,
    name: name.trim(),
    type,
    position,
    width: 180,
    is_hidden: false,
    options: options ?? [],
    formula_expression: null,
    relation_target_db_id: null,
    rollup_column_id: null,
    rollup_fn: null,
  });
}

export async function renameColumn(id: string, name: string): Promise<void> {
  await repo.updateColumn(id, { name: name.trim() });
}

export async function updateColumnWidth(id: string, width: number): Promise<void> {
  await repo.updateColumn(id, { width: Math.max(60, Math.min(width, 800)) });
}

export async function toggleColumnVisibility(id: string, hidden: boolean): Promise<void> {
  await repo.updateColumn(id, { is_hidden: hidden });
}

export async function updateColumnOptions(id: string, options: SelectOption[]): Promise<void> {
  await repo.updateColumn(id, { options });
}

export async function removeColumn(id: string): Promise<void> {
  await repo.deleteCellsForColumn(id);
  await repo.deleteColumn(id);
}

export async function reorderColumns(database_id: string, orderedIds: string[]): Promise<void> {
  await Promise.all(orderedIds.map((id, i) => repo.updateColumn(id, { position: i })));
}

// ── Row ───────────────────────────────────────────────────────

export async function addRow(database_id: string): Promise<Row> {
  const existing = await repo.listRows(database_id);
  const position = existing.length;
  const row = await repo.insertRow({ database_id, position, is_archived: false });
  bus.emit('database:row:created', { databaseId: database_id, rowId: row.id });
  bus.emit('search:index-invalidated', { entityType: 'database:row', id: row.id });
  return row;
}

export async function deleteRow(id: string, database_id: string): Promise<void> {
  await repo.deleteRow(id);
  bus.emit('database:row:deleted', { databaseId: database_id, rowId: id });
  bus.emit('search:index-invalidated', { entityType: 'database:row', id });
}

export async function archiveRow(id: string, archived: boolean): Promise<void> {
  await repo.archiveRow(id, archived);
}

export async function reorderRows(database_id: string, orderedIds: string[]): Promise<void> {
  await Promise.all(orderedIds.map((id, i) => repo.updateRowPosition(id, i)));
}

// ── Cell ──────────────────────────────────────────────────────

export async function setCellValue(
  row_id: string,
  column_id: string,
  value: string | null
): Promise<void> {
  await repo.upsertCell({ id: nanoid(), row_id, column_id, value });
  bus.emit('search:index-invalidated', { entityType: 'database:row', id: row_id });
}

// ── Rows with cells (for rendering) ──────────────────────────

export async function getRowsWithCells(
  database_id: string,
  view: View,
  columns: Column[]
): Promise<RowWithCells[]> {
  let rows = await repo.listRows(database_id);

  // Apply filters
  if (view.filters.length > 0) {
    const allCells = await repo.getCellsForRows(rows.map(r => r.id));
    const cellIndex = buildCellIndex(allCells);
    rows = applyFilters(rows, view.filters, cellIndex, columns);
  }

  // Apply sorts
  if (view.sorts.length > 0) {
    const allCells = await repo.getCellsForRows(rows.map(r => r.id));
    const cellIndex = buildCellIndex(allCells);
    rows = applySorts(rows, view.sorts, cellIndex, columns);
  }

  const cells = await repo.getCellsForRows(rows.map(r => r.id));
  const cellIndex = buildCellIndex(cells);

  return rows.map(row => ({
    row,
    cells: cellIndex[row.id] ?? {},
  }));
}

// ── View ──────────────────────────────────────────────────────

export async function addView(database_id: string, name: string, type: ViewType): Promise<View> {
  const existing = await repo.listViews(database_id);
  return repo.insertView({
    database_id, name: name.trim(), type,
    position: existing.length,
    filters: [], sorts: [], hidden_columns: [], group_by_column_id: null,
  });
}

export async function renameView(id: string, name: string): Promise<void> {
  await repo.updateView(id, { name: name.trim() });
}

export async function deleteView(id: string): Promise<void> {
  await repo.deleteView(id);
}

export async function updateViewFilters(id: string, filters: Filter[]): Promise<void> {
  await repo.updateView(id, { filters });
}

export async function updateViewSorts(id: string, sorts: Sort[]): Promise<void> {
  await repo.updateView(id, { sorts });
}

export async function updateViewHiddenColumns(id: string, hidden_columns: string[]): Promise<void> {
  await repo.updateView(id, { hidden_columns });
}

export async function setKanbanGroupBy(id: string, column_id: string | null): Promise<void> {
  await repo.updateView(id, { group_by_column_id: column_id });
}

// ── Search ───────────────────────────────────────────────────

export async function searchInDatabase(database_id: string, query: string): Promise<RowWithCells[]> {
  if (!query.trim()) return [];
  const matchingRowIds = await repo.searchRows(database_id, query.trim());
  if (matchingRowIds.length === 0) return [];
  const cells = await repo.getCellsForRows(matchingRowIds);
  const cellIndex = buildCellIndex(cells);
  const allRows = await repo.listRows(database_id);
  const rowMap = new Map(allRows.map(r => [r.id, r]));
  return matchingRowIds
    .map(id => rowMap.get(id))
    .filter((r): r is Row => !!r)
    .map(row => ({ row, cells: cellIndex[row.id] ?? {} }));
}

// ── Internal helpers ──────────────────────────────────────────

type CellIndex = Record<string, CellMap>; // row_id → column_id → value

function buildCellIndex(cells: Array<{ row_id: string; column_id: string; value: string | null }>): CellIndex {
  const idx: CellIndex = {};
  for (const c of cells) {
    if (!idx[c.row_id]) idx[c.row_id] = {};
    idx[c.row_id][c.column_id] = c.value;
  }
  return idx;
}

function getCellValue(cellIndex: CellIndex, row_id: string, column_id: string): string | null {
  return cellIndex[row_id]?.[column_id] ?? null;
}

function applyFilters(rows: Row[], filters: Filter[], cellIndex: CellIndex, columns: Column[]): Row[] {
  return rows.filter(row =>
    filters.every(f => {
      const raw = getCellValue(cellIndex, row.id, f.column_id);
      const v = raw ?? '';
      const fv = f.value ?? '';
      switch (f.operator) {
        case 'equals':         return v === fv;
        case 'not_equals':     return v !== fv;
        case 'contains':       return v.toLowerCase().includes(fv.toLowerCase());
        case 'not_contains':   return !v.toLowerCase().includes(fv.toLowerCase());
        case 'is_empty':       return !raw || raw === '';
        case 'is_not_empty':   return !!raw && raw !== '';
        case 'gt':             return parseFloat(v) > parseFloat(fv);
        case 'gte':            return parseFloat(v) >= parseFloat(fv);
        case 'lt':             return parseFloat(v) < parseFloat(fv);
        case 'lte':            return parseFloat(v) <= parseFloat(fv);
        case 'before':         return v < fv;
        case 'after':          return v > fv;
        case 'is_checked':     return v === 'true';
        case 'is_not_checked': return v !== 'true';
        default:               return true;
      }
    })
  );
}

function applySorts(rows: Row[], sorts: Sort[], cellIndex: CellIndex, _columns: Column[]): Row[] {
  return [...rows].sort((a, b) => {
    for (const s of sorts) {
      const av = getCellValue(cellIndex, a.id, s.column_id) ?? '';
      const bv = getCellValue(cellIndex, b.id, s.column_id) ?? '';
      const na = parseFloat(av), nb = parseFloat(bv);
      let cmp: number;
      if (!isNaN(na) && !isNaN(nb)) {
        cmp = na - nb;
      } else {
        cmp = av.localeCompare(bv);
      }
      if (cmp !== 0) return s.direction === 'asc' ? cmp : -cmp;
    }
    return a.position - b.position;
  });
}
