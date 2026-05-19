import { z } from 'zod';

// ── Column Types ──────────────────────────────────────────────
export const ColumnTypeSchema = z.enum([
  'text',
  'number',
  'checkbox',
  'select',
  'multi_select',
  'date',
  'relation',
  'formula',
  'rollup',
  'url',
  'email',
  'phone',
  'created_at',
  'updated_at',
]);
export type ColumnType = z.infer<typeof ColumnTypeSchema>;

// ── Select Option ─────────────────────────────────────────────
export const SelectOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  color: z.string(), // e.g. 'red', 'blue', css var name
});
export type SelectOption = z.infer<typeof SelectOptionSchema>;

// ── Column Definition ─────────────────────────────────────────
export const ColumnSchema = z.object({
  id: z.string(),
  database_id: z.string(),
  name: z.string().min(1).max(128),
  type: ColumnTypeSchema,
  position: z.number().int().nonnegative(),
  width: z.number().int().positive().default(180),
  is_hidden: z.boolean().default(false),
  options: z.array(SelectOptionSchema).default([]), // for select / multi_select
  formula_expression: z.string().nullable().default(null),
  relation_target_db_id: z.string().nullable().default(null), // for relation type
  rollup_column_id: z.string().nullable().default(null),
  rollup_fn: z.enum(['count', 'sum', 'avg', 'min', 'max']).nullable().default(null),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Column = z.infer<typeof ColumnSchema>;
export type ColumnInsert = Omit<Column, 'created_at' | 'updated_at'>;

// ── Database (the table entity itself) ───────────────────────
export const DatabaseSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(256),
  description: z.string().nullable().default(null),
  icon: z.string().nullable().default(null), // emoji or icon name
  cover: z.string().nullable().default(null), // url or color
  is_archived: z.boolean().default(false),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Database = z.infer<typeof DatabaseSchema>;
export type DatabaseInsert = Omit<Database, 'created_at' | 'updated_at'>;

// ── Row ───────────────────────────────────────────────────────
export const RowSchema = z.object({
  id: z.string(),
  database_id: z.string(),
  position: z.number().int().nonnegative(),
  is_archived: z.boolean().default(false),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Row = z.infer<typeof RowSchema>;
export type RowInsert = Omit<Row, 'created_at' | 'updated_at'>;

// ── Cell ─────────────────────────────────────────────────────
export const CellSchema = z.object({
  id: z.string(),
  row_id: z.string(),
  column_id: z.string(),
  // All values serialised as JSON strings; parse per column type at service layer
  value: z.string().nullable().default(null),
  updated_at: z.string(),
});
export type Cell = z.infer<typeof CellSchema>;
export type CellInsert = Omit<Cell, 'updated_at'>;

// ── View Types ────────────────────────────────────────────────
export const ViewTypeSchema = z.enum(['grid', 'kanban', 'gallery', 'list']);
export type ViewType = z.infer<typeof ViewTypeSchema>;

// ── Filter ────────────────────────────────────────────────────
export const FilterOperatorSchema = z.enum([
  'equals', 'not_equals',
  'contains', 'not_contains',
  'is_empty', 'is_not_empty',
  'gt', 'gte', 'lt', 'lte',
  'before', 'after',
  'is_checked', 'is_not_checked',
]);
export type FilterOperator = z.infer<typeof FilterOperatorSchema>;

export const FilterSchema = z.object({
  id: z.string(),
  column_id: z.string(),
  operator: FilterOperatorSchema,
  value: z.string().nullable().default(null),
});
export type Filter = z.infer<typeof FilterSchema>;

// ── Sort ─────────────────────────────────────────────────────
export const SortSchema = z.object({
  id: z.string(),
  column_id: z.string(),
  direction: z.enum(['asc', 'desc']),
});
export type Sort = z.infer<typeof SortSchema>;

// ── View ─────────────────────────────────────────────────────
export const ViewSchema = z.object({
  id: z.string(),
  database_id: z.string(),
  name: z.string().min(1).max(128),
  type: ViewTypeSchema,
  position: z.number().int().nonnegative(),
  filters: z.array(FilterSchema).default([]),
  sorts: z.array(SortSchema).default([]),
  hidden_columns: z.array(z.string()).default([]), // column ids
  group_by_column_id: z.string().nullable().default(null), // kanban grouping
  created_at: z.string(),
  updated_at: z.string(),
});
export type View = z.infer<typeof ViewSchema>;
export type ViewInsert = Omit<View, 'created_at' | 'updated_at'>;

// ── Derived: Row with cells map ───────────────────────────────
export type CellMap = Record<string, string | null>; // column_id → raw value

export interface RowWithCells {
  row: Row;
  cells: CellMap;
}

// ── Derived: Full database with columns + views ───────────────
export interface DatabaseDetail {
  database: Database;
  columns: Column[];
  views: View[];
}

// ── Events ────────────────────────────────────────────────────
export type DatabaseEvent =
  | { type: 'database:created'; payload: Database }
  | { type: 'database:updated'; payload: Database }
  | { type: 'database:deleted'; payload: { id: string } }
  | { type: 'database:row:created'; payload: { database_id: string; row: Row } }
  | { type: 'database:row:deleted'; payload: { database_id: string; row_id: string } }
  | { type: 'database:cell:updated'; payload: { row_id: string; column_id: string; value: string | null } };
