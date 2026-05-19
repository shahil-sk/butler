// ============================================================
// BUTLER — Database module entity types
// Kept in src/shared/types/ per module contract.
// ============================================================

export type DatabaseColumnType =
  | "text"
  | "number"
  | "select"
  | "multi_select"
  | "checkbox"
  | "date"
  | "url"
  | "email"
  | "relation";

export interface SelectOption {
  id:    string;
  label: string;
  color: string;
}

export interface DatabaseColumnOptions {
  selectOptions?:  SelectOption[];
  numberFormat?:   "integer" | "decimal" | "currency" | "percent";
  relationTableId?: string;
}

export interface DatabaseTable {
  id:          string;
  name:        string;
  icon?:       string;
  description?: string;
  createdAt:   string;
  updatedAt:   string;
}

export interface DatabaseColumn {
  id:        string;
  tableId:   string;
  name:      string;
  type:      DatabaseColumnType;
  options:   DatabaseColumnOptions;
  position:  number;
  isPrimary: boolean;
  createdAt: string;
}

export interface DatabaseRow {
  id:        string;
  tableId:   string;
  position:  number;
  cells:     Record<string, unknown>; // colId → value (in-memory convenience)
  createdAt: string;
  updatedAt: string;
}

export type DatabaseViewType = "grid" | "kanban";

export interface DatabaseView {
  id:        string;
  tableId:   string;
  name:      string;
  type:      DatabaseViewType;
  config:    Record<string, unknown>; // view-specific settings (kanban groupBy, hidden cols…)
  position:  number;
  createdAt: string;
}

export type FilterOperator =
  | "equals" | "not_equals"
  | "contains" | "not_contains"
  | "is_empty" | "is_not_empty"
  | "gt" | "lt" | "gte" | "lte";

export interface DatabaseFilter {
  id:       string;
  viewId:   string;
  columnId: string;
  operator: FilterOperator;
  value:    unknown;
  position: number;
}

export interface DatabaseSort {
  id:        string;
  viewId:    string;
  columnId:  string;
  direction: "asc" | "desc";
  position:  number;
}
