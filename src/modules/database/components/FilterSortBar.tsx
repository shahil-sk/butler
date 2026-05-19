// ============================================================
// DATABASE — Filter + Sort toolbar
// ============================================================

import { useEffect, useState } from "react";
import { Filter, ArrowUpDown, X, Plus } from "lucide-react";
import { useDatabaseStore } from "../store";
import type { DatabaseView, FilterOperator } from "../store";
import type { DatabaseTable } from "@/shared/types";

const OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: "eq",           label: "=" },
  { value: "neq",          label: "≠" },
  { value: "contains",     label: "contains" },
  { value: "not_contains", label: "doesn't contain" },
  { value: "is_empty",     label: "is empty" },
  { value: "is_not_empty", label: "is not empty" },
  { value: "gt",           label: ">" },
  { value: "lt",           label: "<" },
];

interface Props {
  view: DatabaseView;
  table: DatabaseTable;
}

export function FilterSortBar({ view, table }: Props) {
  const {
    filters, sorts,
    loadFilters, addFilter, removeFilter,
    loadSorts, addSort, removeSort,
  } = useDatabaseStore((s) => ({
    filters: s.filters,
    sorts: s.sorts,
    loadFilters: s.loadFilters,
    addFilter: s.addFilter,
    removeFilter: s.removeFilter,
    loadSorts: s.loadSorts,
    addSort: s.addSort,
    removeSort: s.removeSort,
  }));

  const [showFilters, setShowFilters] = useState(false);
  const [showSorts, setShowSorts]     = useState(false);

  useEffect(() => {
    void loadFilters(view.id);
    void loadSorts(view.id);
  }, [view.id, loadFilters, loadSorts]);

  const viewFilters = filters[view.id] ?? [];
  const viewSorts   = sorts[view.id] ?? [];
  const firstCol    = table.schema[0];

  return (
    <div className="flex items-center gap-2 px-4 py-1.5 border-b border-border text-xs">
      {/* Filter toggle */}
      <button
        onClick={() => setShowFilters((v) => !v)}
        className={`flex items-center gap-1 px-2 py-1 rounded hover:bg-surface-offset transition-colors ${
          viewFilters.length > 0 ? "text-primary" : "text-muted-foreground"
        }`}
      >
        <Filter size={12} />
        Filter {viewFilters.length > 0 && `(${viewFilters.length})`}
      </button>

      {/* Sort toggle */}
      <button
        onClick={() => setShowSorts((v) => !v)}
        className={`flex items-center gap-1 px-2 py-1 rounded hover:bg-surface-offset transition-colors ${
          viewSorts.length > 0 ? "text-primary" : "text-muted-foreground"
        }`}
      >
        <ArrowUpDown size={12} />
        Sort {viewSorts.length > 0 && `(${viewSorts.length})`}
      </button>

      {/* Active filters */}
      {showFilters && (
        <div className="flex items-center gap-1 flex-wrap">
          {viewFilters.map((f) => {
            const col = table.schema.find((c) => c.id === f.columnId);
            return (
              <span key={f.id} className="flex items-center gap-1 bg-surface-offset rounded px-2 py-0.5">
                <span className="text-muted-foreground">{col?.name}</span>
                <span>{OPERATORS.find((o) => o.value === f.operator)?.label}</span>
                {f.value && <span className="font-medium">{f.value}</span>}
                <button onClick={() => void removeFilter(f.id, view.id)} aria-label="Remove filter">
                  <X size={10} />
                </button>
              </span>
            );
          })}
          {firstCol && (
            <button
              onClick={() => void addFilter(view.id, firstCol.id, "contains", "")}
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground px-1"
            >
              <Plus size={11} /> Add filter
            </button>
          )}
        </div>
      )}

      {/* Active sorts */}
      {showSorts && (
        <div className="flex items-center gap-1 flex-wrap">
          {viewSorts.map((s) => {
            const col = table.schema.find((c) => c.id === s.columnId);
            return (
              <span key={s.id} className="flex items-center gap-1 bg-surface-offset rounded px-2 py-0.5">
                <span className="text-muted-foreground">{col?.name}</span>
                <span>{s.direction === "asc" ? "↑" : "↓"}</span>
                <button onClick={() => void removeSort(s.id, view.id)} aria-label="Remove sort">
                  <X size={10} />
                </button>
              </span>
            );
          })}
          {firstCol && (
            <button
              onClick={() => void addSort(view.id, firstCol.id, "asc")}
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground px-1"
            >
              <Plus size={11} /> Add sort
            </button>
          )}
        </div>
      )}
    </div>
  );
}
