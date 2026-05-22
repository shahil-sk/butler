// ============================================================
// PLANNER — PlanAdderModal
// Reminder-style quick-add for creating a named plan (time block)
// on any date. Similar UX to a reminder: title, date, time range,
// optional task link, color, notes.
// ============================================================

import { useState } from "react";
import { X, Clock, CalendarDays, Tag, AlignLeft, Link2 } from "lucide-react";
import { cn } from "@/shared/utils";
import { usePlannerStore } from "../store";
import { BLOCK_COLORS } from "../types";
import { useTaskStore } from "@/modules/tasks/store";

interface Props {
  defaultDate: string;   // ISO date "2024-01-15"
  defaultTime?: string;  // "09:00"
  onClose: () => void;
}

export function PlanAdderModal({ defaultDate, defaultTime = "09:00", onClose }: Props) {
  const { createBlock } = usePlannerStore();
  const tasks           = useTaskStore((s) => s.tasks);

  const [title,     setTitle]     = useState("");
  const [date,      setDate]      = useState(defaultDate);
  const [startTime, setStartTime] = useState(defaultTime);
  const [endTime,   setEndTime]   = useState(() => {
    const [h, m] = defaultTime.split(":").map(Number);
    const end    = h * 60 + m + 60;
    return `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
  });
  const [color,     setColor]     = useState<string>(BLOCK_COLORS[0]);
  const [isBreak,   setIsBreak]   = useState(false);
  const [notes,     setNotes]     = useState("");
  const [taskId,    setTaskId]    = useState("");
  const [saving,    setSaving]    = useState(false);
  const [showMore,  setShowMore]  = useState(false);

  const activeTasks = tasks.filter(
    (t) => t.status !== "done" && t.status !== "archived" && t.status !== "cancelled"
  );

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await createBlock({
        date,
        title:     title.trim(),
        startTime,
        endTime,
        color,
        isBreak,
        notes:     notes.trim() || undefined,
        taskId:    taskId || undefined,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[3px]" />

      {/* Sheet */}
      <div className="relative z-10 w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-card border border-border shadow-2xl flex flex-col animate-fade-in">

        {/* Handle (mobile) */}
        <div className="flex justify-center pt-2.5 pb-0 sm:hidden">
          <div className="w-9 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <CalendarDays size={14} className="text-primary" />
            <h3 className="text-sm font-semibold">Add Plan</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex flex-col gap-3 px-4 py-4">

          {/* Title */}
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) void handleSave();
              if (e.key === "Escape") onClose();
            }}
            placeholder="What are you planning? e.g. Deep Work, Review PR…"
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring/40"
          />

          {/* Date + Time row */}
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-background">
              <CalendarDays size={12} className="text-muted-foreground/50 shrink-0" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="flex-1 text-xs bg-transparent outline-none text-foreground"
              />
            </div>
          </div>

          {/* Time range */}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-background">
              <Clock size={12} className="text-muted-foreground/50 shrink-0" />
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="flex-1 text-xs bg-transparent outline-none text-foreground tabular-nums"
              />
            </div>
            <span className="text-xs text-muted-foreground/50">→</span>
            <div className="flex-1 flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-background">
              <Clock size={12} className="text-muted-foreground/50 shrink-0" />
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="flex-1 text-xs bg-transparent outline-none text-foreground tabular-nums"
              />
            </div>
          </div>

          {/* Color + Break toggle row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {BLOCK_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "w-5 h-5 rounded-full transition-all",
                    color === c ? "ring-2 ring-offset-1 ring-offset-card scale-110" : "opacity-60 hover:opacity-100"
                  )}
                  style={{ backgroundColor: c, outlineColor: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
            <button
              onClick={() => setIsBreak((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors",
                isBreak
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-600"
                  : "border-border text-muted-foreground hover:bg-accent"
              )}
            >
              ☕ Break
            </button>
          </div>

          {/* Toggle more options */}
          <button
            onClick={() => setShowMore((v) => !v)}
            className="text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors text-left"
          >
            {showMore ? "▲ Less options" : "▼ More options (task link, notes)"}
          </button>

          {showMore && (
            <div className="flex flex-col gap-3 animate-fade-in">

              {/* Link task */}
              {activeTasks.length > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-background">
                  <Link2 size={12} className="text-muted-foreground/50 shrink-0" />
                  <select
                    value={taskId}
                    onChange={(e) => setTaskId(e.target.value)}
                    className="flex-1 text-xs bg-transparent outline-none text-foreground"
                  >
                    <option value="">Link a task (optional)…</option>
                    {activeTasks.map((t) => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Notes */}
              <div className="flex gap-1.5 px-3 py-2 rounded-xl border border-border bg-background">
                <AlignLeft size={12} className="text-muted-foreground/50 shrink-0 mt-0.5" />
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes…"
                  rows={2}
                  className="flex-1 text-xs bg-transparent outline-none resize-none text-foreground placeholder:text-muted-foreground/40"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={!title.trim() || saving}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {saving ? "Adding…" : "Add Plan"}
          </button>
        </div>
      </div>
    </div>
  );
}
