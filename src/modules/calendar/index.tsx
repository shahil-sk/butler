// ============================================================
// CALENDAR — Module root  (improved)
// - Correct hook placement (no hooks inside callbacks)
// - Bus listeners: tasks/notes auto-reload context
// - WeekView / DayView / AgendaView wired in
// ============================================================

import { useEffect } from "react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  format, parseISO,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/shared/utils";
import { useCalendarStore } from "./store";
import { MonthGrid }  from "./MonthGrid";
import { WeekView }   from "./WeekView";
import { DayView }    from "./DayView";
import { AgendaView } from "./AgendaView";
import { EventForm }  from "./EventForm";
import { bus }        from "@/kernel/event-bus";
import { useTaskStore } from "@/modules/tasks/store";
import { useNoteStore } from "@/modules/notes/store";

const VIEW_LABELS = { month: "Month", week: "Week", day: "Day", agenda: "Agenda" } as const;

export function CalendarModule() {
  const {
    view, activeDate,
    loadCalendars, loadEvents,
    setView, goNext, goPrev, goToday,
    openEventForm,
  } = useCalendarStore();

  const loadTasks = useTaskStore((s) => s.loadTasks);
  const loadNotes = useNoteStore((s) => s.loadNotes);

  const anchor = parseISO(activeDate);
  const from   = startOfMonth(startOfWeek(anchor, { weekStartsOn: 1 }));
  const to     = endOfMonth(endOfWeek(anchor, { weekStartsOn: 1 }));

  useEffect(() => {
    void loadCalendars();
    void (loadTasks as (() => Promise<void>) | undefined)?.();
    void (loadNotes as (() => Promise<void>) | undefined)?.();
  }, []);

  useEffect(() => {
    void loadEvents(from.toISOString(), to.toISOString());
  }, [activeDate, view]);

  useEffect(() => {
    const unsubs = [
      bus.on("task:created",  () => void (loadTasks as any)?.()),
      bus.on("task:updated",  () => void (loadTasks as any)?.()),
      bus.on("task:deleted",  () => void (loadTasks as any)?.()),
      bus.on("note:created",  () => void (loadNotes as any)?.()),
      bus.on("note:updated",  () => void (loadNotes as any)?.()),
      bus.on("note:deleted",  () => void (loadNotes as any)?.()),
      bus.on("calendar:open-for-date", ({ date }: { date: string }) => {
        useCalendarStore.getState().setActiveDate(date);
        useCalendarStore.getState().setView("day");
        openEventForm({ startAt: `${date}T09:00:00`, endAt: `${date}T10:00:00` });
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const headerLabel = (() => {
    if (view === "month") return format(anchor, "MMMM yyyy");
    if (view === "week") {
      const ws = startOfWeek(anchor, { weekStartsOn: 1 });
      const we = endOfWeek(anchor, { weekStartsOn: 1 });
      return `${format(ws, "MMM d")} – ${format(we, "MMM d, yyyy")}`;
    }
    if (view === "day") return format(anchor, "EEEE, MMMM d, yyyy");
    return format(anchor, "MMMM yyyy");
  })();

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border shrink-0">
        <button onClick={goPrev} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-fast">
          <ChevronLeft size={14} />
        </button>
        <button onClick={goNext} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-fast">
          <ChevronRight size={14} />
        </button>
        <button onClick={goToday} className="px-2.5 py-1 text-xs rounded border border-border hover:bg-accent transition-fast">
          Today
        </button>
        <h1 className="text-sm font-semibold flex-1 text-center">{headerLabel}</h1>

        <div className="flex items-center rounded-lg border border-border overflow-hidden">
          {(Object.keys(VIEW_LABELS) as (keyof typeof VIEW_LABELS)[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "px-2.5 py-1 text-[11px] transition-fast border-r last:border-r-0 border-border",
                view === v
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>

        <button
          onClick={() => openEventForm({ startAt: `${activeDate}T09:00:00`, endAt: `${activeDate}T10:00:00` })}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-fast"
        >
          <Plus size={12} />
          New event
        </button>
      </div>

      {(view === "month" || view === "week") && (
        <div className="grid grid-cols-7 border-b border-border shrink-0">
          {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => (
            <div key={d} className="py-1.5 text-center text-[11px] font-medium text-muted-foreground">{d}</div>
          ))}
        </div>
      )}

      {view === "month"  && <MonthGrid />}
      {view === "week"   && <WeekView />}
      {view === "day"    && <DayView />}
      {view === "agenda" && <AgendaView />}

      <EventForm />
    </div>
  );
}
