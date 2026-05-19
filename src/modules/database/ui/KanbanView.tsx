/**
 * ui/KanbanView.tsx — Kanban board grouped by a select column.
 * Pure UI.
 */
import React, { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { useDatabaseMutations } from './hooks/useDatabaseData';
import type { Column, RowWithCells, View, SelectOption } from '../types';
import { useDatabaseStore } from '../store';

interface KanbanViewProps {
  db_id: string;
  view: View;
  columns: Column[];
  rows: RowWithCells[];
}

export function KanbanView({ db_id, view, columns, rows }: KanbanViewProps) {
  const { setOpenRowId } = useDatabaseStore();
  const { addRow, setCellValue } = useDatabaseMutations();

  const groupColumn = columns.find(c => c.id === view.group_by_column_id);
  const nameColumn = columns[0]; // first column = "Name"

  // Build groups: one lane per option + one "No status" lane
  const groups = useMemo((): Array<{ option: SelectOption | null; rows: RowWithCells[] }> => {
    if (!groupColumn) return [{ option: null, rows }];

    const options = groupColumn.options;
    const grouped = new Map<string | null, RowWithCells[]>();
    grouped.set(null, []);
    for (const o of options) grouped.set(o.id, []);

    for (const rw of rows) {
      const val = rw.cells[groupColumn.id] ?? null;
      const key = val && grouped.has(val) ? val : null;
      grouped.get(key)!.push(rw);
    }

    return [
      { option: null, rows: grouped.get(null)! },
      ...options.map(o => ({ option: o, rows: grouped.get(o.id)! })),
    ];
  }, [groupColumn, rows]);

  const handleAddRowInGroup = async (optionId: string | null) => {
    const row = await addRow.mutateAsync({ db_id });
    if (optionId && groupColumn) {
      setCellValue.mutate({ row_id: row.id, column_id: groupColumn.id, value: optionId, db_id });
    }
  };

  return (
    <div className="flex gap-3 p-4 overflow-x-auto h-full">
      {groups.map(({ option, rows: groupRows }) => (
        <div
          key={option?.id ?? '__none__'}
          className="flex flex-col gap-2 min-w-[260px] max-w-[260px]"
        >
          {/* Lane header */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              {option ? (
                <span className={cn(
                  'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                  badgeColor(option.color)
                )}>
                  {option.label}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground font-medium">No status</span>
              )}
              <span className="text-xs text-muted-foreground">{groupRows.length}</span>
            </div>
            <button
              className="flex items-center justify-center w-5 h-5 rounded hover:bg-accent text-muted-foreground"
              onClick={() => handleAddRowInGroup(option?.id ?? null)}
              aria-label={`Add row to ${option?.label ?? 'No status'}`}
            >
              <Plus size={12} />
            </button>
          </div>

          {/* Cards */}
          <div className="flex flex-col gap-1.5 flex-1 overflow-y-auto">
            {groupRows.map(({ row, cells }) => (
              <div
                key={row.id}
                className={cn(
                  'bg-card border border-border rounded-lg px-3 py-2.5',
                  'hover:border-border/80 hover:shadow-sm transition-all cursor-pointer',
                  'active:scale-[0.99]'
                )}
                onClick={() => setOpenRowId(row.id)}
              >
                <p className="text-sm font-medium text-foreground leading-snug line-clamp-2">
                  {nameColumn ? (cells[nameColumn.id] ?? '') : ''}
                  {(!nameColumn || !cells[nameColumn.id]) && (
                    <span className="text-muted-foreground italic">Untitled</span>
                  )}
                </p>
                {/* Show non-name, non-group columns as metadata */}
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {columns
                    .filter(c => c.id !== nameColumn?.id && c.id !== groupColumn?.id && cells[c.id])
                    .slice(0, 3)
                    .map(c => (
                      <span key={c.id} className="text-xs text-muted-foreground truncate max-w-[100px]">
                        {cells[c.id]}
                      </span>
                    ))}
                </div>
              </div>
            ))}
          </div>

          {/* Add card button */}
          <button
            className="flex items-center gap-1.5 px-2 py-1.5 rounded text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            onClick={() => handleAddRowInGroup(option?.id ?? null)}
          >
            <Plus size={12} /> Add card
          </button>
        </div>
      ))}
    </div>
  );
}

function badgeColor(color: string): string {
  const map: Record<string, string> = {
    red:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    green:  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    blue:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    gray:   'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  };
  return map[color] ?? map.gray;
}
