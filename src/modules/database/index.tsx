import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { registry } from "@/kernel/router";
import { databaseManifest } from "./manifest";
import { setupDatabaseEventListeners } from "./events";
import { useDatabaseStore } from "./store";
import { TableList } from "./components/TableList";
import { ViewBar } from "./components/ViewBar";
import { GridView } from "./components/GridView";
import { KanbanView } from "./components/KanbanView";
import { RowDetail } from "./components/RowDetail";

// Register the module once (idempotent)
registry.register(databaseManifest);

// ─── Main layout ──────────────────────────────────────────────────────────────
function DatabaseLayout() {
  const { activeTableId, activeViewId, views, loadTable, setActiveView } = useDatabaseStore();

  useEffect(() => {
    const cleanup = setupDatabaseEventListeners();
    return cleanup;
  }, []);

  // When a table is selected, load its data
  useEffect(() => {
    if (!activeTableId) return;
    void loadTable(activeTableId).then(() => {
      const tableViews = useDatabaseStore.getState().views[activeTableId] ?? [];
      if (tableViews.length > 0 && !activeViewId) {
        setActiveView(tableViews[0].id);
      }
    });
  }, [activeTableId, loadTable, setActiveView, activeViewId]);

  const tableViews = activeTableId ? (views[activeTableId] ?? []) : [];
  const activeView = tableViews.find((v) => v.id === activeViewId) ?? tableViews[0] ?? null;

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Sidebar: table list */}
      <TableList />

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {!activeTableId ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Select or create a table to get started.
          </div>
        ) : (
          <>
            <ViewBar tableId={activeTableId} />
            <div className="flex-1 overflow-auto">
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
          </>
        )}
      </div>

      {/* Row detail modal */}
      <RowDetail />
    </div>
  );
}

export default function DatabaseModule() {
  return (
    <Routes>
      <Route path="/" element={<DatabaseLayout />} />
      <Route path="*" element={<Navigate to="/database" replace />} />
    </Routes>
  );
}
