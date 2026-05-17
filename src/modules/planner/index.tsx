import { useEffect } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, LayoutGrid } from "lucide-react";
import { registry } from "@/kernel/router";
import { db } from "@/kernel/db";
import { PLANNER_MIGRATIONS } from "./db";
import { usePlannerStore, type PlannerView } from "./store";
import { useTaskStore } from "@/modules/tasks/store";
import { DayColumn } from "./components/DayColumn";
import { TaskSidebar } from "./components/TaskSidebar";
import { PageHeader, ViewSwitcher } from "@/shared/ui";
import { cn, toISODate } from "@/shared/utils";
import { format, parseISO, startOfWeek, addDays } from "date-fns";
import type { ModuleManifest } from "@/shared/types";

const manifest: ModuleManifest = {
  id: "planner", name: "Planner", icon: "CalendarDays",
  sidebarOrder: 3, isEnabled: true,
  routes: [{ path: "/planner", label: "Planner" }],
  commands: [{ id: "planner.today", label: "Go to today", group: "Planner", action: "navigate:to" }],
  shortcuts: [{ keys: "g p", action: "navigate:to", description: "Go to Planner", global: false }],
};
registry.register(manifest);

const VIEW_OPTIONS = [
  { value: "day"  as PlannerView, icon: CalendarDays, label: "Day" },
  { value: "week" as PlannerView, icon: LayoutGrid,   label: "Week" },
];

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function PlannerModule() {
  const {
    activeDate, view, setView,
    loadBlocks, loadWeekBlocks,
    goToday, goNextDay, goPrevDay, goNextWeek, goPrevWeek,
    getBlocksForDate,
  } = usePlannerStore();

  const { loadTasks, tasks } = useTaskStore();

  useEffect(() => {
    if (tasks.length === 0) void loadTasks();
  }, []);

  useEffect(() => {
    if (view === "day") {
      void loadBlocks(activeDate);
    } else {
      const weekStart = toISODate(startOfWeek(parseISO(activeDate), { weekStartsOn: 1 }));
      void loadWeekBlocks(weekStart);
    }
  }, [activeDate, view]);

  const dateLabel = format(parseISO(activeDate), "EEEE, MMMM d, yyyy");
  const weekStart = startOfWeek(parseISO(activeDate), { weekStartsOn: 1 });
  const weekDates = Array.from({ length: 7 }, (_, i) => toISODate(addDays(weekStart, i)));
  const isToday   = activeDate === toISODate(new Date());

  const prev = view === "day" ? goPrevDay : goPrevWeek;
  const next = view === "day" ? goNextDay : goNextWeek;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader title="Planner">
        {/* Date nav */}
        <button
          onClick={prev}
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

        <span className="text-xs font-medium text-foreground min-w-[180px] text-center">
          {view === "day"
            ? dateLabel
            : `${format(weekStart, "MMM d")} – ${format(addDays(weekStart, 6), "MMM d, yyyy")}`
          }
        </span>

        <button
          onClick={next}
          className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-fast"
        >
          <ChevronRight size={14} />
        </button>

        <ViewSwitcher options={VIEW_OPTIONS} value={view} onChange={setView} />
      </PageHeader>

      <div className="flex flex-1 overflow-hidden">
        {/* Unscheduled tasks sidebar */}
        <TaskSidebar />

        {/* Calendar area */}
        <div className="flex flex-col flex-1 overflow-hidden">

          {/* Week header */}
          {view === "week" && (
            <div className="flex border-b border-border shrink-0">
              <div className="w-10 shrink-0" /> {/* spacer for hour labels */}
              {weekDates.map((date, i) => {
                const d      = parseISO(date);
                const isDay  = date === toISODate(new Date());
                return (
                  <button
                    key={date}
                    onClick={() => { usePlannerStore.getState().setActiveDate(date); setView("day"); }}
                    className={cn(
                      "flex-1 flex flex-col items-center py-2 text-xs transition-fast hover:bg-accent",
                      isDay && "text-primary font-semibold"
                    )}
                  >
                    <span className="text-muted-foreground/60">{WEEK_DAYS[i]}</span>
                    <span className={cn(
                      "w-7 h-7 flex items-center justify-center rounded-full mt-0.5 text-sm font-medium",
                      isDay && "bg-primary text-primary-foreground"
                    )}>
                      {format(d, "d")}
                    </span>
                    <span className="text-[10px] text-muted-foreground/50 mt-0.5">
                      {getBlocksForDate(date).length > 0 ? `${getBlocksForDate(date).length} blocks` : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Scrollable grid */}
          <div className="flex flex-1 overflow-auto">
            {/* Hour labels column */}
            <div className="w-10 shrink-0 relative">
              {Array.from({ length: 16 }, (_, i) => i + 6).map((h) => (
                <div
                  key={h}
                  className="absolute left-0 right-0 text-right pr-1"
                  style={{ top: (h - 6) * 64 - 8 }}
                >
                  <span className="text-[10px] text-muted-foreground/40 tabular-nums">
                    {h === 12 ? "12p" : h > 12 ? `${h - 12}p` : `${h}a`}
                  </span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {view === "day" ? (
              <DayColumn date={activeDate} />
            ) : (
              <div className="flex flex-1">
                {weekDates.map((date) => (
                  <div key={date} className="flex-1 border-l border-border first:border-l-0">
                    <DayColumn date={date} compact />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
