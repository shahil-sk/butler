// ============================================================
// DATABASE — Row detail side panel
// ============================================================

import { X } from "lucide-react";
import { useDatabaseStore } from "../store";
import type { DatabaseTable } from "@/shared/types";
import { CellEditor } from "./CellEditor";

interface Props {
  table: DatabaseTable;
}

export function RowDetailPanel({ table }: Props) {
  const { openRowId, rows, updateCell, deleteRow, setOpenRow } = useDatabaseStore((s) => ({
    openRowId: s.openRowId,
    rows: s.rows,
    updateCell: s.updateCell,
    deleteRow: s.deleteRow,
    setOpenRow: s.setOpenRow,
  }));

  if (!openRowId) return null;

  const row = (rows[table.id] ?? []).find((r) => r.id === openRowId);
  if (!row) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-80 bg-surface border-l border-border shadow-lg flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-sm font-medium">Row detail</span>
        <button
          onClick={() => setOpenRow(null)}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {table.schema.map((col) => (
          <div key={col.id}>
            <label className="text-xs text-muted-foreground block mb-1">{col.name}</label>
            <CellEditor
              column={col}
              value={row.cells[col.id]}
              onChange={(v) => void updateCell(row.id, col.id, v)}
            />
          </div>
        ))}
      </div>

      <div className="px-4 py-3 border-t border-border">
        <button
          onClick={() => { void deleteRow(row.id, table.id); setOpenRow(null); }}
          className="text-xs text-destructive hover:underline"
        >
          Delete row
        </button>
      </div>
    </div>
  );
}
