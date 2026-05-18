import { useEffect } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, LayoutGrid, Columns3, Clock, Coffee, Layers } from "lucide-react";
import { registry } from "@/kernel/router";
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
  commands: [
    { id: "planner.today", label: "Go to today",      group: "Planner", action: "navigate:to" },
    { id: "planner.day",   label: "Switch to day view",  group: "Planner", action: "navigate:to" },
    { id: "planner.week",  label: "Switch to week view", group: "Planner", action: "navigate:to" },
  ],
  shortcuts: [{ keys: "g p", action: "navigate:to", description: "Go to Planner", global: false }],
};
registry.register(manifest);

const VIEW_OPTIONS = [
  { value: "day"  as PlannerView, icon: CalendarDays, label: "Day" },
  { value: "3day" as PlannerView, icon: Columns3,     label: "3 Day" },
  { value: "week" as PlannerView, icon: LayoutGrid,   label: "Week" },
];

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ── Mini stats bar ─────────────────────────────────────────────
function StatsBar({ date }: { date: string }) {
  const { getDayStats } = usePlannerStore();
  const s = getDayStats(date);
  if (s.totalBlocks === 0) return null;

  const fh = Math.floor(s.focusMinutes / 60);
  const fm = s.focusMinutes % 60;
  const focusLabel = fh > 0 ? `${fh}h${fm > 0 ? ` ${fm}m` : ""}` : `${fm}m`;

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-border/40 bg-surface-1/40 shrink-0 backdrop-blur-sm">
      <StatPill icon={<Layers size={9} />}  label={`${s.totalBlocks} blocks`}  />
      <div className="w-px h-3 bg-border/40" />
      <StatPill icon={<Clock size={9} />}   label={`${focusLabel} focus`} accent />
      {s.breakMinutes > 0 && (
        <>
          <div className="w-px h-3 bg-border/40" />
          <StatPill icon={<Coffee size={9} />} label={`${s.breakMinutes}m breaks`} />
        </>
      )}
    </div>
  );
}

function StatPill({ icon, label, accent = false }: { icon: React.ReactNode; label: string; accent?: boolean }) {
  return (
    <div className={cn(
      "flex items-center gap-1.5 text-[10px] font-medium tabular-nums tracking-wide",
      accent ? "text-primary" : "text-muted-foreground/60"
    )}>
      <span className={cn("opacity-70", accent && "opacity-100")}>{icon}</span>
      {label}
    </div>
  );
}

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
    } else if (view === "3day") {
      const d0 = parseISO(activeDate);
      for (let i = 0; i < 3; i++) void loadBlocks(toISODate(addDays(d0, i)));
    } else {
      const weekStart = toISODate(startOfWeek(parseISO(activeDate), { weekStartsOn: 1 }));
      void loadWeekBlocks(weekStart);
    }
  }, [activeDate, view]);

  const dateLabel  = format(parseISO(activeDate), "EEEE, MMMM d, yyyy");
  const weekStart  = startOfWeek(parseISO(activeDate), { weekStartsOn: 1 });
  const weekDates  = Array.from({ length: 7 }, (_, i) => toISODate(addDays(weekStart, i)));
  const threeDates = Array.from({ length: 3 }, (_, i) => toISODate(addDays(parseISO(activeDate), i)));
  const isToday    = activeDate === toISODate(new Date());

  const prev = (view === "week") ? goPrevWeek : goPrevDay;
  const next = (view === "week") ? goNextWeek : goNextDay;

  let rangeLabel = dateLabel;
  if (view === "week") {
    rangeLabel = `${format(weekStart, "MMM d")} – ${format(addDays(weekStart, 6), "MMM d, yyyy")}`;
  } else if (view === "3day") {
    const d0 = parseISO(activeDate);
    rangeLabel = `${format(d0, "MMM d")} – ${format(addDays(d0, 2), "MMM d")}`;
  }

  const displayDates = view === "week" ? weekDates : view === "3day" ? threeDates : [activeDate];

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <PageHeader title="Planner">
        {/* Nav cluster */}
        <div className="flex items-center gap-0.5 rounded-lg border border-border/50 bg-surface-1/60 p-0.5">
          <button
            onClick={prev}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/70 transition-all duration-150"
          >
            <ChevronLeft size={13} />
          </button>

          <button
            onClick={goToday}
            className={cn(
              "px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide transition-all duration-150",
              isToday
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"
            )}
          >
            Today
          </button>

          <button
            onClick={next}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/70 transition-all duration-150"
          >
            <ChevronRight size={13} />
          </button>
        </div>

        {/* Range label */}
        <span className="text-[12px] font-medium text-foreground/80 min-w-[200px] text-center tabular-nums tracking-tight select-none">
          {rangeLabel}
        </span>

        <ViewSwitcher options={VIEW_OPTIONS} value={view} onChange={setView} />
      </PageHeader>

      {/* Stats bar (day view only) */}
      {view === "day" && <StatsBar date={activeDate} />}

      <div className="flex flex-1 overflow-hidden">
        <TaskSidebar />

        <div className="flex flex-col flex-1 overflow-hidden">

          {/* Multi-day column headers */}
          {view !== "day" && (
            <div className="flex border-b border-border/60 shrink-0 bg-surface-1/30">
              {/* Offset for hour labels */}
              <div className="w-10 shrink-0" />
              {displayDates.map((date, i) => {
                const d     = parseISO(date);
                const isDay = date === toISODate(new Date());
                const weekDayIdx = view === "week" ? i : (d.getDay() + 6) % 7;
                const blockCount = getBlocksForDate(date).length;
                return (
                  <button
                    key={date}
                    onClick={() => {
                      usePlannerStore.getState().setActiveDate(date);
                      setView("day");
                    }}
                    className={cn(
                      "flex-1 flex flex-col items-center py-2.5 text-xs transition-all duration-150 hover:bg-accent/50 group",
                      isDay && "text-primary"
                    )}
                  >
                    <span className={cn(
                      "text-[9px] font-semibold tracking-widest uppercase mb-1",
                      isDay ? "text-primary/70" : "text-muted-foreground/40"
                    )}>
                      {WEEK_DAYS[weekDayIdx]}
                    </span>
                    <span className={cn(
                      "w-7 h-7 flex items-center justify-center rounded-full text-[13px] font-semibold transition-all duration-150",
                      isDay
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-foreground/80 group-hover:bg-accent"
                    )}>
                      {format(d, "d")}
                    </span>
                    {blockCount > 0 ? (
                      <span className={cn(
                        "mt-1.5 text-[9px] font-medium tracking-wide",
                        isDay ? "text-primary/60" : "text-muted-foreground/40"
                      )}>
                        {blockCount}b
                      </span>
                    ) : (
                      <span className="mt-1.5 text-[9px] opacity-0">·</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Scrollable grid */}
          <div className="flex flex-1 overflow-auto">
            {/* Hour labels */}
            <div className="w-10 shrink-0 relative select-none">
              {Array.from({ length: 16 }, (_, i) => i + 6).map((h) => (
                <div
                  key={h}
                  className="absolute left-0 right-0 flex justify-end pr-2"
                  style={{ top: (h - 6) * 64 - 8 }}
                >
                  <span className={cn(
                    "text-[9px] font-medium tabular-nums tracking-wide",
                    h === 12
                      ? "text-muted-foreground/60"
                      : "text-muted-foreground/30"
                  )}>
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
                {displayDates.map((date) => (
                  <div key={date} className="flex-1 border-l border-border/40 first:border-l-0">
                    <DayColumn date={date} compact={view === "week"} />
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
