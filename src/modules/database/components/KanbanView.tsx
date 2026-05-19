// ============================================================
// DATABASE — Kanban view (group by select column)
// ============================================================

import { useMemo } from "react";
import { Plus } from "lucide-react";
import { useDatabaseStore } from "../store";
import type { DatabaseView } from "../store";
import type { DatabaseTable, DatabaseRow, DatabaseColumn } from "@/shared/types";
import { CellEditor } from "./CellEditor";

interface Props {
  table: DatabaseTable;
  view: DatabaseView;
  rows: DatabaseRow[];
}

export function KanbanView({ table, view, rows }: Props) {
  const { createRow, updateCell, setOpenRow } = useDatabaseStore((s) => ({
    createRow: s.createRow,
    updateCell: s.updateCell,
    setOpenRow: s.setOpenRow,
  }));

  const groupCol: DatabaseColumn | undefined =
    view.groupByColumnId
      ? table.schema.find((c) => c.id === view.groupByColumnId)
      : table.schema.find((c) => c.type === "select");

  const groups = useMemo(() => {
    if (!groupCol) return [{ label: "All", rows }];
    const opts = groupCol.options ?? [];
    const buckets = new Map<string, DatabaseRow[]>(
      ["(none)", ...opts].map((o) => [o, []])
    );
    for (const row of rows) {
      const val = (row.cells[groupCol.id] as string) || "(none)";
      const key = buckets.has(val) ? val : "(none)";
      buckets.get(key)!.push(row);
    }
    return Array.from(buckets.entries()).map(([label, rows]) => ({ label, rows }));
  }, [groupCol, rows]);

  // Title column (first text col)
  const titleCol: DatabaseColumn | undefined =
    table.schema.find((c) => c.type === "text") ?? table.schema[0];

  return (
    <div className="flex gap-3 overflow-x-auto h-full p-4 items-start">
      {groups.map(({ label, rows: groupRows }) => (
        <div key={label} className="flex-shrink-0 w-60">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {label}
            </span>
            <span className="text-xs text-muted-foreground">{groupRows.length}</span>
          </div>

          <div className="flex flex-col gap-2">
            {groupRows.map((row) => (
              <div
                key={row.id}
                className="bg-surface border border-border rounded-lg p-3 cursor-pointer hover:bg-surface-2 transition-colors"
                onClick={() => setOpenRow(row.id)}
              >
                {titleCol && (
                  <p className="text-sm truncate">
                    {(row.cells[titleCol.id] as string) || (
                      <span className="text-muted-foreground">Untitled</span>
                    )}
                  </p>
                )}
                {table.schema.slice(0, 3).filter((c) => c.id !== titleCol?.id && c.id !== groupCol?.id).map((col) => (
                  <div key={col.id} className="mt-1">
                    <span className="text-xs text-muted-foreground">{col.name}: </span>
                    <span className="text-xs">{String(row.cells[col.id] ?? "")}</span>
                  </div>
                ))}
              </div>
            ))}

            <button
              onClick={async () => {
                const row = await createRow(table.id);
                if (groupCol) void updateCell(row.id, groupCol.id, label === "(none)" ? null : label);
              }}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 py-1"
            >
              <Plus size={12} /> Add row
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
