import { useEffect, useState } from "react";
import {
  ChevronLeft, ChevronRight, CalendarDays, LayoutGrid, Columns3,
  Clock, Coffee, Layers, BookTemplate, Plus, Save, Trash2, CheckSquare,
} from "lucide-react";
import { registry } from "@/kernel/router";
import { usePlannerStore, type PlannerView } from "./store";
import { useTaskStore } from "@/modules/tasks/store";
import { useTimeStore } from "@/modules/time-tracking/store";
import { useFocusStore } from "@/modules/focus/store";
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
    { id: "planner.today", label: "Go to today",         group: "Planner", action: "navigate:to" },
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

// ── Helpers ──────────────────────────────────────────────────

function fmtMins(m: number) {
  const h = Math.floor(m / 60), r = m % 60;
  return h > 0 ? (r > 0 ? `${h}h ${r}m` : `${h}h`) : `${m}m`;
}

// ── Stats bar (unified: planner blocks + time entries + focus) ─
function StatsBar({ date }: { date: string }) {
  const { getDayStats }  = usePlannerStore();
  const timeEntries      = useTimeStore((s) => s.entries);
  const focusSessions    = useFocusStore((s) => s.sessions);

  const s = getDayStats(date);

  // Tracked minutes from time-tracking entries for this date
  const trackedMins = timeEntries
    .filter((e) => e.endAt && e.startAt.startsWith(date))
    .reduce((a, e) => a + (e.durationMinutes ?? 0), 0);

  // Focus minutes from completed focus sessions for this date
  const focusMins = focusSessions
    .filter((fs) => fs.type === "focus" && fs.completedAt && fs.startedAt?.startsWith(date))
    .reduce((a, fs) => a + (fs.actualMinutes ?? 0), 0);

  const totalTracked = trackedMins + focusMins;
  if (s.totalBlocks === 0 && totalTracked === 0) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-border/40 bg-surface-1/40 shrink-0 backdrop-blur-sm flex-wrap">
      {s.totalBlocks > 0 && (
        <StatPill icon={<Layers size={9} />} label={`${s.totalBlocks} blocks`} />
      )}
      {s.taskCount > 0 && (
        <>
          <div className="w-px h-3 bg-border/40" />
          <StatPill icon={<CheckSquare size={9} />} label={`${s.taskCount} tasks`} />
        </>
      )}
      {s.focusMinutes > 0 && (
        <>
          <div className="w-px h-3 bg-border/40" />
          <StatPill icon={<Clock size={9} />} label={`${fmtMins(s.focusMinutes)} planned`} accent />
        </>
      )}
      {s.breakMinutes > 0 && (
        <>
          <div className="w-px h-3 bg-border/40" />
          <StatPill icon={<Coffee size={9} />} label={`${s.breakMinutes}m breaks`} />
        </>
      )}
      {trackedMins > 0 && (
        <>
          <div className="w-px h-3 bg-border/40" />
          <StatPill icon={<Clock size={9} />} label={`${fmtMins(trackedMins)} tracked`} color="text-emerald-500" />
        </>
      )}
      {focusMins > 0 && (
        <>
          <div className="w-px h-3 bg-border/40" />
          <StatPill icon={<Clock size={9} />} label={`${fmtMins(focusMins)} focus`} color="text-amber-500" />
        </>
      )}
    </div>
  );
}

function StatPill({
  icon, label, accent = false, color,
}: { icon: React.ReactNode; label: string; accent?: boolean; color?: string }) {
  return (
    <div className={cn(
      "flex items-center gap-1.5 text-[10px] font-medium tabular-nums tracking-wide",
      color ?? (accent ? "text-primary" : "text-muted-foreground/60")
    )}>
      <span className={cn("opacity-70", (accent || color) && "opacity-100")}>{icon}</span>
      {label}
    </div>
  );
}

// ── Custom Plan Modal ─────────────────────────────────────────

