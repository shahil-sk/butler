import { useEffect } from "react";
import {
  ChevronLeft, ChevronRight, Plus,
  LayoutGrid, List, Calendar as CalIcon, AlignLeft,
} from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { registry } from "@/kernel/router";
import { useCalendarStore, type CalendarView } from "./store";
import { MonthGrid } from "./components/MonthGrid";
import { EventForm } from "./components/EventForm";
import { PageHeader, ViewSwitcher, PrimaryButton } from "@/shared/ui";
import { cn, toISODate } from "@/shared/utils";
import type { ModuleManifest } from "@/shared/types";

const manifest: ModuleManifest = {
  id: "calendar", name: "Calendar", icon: "CalendarDays",
  sidebarOrder: 5, isEnabled: true,
  routes: [{ path: "/calendar", label: "Calendar" }],
  commands: [
    { id: "cal.new", label: "New event", group: "Calendar", action: "calendar:event-form" },
  ],
  shortcuts: [
    { keys: "g c", action: "navigate:to", description: "Go to Calendar", global: false },
  ],
};
registry.register(manifest);

const VIEW_OPTIONS = [
  { value: "month"  as CalendarView, icon: LayoutGrid,  label: "Month" },
  { value: "week"   as CalendarView, icon: List,         label: "Week"  },
  { value: "day"    as CalendarView, icon: CalIcon,      label: "Day"   },
  { value: "agenda" as CalendarView, icon: AlignLeft,    label: "Agenda"},
];

export function CalendarModule() {
  const {
    view, setView, activeDate,
    loadEvents, loadCalendars,
    goToday, goNext, goPrev,
    openEventForm, eventForm,
    getEventsInRange,
  } = useCalendarStore();

  const anchor = parseISO(activeDate);

  // Compute load range based on view
  useEffect(() => {
    void loadCalendars();
  }, []);

  useEffect(() => {
    let from: string, to: string;
    if (view === "month") {
      from = startOfMonth(anchor).toISOString();
      to   = endOfMonth(anchor).toISOString();
    } else if (view === "week") {
      from = startOfWeek(anchor, { weekStartsOn: 1 }).toISOString();
      to   = endOfWeek(anchor,   { weekStartsOn: 1 }).toISOString();
    } else {
      from = `${activeDate}T00:00:00Z`;
      to   = `${activeDate}T23:59:59Z`;
    }
    void loadEvents(from, to);
  }, [activeDate, view]);

  const isToday = activeDate === toISODate(new Date());

  const dateLabel = (() => {
    if (view === "month")  return format(anchor, "MMMM yyyy");
    if (view === "week")   return `Week of ${format(startOfWeek(anchor, { weekStartsOn: 1 }), "MMM d, yyyy")}`;
    if (view === "day")    return format(anchor, "EEEE, MMMM d, yyyy");
    return format(anchor, "MMMM yyyy");
  })();

  // Agenda view — flat sorted list
  const agendaEvents = view === "agenda"
    ? getEventsInRange(
        startOfMonth(anchor).toISOString(),
        endOfMonth(anchor).toISOString()
      ).sort((a, b) => a.startAt.localeCompare(b.startAt))
    : [];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader title="Calendar">
        {/* Date navigation */}
        <button
          onClick={goPrev}
          className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-fast"
        >
          <ChevronLeft size={14} />
        </button>

        <button
          onClick={goToday}
          className={cn(
            "px-2.5 py-1 rounded-md text-xs transition-fast",
            isToday
              ? "bg-primary/10 text-primary font-medium"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          Today
        </button>

        <span className="text-xs font-medium text-foreground min-w-[200px] text-center">
          {dateLabel}
        </span>

        <button
          onClick={goNext}
          className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-fast"
        >
          <ChevronRight size={14} />
        </button>

        <ViewSwitcher options={VIEW_OPTIONS} value={view} onChange={setView} />

        <PrimaryButton onClick={() => openEventForm({ startAt: `${activeDate}T09:00:00` })}>
          <Plus size={13} />
          New event
        </PrimaryButton>
      </PageHeader>

      {/* View content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {view === "month" && <MonthGrid />}

        {view === "agenda" && (
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
            {agendaEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">
                No events this month.
              </p>
            ) : (
              agendaEvents.map((evt) => {
                const cal   = useCalendarStore.getState().calendars.find((c) => c.id === evt.calendarId);
                const color = evt.color ?? cal?.color ?? "#3b82f6";
                return (
                  <div
                    key={evt.id}
                    onClick={() => openEventForm(evt, evt.id)}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-border hover:border-primary/30 cursor-pointer transition-fast group"
                  >
                    <div
                      className="w-1 h-8 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{evt.title}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {evt.allDay
                          ? evt.startAt.slice(0, 10)
                          : `${evt.startAt.slice(0,10)} ${evt.startAt.slice(11,16)} – ${evt.endAt.slice(11,16)}`
                        }
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {(view === "week" || view === "day") && (
          <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">
            Week/day view — use Planner module for time-blocking workflows.
          </div>
        )}
      </div>

      {/* Event form modal */}
      {eventForm.open && <EventForm />}
    </div>
  );
}
