import { useMemo } from "react";
import { useDatabaseStore } from "../store";
import type { SelectOption } from "@/shared/types";
import { cn } from "@/shared/utils";

interface Props {
  tableId: string;
  viewId:  string;
}

export function KanbanView({ tableId, viewId }: Props) {
  const columns     = useDatabaseStore((s) => s.columns[tableId] ?? []);
  const rows        = useDatabaseStore((s) => s.rows[tableId]    ?? []);
  const cells       = useDatabaseStore((s) => s.cells[tableId]   ?? {});
  const views       = useDatabaseStore((s) => s.views[tableId]   ?? []);
  const { setCellValue, addRow, setOpenRow } = useDatabaseStore();

  // Config: which column is the kanban groupBy?
  const view = views.find((v) => v.id === viewId);
  const groupByColId = (view?.config as Record<string, string>)?.groupBy;
  const groupByCol = columns.find((c) => c.id === groupByColId)
    ?? columns.find((c) => c.type === "select");

  const lanes: SelectOption[] = useMemo(() => {
    if (!groupByCol) return [];
    return (groupByCol.options?.selectOptions ?? []) as SelectOption[];
  }, [groupByCol]);

  const grouped = useMemo(() => {
    const map: Record<string, typeof rows> = { "__none__": [] };
    for (const lane of lanes) map[lane.label] = [];
    for (const row of rows) {
      const val = groupByCol ? String(cells[row.id]?.[groupByCol.id] ?? "") : "";
      const key = lanes.find((l) => l.label === val)?.label ?? "__none__";
      map[key].push(row);
    }
    return map;
  }, [rows, cells, groupByCol, lanes]);

  const primaryCol = columns.find((c) => c.isPrimary) ?? columns[0];

  if (!groupByCol) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        Kanban requires a <strong className="mx-1">Select</strong> column. Add one and set it as the group-by field in view settings.
      </div>
    );
  }

  const allLanes = [...lanes.map((l) => l.label), "__none__"];

  return (
    <div className="flex gap-3 p-4 overflow-x-auto h-full items-start">
      {allLanes.map((lane) => {
        const laneRows = grouped[lane] ?? [];
        const color    = lanes.find((l) => l.label === lane)?.color;
        return (
          <div
            key={lane}
            className="flex flex-col gap-2 min-w-[240px] max-w-[280px]"
          >
            {/* Lane header */}
            <div className="flex items-center justify-between mb-1">
              <span
                className={cn(
                  "text-xs font-semibold px-2 py-0.5 rounded-full",
                  color ? "" : "bg-muted text-muted-foreground",
                )}
                style={color ? { background: color + "22", color } : undefined}
              >
                {lane === "__none__" ? "No status" : lane}
              </span>
              <span className="text-xs text-muted-foreground">{laneRows.length}</span>
            </div>

            {/* Cards */}
            {laneRows.map((row) => (
              <button
                key={row.id}
                onClick={() => setOpenRow(row.id)}
                className="w-full text-left bg-card border border-border rounded-lg p-3 hover:shadow-md transition-shadow"
              >
                <p className="text-sm font-medium truncate">
                  {String(cells[row.id]?.[primaryCol?.id ?? ""] ?? "Untitled")}
                </p>
              </button>
            ))}

            {/* Add card */}
            <button
              onClick={async () => {
                const rowId = await addRow(tableId);
                if (groupByCol && lane !== "__none__") {
                  await setCellValue(tableId, rowId, groupByCol.id, lane);
                }
              }}
              className="w-full text-xs text-muted-foreground hover:text-foreground py-1.5 rounded-md hover:bg-muted/30 transition-colors text-center"
            >
              + Add card
            </button>
          </div>
        );
      })}
    </div>
  );
}
