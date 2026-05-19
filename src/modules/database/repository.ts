/**
 * repository.ts — Raw DB access only. Zero business logic.
 * All JSON serialisation/deserialisation happens here at the boundary.
 */
import { db } from '@/kernel/db';
import { nanoid } from '@/shared/utils/nanoid';
import { now } from '@/shared/utils/time';
import type {
  Database, DatabaseInsert,
  Column, ColumnInsert,
  Row, RowInsert,
  Cell, CellInsert,
  View, ViewInsert,
} from './types';

// ── helpers ───────────────────────────────────────────────────

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

function rowToDatabase(r: Record<string, unknown>): Database {
  return {
    id: r.id as string,
    name: r.name as string,
    description: (r.description as string) ?? null,
    icon: (r.icon as string) ?? null,
    cover: (r.cover as string) ?? null,
    is_archived: Boolean(r.is_archived),
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  };
}

function rowToColumn(r: Record<string, unknown>): Column {
  return {
    id: r.id as string,
    database_id: r.database_id as string,
    name: r.name as string,
    type: r.type as Column['type'],
    position: r.position as number,
    width: r.width as number,
    is_hidden: Boolean(r.is_hidden),
    options: parseJson(r.options as string, []),
    formula_expression: (r.formula_expression as string) ?? null,
    relation_target_db_id: (r.relation_target_db_id as string) ?? null,
    rollup_column_id: (r.rollup_column_id as string) ?? null,
    rollup_fn: (r.rollup_fn as Column['rollup_fn']) ?? null,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  };
}

function rowToRow(r: Record<string, unknown>): Row {
  return {
    id: r.id as string,
    database_id: r.database_id as string,
    position: r.position as number,
    is_archived: Boolean(r.is_archived),
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  };
}

function rowToCell(r: Record<string, unknown>): Cell {
  return {
    id: r.id as string,
    row_id: r.row_id as string,
    column_id: r.column_id as string,
    value: (r.value as string) ?? null,
    updated_at: r.updated_at as string,
  };
}

function rowToView(r: Record<string, unknown>): View {
  return {
    id: r.id as string,
    database_id: r.database_id as string,
    name: r.name as string,
    type: r.type as View['type'],
    position: r.position as number,
    filters: parseJson(r.filters as string, []),
    sorts: parseJson(r.sorts as string, []),
    hidden_columns: parseJson(r.hidden_columns as string, []),
    group_by_column_id: (r.group_by_column_id as string) ?? null,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
  };
}

// ── Database CRUD ─────────────────────────────────────────────

export async function listDatabases(): Promise<Database[]> {
  const rows = await db.query<Record<string, unknown>>(
    'SELECT * FROM databases WHERE is_archived = 0 ORDER BY updated_at DESC'
  );
  return rows.map(rowToDatabase);
}

export async function getDatabaseById(id: string): Promise<Database | null> {
  const rows = await db.query<Record<string, unknown>>(
    'SELECT * FROM databases WHERE id = $1',
    [id]
  );
  return rows[0] ? rowToDatabase(rows[0]) : null;
}

