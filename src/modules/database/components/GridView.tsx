// ============================================================
// DATABASE — Grid view (spreadsheet-style)
// ============================================================

import { useRef } from "react";
import { Trash2 } from "lucide-react";
import { useDatabaseStore } from "../store";
import type { DatabaseView } from "../store";
import type { DatabaseTable, DatabaseRow, DatabaseColumn } from "@/shared/types";
import { CellEditor } from "./CellEditor";
import { cn } from "@/shared/utils";

interface Props {
  table: DatabaseTable;
  view: DatabaseView | null;
  rows: DatabaseRow[];
}

export function GridView({ table, view, rows }: Props) {
  const { updateCell, deleteRow, setOpenRow } = useDatabaseStore((s) => ({
    updateCell: s.updateCell,
    deleteRow: s.deleteRow,
    setOpenRow: s.setOpenRow,
  }));

  const hiddenSet = new Set(view?.hiddenColumns ?? []);
  const orderedCols: DatabaseColumn[] = view?.columnOrder.length
    ? (view.columnOrder
        .map((id) => table.schema.find((c) => c.id === id))
        .filter((c): c is DatabaseColumn => !!c && !hiddenSet.has(c.id)))
    : table.schema.filter((c) => !hiddenSet.has(c.id));

  if (table.schema.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">Add columns to get started.</p>
      </div>
    );
  }

  return (
    <div className="overflow-auto h-full">
      <table className="text-sm w-full border-collapse">
        <thead className="sticky top-0 z-10 bg-surface border-b border-border">
          <tr>
            <th className="w-8 px-2 py-2 text-left" />
            {orderedCols.map((col) => (
              <th
                key={col.id}
                className="px-3 py-2 text-left font-medium text-xs text-muted-foreground whitespace-nowrap border-r border-border last:border-r-0"
                style={{ minWidth: 140 }}
              >
                {col.name}
              </th>
            ))}
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="group border-b border-border hover:bg-surface-2 transition-colors"
            >
              <td
                className="px-2 py-1 text-xs text-muted-foreground cursor-pointer select-none"
                onClick={() => setOpenRow(row.id)}
              >
                ↗
              </td>
              {orderedCols.map((col) => (
                <td
                  key={col.id}
                  className="px-1 py-1 border-r border-border last:border-r-0"
                >
                  <CellEditor
                    column={col}
                    value={row.cells[col.id]}
                    onChange={(v) => void updateCell(row.id, col.id, v)}
                  />
                </td>
              ))}
              <td className="px-2 py-1">
                <button
                  onClick={() => void deleteRow(row.id, table.id)}
                  className={cn(
                    "opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  )}
                  aria-label="Delete row"
                >
                  <Trash2 size={13} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
