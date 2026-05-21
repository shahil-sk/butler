/**
 * ui/ColumnHeader.tsx — Resizable, renameable column header with type icon.
 * Pure UI.
 */
import React, { useState, useRef, useCallback } from 'react';
import {
  Type, Hash, CheckSquare, ChevronDown, Calendar, Link,
  Mail, Phone, Zap, ArrowRight, MoreHorizontal,
} from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { useDatabaseStore } from '../store';
import { useDatabaseMutations } from './hooks/useDatabaseData';
import type { Column } from '../types';

interface ColumnHeaderProps {
  column: Column;
  db_id: string;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  text:         Type,
  number:       Hash,
  checkbox:     CheckSquare,
  select:       ChevronDown,
  multi_select: ChevronDown,
  date:         Calendar,
  url:          Link,
  email:        Mail,
  phone:        Phone,
  formula:      Zap,
  relation:     ArrowRight,
  rollup:       Hash,
  created_at:   Calendar,
  updated_at:   Calendar,
};

export function ColumnHeader({ column, db_id }: ColumnHeaderProps) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(column.name);
  const { setResizingColumn } = useDatabaseStore();
  const { renameColumn } = useDatabaseMutations();
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);
  const thRef = useRef<HTMLTableCellElement>(null);

  const Icon = TYPE_ICONS[column.type] ?? Type;

  const commitRename = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== column.name) {
      renameColumn.mutate({ id: column.id, db_id, name: trimmed });
    }
    setRenaming(false);
  }, [draft, column.id, column.name, db_id, renameColumn]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = column.width;
    setResizingColumn(column.id);

    const onMove = (mv: MouseEvent) => {
      const delta = mv.clientX - resizeStartX.current;
      const newWidth = Math.max(60, Math.min(resizeStartWidth.current + delta, 800));
      if (thRef.current) {
        thRef.current.style.width = `${newWidth}px`;
      }
    };

    const onUp = (mu: MouseEvent) => {
      const delta = mu.clientX - resizeStartX.current;
      const newWidth = Math.max(60, Math.min(resizeStartWidth.current + delta, 800));
      // Persist via mutation — imported lazily to avoid hook rules issues
      import('../service').then(svc => svc.updateColumnWidth(column.id, newWidth));
      setResizingColumn(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [column.id, column.width, setResizingColumn]);

  return (
    <th
      ref={thRef}
      className="h-9 px-2 text-left font-normal border-r border-border/50 group/header relative select-none"
      style={{ width: column.width }}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <Icon size={13} className="text-muted-foreground flex-shrink-0" />
        {renaming ? (
          <input
            autoFocus
            className="flex-1 bg-transparent outline-none text-sm min-w-0 border-b border-blue-500"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') { setDraft(column.name); setRenaming(false); }
            }}
          />
        ) : (
          <span
            className="flex-1 truncate text-sm text-foreground/80 cursor-pointer"
            onDoubleClick={() => { setDraft(column.name); setRenaming(true); }}
          >
            {column.name}
          </span>
        )}
        <button
          className="hidden group-hover/header:flex items-center justify-center w-5 h-5 rounded hover:bg-accent text-muted-foreground"
          onClick={() => { setDraft(column.name); setRenaming(true); }}
          aria-label="Rename column"
        >
          <MoreHorizontal size={12} />
        </button>
      </div>

      {/* Resize handle */}
      <div
        className={cn(
          'absolute right-0 top-0 h-full w-1 cursor-col-resize opacity-0 group-hover/header:opacity-100',
          'hover:bg-blue-500 transition-opacity'
        )}
        onMouseDown={handleResizeMouseDown}
      />
    </th>
  );
}
