import { useState } from "react";
import { useDatabaseStore } from "../store";
import type { DatabaseViewType } from "@/shared/types";
import { cn } from "@/shared/utils";

interface Props {
  tableId: string;
}

const VIEW_ICONS: Record<DatabaseViewType, string> = {
  grid:   "⊞",
  kanban: "⠿",
};

export function ViewBar({ tableId }: Props) {
  const views         = useDatabaseStore((s) => s.views[tableId] ?? []);
  const activeViewId  = useDatabaseStore((s) => s.activeViewId);
  const { setActiveView, addView, deleteView } = useDatabaseStore();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<DatabaseViewType>("grid");

  const handleAdd = async () => {
    if (!newName.trim()) return;
    const id = await addView({ tableId, name: newName.trim(), type: newType, position: views.length });
    setActiveView(id);
    setAdding(false);
    setNewName("");
    setNewType("grid");
  };

  return (
    <div className="flex items-center gap-1 px-4 border-b border-border overflow-x-auto shrink-0" style={{ minHeight: 40 }}>
      {views.map((v) => (
        <button
          key={v.id}
          onClick={() => setActiveView(v.id)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors whitespace-nowrap",
            activeViewId === v.id
              ? "bg-primary/10 text-primary font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
          )}
        >
          <span>{VIEW_ICONS[v.type]}</span>
          <span>{v.name}</span>
        </button>
      ))}

      {adding ? (
        <div className="flex items-center gap-1 ml-2">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="View name"
            onKeyDown={(e) => { if (e.key === "Enter") void handleAdd(); if (e.key === "Escape") setAdding(false); }}
            className="text-sm border border-border rounded px-2 py-0.5 bg-background w-28 focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as DatabaseViewType)}
            className="text-xs border border-border rounded px-1 py-0.5 bg-background"
          >
            <option value="grid">Grid</option>
            <option value="kanban">Kanban</option>
          </select>
          <button onClick={() => void handleAdd()} className="text-xs text-primary hover:underline">Add</button>
          <button onClick={() => setAdding(false)} className="text-xs text-muted-foreground hover:underline">Cancel</button>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted/30 ml-1 transition-colors whitespace-nowrap"
        >
          + Add view
        </button>
      )}
    </div>
  );
}
