import { useState, useEffect } from "react";
import { Plus, Database, LayoutGrid } from "lucide-react";
import { useDatabaseStore } from "@/modules/database/store";
import { GridView } from "@/modules/database/components/GridView";
import { KanbanView } from "@/modules/database/components/KanbanView";
import { ViewBar } from "@/modules/database/components/ViewBar";
import { RowDetail } from "@/modules/database/components/RowDetail";

export function ProjectDatabase({ projectId }: { projectId: string }) {
  const { tables, createTable, loadTables, activeTableId, setActiveTable, views, activeViewId, setActiveView } = useDatabaseStore();
  const projectTables = tables.filter(t => t.projectId === projectId);
  
  useEffect(() => {
    void loadTables();
  }, [loadTables]);
  
  // Auto-select first table if none selected or active is not in project
  useEffect(() => {
    if (projectTables.length > 0) {
      if (!activeTableId || !projectTables.find(t => t.id === activeTableId)) {
        setActiveTable(projectTables[0].id);
      }
    } else {
      setActiveTable(null);
    }
  }, [projectTables.length, activeTableId, setActiveTable]);

  const handleCreate = async () => {
    const name = prompt("Database name:");
    if (!name) return;
    const id = await createTable({ name, projectId });
    setActiveTable(id);
  };

  if (projectTables.length === 0) {
    return (
      <div className="p-10 text-center text-muted-foreground flex flex-col items-center">
        <Database size={40} className="mb-4 opacity-20" />
        <p className="text-sm mb-4">No databases in this project.</p>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-medium text-sm rounded-lg hover:bg-primary/90 transition-fast"
        >
          <Plus size={16} />
          Create Database
        </button>
      </div>
    );
  }

  const tableViews = activeTableId ? (views[activeTableId] ?? []) : [];
  const activeView = tableViews.find(v => v.id === activeViewId) ?? tableViews[0] ?? null;

  return (
    <div className="flex flex-col h-[600px] border-t border-border mt-2">
      <div className="flex items-center gap-2 p-2 border-b border-border overflow-x-auto">
        {projectTables.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTable(t.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-fast flex items-center gap-1.5 shrink-0 ${activeTableId === t.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}
          >
            <Database size={12} />
            {t.name}
          </button>
        ))}
        <button
          onClick={handleCreate}
          className="p-1.5 text-muted-foreground hover:bg-muted rounded-md transition-fast shrink-0"
          title="New Database"
        >
          <Plus size={14} />
        </button>
      </div>
      
      {activeTableId ? (
        <div className="flex-1 flex flex-col min-h-0 bg-background">
          <ViewBar tableId={activeTableId} />
          <div className="flex-1 overflow-auto bg-muted/5 relative">
            {!activeView ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                No views — add one from the bar above.
              </div>
            ) : activeView.type === "kanban" ? (
              <KanbanView tableId={activeTableId} viewId={activeView.id} />
            ) : (
              <GridView tableId={activeTableId} viewId={activeView.id} />
            )}
          </div>
        </div>
      ) : null}
      
      <RowDetail />
    </div>
  );
}
