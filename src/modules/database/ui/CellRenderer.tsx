/**
 * ui/CellRenderer.tsx — Renders/edits a cell based on column type.
 * Pure UI. No service calls.
 */
import React, { useEffect, useRef } from 'react';
import { cn } from '@/shared/utils/cn';
import type { Column } from '../types';

interface CellRendererProps {
  column: Column;
  value: string | null;
  isEditing: boolean;
  onChange: (value: string | null) => void;
  onBlur: () => void;
}

export function CellRenderer({ column, value, isEditing, onChange, onBlur }: CellRendererProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  const display = value ?? '';

  switch (column.type) {
    case 'checkbox':
      return (
        <input
          type="checkbox"
          className="w-4 h-4 rounded border-border cursor-pointer accent-blue-500"
          checked={value === 'true'}
          onChange={e => onChange(e.target.checked ? 'true' : 'false')}
        />
      );

    case 'select': {
      const opt = column.options.find(o => o.id === value);
      if (!isEditing) {
        return opt ? (
          <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium', colorClass(opt.color))}>
            {opt.label}
          </span>
        ) : null;
      }
      return (
        <select
          className="w-full h-full bg-transparent text-sm outline-none"
          value={value ?? ''}
          onChange={e => onChange(e.target.value || null)}
          onBlur={onBlur}
          autoFocus
        >
          <option value="">—</option>
          {column.options.map(o => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      );
    }

    case 'multi_select': {
      const selectedIds = value ? (JSON.parse(value) as string[]) : [];
      const selectedOpts = selectedIds
        .map(id => column.options.find(o => o.id === id))
        .filter(Boolean) as typeof column.options;

      if (!isEditing) {
        return (
          <div className="flex gap-1 flex-wrap">
            {selectedOpts.map(o => (
              <span key={o.id} className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium', colorClass(o.color))}>
                {o.label}
              </span>
            ))}
          </div>
        );
      }
      return (
        <div className="flex flex-wrap gap-1">
          {column.options.map(o => {
            const active = selectedIds.includes(o.id);
            return (
              <button
                key={o.id}
                className={cn(
                  'px-1.5 py-0.5 rounded text-xs font-medium border transition-colors',
                  active ? colorClass(o.color) : 'border-border text-muted-foreground hover:border-foreground'
                )}
                onClick={() => {
                  const next = active
                    ? selectedIds.filter(id => id !== o.id)
                    : [...selectedIds, o.id];
                  onChange(next.length ? JSON.stringify(next) : null);
                }}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      );
    }

    case 'number':
      if (!isEditing) {
        return <span className="tabular-nums">{display}</span>;
      }
      return (
        <input
          ref={inputRef}
          type="number"
          className="w-full h-full bg-transparent text-sm outline-none tabular-nums"
          defaultValue={value ?? ''}
          onBlur={e => { onChange(e.target.value || null); onBlur(); }}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') { onChange((e.target as HTMLInputElement).value || null); onBlur(); } }}
        />
      );

    case 'date':
      if (!isEditing) {
        return <span className="text-muted-foreground">{display}</span>;
      }
      return (
        <input
          ref={inputRef}
          type="date"
          className="w-full h-full bg-transparent text-sm outline-none"
          defaultValue={value ?? ''}
          onBlur={e => { onChange(e.target.value || null); onBlur(); }}
        />
      );

    case 'url':
      if (!isEditing) {
        return value ? (
          <a href={value} target="_blank" rel="noopener noreferrer"
            className="text-blue-500 hover:underline truncate block max-w-full"
            onClick={e => e.stopPropagation()}
          >
            {value}
          </a>
        ) : null;
      }
      return (
        <input
          ref={inputRef}
          type="url"
          className="w-full h-full bg-transparent text-sm outline-none"
          defaultValue={value ?? ''}
          onBlur={e => { onChange(e.target.value || null); onBlur(); }}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') { onChange((e.target as HTMLInputElement).value || null); onBlur(); } }}
        />
      );

    case 'created_at':
    case 'updated_at':
      return <span className="text-xs text-muted-foreground">{display ? new Date(display).toLocaleDateString() : ''}</span>;

    // text, email, phone, formula, rollup, relation → text input/display
    default:
      if (!isEditing) {
        return <span className="truncate block">{display}</span>;
      }
      return (
        <input
          ref={inputRef}
          type="text"
          className="w-full h-full bg-transparent text-sm outline-none"
          defaultValue={value ?? ''}
          onBlur={e => { onChange(e.target.value || null); onBlur(); }}
          onKeyDown={e => { if (e.key === 'Enter') { onChange((e.target as HTMLInputElement).value || null); onBlur(); } if (e.key === 'Escape') onBlur(); }}
        />
      );
  }
}

// ── Color classes for select badges ──────────────────────────
function colorClass(color: string): string {
  const map: Record<string, string> = {
    red:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    green:  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    blue:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    pink:   'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
    gray:   'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  };
  return map[color] ?? map.gray;
}