export async function insertDatabase(data: Omit<DatabaseInsert, 'id'>): Promise<Database> {
  const id = nanoid();
  const ts = now();
  await db.execute(
    `INSERT INTO databases (id, name, description, icon, cover, is_archived, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, data.name, data.description ?? null, data.icon ?? null, data.cover ?? null, 0, ts, ts]
  );
  return (await getDatabaseById(id))!;
}

export async function updateDatabase(id: string, patch: Partial<Omit<DatabaseInsert, 'id'>>): Promise<void> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;
  if (patch.name !== undefined)        { sets.push(`name = $${idx++}`);        vals.push(patch.name); }
  if (patch.description !== undefined) { sets.push(`description = $${idx++}`); vals.push(patch.description); }
  if (patch.icon !== undefined)        { sets.push(`icon = $${idx++}`);        vals.push(patch.icon); }
  if (patch.cover !== undefined)       { sets.push(`cover = $${idx++}`);       vals.push(patch.cover); }
  if (patch.is_archived !== undefined) { sets.push(`is_archived = $${idx++}`); vals.push(patch.is_archived ? 1 : 0); }
  if (sets.length === 0) return;
  sets.push(`updated_at = $${idx++}`);
  vals.push(now());
  vals.push(id);
  await db.execute(`UPDATE databases SET ${sets.join(', ')} WHERE id = $${idx}`, vals);
}

export async function deleteDatabase(id: string): Promise<void> {
  await db.execute('DELETE FROM databases WHERE id = $1', [id]);
}

// ── Column CRUD ───────────────────────────────────────────────

export async function listColumns(database_id: string): Promise<Column[]> {
  const rows = await db.query<Record<string, unknown>>(
    'SELECT * FROM db_columns WHERE database_id = $1 ORDER BY position',
    [database_id]
  );
  return rows.map(rowToColumn);
}

export async function insertColumn(data: Omit<ColumnInsert, 'id'>): Promise<Column> {
  const id = nanoid();
  const ts = now();
  await db.execute(
    `INSERT INTO db_columns
      (id, database_id, name, type, position, width, is_hidden, options,
       formula_expression, relation_target_db_id, rollup_column_id, rollup_fn, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [
      id, data.database_id, data.name, data.type, data.position, data.width ?? 180,
      data.is_hidden ? 1 : 0,
      JSON.stringify(data.options ?? []),
      data.formula_expression ?? null,
      data.relation_target_db_id ?? null,
      data.rollup_column_id ?? null,
      data.rollup_fn ?? null,
      ts, ts,
    ]
  );
  const rows = await db.query<Record<string, unknown>>('SELECT * FROM db_columns WHERE id = $1', [id]);
  return rowToColumn(rows[0]);
}

export async function updateColumn(id: string, patch: Partial<Omit<ColumnInsert, 'id' | 'database_id'>>): Promise<void> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;
  const fields: Array<[keyof typeof patch, string, (v: unknown) => unknown]> = [
    ['name', 'name', v => v],
    ['type', 'type', v => v],
    ['position', 'position', v => v],
    ['width', 'width', v => v],
    ['is_hidden', 'is_hidden', v => (v ? 1 : 0)],
    ['options', 'options', v => JSON.stringify(v)],
    ['formula_expression', 'formula_expression', v => v],
    ['relation_target_db_id', 'relation_target_db_id', v => v],
    ['rollup_column_id', 'rollup_column_id', v => v],
    ['rollup_fn', 'rollup_fn', v => v],
  ];
  for (const [key, col, transform] of fields) {
    if (patch[key] !== undefined) {
      sets.push(`${col} = $${idx++}`);
      vals.push(transform(patch[key]));
    }
  }
  if (sets.length === 0) return;
  sets.push(`updated_at = $${idx++}`);
  vals.push(now());
  vals.push(id);
  await db.execute(`UPDATE db_columns SET ${sets.join(', ')} WHERE id = $${idx}`, vals);
}

export async function deleteColumn(id: string): Promise<void> {
  await db.execute('DELETE FROM db_columns WHERE id = $1', [id]);
}

// ── Row CRUD ──────────────────────────────────────────────────

export async function listRows(database_id: string, includeArchived = false): Promise<Row[]> {
  const rows = await db.query<Record<string, unknown>>(
    `SELECT * FROM db_rows WHERE database_id = $1 ${includeArchived ? '' : 'AND is_archived = 0'} ORDER BY position`,
    [database_id]
  );
  return rows.map(rowToRow);
}

export async function getRowById(id: string): Promise<Row | null> {
  const rows = await db.query<Record<string, unknown>>('SELECT * FROM db_rows WHERE id = $1', [id]);
  return rows[0] ? rowToRow(rows[0]) : null;
}

