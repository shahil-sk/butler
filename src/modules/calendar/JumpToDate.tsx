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
      className="fixed inset-0 z-[110] flex items-start justify-center pt-32 backdrop-blur-sm"
      style={{ background: "oklch(0 0 0 / 0.4)" }}
      onClick={onClose}
    >
      <div
        className="w-[360px] rounded-3xl border border-border/50 bg-card/60 backdrop-blur-2xl shadow-2xl px-6 py-5 relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200px] h-[100px] bg-primary/20 blur-[50px] rounded-full pointer-events-none -z-10" />

        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-bold text-foreground tracking-wider uppercase">Jump to date</span>
          <button type="button" onClick={onClose} className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all">
            <X size={14} />
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
          className="w-full px-4 py-3 text-sm rounded-xl border border-border/50 bg-muted/30 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50 transition-all font-medium"
        />
        {error && <p className="mt-2 text-xs font-medium text-red-400">{error}</p>}
        <div className="flex justify-end mt-4">
          <button
            type="button"
            onClick={submit}
            className="px-6 py-2 text-xs font-bold uppercase tracking-wider rounded-full bg-primary text-primary-foreground hover:brightness-110 transition-all shadow-md shadow-primary/20"
          >
            Go
          </button>
        </div>
        <p className="mt-3 text-[10px] text-muted-foreground/50 text-center font-medium">Press <kbd className="px-1.5 py-0.5 rounded border border-border/50 bg-muted/20 text-[9px] mx-0.5">Esc</kbd> to close</p>
      </div>
    </div>
  );
}
