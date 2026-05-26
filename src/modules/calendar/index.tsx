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
import { MonthGrid }  from "./components/MonthGrid";
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
      return `${format(ws, "MMM d")} \u2013 ${format(we, "MMM d, yyyy")}`;
    }
    if (view === "day") return format(anchor, "EEEE, MMMM d, yyyy");
    return format(anchor, "MMMM yyyy");
  })();

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 pt-6 pb-3 border-b border-border/40 shrink-0 gap-4 flex-wrap md:flex-nowrap">
        <div className="flex items-center gap-1.5 bg-muted/40 dark:bg-muted/10 p-0.5 border border-border/40 rounded-xl">
          <button onClick={goPrev} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-fast">
            <ChevronLeft size={13} />
          </button>
          <button onClick={goToday} className="px-3 py-1 text-[11px] font-bold rounded-lg bg-background hover:bg-accent/40 text-foreground border border-border/20 transition-fast shadow-sm">
            Today
          </button>
          <button onClick={goNext} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-fast">
            <ChevronRight size={13} />
          </button>
        </div>
        
        <h1 className="text-[18px] font-bold tracking-tight text-gradient flex-1 text-center md:text-left md:pl-2 min-w-[150px]">{headerLabel}</h1>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-0.5 bg-muted/40 dark:bg-muted/20 p-0.5 border border-border/30 rounded-xl shrink-0">
            {(Object.keys(VIEW_LABELS) as (keyof typeof VIEW_LABELS)[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[12px] font-bold transition-all duration-200",
                  view === v
                    ? "bg-background text-foreground shadow-sm shadow-black/5 border border-border/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                )}
              >
                {VIEW_LABELS[v]}
              </button>
            ))}
          </div>

          <button
            onClick={() => openEventForm({ startAt: `${activeDate}T09:00:00`, endAt: `${activeDate}T10:00:00` })}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/95 transition-fast shadow-sm shadow-primary/25 shrink-0"
          >
            <Plus size={12} />
            New event
          </button>
        </div>
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
