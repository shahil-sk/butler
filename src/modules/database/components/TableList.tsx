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
    <aside className="w-52 shrink-0 border-r border-border flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tables</span>
        <button
          onClick={() => setCreating(true)}
          className="text-xs text-primary hover:underline"
          aria-label="New table"
        >
          + New
        </button>
      </div>

      {creating && (
        <div className="px-3 py-2 border-b border-border">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Table name"
            onKeyDown={(e) => { if (e.key === "Enter") void handleCreate(); if (e.key === "Escape") setCreating(false); }}
            className="w-full text-sm border border-border rounded px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      )}

      <nav className="flex-1 overflow-y-auto py-1">
        {tables.length === 0 && (
          <p className="text-xs text-muted-foreground px-4 py-3">No tables yet.</p>
        )}
        {tables.map((t) => (
          <div
            key={t.id}
            className={cn(
              "group flex items-center justify-between px-3 py-2 cursor-pointer text-sm rounded-md mx-1 transition-colors",
              activeTableId === t.id
                ? "bg-primary/10 text-primary font-medium"
                : "hover:bg-muted/40 text-foreground",
            )}
            onClick={() => setActiveTable(t.id)}
          >
            <span className="truncate flex items-center gap-1.5">
              {t.icon && <span>{t.icon}</span>}
              {t.name}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); void deleteTable(t.id); }}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive text-xs transition-opacity"
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
