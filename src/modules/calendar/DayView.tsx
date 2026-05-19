// ============================================================
// CALENDAR — DayView
// Single-day timed grid + right context panel:
//   - Tasks due today (click → opens task detail)
//   - Notes updated today (click → navigates to notes)
// ============================================================

import { useRef, useEffect } from "react";
import { parseISO, format } from "date-fns";
import { CheckCircle2, Circle, FileText } from "lucide-react";
import { cn, toISODate } from "@/shared/utils";
import { useCalendarStore } from "./store";
import { useTaskStore } from "@/modules/tasks/store";
import { useNoteStore } from "@/modules/notes/store";
import { bus } from "@/kernel/event-bus";

const HOURS  = Array.from({ length: 24 }, (_, i) => i);
const CELL_H = 60;

function timeToY(isoTime: string): number {
  const d = new Date(isoTime);
  return (d.getHours() + d.getMinutes() / 60) * CELL_H;
}
function durationH(s: string, e: string): number {
  return Math.max((new Date(e).getTime() - new Date(s).getTime()) / 3_600_000, 0.25);
}

export function DayView() {
  const { activeDate, getEventsForDay, openEventForm, calendars } = useCalendarStore();
  const tasks  = useTaskStore((s) => s.tasks);
  const notes  = useNoteStore((s) => s.notes);
  const scrollRef = useRef<HTMLDivElement>(null);

  const ds       = activeDate;
  const dayLabel = format(parseISO(ds), "EEEE, MMMM d");
  const isToday  = ds === toISODate(new Date());
  const events   = getEventsForDay(ds);
  const timedEvts  = events.filter((e) => !e.allDay);
  const allDayEvts = events.filter((e) =>  e.allDay);

  const dueTasks   = tasks.filter((t) => t.dueDate?.startsWith(ds));
  const todayNotes = notes.filter((n) => n.updatedAt?.startsWith(ds));

  const now  = new Date();
  const nowY = (now.getHours() + now.getMinutes() / 60) * CELL_H;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: CELL_H * 7, behavior: "instant" });
  }, [activeDate]);

  return (
    <div className="flex flex-1 overflow-hidden border-t border-border">
      {/* Timeline */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {allDayEvts.length > 0 && (
          <div className="shrink-0 flex items-center gap-1.5 px-4 py-2 border-b border-border bg-muted/30 flex-wrap">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide mr-1">All day</span>
            {allDayEvts.map((e) => {
              const cal   = calendars.find((c) => c.id === e.calendarId);
              const color = e.color ?? cal?.color ?? "#3b82f6";
              return (
                <button
                  key={e.id}
                  onClick={() => openEventForm(e, e.id)}
                  className="text-[11px] px-2 py-0.5 rounded-full font-medium transition-fast hover:brightness-95"
                  style={{ backgroundColor: `${color}22`, color }}
                >
                  {e.title}
                </button>
              );
            })}
          </div>
        )}

        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="flex">
            <div className="w-14 shrink-0 border-r border-border">
              {HOURS.map((h) => (
                <div key={h} className="relative border-b border-border/30" style={{ height: CELL_H }}>
                  <span className="absolute -top-2 right-2 text-[10px] tabular-nums text-muted-foreground/60 select-none">
                    {h === 0 ? "" : `${String(h).padStart(2, "0")}:00`}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex-1 relative">
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="absolute w-full border-b border-border/30 cursor-pointer hover:bg-accent/20 transition-fast"
                  style={{ top: h * CELL_H, height: CELL_H }}
                  onClick={() => {
                    const start = `${ds}T${String(h).padStart(2, "0")}:00:00`;
                    const end   = `${ds}T${String(h + 1).padStart(2, "0")}:00:00`;
                    openEventForm({ startAt: start, endAt: end });
                  }}
                />
              ))}

              {isToday && (
                <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: nowY }}>
                  <div className="flex items-center">
                    <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 shrink-0" />
                    <div className="flex-1 h-px bg-red-500 opacity-70" />
                  </div>
                </div>
              )}

              {timedEvts.map((evt) => {
                const cal    = calendars.find((c) => c.id === evt.calendarId);
                const color  = evt.color ?? cal?.color ?? "#3b82f6";
                const top    = timeToY(evt.startAt);
                const height = durationH(evt.startAt, evt.endAt) * CELL_H;
                return (
                  <div
                    key={evt.id}
                    onClick={(e) => { e.stopPropagation(); openEventForm(evt, evt.id); }}
                    className="absolute left-1 right-1 rounded-md overflow-hidden cursor-pointer z-10 px-2 py-1 transition-fast hover:brightness-95"
                    style={{
                      top,
                      height: Math.max(height, 24),
                      backgroundColor: `${color}20`,
                      borderLeft: `3px solid ${color}`,
                      color,
                    }}
                  >
                    <p className="text-[11px] font-semibold leading-tight truncate">{evt.title}</p>
                    {height > 36 && (
                      <p className="text-[10px] opacity-70 tabular-nums mt-0.5">
                        {evt.startAt.slice(11,16)}&ndash;{evt.endAt.slice(11,16)}
                      </p>
                    )}
                    {height > 56 && evt.description && (
                      <p className="text-[10px] opacity-60 mt-1 line-clamp-2">{evt.description}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Right context panel */}
      <div className="w-56 shrink-0 border-l border-border overflow-y-auto flex flex-col">
        <div className="px-4 py-3 border-b border-border shrink-0">
          <p className="text-xs font-semibold text-foreground">{dayLabel}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {timedEvts.length} event{timedEvts.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="px-3 pt-3 pb-1">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2 font-medium">Tasks due</p>
          {dueTasks.length === 0 ? (
            <p className="text-[11px] text-muted-foreground/50 pb-2">None</p>
          ) : (
            dueTasks.map((t) => (
              <button
                key={t.id}
                onClick={() => (useTaskStore.getState() as any).openTask?.(t.id)}
                className="w-full flex items-center gap-2 py-1.5 text-left group"
              >
                {t.status === "done"
                  ? <CheckCircle2 size={11} className="text-green-500 shrink-0" />
                  : <Circle size={11} className="text-muted-foreground/50 shrink-0" />}
                <span className={cn(
                  "text-[11px] flex-1 truncate transition-fast group-hover:text-primary",
                  t.status === "done" && "line-through opacity-50"
                )}>
                  {t.title}
                </span>
              </button>
            ))
          )}
        </div>

        <div className="mx-3 border-t border-border my-1" />

        <div className="px-3 pt-2 pb-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2 font-medium">Notes today</p>
          {todayNotes.length === 0 ? (
            <p className="text-[11px] text-muted-foreground/50">None</p>
          ) : (
            todayNotes.map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  (useNoteStore.getState() as any).openNote?.(n.id);
                  bus.emit("navigate:to", { path: "/notes" });
                }}
                className="w-full flex items-start gap-2 py-1.5 text-left group"
              >
                <FileText size={11} className="text-muted-foreground/50 shrink-0 mt-0.5" />
                <span className="text-[11px] flex-1 truncate transition-fast group-hover:text-primary">
                  {n.title || "Untitled"}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
