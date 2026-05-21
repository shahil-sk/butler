/**
 * ui/DatabaseToolbar.tsx — View tabs + filter/sort/search/add-column controls.
 * Pure UI.
 */
import React, { useState } from 'react';
import {
  Table2, LayoutKanban, LayoutList, Image,
  Filter, ArrowUpDown, Search, Plus, Eye,
} from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { useDatabaseStore } from '../store';
import { useDatabaseMutations } from './hooks/useDatabaseData';
import type { View, ViewType, Column, DatabaseDetail } from '../types';

const VIEW_ICONS: Record<ViewType, React.ElementType> = {
  grid:    Table2,
  kanban:  LayoutKanban,
  list:    LayoutList,
  gallery: Image,
};

interface DatabaseToolbarProps {
  detail: DatabaseDetail;
  activeView: View | null;
}

export function DatabaseToolbar({ detail, activeView }: DatabaseToolbarProps) {
  const { database, views, columns } = detail;
  const {
    setActiveViewId, toggleFilterPanel, toggleSortPanel,
    setSearchQuery, searchQuery, filterPanelOpen, sortPanelOpen,
  } = useDatabaseStore();
  const { addView, addColumn } = useDatabaseMutations();
  const [addingView, setAddingView] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColName, setNewColName] = useState('');

  const activeFilters = activeView?.filters.length ?? 0;
  const activeSorts = activeView?.sorts.length ?? 0;

  return (
    <div className="flex flex-col border-b border-border">
      {/* View tabs row */}
      <div className="flex items-center gap-0.5 px-4 pt-2 overflow-x-auto">
        {views.map(view => {
          const Icon = VIEW_ICONS[view.type];
          const isActive = view.id === activeView?.id;
          return (
            <button
              key={view.id}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-t text-sm transition-colors whitespace-nowrap',
                isActive
                  ? 'bg-background border border-b-background border-border text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              )}
              onClick={() => setActiveViewId(database.id, view.id)}
            >
              <Icon size={13} />
              {view.name}
            </button>
          );
        })}

        {/* Add view */}
        {addingView ? (
          <input
            autoFocus
            className="px-2 py-1 text-sm border border-border rounded bg-background outline-none w-32"
            placeholder="View name…"
            value={newViewName}
            onChange={e => setNewViewName(e.target.value)}
            onBlur={() => { setAddingView(false); setNewViewName(''); }}
            onKeyDown={e => {
              if (e.key === 'Enter' && newViewName.trim()) {
                addView.mutate({ db_id: database.id, name: newViewName.trim(), type: 'grid' });
                setAddingView(false); setNewViewName('');
              }
              if (e.key === 'Escape') { setAddingView(false); setNewViewName(''); }
            }}
          />
        ) : (
          <button
            className="flex items-center gap-1 px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded transition-colors"
            onClick={() => setAddingView(true)}
          >
            <Plus size={12} /> Add view
          </button>
        )}
      </div>

      {/* Action bar row */}
      <div className="flex items-center gap-1.5 px-4 py-1.5">
        {/* Search */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded border border-border/60 bg-background/50 text-sm text-muted-foreground focus-within:border-border focus-within:text-foreground transition-colors min-w-0 flex-1 max-w-xs">
          <Search size={13} />
          <input
            className="bg-transparent outline-none text-sm flex-1 min-w-0 placeholder:text-muted-foreground"
            placeholder="Search…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-1 ml-auto">
          {/* Filter */}
          <button
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded text-sm transition-colors',
              filterPanelOpen || activeFilters > 0
                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            )}
            onClick={toggleFilterPanel}
          >
            <Filter size={13} />
            Filter
            {activeFilters > 0 && (
              <span className="ml-0.5 text-xs bg-blue-500 text-white rounded-full w-4 h-4 flex items-center justify-center">
                {activeFilters}
              </span>
            )}
          </button>

          {/* Sort */}
          <button
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded text-sm transition-colors',
              sortPanelOpen || activeSorts > 0
                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            )}
            onClick={toggleSortPanel}
          >
            <ArrowUpDown size={13} />
            Sort
            {activeSorts > 0 && (
              <span className="ml-0.5 text-xs bg-blue-500 text-white rounded-full w-4 h-4 flex items-center justify-center">
                {activeSorts}
              </span>
            )}
          </button>

          {/* Add column */}
          {addingColumn ? (
            <input
              autoFocus
              className="px-2 py-1 text-sm border border-border rounded bg-background outline-none w-32"
              placeholder="Column name…"
              value={newColName}
              onChange={e => setNewColName(e.target.value)}
              onBlur={() => { setAddingColumn(false); setNewColName(''); }}
              onKeyDown={e => {
                if (e.key === 'Enter' && newColName.trim()) {
                  addColumn.mutate({ db_id: database.id, name: newColName.trim(), type: 'text' });
                  setAddingColumn(false); setNewColName('');
                }
                if (e.key === 'Escape') { setAddingColumn(false); setNewColName(''); }
              }}
            />
          ) : (
            <button
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              onClick={() => setAddingColumn(true)}
            >
              <Plus size={13} /> Column
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
