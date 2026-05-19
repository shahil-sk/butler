// ============================================================
// DATABASE — Table view (grid + kanban switcher)
// ============================================================

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Plus } from "lucide-react";
import { useDatabaseStore } from "../store";
import type { DatabaseView } from "../store";
import { ViewSwitcher, PageHeader, GhostButton, PrimaryButton } from "@/shared/ui";
import { GridView } from "./GridView";
import { KanbanView } from "./KanbanView";
import { FilterSortBar } from "./FilterSortBar";
import { RowDetailPanel } from "./RowDetailPanel";

export function TableView() {
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();
  const {
    tables, views, rows, activeViewId,
    loadViews, loadRows, createView, createRow,
    setActiveView, setActiveTable,
  } = useDatabaseStore((s) => ({
    tables: s.tables,
    views: s.views,
    rows: s.rows,
    activeViewId: s.activeViewId,
    loadViews: s.loadViews,
    loadRows: s.loadRows,
    createView: s.createView,
    createRow: s.createRow,
    setActiveView: s.setActiveView,
    setActiveTable: s.setActiveTable,
  }));

  const table = tables.find((t) => t.id === tableId);
  const tableViews = views.filter((v) => v.tableId === tableId);
  const activeView: DatabaseView | undefined =
    tableViews.find((v) => v.id === activeViewId) ?? tableViews[0];
  const tableRows = tableId ? (rows[tableId] ?? []) : [];

  useEffect(() => {
    if (!tableId) return;
    setActiveTable(tableId);
    void loadViews(tableId);
    void loadRows(tableId);
    return () => setActiveTable(null);
  }, [tableId, loadViews, loadRows, setActiveTable]);

  useEffect(() => {
    if (tableViews.length > 0 && !activeViewId) {
      setActiveView(tableViews[0].id);
    }
  }, [tableViews, activeViewId, setActiveView]);

  async function handleNewView(type: "grid" | "kanban") {
    if (!tableId) return;
    const v = await createView(tableId, type === "grid" ? "Grid" : "Kanban", type);
    setActiveView(v.id);
  }

  if (!table) {
    return <div className="p-4 text-sm text-muted-foreground">Table not found.</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title={table.name}
        left={
          <GhostButton onClick={() => navigate("/database")}>
            <ChevronLeft size={14} />
          </GhostButton>
        }
        right={
          <PrimaryButton onClick={() => void createRow(table.id)}>
            <Plus size={14} className="mr-1" /> New Row
          </PrimaryButton>
        }
      />

      {/* View tabs */}
      <div className="flex items-center gap-1 px-4 border-b border-border overflow-x-auto">
        {tableViews.map((v) => (
          <button
            key={v.id}
            onClick={() => setActiveView(v.id)}
            className={`text-xs px-3 py-2 border-b-2 transition-colors whitespace-nowrap ${
              v.id === activeView?.id
                ? "border-primary text-primary font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {v.name}
          </button>
        ))}
        <button
          onClick={() => void handleNewView("grid")}
          className="text-xs px-2 py-2 text-muted-foreground hover:text-foreground"
          title="Add grid view"
        >
          + Grid
        </button>
        <button
          onClick={() => void handleNewView("kanban")}
          className="text-xs px-2 py-2 text-muted-foreground hover:text-foreground"
          title="Add kanban view"
        >
          + Kanban
        </button>
      </div>

      {/* Filter / sort bar */}
      {activeView && <FilterSortBar view={activeView} table={table} />}

      {/* View content */}
      <div className="flex-1 overflow-hidden">
        {activeView?.type === "kanban" ? (
          <KanbanView table={table} view={activeView} rows={tableRows} />
        ) : (
          <GridView table={table} view={activeView ?? null} rows={tableRows} />
        )}
      </div>

      {/* Row detail panel */}
      <RowDetailPanel table={table} />
    </div>
  );
}
