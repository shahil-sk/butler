import { useMemo, useCallback } from "react";
import { useDatabaseStore } from "../store";
import type { DatabaseColumn, DatabaseRow, DatabaseFilter, DatabaseSort, FilterOperator } from "@/shared/types";
import { cn } from "@/shared/utils";

interface Props {
  tableId: string;
  viewId:  string;
}

// ─── Cell renderer ────────────────────────────────────────────────────────────
function CellDisplay({ value, type }: { value: unknown; type: string }) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground/40">—</span>;
  }
  if (type === "checkbox") {
    return (
      <span className={cn("inline-block w-4 h-4 rounded border", value ? "bg-primary border-primary" : "border-border")} />
    );
  }
  if (type === "select" || type === "multi_select") {
    const vals = Array.isArray(value) ? value : [value];
    return (
      <div className="flex flex-wrap gap-1">
        {vals.map((v, i) => (
          <span key={i} className="px-1.5 py-0.5 rounded text-xs bg-primary/10 text-primary">{String(v)}</span>
        ))}
      </div>
    );
  }
  return <span className="truncate text-sm">{String(value)}</span>;
}

// ─── Inline cell editor ───────────────────────────────────────────────────────
function CellEditor({
  value,
  column,
  onCommit,
}: {
  value:    unknown;
  column:   DatabaseColumn;
  onCommit: (v: unknown) => void;
}) {
  const raw = value === null || value === undefined ? "" : String(value);
  if (column.type === "checkbox") {
    return (
      <input
        type="checkbox"
        checked={!!value}
        onChange={(e) => onCommit(e.target.checked)}
        className="w-4 h-4"
      />
    );
  }
  return (
    <input
      autoFocus
      defaultValue={raw}
      onBlur={(e) => onCommit(e.target.value)}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
      className="w-full bg-transparent outline-none text-sm px-1"
    />
  );
}

// ─── Filter helpers ────────────────────────────────────────────────────────────
function matchFilter(value: unknown, operator: FilterOperator, filterValue: unknown): boolean {
  const str  = String(value ?? "").toLowerCase();
  const fStr = String(filterValue ?? "").toLowerCase();
  switch (operator) {
    case "equals":      return str === fStr;
    case "not_equals":  return str !== fStr;
    case "contains":    return str.includes(fStr);
    case "not_contains": return !str.includes(fStr);
    case "is_empty":    return str === "";
    case "is_not_empty": return str !== "";
    case "gt":  return Number(value) > Number(filterValue);
    case "lt":  return Number(value) < Number(filterValue);
    case "gte": return Number(value) >= Number(filterValue);
    case "lte": return Number(value) <= Number(filterValue);
    default:    return true;
  }
}

// ─── GridView ─────────────────────────────────────────────────────────────────
export function GridView({ tableId, viewId }: Props) {
  const columns    = useDatabaseStore((s) => s.columns[tableId] ?? []);
  const allRows    = useDatabaseStore((s) => s.rows[tableId]    ?? []);
  const cells      = useDatabaseStore((s) => s.cells[tableId]   ?? {});
  const filters    = useDatabaseStore((s) => s.filters[viewId]  ?? []);
  const sorts      = useDatabaseStore((s) => s.sorts[viewId]    ?? []);
  const { setCellValue, addRow, setOpenRow } = useDatabaseStore();

  // Apply filters
  const filtered = useMemo(() => {
    if (filters.length === 0) return allRows;
    return allRows.filter((row) =>
      filters.every((f) => {
        const val = cells[row.id]?.[f.columnId];
        return matchFilter(val, f.operator as FilterOperator, f.value);
      })
    );
  }, [allRows, cells, filters]);

  // Apply sorts
  const sorted = useMemo(() => {
    if (sorts.length === 0) return filtered;
    return [...filtered].sort((a, b) => {
      for (const s of sorts) {
        const av = String(cells[a.id]?.[s.columnId] ?? "");
        const bv = String(cells[b.id]?.[s.columnId] ?? "");
        const cmp = av.localeCompare(bv);
        if (cmp !== 0) return s.direction === "asc" ? cmp : -cmp;
      }
      return 0;
    });
  }, [filtered, cells, sorts]);

  const handleCommit = useCallback(
    async (row: DatabaseRow, col: DatabaseColumn, val: unknown) => {
      await setCellValue(tableId, row.id, col.id, val);
    },
    [tableId, setCellValue],
  );

  if (columns.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        No columns yet — add one to get started.
      </div>
    );
  }

  return (
    <div className="overflow-auto flex-1">
      <table className="min-w-full text-sm border-collapse">
        <thead>
          <tr className="bg-muted/40 border-b border-border">
            {columns.map((col) => (
              <th
                key={col.id}
                className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap border-r border-border last:border-r-0"
                style={{ minWidth: 140 }}
              >
                {col.name}
              </th>
            ))}
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={row.id}
              className="border-b border-border hover:bg-muted/20 group"
            >
              {columns.map((col, ci) => (
                <td
                  key={col.id}
                  className="px-3 py-1.5 border-r border-border last:border-r-0 align-middle"
                >
                  {ci === 0 ? (
                    <button
                      className="flex items-center gap-1.5 w-full text-left"
                      onClick={() => setOpenRow(row.id)}
                    >
                      <span className="truncate text-sm font-medium">
                        {String(cells[row.id]?.[col.id] ?? "Untitled")}
                      </span>
                      <span className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
                        Open
                      </span>
                    </button>
                  ) : (
                    <CellEditor
                      value={cells[row.id]?.[col.id]}
                      column={col}
                      onCommit={(v) => void handleCommit(row, col, v)}
                    />
                  )}
                </td>
              ))}
              <td className="w-8" />
            </tr>
          ))}
        </tbody>
      </table>
      <button
        onClick={() => void addRow(tableId)}
        className="w-full py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/20 border-b border-border transition-colors text-left px-3"
      >
        + New row
      </button>
    </div>
  );
}
