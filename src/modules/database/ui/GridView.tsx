/**
 * ui/GridView.tsx — Notion-style spreadsheet grid.
 * Pure UI + hooks. Zero business logic.
 */
import React, { useCallback, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { useDatabaseStore } from '../store';
import { useDatabaseMutations } from './hooks/useDatabaseData';
import type { Column, RowWithCells, View } from '../types';
import { CellRenderer } from './CellRenderer';
import { ColumnHeader } from './ColumnHeader';

interface GridViewProps {
  db_id: string;
  view: View;
  columns: Column[];
  rows: RowWithCells[];
}

export function GridView({ db_id, view, columns, rows }: GridViewProps) {
  const { editingCellKey, setEditingCell, setOpenRowId } = useDatabaseStore();
  const { addRow, deleteRow, setCellValue } = useDatabaseMutations();
  const containerRef = useRef<HTMLDivElement>(null);

  const visibleColumns = columns.filter(c => !view.hidden_columns.includes(c.id));

  const handleCellClick = useCallback((row_id: string, col_id: string) => {
    setEditingCell(`${row_id}:${col_id}`);
  }, [setEditingCell]);

  const handleCellChange = useCallback((row_id: string, col_id: string, value: string | null) => {
    setCellValue.mutate({ row_id, column_id: col_id, value, db_id });
  }, [setCellValue, db_id]);

  const handleAddRow = useCallback(() => {
    addRow.mutate({ db_id });
  }, [addRow, db_id]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto"
      onMouseDown={e => {
        // Deselect cell if clicking outside any cell
        const target = e.target as HTMLElement;
        if (!target.closest('[data-cell]')) setEditingCell(null);
      }}
    >
      <table className="w-full border-collapse table-fixed text-sm">
        <colgroup>
          {/* Row number column */}
          <col style={{ width: 48 }} />
          {visibleColumns.map(c => (
            <col key={c.id} style={{ width: c.width }} />
          ))}
          {/* Add column button column */}
          <col style={{ width: 40 }} />
        </colgroup>

        <thead>
          <tr className="border-b border-border sticky top-0 z-10 bg-background">
            {/* Row number header */}
            <th className="h-9 px-2 text-left font-normal text-muted-foreground select-none" />
            {visibleColumns.map(col => (
              <ColumnHeader key={col.id} column={col} db_id={db_id} />
            ))}
            {/* Add column */}
            <th className="h-9 px-1">
              <button
                className="flex items-center justify-center w-6 h-6 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                onClick={() => {/* open add column popover — handled by parent toolbar */}}
                aria-label="Add column"
              >
                <Plus size={14} />
              </button>
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map(({ row, cells }, rowIndex) => (
            <tr
              key={row.id}
              className="group border-b border-border hover:bg-accent/30 transition-colors"
            >
              {/* Row number + expand */}
              <td className="h-9 px-2 text-xs text-muted-foreground select-none relative">
                <span className="group-hover:hidden">{rowIndex + 1}</span>
                <button
                  className="hidden group-hover:flex items-center justify-center absolute inset-0 text-muted-foreground hover:text-foreground"
                  onClick={() => setOpenRowId(row.id)}
                  aria-label="Open row detail"
                >
                  ↗
                </button>
              </td>

              {visibleColumns.map(col => {
                const cellKey = `${row.id}:${col.id}`;
                const isEditing = editingCellKey === cellKey;
                return (
                  <td
                    key={col.id}
                    data-cell
                    className={cn(
                      'h-9 px-2 border-r border-border/50 overflow-hidden',
                      'cursor-default',
                      isEditing && 'ring-2 ring-inset ring-blue-500/70'
                    )}
                    onClick={() => handleCellClick(row.id, col.id)}
                  >
                    <CellRenderer
                      column={col}
                      value={cells[col.id] ?? null}
                      isEditing={isEditing}
                      onChange={v => handleCellChange(row.id, col.id, v)}
                      onBlur={() => setEditingCell(null)}
                    />
                  </td>
                );
              })}

              {/* Delete row (visible on hover) */}
              <td className="h-9 px-1">
                <button
                  className="hidden group-hover:flex items-center justify-center w-6 h-6 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  onClick={() => deleteRow.mutate({ id: row.id, db_id })}
                  aria-label="Delete row"
                >
                  <Trash2 size={12} />
                </button>
              </td>
            </tr>
          ))}

          {/* Add row */}
          <tr>
            <td colSpan={visibleColumns.length + 2}>
              <button
                className="flex items-center gap-1.5 w-full h-9 px-3 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors"
                onClick={handleAddRow}
              >
                <Plus size={13} />
                <span>New row</span>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
