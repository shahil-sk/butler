// @ts-nocheck
// ============================================================
// CALENDAR — AgendaView
// Month-scoped flat list grouped by date.
// - Reactive to event/task/note store changes (not just activeDate)
// - Time-block events show a collapsible dropdown for linked tasks/notes
// - Tasks already linked via a time-block are excluded from standalone list
// - Standalone tasks include both dueDate and scheduledDate matches
// ============================================================

import { useMemo, useState } from "react";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import {
  CheckCircle2, Circle, Clock, StickyNote,
  ChevronDown, ChevronRight, Link2,
} from "lucide-react";
import { cn } from "@/shared/utils";
import { useCalendarStore } from "./store";
import { useTaskStore } from "@/modules/tasks/store";
import { bus } from "@/kernel/event-bus";
const notes: any[] = [];

// ── LinkedDropdown ─────────────────────────────────────────────────
// Collapsible section shown below any event that has linkedTaskIds or
// linkedNoteIds. Starts collapsed; chevron toggles open.

interface LinkedDropdownProps {
  linkedTaskIds: string[];
  linkedNoteIds: string[];
}

function LinkedDropdown({ linkedTaskIds, linkedNoteIds }: LinkedDropdownProps) {
  const [open, setOpen] = useState(false);
  const tasks = useTaskStore((s) => s.tasks);
  

  const linkedTasks = linkedTaskIds.map((id) => tasks.find((t) => t.id === id)).filter(Boolean);
  const linkedNotes = linkedNoteIds.map((id) => notes.find((n) => n.id === id)).filter(Boolean);
  const total = linkedTasks.length + linkedNotes.length;
  if (total === 0) return null;

  return (
    <div className="ml-3 border-l border-border/40 pl-2">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="flex items-center gap-1 py-1 text-[10px] text-muted-foreground hover:text-foreground transition-fast"
      >
        {open
          ? <ChevronDown size={10} className="shrink-0" />
          : <ChevronRight size={10} className="shrink-0" />}
        <Link2 size={9} className="shrink-0" />
        {total} linked {total === 1 ? "item" : "items"}
      </button>

      {open && (
        <div className="pb-1.5 space-y-1">
          {linkedTasks.map((t) => t && (
            <button
              key={t.id}
              onClick={(e) => { e.stopPropagation(); (useTaskStore.getState() as any).openTask?.(t.id); }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent/50 transition-fast group text-left"
            >
              {t.status === "done"
                ? <CheckCircle2 size={11} className="text-green-500 shrink-0" />
                : <Circle size={11} className="text-muted-foreground/40 shrink-0" />}
              <span className={cn(
                "text-[11px] flex-1 truncate transition-fast group-hover:text-foreground",
                t.status === "done" ? "line-through text-muted-foreground/40" : "text-muted-foreground"
              )}>
                {t.title}
              </span>
              <span className="text-[9px] text-muted-foreground/30 shrink-0">task</span>
            </button>
          ))}
          {linkedNotes.map((n) => n && (
            <button
              key={n.id}
              onClick={(e) => {
                e.stopPropagation();
                
                bus.emit("navigate:to", { path: "/notes" });
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent/50 transition-fast group text-left"
            >
              <StickyNote size={11} className="text-muted-foreground/40 shrink-0" />
              <span className="text-[11px] flex-1 truncate text-muted-foreground group-hover:text-foreground transition-fast">
                {n.title || "Untitled"}
              </span>
              <span className="text-[9px] text-muted-foreground/30 shrink-0">note</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── AgendaView ───────────────────────────────────────────────────

export function AgendaView() {
  const { activeDate, openEventForm, calendars } = useCalendarStore();
  // Subscribe to events array directly so agenda re-renders on any event change
  const storeEvents = useCalendarStore((s) => s.events);
  const tasks  = useTaskStore((s) => s.tasks);
  

  const anchor = parseISO(activeDate);
  const fromISO = startOfMonth(anchor).toISOString();
  const toISO   = endOfMonth(anchor).toISOString();
  const fromD   = fromISO.slice(0, 10);
  const toD     = toISO.slice(0, 10);

  // Re-derive events whenever the store changes — fixes stale agenda after adds/edits
  const events = useMemo(
    () =>
      storeEvents
        .filter((e) => e.endAt >= fromISO && e.startAt <= toISO)
        .sort((a, b) => a.startAt.localeCompare(b.startAt)),
    [storeEvents, fromISO, toISO]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, typeof events>();
    for (const evt of events) {
      const ds = evt.startAt.slice(0, 10);
      if (!map.has(ds)) map.set(ds, []);
      map.get(ds)!.push(evt);
    }
    return map;
  }, [events]);

  const taskDates = useMemo(() => {
    const s = new Set<string>();
    for (const t of tasks) {
      if (t.dueDate       && t.dueDate       >= fromD && t.dueDate       <= toD) s.add(t.dueDate);
      if (t.scheduledDate && t.scheduledDate >= fromD && t.scheduledDate <= toD) s.add(t.scheduledDate);
    }
    return s;
  }, [tasks, fromD, toD]);

  const allDates = useMemo(() => {
    const s = new Set([...grouped.keys(), ...taskDates]);
    return [...s].sort();
  }, [grouped, taskDates]);

  if (allDates.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-24">
        <Clock size={32} className="text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">No events this month.</p>
        <button onClick={() => openEventForm()} className="text-xs text-primary hover:underline">
          + New event
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      {allDates.map((ds) => {
        const dayEvts = grouped.get(ds) ?? [];
        const isToday = ds === new Date().toISOString().slice(0, 10);
        const date    = parseISO(ds);

        // IDs of tasks already represented by a time-block event on this day
        const timeBlockTaskIds = new Set(
          dayEvts
            .filter((e) => e.isTimeBlock && e.linkedTaskIds?.length)
            .flatMap((e) => e.linkedTaskIds!)
        );

        // Standalone tasks: due OR scheduled today, not already in a time-block
        const dayTasks = tasks.filter(
          (t) =>
            !timeBlockTaskIds.has(t.id) &&
            (t.dueDate?.startsWith(ds) || t.scheduledDate?.startsWith(ds))
        );

        const dayNotes = notes.filter((n) => n.updatedAt?.startsWith(ds));

        return (
          <div key={ds} className="mb-6">
            {/* Day header */}
            <div className="flex items-center gap-3 mb-2">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0",
                isToday ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}>
                {format(date, "d")}
              </div>
              <div>
                <p className={cn("text-xs font-semibold", isToday ? "text-primary" : "text-foreground")}>
                  {isToday ? "Today" : format(date, "EEEE")}
                </p>
                <p className="text-[10px] text-muted-foreground">{format(date, "MMMM d, yyyy")}</p>
              </div>
            </div>

            <div className="ml-11 space-y-1.5">
              {/* Calendar events */}
              {dayEvts.map((evt) => {
                const cal   = calendars.find((c) => c.id === evt.calendarId);
                const color = evt.color ?? cal?.color ?? "#3b82f6";
                const hasLinks =
                  (evt.linkedTaskIds?.length ?? 0) + (evt.linkedNoteIds?.length ?? 0) > 0;

                return (
                  <div key={evt.id}>
                    <div
                      onClick={() => openEventForm(evt, evt.id)}
                      className="group flex items-center gap-4 px-4 py-3 rounded-2xl border border-border/50 hover:border-primary/50 bg-card/40 backdrop-blur-md cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5"
                      style={{ borderLeftColor: color, borderLeftWidth: 4 }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate text-foreground group-hover:text-primary transition-colors">{evt.title}</p>
                        <p className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
                          {evt.allDay
                            ? "All day"
                            : `${evt.startAt.slice(11, 16)}\u2013${evt.endAt.slice(11, 16)}`}
                          {evt.description && ` \u00b7 ${evt.description.slice(0, 40)}`}
                        </p>
                      </div>
                      {evt.isTimeBlock && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium shrink-0">
                          time block
                        </span>
                      )}
                    </div>

                    {/* Collapsible linked tasks / notes dropdown */}
                    {hasLinks && (
                      <LinkedDropdown
                        linkedTaskIds={evt.linkedTaskIds ?? []}
                        linkedNoteIds={evt.linkedNoteIds ?? []}
                      />
                    )}
                  </div>
                );
              })}

              {/* Standalone tasks */}
              {dayTasks.map((t) => (
                <button
                  key={t.id}
                  onClick={() => (useTaskStore.getState() as any).openTask?.(t.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border border-border/40 hover:border-border bg-muted/10 hover:bg-muted/20 backdrop-blur-sm transition-all duration-300 group text-left hover:-translate-y-0.5"
                >
                  {t.status === "done"
                    ? <CheckCircle2 size={16} className="text-green-500 shrink-0 transition-transform group-hover:scale-110" />
                    : <Circle size={16} className="text-muted-foreground/40 shrink-0 transition-transform group-hover:scale-110 group-hover:text-primary/50" />}
                  <span className={cn(
                    "text-sm font-bold flex-1 truncate transition-fast group-hover:text-foreground",
                    t.status === "done" ? "line-through text-muted-foreground/50" : "text-muted-foreground"
                  )}>
                    {t.title}
                  </span>
                  <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground/40 shrink-0">
                    {t.dueDate?.startsWith(ds) ? "due" : "scheduled"}
                  </span>
                </button>
              ))}

              {/* Notes updated today */}
              {dayNotes.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    
                    bus.emit("navigate:to", { path: "/notes" });
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border border-border/30 hover:border-border bg-muted/5 hover:bg-muted/10 backdrop-blur-sm transition-all duration-300 group text-left hover:-translate-y-0.5"
                >
                  <StickyNote size={14} className="text-muted-foreground/40 shrink-0 transition-transform group-hover:scale-110 group-hover:text-yellow-500/50" />
                  <span className="text-sm font-bold flex-1 truncate text-muted-foreground group-hover:text-foreground transition-fast">
                    {n.title || "Untitled"}
                  </span>
                  <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground/40 shrink-0">note</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
