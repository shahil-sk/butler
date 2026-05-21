import { useRef } from "react";
import { useDatabaseStore } from "../store";
import type { DatabaseColumn } from "@/shared/types";
import { cn } from "@/shared/utils";

export function RowDetail() {
  const openRowId    = useDatabaseStore((s) => s.openRowId);
  const activeTableId = useDatabaseStore((s) => s.activeTableId);
  const { setOpenRow, setCellValue, deleteRow } = useDatabaseStore();

  const tableId  = activeTableId ?? "";
  const columns  = useDatabaseStore((s) => s.columns[tableId] ?? []);
  const cells    = useDatabaseStore((s) => s.cells[tableId]   ?? {});
  const row      = useDatabaseStore((s) => s.rows[tableId]?.find((r) => r.id === openRowId));

  if (!openRowId || !row) return null;

  const rowCells = cells[openRowId] ?? {};

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={() => setOpenRow(null)}
    >
      <div
        className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg p-6 flex flex-col gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">
            {String(rowCells[columns.find((c) => c.isPrimary)?.id ?? ""] ?? "Untitled")}
          </h2>
          <button
            onClick={() => setOpenRow(null)}
            className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Fields */}
        <div className="flex flex-col gap-4 overflow-y-auto max-h-[60vh]">
          {columns.map((col) => (
            <FieldRow
              key={col.id}
              column={col}
              value={rowCells[col.id]}
              onCommit={(v) => void setCellValue(tableId, openRowId, col.id, v)}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-2 border-t border-border">
          <span className="text-xs text-muted-foreground">Created {new Date(row.createdAt).toLocaleDateString()}</span>
          <button
            onClick={() => { void deleteRow(tableId, openRowId); }}
            className="text-xs text-destructive hover:underline"
          >
            Delete row
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldRow({
  column,
  value,
  onCommit,
}: {
  column:   DatabaseColumn;
  value:    unknown;
  onCommit: (v: unknown) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const renderInput = () => {
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
    if (column.type === "select") {
      const opts = column.options?.selectOptions ?? [];
      return (
        <select
          value={String(value ?? "")}
          onChange={(e) => onCommit(e.target.value)}
          className={cn(
            "w-full bg-muted/30 border border-border rounded-md px-2 py-1.5 text-sm",
            "focus:outline-none focus:ring-1 focus:ring-primary",
          )}
        >
          <option value="">—</option>
          {opts.map((o) => (
            <option key={o.id} value={o.label}>{o.label}</option>
          ))}
        </select>
      );
    }
    if (column.type === "number") {
      return (
        <input
          ref={inputRef}
          type="number"
          defaultValue={value !== undefined && value !== null ? Number(value) : ""}
          onBlur={(e) => onCommit(e.target.value === "" ? null : Number(e.target.value))}
          className={cn(
            "w-full bg-muted/30 border border-border rounded-md px-2 py-1.5 text-sm",
            "focus:outline-none focus:ring-1 focus:ring-primary",
          )}
        />
      );
    }
    return (
      <input
        ref={inputRef}
        type={column.type === "date" ? "date" : column.type === "email" ? "email" : column.type === "url" ? "url" : "text"}
        defaultValue={String(value ?? "")}
        onBlur={(e) => onCommit(e.target.value)}
        className={cn(
          "w-full bg-muted/30 border border-border rounded-md px-2 py-1.5 text-sm",
          "focus:outline-none focus:ring-1 focus:ring-primary",
        )}
      />
    );
  };

  return (
    <div className="flex items-start gap-3">
      <label className="w-32 shrink-0 text-sm text-muted-foreground pt-1.5 truncate">{column.name}</label>
      <div className="flex-1">{renderInput()}</div>
    </div>
  );
}
