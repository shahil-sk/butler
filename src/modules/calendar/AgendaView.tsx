// ============================================================
// CALENDAR — AgendaView
// Month-scoped flat list grouped by date.
// Shows calendar events + tasks due + notes updated that day.
// Empty state with CTA.
// ============================================================

import { useMemo } from "react";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { CheckCircle2, Circle, Clock, StickyNote } from "lucide-react";
import { cn } from "@/shared/utils";
import { useCalendarStore } from "./store";
import { useTaskStore } from "@/modules/tasks/store";
import { useNoteStore } from "@/modules/notes/store";
import { bus } from "@/kernel/event-bus";

export function AgendaView() {
  const { activeDate, getEventsInRange, openEventForm, calendars } = useCalendarStore();
  const tasks  = useTaskStore((s) => s.tasks);
  const notes  = useNoteStore((s) => s.notes);

  const anchor = parseISO(activeDate);
  const from   = startOfMonth(anchor).toISOString();
  const to     = endOfMonth(anchor).toISOString();

  const events = useMemo(
    () => getEventsInRange(from, to).sort((a, b) => a.startAt.localeCompare(b.startAt)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeDate]
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
    const fromD = from.slice(0, 10);
    const toD   = to.slice(0, 10);
    for (const t of tasks) {
      if (t.dueDate && t.dueDate >= fromD && t.dueDate <= toD) s.add(t.dueDate);
    }
    return s;
  }, [tasks, from, to]);

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
        const dayEvts  = grouped.get(ds) ?? [];
        const dayTasks = tasks.filter((t) => t.dueDate?.startsWith(ds));
        const dayNotes = notes.filter((n) => n.updatedAt?.startsWith(ds));
        const date     = parseISO(ds);
        const isToday  = ds === new Date().toISOString().slice(0, 10);

        return (
          <div key={ds} className="mb-6">
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
              {dayEvts.map((evt) => {
                const cal   = calendars.find((c) => c.id === evt.calendarId);
                const color = evt.color ?? cal?.color ?? "#3b82f6";
                return (
                  <div
                    key={evt.id}
                    onClick={() => openEventForm(evt, evt.id)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border hover:border-primary/30 cursor-pointer transition-fast"
                    style={{ borderLeftColor: color, borderLeftWidth: 3 }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate text-foreground">{evt.title}</p>
                      <p className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
                        {evt.allDay ? "All day" : `${evt.startAt.slice(11,16)}\u2013${evt.endAt.slice(11,16)}`}
                        {evt.description && ` \u00b7 ${evt.description.slice(0, 40)}`}
                      </p>
                    </div>
                    {evt.isTimeBlock && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium shrink-0">
                        time block
                      </span>
                    )}
                  </div>
                );
              })}

              {dayTasks.map((t) => (
                <button
                  key={t.id}
                  onClick={() => (useTaskStore.getState() as any).openTask?.(t.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border/60 hover:border-border bg-muted/20 transition-fast group text-left"
                >
                  {t.status === "done"
                    ? <CheckCircle2 size={12} className="text-green-500 shrink-0" />
                    : <Circle size={12} className="text-muted-foreground/40 shrink-0" />}
                  <span className={cn(
                    "text-xs flex-1 truncate transition-fast group-hover:text-foreground",
                    t.status === "done" ? "line-through text-muted-foreground/50" : "text-muted-foreground"
                  )}>
                    {t.title}
                  </span>
                  <span className="text-[9px] text-muted-foreground/40 shrink-0">task due</span>
                </button>
              ))}

              {dayNotes.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    (useNoteStore.getState() as any).openNote?.(n.id);
                    bus.emit("navigate:to", { path: "/notes" });
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border/40 hover:border-border bg-muted/10 transition-fast group text-left"
                >
                  <StickyNote size={11} className="text-muted-foreground/40 shrink-0" />
                  <span className="text-xs flex-1 truncate text-muted-foreground group-hover:text-foreground transition-fast">
                    {n.title || "Untitled"}
                  </span>
                  <span className="text-[9px] text-muted-foreground/40 shrink-0">note</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
