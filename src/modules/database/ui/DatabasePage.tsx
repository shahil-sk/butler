/**
 * ui/DatabasePage.tsx — Root UI for a single database.
 * Composes toolbar + active view. Pure UI.
 */
import React, { useEffect } from 'react';
import { useDatabaseStore } from '../store';
import { useDatabaseDetail, useRowsWithCells, useDatabaseSearch } from './hooks/useDatabaseData';
import { DatabaseToolbar } from './DatabaseToolbar';
import { GridView } from './GridView';
import { KanbanView } from './KanbanView';

interface DatabasePageProps {
  db_id: string;
}

export function DatabasePage({ db_id }: DatabasePageProps) {
  const { activeViewIds, setActiveViewId, searchQuery } = useDatabaseStore();
  const { data: detail, isLoading, isError } = useDatabaseDetail(db_id);

  // Auto-select first view
  const activeViewId = activeViewIds[db_id];
  useEffect(() => {
    if (detail && !activeViewId && detail.views.length > 0) {
      setActiveViewId(db_id, detail.views[0].id);
    }
  }, [detail, activeViewId, db_id, setActiveViewId]);

  const activeView = detail?.views.find(v => v.id === activeViewId) ?? null;

  const { data: rowsData = [], isLoading: rowsLoading } = useRowsWithCells(
    db_id,
    activeViewId ?? null
  );

  const { data: searchResults } = useDatabaseSearch(
    searchQuery.trim() ? db_id : null,
    searchQuery
  );

  const displayRows = searchQuery.trim() ? (searchResults ?? []) : rowsData;

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  if (isError || !detail) {
    return (
      <div className="flex-1 flex items-center justify-center text-destructive text-sm">
        Failed to load database.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <DatabaseToolbar detail={detail} activeView={activeView} />

      {rowsLoading ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          Loading rows…
        </div>
      ) : activeView?.type === 'kanban' ? (
        <KanbanView
          db_id={db_id}
          view={activeView}
          columns={detail.columns}
          rows={displayRows}
        />
      ) : (
        // grid | list | gallery all fallback to grid for now
        <GridView
          db_id={db_id}
          view={activeView!}
          columns={detail.columns}
          rows={displayRows}
        />
      )}
    </div>
  );
}