export async function insertRow(data: Omit<RowInsert, 'id'>): Promise<Row> {
  const id = nanoid();
  const ts = now();
  await db.execute(
    `INSERT INTO db_rows (id, database_id, position, is_archived, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, data.database_id, data.position, data.is_archived ? 1 : 0, ts, ts]
  );
  return (await getRowById(id))!;
}

export async function updateRowPosition(id: string, position: number): Promise<void> {
  await db.execute(
    'UPDATE db_rows SET position = $1, updated_at = $2 WHERE id = $3',
    [position, now(), id]
  );
}

export async function archiveRow(id: string, archived: boolean): Promise<void> {
  await db.execute(
    'UPDATE db_rows SET is_archived = $1, updated_at = $2 WHERE id = $3',
    [archived ? 1 : 0, now(), id]
  );
}

export async function deleteRow(id: string): Promise<void> {
  await db.execute('DELETE FROM db_rows WHERE id = $1', [id]);
}

// ── Cell CRUD ─────────────────────────────────────────────────

export async function getCellsForRow(row_id: string): Promise<Cell[]> {
  const rows = await db.query<Record<string, unknown>>(
    'SELECT * FROM db_cells WHERE row_id = $1',
    [row_id]
  );
  return rows.map(rowToCell);
}

export async function getCellsForRows(row_ids: string[]): Promise<Cell[]> {
  if (row_ids.length === 0) return [];
  const placeholders = row_ids.map((_, i) => `$${i + 1}`).join(', ');
  const rows = await db.query<Record<string, unknown>>(
    `SELECT * FROM db_cells WHERE row_id IN (${placeholders})`,
    row_ids
  );
  return rows.map(rowToCell);
}

export async function upsertCell(data: CellInsert): Promise<void> {
  const ts = now();
  await db.execute(
    `INSERT INTO db_cells (id, row_id, column_id, value, updated_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT(row_id, column_id) DO UPDATE
       SET value = excluded.value, updated_at = excluded.updated_at`,
    [data.id ?? nanoid(), data.row_id, data.column_id, data.value ?? null, ts]
  );
}

export async function deleteCellsForColumn(column_id: string): Promise<void> {
  await db.execute('DELETE FROM db_cells WHERE column_id = $1', [column_id]);
}

// ── View CRUD ─────────────────────────────────────────────────

export async function listViews(database_id: string): Promise<View[]> {
  const rows = await db.query<Record<string, unknown>>(
    'SELECT * FROM db_views WHERE database_id = $1 ORDER BY position',
    [database_id]
  );
  return rows.map(rowToView);
}

export async function getViewById(id: string): Promise<View | null> {
  const rows = await db.query<Record<string, unknown>>('SELECT * FROM db_views WHERE id = $1', [id]);
  return rows[0] ? rowToView(rows[0]) : null;
}

export async function insertView(data: Omit<ViewInsert, 'id'>): Promise<View> {
  const id = nanoid();
  const ts = now();
  await db.execute(
    `INSERT INTO db_views
      (id, database_id, name, type, position, filters, sorts, hidden_columns, group_by_column_id, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      id, data.database_id, data.name, data.type, data.position,
      JSON.stringify(data.filters ?? []),
      JSON.stringify(data.sorts ?? []),
      JSON.stringify(data.hidden_columns ?? []),
      data.group_by_column_id ?? null,
      ts, ts,
    ]
  );
  return (await getViewById(id))!;
}

export async function updateView(id: string, patch: Partial<Omit<ViewInsert, 'id' | 'database_id'>>): Promise<void> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;
  if (patch.name !== undefined)               { sets.push(`name = $${idx++}`);               vals.push(patch.name); }
  if (patch.type !== undefined)               { sets.push(`type = $${idx++}`);               vals.push(patch.type); }
  if (patch.position !== undefined)           { sets.push(`position = $${idx++}`);           vals.push(patch.position); }
  if (patch.filters !== undefined)            { sets.push(`filters = $${idx++}`);            vals.push(JSON.stringify(patch.filters)); }
  if (patch.sorts !== undefined)              { sets.push(`sorts = $${idx++}`);              vals.push(JSON.stringify(patch.sorts)); }
  if (patch.hidden_columns !== undefined)     { sets.push(`hidden_columns = $${idx++}`);     vals.push(JSON.stringify(patch.hidden_columns)); }
  if (patch.group_by_column_id !== undefined) { sets.push(`group_by_column_id = $${idx++}`); vals.push(patch.group_by_column_id); }
  if (sets.length === 0) return;
  sets.push(`updated_at = $${idx++}`);
  vals.push(now());
  vals.push(id);
  await db.execute(`UPDATE db_views SET ${sets.join(', ')} WHERE id = $${idx}`, vals);
}

export async function deleteView(id: string): Promise<void> {
  await db.execute('DELETE FROM db_views WHERE id = $1', [id]);
}

// ── FTS search ────────────────────────────────────────────────

export async function searchRows(database_id: string, query: string): Promise<string[]> {
  // Returns matching row_ids
  const rows = await db.query<{ row_id: string }>(
    `SELECT DISTINCT row_id FROM db_fts
     WHERE database_id = $1 AND db_fts MATCH $2
     ORDER BY rank`,
    [database_id, `"${query.replace(/"/g, '')}"`]
  );
  return rows.map(r => r.row_id);
}
