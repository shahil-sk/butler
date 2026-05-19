/**
 * store.ts — Zustand slice for database module.
 * UI state only. Derived/server state lives in TanStack Query (see hooks).
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { Database, View, Column } from './types';

interface DatabaseUIState {
  // Which database is open
  activeDatabaseId: string | null;
  // Which view is active per database
  activeViewIds: Record<string, string>;
  // Inline editing
  editingCellKey: string | null; // `${row_id}:${column_id}`
  // Column being resized
  resizingColumnId: string | null;
  // Row detail panel
  openRowId: string | null;
  // Search
  searchQuery: string;
  // Filter / sort panel
  filterPanelOpen: boolean;
  sortPanelOpen: boolean;
  // Column config panel
  columnConfigId: string | null;
}

interface DatabaseUIActions {
  setActiveDatabaseId(id: string | null): void;
  setActiveViewId(database_id: string, view_id: string): void;
  setEditingCell(key: string | null): void;
  setResizingColumn(id: string | null): void;
  setOpenRowId(id: string | null): void;
  setSearchQuery(q: string): void;
  toggleFilterPanel(): void;
  toggleSortPanel(): void;
  setColumnConfigId(id: string | null): void;
}

export type DatabaseStore = DatabaseUIState & DatabaseUIActions;

export const useDatabaseStore = create<DatabaseStore>()(
  immer((set) => ({
    // ── State ──────────────────────────────────────────────
    activeDatabaseId: null,
    activeViewIds: {},
    editingCellKey: null,
    resizingColumnId: null,
    openRowId: null,
    searchQuery: '',
    filterPanelOpen: false,
    sortPanelOpen: false,
    columnConfigId: null,

    // ── Actions ────────────────────────────────────────────
    setActiveDatabaseId(id) {
      set(s => { s.activeDatabaseId = id; s.searchQuery = ''; });
    },

    setActiveViewId(database_id, view_id) {
      set(s => { s.activeViewIds[database_id] = view_id; });
    },

    setEditingCell(key) {
      set(s => { s.editingCellKey = key; });
    },

    setResizingColumn(id) {
      set(s => { s.resizingColumnId = id; });
    },

    setOpenRowId(id) {
      set(s => { s.openRowId = id; });
    },

    setSearchQuery(q) {
      set(s => { s.searchQuery = q; });
    },

    toggleFilterPanel() {
      set(s => { s.filterPanelOpen = !s.filterPanelOpen; s.sortPanelOpen = false; });
    },

    toggleSortPanel() {
      set(s => { s.sortPanelOpen = !s.sortPanelOpen; s.filterPanelOpen = false; });
    },

    setColumnConfigId(id) {
      set(s => { s.columnConfigId = id; });
    },
  }))
);
