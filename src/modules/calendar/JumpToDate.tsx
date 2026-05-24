// ============================================================
// JUMP-TO-DATE — Cmd/Ctrl+G quick-date input
// Renders as an inline overlay above the calendar toolbar.
// ============================================================

import { useEffect, useRef, useState } from "react";
import { parse, isValid } from "date-fns";
import { X } from "lucide-react";
import { toISODate } from "@/shared/utils";
import { useCalendarStore } from "./store";

export function useJumpToDate() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "g") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return { open, setOpen };
}

export function JumpToDateOverlay({ onClose }: { onClose: () => void }) {
  const { setActiveDate, setView } = useCalendarStore();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 30);
  }, []);

  const tryParse = (raw: string): string | null => {
    // Attempt common formats: "May 24", "24 May 2026", "2026-05-24", "05/24/2026"
    const formats = [
      "yyyy-MM-dd",
      "MM/dd/yyyy",
      "dd/MM/yyyy",
      "MMMM d",
      "MMM d",
      "d MMMM yyyy",
      "d MMM yyyy",
    ];
    const ref = new Date();
    for (const fmt of formats) {
      const parsed = parse(raw.trim(), fmt, ref);
      if (isValid(parsed)) return toISODate(parsed);
    }
    return null;
  };

  const submit = () => {
    const date = tryParse(value);
    if (!date) {
      setError("Couldn't parse that date. Try \"2026-05-24\" or \"May 24\".");
      return;
    }
    setActiveDate(date);
    setView("day");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24"
      style={{ background: "oklch(0 0 0 / 0.35)" }}
      onClick={onClose}
    >
      <div
        className="w-[340px] rounded-xl border border-border bg-popover shadow-xl px-4 py-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-foreground">Jump to date</span>
          <button type="button" onClick={onClose} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-fast">
            <X size={12} />
          </button>
        </div>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(""); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") onClose();
          }}
          placeholder='e.g. "May 24" or "2026-05-24"'
          className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface-2 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
        />
        {error && <p className="mt-1.5 text-[11px] text-red-400">{error}</p>}
        <div className="flex justify-end mt-3">
          <button
            type="button"
            onClick={submit}
            className="px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-fast"
          >
            Go
          </button>
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground/50">Press <kbd className="px-1 py-0.5 rounded border border-border text-[9px]">Esc</kbd> to close</p>
      </div>
    </div>
  );
}