function CustomPlanModal({ onClose }: { onClose: () => void }) {
  const {
    activeDate, templates,
    loadTemplates, savePlanTemplate, deleteTemplate, applyTemplate,
    getBlocksForDate,
  } = usePlannerStore();

  const [newName,  setNewName]  = useState("");
  const [saving,   setSaving]   = useState(false);
  const [applying, setApplying] = useState<string | null>(null);

  useEffect(() => { void loadTemplates(); }, [loadTemplates]);

  const todayBlocks = getBlocksForDate(activeDate);

  async function handleSave() {
    if (!newName.trim()) return;
    setSaving(true);
    await savePlanTemplate(newName.trim(), activeDate);
    setNewName("");
    setSaving(false);
  }

  async function handleApply(id: string) {
    setApplying(id);
    await applyTemplate(id, activeDate);
    setApplying(null);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />

      <div className="relative w-full max-w-md mx-4 rounded-xl bg-card border border-border shadow-xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <BookTemplate size={14} className="text-primary" />
            <h3 className="text-sm font-semibold">Custom Plan Templates</h3>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-fast">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">

          {/* Save today as template */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Save today as template</p>
            {todayBlocks.length === 0 ? (
              <p className="text-xs text-muted-foreground/60 italic">No blocks on {format(parseISO(activeDate), "MMM d")} — add blocks first.</p>
            ) : (
              <div className="flex gap-2">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void handleSave()}
                  placeholder={`e.g. "Deep Work Day" (${todayBlocks.length} blocks)`}
                  className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                />
                <button
                  onClick={() => void handleSave()}
                  disabled={!newName.trim() || saving}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  <Save size={12} />
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            )}
          </div>

          {/* Templates list */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Saved templates</p>
            {templates.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <BookTemplate size={24} className="text-muted-foreground/20" />
                <p className="text-xs text-muted-foreground/60">No templates yet.<br />Save today's plan to reuse it later.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {templates.map((t) => (
                  <div key={t.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border bg-background hover:border-primary/30 transition-colors group">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t.name}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {t.blocks.length} blocks · {format(parseISO(t.createdAt), "MMM d, yyyy")}
                      </p>
                      {/* Block time preview */}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {t.blocks.slice(0, 5).map((b, i) => (
                          <span key={i}
                            className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                            style={{
                              background: b.color ? `${b.color}20` : "hsl(var(--muted))",
                              color:      b.color ?? "hsl(var(--muted-foreground))",
                            }}>
                            {b.startTime} {b.title}
                          </span>
                        ))}
                        {t.blocks.length > 5 && (
                          <span className="text-[9px] text-muted-foreground">+{t.blocks.length - 5} more</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => void handleApply(t.id)}
                        disabled={applying === t.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors disabled:opacity-50"
                      >
                        <Plus size={10} />
                        {applying === t.id ? "Applying…" : "Apply"}
                      </button>
                      <button
                        onClick={() => void deleteTemplate(t.id)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete template"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
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

// ── Module root ───────────────────────────────────────────────

export function PlannerModule() {
  const {
    activeDate, view, setView,
    loadBlocks, loadWeekBlocks,
    goToday, goNextDay, goPrevDay, goNextWeek, goPrevWeek,
    getBlocksForDate,
  } = usePlannerStore();

  const tasks = useTaskStore((s) => s.tasks);
  const { loadTasks } = useTaskStore();

  const [showPlanModal, setShowPlanModal] = useState(false);

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
          <button onClick={prev}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/70 transition-all duration-150">
            <ChevronLeft size={13} />
          </button>
          <button onClick={goToday}
            className={cn(
              "px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wide transition-all duration-150",
              isToday
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"
            )}>
            Today
          </button>
          <button onClick={next}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/70 transition-all duration-150">
            <ChevronRight size={13} />
          </button>
        </div>

        {/* Range label */}
        <span className="text-[12px] font-medium text-foreground/80 min-w-[200px] text-center tabular-nums tracking-tight select-none">
          {rangeLabel}
        </span>

        <ViewSwitcher options={VIEW_OPTIONS} value={view} onChange={setView} />

        {/* Custom Plan button */}
        <button
          onClick={() => setShowPlanModal(true)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title="Custom plan templates"
        >
          <BookTemplate size={12} />
          Plan
        </button>
      </PageHeader>

      {/* Stats bar (day view only — shows live tracked+focus time) */}
      {view === "day" && <StatsBar date={activeDate} />}

      <div className="flex flex-1 overflow-hidden">
        <TaskSidebar visibleDates={displayDates} />

        <div className="flex flex-col flex-1 overflow-hidden">

          {/* Multi-day column headers */}
          {view !== "day" && (
            <div className="flex border-b border-border/60 shrink-0 bg-surface-1/30">
              <div className="w-10 shrink-0" />
              {displayDates.map((date, i) => {
                const d          = parseISO(date);
                const isDay      = date === toISODate(new Date());
                const weekDayIdx = view === "week" ? i : (d.getDay() + 6) % 7;
                const blockCount = getBlocksForDate(date).length;
                // task count: scheduled tasks for this date
                const taskCount  = tasks.filter((t) => t.scheduledDate === date && t.status !== "done").length;
                // time tracking entries for this date
                const timeEntries = useTimeStore.getState().entries;
                const trackedMins = timeEntries
                  .filter((e) => e.endAt && e.startAt.startsWith(date))
                  .reduce((a, e) => a + (e.durationMinutes ?? 0), 0);
                return (
                  <button key={date}
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
                    {/* Block + task + tracked time chips */}
                    <div className="mt-1.5 flex items-center gap-1 flex-wrap justify-center">
                      {blockCount > 0 && (
                        <span className={cn(
                          "text-[9px] font-medium tabular-nums px-1 rounded",
                          isDay ? "text-primary/70 bg-primary/10" : "text-muted-foreground/50 bg-muted/50"
                        )}>
                          {blockCount}b
                        </span>
                      )}
                      {taskCount > 0 && (
                        <span className="text-[9px] font-medium tabular-nums px-1 rounded text-amber-600 bg-amber-500/10">
                          {taskCount}t
                        </span>
                      )}
                      {trackedMins > 0 && (
                        <span className="text-[9px] font-medium tabular-nums px-1 rounded text-emerald-600 bg-emerald-500/10">
                          {fmtMins(trackedMins)}
                        </span>
                      )}
                      {blockCount === 0 && taskCount === 0 && (
                        <span className="mt-1.5 text-[9px] opacity-0">·</span>
                      )}
                    </div>
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
                <div key={h} className="absolute left-0 right-0 flex justify-end pr-2"
                  style={{ top: (h - 6) * 64 - 8 }}>
                  <span className={cn(
                    "text-[9px] font-medium tabular-nums tracking-wide",
                    h === 12 ? "text-muted-foreground/60" : "text-muted-foreground/30"
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

      {/* Custom plan modal */}
      {showPlanModal && <CustomPlanModal onClose={() => setShowPlanModal(false)} />}
    </div>
  );
}
