/**
 * ui/hooks/useDatabaseData.ts
 * TanStack Query hooks — data fetching layer between service and UI components.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as svc from '../../service';
import { useDatabaseStore } from '../../store';
import type { Filter, Sort, SelectOption, ColumnType, ViewType } from '../../types';

// ── Query keys ────────────────────────────────────────────────
export const dbKeys = {
  all:        () => ['databases'] as const,
  detail:     (id: string) => ['databases', id] as const,
  rows:       (db_id: string, view_id: string) => ['databases', db_id, 'rows', view_id] as const,
  search:     (db_id: string, q: string) => ['databases', db_id, 'search', q] as const,
};

// ── Database list ─────────────────────────────────────────────
export function useDatabases() {
  return useQuery({
    queryKey: dbKeys.all(),
    queryFn: () => svc.listDatabases(),
  });
}

// ── Database detail (columns + views) ─────────────────────────
export function useDatabaseDetail(id: string | null) {
  return useQuery({
    queryKey: dbKeys.detail(id ?? ''),
    queryFn: () => svc.getDatabaseDetail(id!),
    enabled: !!id,
  });
}

// ── Rows with cells for a view ────────────────────────────────
export function useRowsWithCells(db_id: string | null, view_id: string | null) {
  const { data: detail } = useDatabaseDetail(db_id);
  const view = detail?.views.find(v => v.id === view_id);
  const columns = detail?.columns ?? [];

  return useQuery({
    queryKey: dbKeys.rows(db_id ?? '', view_id ?? ''),
    queryFn: () => svc.getRowsWithCells(db_id!, view!, columns),
    enabled: !!db_id && !!view,
  });
}

// ── Search ────────────────────────────────────────────────────
export function useDatabaseSearch(db_id: string | null, query: string) {
  return useQuery({
    queryKey: dbKeys.search(db_id ?? '', query),
    queryFn: () => svc.searchInDatabase(db_id!, query),
    enabled: !!db_id && query.trim().length > 0,
    staleTime: 0,
  });
}

// ── Mutations ─────────────────────────────────────────────────
export function useDatabaseMutations() {
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: dbKeys.all() });
  const invDetail = (id: string) => qc.invalidateQueries({ queryKey: dbKeys.detail(id) });

  const createDatabase = useMutation({
    mutationFn: ({ name, icon }: { name: string; icon?: string }) =>
      svc.createDatabase(name, icon),
    onSuccess: inv,
  });

  const renameDatabase = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      svc.renameDatabase(id, name),
    onSuccess: (_, { id }) => { inv(); invDetail(id); },
  });

  const archiveDatabase = useMutation({
    mutationFn: (id: string) => svc.archiveDatabase(id),
    onSuccess: inv,
  });

  const addColumn = useMutation({
    mutationFn: ({ db_id, name, type, options }: {
      db_id: string; name: string; type: ColumnType; options?: SelectOption[];
    }) => svc.addColumn(db_id, name, type, options),
    onSuccess: (_, { db_id }) => invDetail(db_id),
  });

  const renameColumn = useMutation({
    mutationFn: ({ id, db_id, name }: { id: string; db_id: string; name: string }) =>
      svc.renameColumn(id, name),
    onSuccess: (_, { db_id }) => invDetail(db_id),
  });

  const removeColumn = useMutation({
    mutationFn: ({ id, db_id }: { id: string; db_id: string }) =>
      svc.removeColumn(id),
    onSuccess: (_, { db_id }) => invDetail(db_id),
  });

  const updateColumnOptions = useMutation({
    mutationFn: ({ id, db_id, options }: { id: string; db_id: string; options: SelectOption[] }) =>
      svc.updateColumnOptions(id, options),
    onSuccess: (_, { db_id }) => invDetail(db_id),
  });

  const addRow = useMutation({
    mutationFn: ({ db_id }: { db_id: string }) => svc.addRow(db_id),
    onSuccess: (_, { db_id }) =>
      qc.invalidateQueries({ queryKey: ['databases', db_id] }),
  });

  const deleteRow = useMutation({
    mutationFn: ({ id, db_id }: { id: string; db_id: string }) =>
      svc.deleteRow(id, db_id),
    onSuccess: (_, { db_id }) =>
      qc.invalidateQueries({ queryKey: ['databases', db_id] }),
  });

  const setCellValue = useMutation({
    mutationFn: ({ row_id, column_id, value, db_id }: {
      row_id: string; column_id: string; value: string | null; db_id: string;
    }) => svc.setCellValue(row_id, column_id, value),
    onSuccess: (_, { db_id }) =>
      qc.invalidateQueries({ queryKey: ['databases', db_id] }),
  });

  const addView = useMutation({
    mutationFn: ({ db_id, name, type }: { db_id: string; name: string; type: ViewType }) =>
      svc.addView(db_id, name, type),
    onSuccess: (_, { db_id }) => invDetail(db_id),
  });

  const deleteView = useMutation({
    mutationFn: ({ id, db_id }: { id: string; db_id: string }) =>
      svc.deleteView(id),
    onSuccess: (_, { db_id }) => invDetail(db_id),
  });

  const updateViewFilters = useMutation({
    mutationFn: ({ id, db_id, filters }: { id: string; db_id: string; filters: Filter[] }) =>
      svc.updateViewFilters(id, filters),
    onSuccess: (_, { db_id }) => invDetail(db_id),
  });

  const updateViewSorts = useMutation({
    mutationFn: ({ id, db_id, sorts }: { id: string; db_id: string; sorts: Sort[] }) =>
      svc.updateViewSorts(id, sorts),
    onSuccess: (_, { db_id }) => invDetail(db_id),
  });

  return {
    createDatabase, renameDatabase, archiveDatabase,
    addColumn, renameColumn, removeColumn, updateColumnOptions,
    addRow, deleteRow, setCellValue,
    addView, deleteView, updateViewFilters, updateViewSorts,
  };
}
