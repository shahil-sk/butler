import { useEffect, useState } from "react";
import { useDatabaseStore } from "../store";
import { cn } from "@/shared/utils";

export function TableList() {
  const { tables, loadTables, createTable, deleteTable, setActiveTable, activeTableId } =
    useDatabaseStore();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName]   = useState("");

  useEffect(() => { void loadTables(); }, [loadTables]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const id = await createTable({ name: newName.trim() });
    setActiveTable(id);
    setCreating(false);
    setNewName("");
  };

  return (
    <aside className="w-[180px] shrink-0 border-r border-border/40 bg-card/40 backdrop-blur-sm flex flex-col h-full py-4 px-2">
      <div className="flex items-center justify-between px-3 pb-3 border-b border-border/40 shrink-0 mb-2">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Tables</span>
        <button
          onClick={() => setCreating(true)}
          className="text-[11px] text-primary font-bold hover:underline"
          aria-label="New table"
        >
          + New
        </button>
      </div>

      {creating && (
        <div className="px-2 pb-2 shrink-0">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Table name"
            onKeyDown={(e) => { if (e.key === "Enter") void handleCreate(); if (e.key === "Escape") setCreating(false); }}
            className="w-full text-xs border border-border rounded-xl px-2 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>
      )}

      <nav className="flex-1 overflow-y-auto space-y-px">
        {tables.length === 0 && (
          <p className="text-xs text-muted-foreground px-3 py-3">No tables yet.</p>
        )}
        {tables.map((t) => (
          <div
            key={t.id}
            className={cn(
              "group flex items-center justify-between px-3 py-2 cursor-pointer text-xs rounded-xl transition-all duration-150 font-semibold",
              activeTableId === t.id
                ? "bg-primary/10 text-primary font-bold shadow-sm"
                : "hover:bg-accent/40 text-foreground",
            )}
            onClick={() => setActiveTable(t.id)}
          >
            <span className="truncate flex items-center gap-1.5">
              {t.icon && <span>{t.icon}</span>}
              {t.name}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); void deleteTable(t.id); }}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive text-[13px] font-bold transition-opacity"
              aria-label="Delete table"
            >
              ×
            </button>
          </div>
        ))}
      </nav>
    </aside>
  );
}
