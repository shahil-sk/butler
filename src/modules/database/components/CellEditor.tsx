// ============================================================
// DATABASE — Cell editor (per column type)
// ============================================================

import { useState, useRef, useEffect } from "react";
import type { DatabaseColumn } from "@/shared/types";

interface Props {
  column: DatabaseColumn;
  value: unknown;
  onChange: (value: unknown) => void;
}

function asStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

export function CellEditor({ column, value, onChange }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(asStr(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commit() {
    setEditing(false);
    if (draft === asStr(value)) return;
    if (column.type === "number") {
      onChange(draft === "" ? null : Number(draft));
    } else if (column.type === "boolean") {
      onChange(draft === "true");
    } else {
      onChange(draft === "" ? null : draft);
    }
  }

  // Boolean — checkbox
  if (column.type === "boolean") {
    return (
      <input
        type="checkbox"
        checked={!!value}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-primary cursor-pointer"
      />
    );
  }

  // Select — dropdown
  if (column.type === "select" || column.type === "multi_select") {
    const opts = column.options ?? [];
    const selected = column.type === "select" ? asStr(value) : (value as string[] | undefined) ?? [];
    if (column.type === "select") {
      return (
        <select
          value={asStr(selected)}
          onChange={(e) => onChange(e.target.value)}
          className="w-full text-xs bg-transparent border-none focus:outline-none cursor-pointer"
        >
          <option value="">—</option>
          {opts.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    // multi_select: comma-separated tags
    return (
      <div className="flex flex-wrap gap-1">
        {(selected as string[]).map((v) => (
          <span key={v} className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
            {v}
          </span>
        ))}
      </div>
    );
  }

  // Date
  if (column.type === "date") {
    return (
      <input
        type="date"
        value={asStr(value)}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full text-xs bg-transparent border-none focus:outline-none cursor-pointer"
      />
    );
  }

  // Default: inline text/number/url/email
  if (editing) {
    return (
      <input
        ref={inputRef}
        type={column.type === "number" ? "number" : "text"}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") commit(); }}
        className="w-full text-xs bg-surface-offset border border-primary rounded px-1.5 py-0.5 focus:outline-none"
      />
    );
  }

  return (
    <div
      onClick={() => { setDraft(asStr(value)); setEditing(true); }}
      className="min-h-[22px] px-1.5 py-0.5 text-xs cursor-text rounded hover:bg-surface-offset truncate"
    >
      {asStr(value) || <span className="text-muted-foreground/40">—</span>}
    </div>
  );
}
