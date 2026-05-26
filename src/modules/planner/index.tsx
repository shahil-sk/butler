// ============================================================
// PLANNER MODULE — index.tsx
// New: week utilisation bar, today-column highlight ring,
//      block count badges on view tabs, drag-hint tooltip
// ============================================================

import { useEffect, useState } from "react";
import {
  ChevronLeft, ChevronRight, CalendarDays, LayoutGrid, Columns3,
  Clock, Coffee, Layers, BookTemplate, Plus, Save, Trash2, CheckSquare,
  Percent,
} from "lucide-react";
import { registry } from "@/kernel/router";
import { usePlannerStore, type PlannerView } from "./store";
import { useTaskStore } from "@/modules/tasks/store";
import { useTimeStore } from "@/modules/time-tracking/store";
import { useFocusStore } from "@/modules/focus/store";
import { DayColumn } from "./components/DayColumn";
import { TaskSidebar } from "./components/TaskSidebar";
import { Button } from "@/components/Button";

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
const WORK_HOURS = 8 * 60; // 480 min = target work day

// ── Helpers ─────────────────────────────────────────────────

function fmtMins(m: number) {
  const h = Math.floor(m / 60), r = m % 60;
  return h > 0 ? (r > 0 ? `${h}h ${r}m` : `${h}h`) : `${m}m`;
}

function toMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// ── Week utilisation bar ──────────────────────────────────────

function WeekUtilBar({ weekDates }: { weekDates: string[] }) {
  const blocks = usePlannerStore((s) => s.blocks);

  const days = weekDates.map((date) => {
    const dayBlocks = blocks.filter((b) => b.date === date && !b.isBreak);
    const plannedMins = dayBlocks.reduce(
      (acc, b) => acc + (toMin(b.endTime) - toMin(b.startTime)), 0
    );
    const pct = Math.min(100, Math.round((plannedMins / WORK_HOURS) * 100));
    const isToday = date === toISODate(new Date());
    return { date, pct, plannedMins, isToday };
  });

  const totalMins = days.reduce((a, d) => a + d.plannedMins, 0);
  const weekPct   = Math.min(100, Math.round((totalMins / (WORK_HOURS * 5)) * 100));

  return (
    <div className="flex items-center gap-3 px-6 py-2 border-b border-border/30 shrink-0">
      <div className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
        <Percent size={9} />
        <span className="font-medium tabular-nums">{weekPct}%</span>
        <span className="opacity-60">week</span>
      </div>
      <div className="flex flex-1 items-end gap-1" style={{ height: 20 }}>
        {days.map(({ date, pct, isToday }) => (
          <div key={date} className="flex-1 flex flex-col items-center gap-0.5">
            <div className="w-full rounded-sm overflow-hidden bg-muted/50" style={{ height: 12 }}>
              <div
                className={cn(
                  "h-full rounded-sm transition-all duration-500",
                  pct >= 80 ? "bg-primary" :
                  pct >= 50 ? "bg-primary/60" :
                  "bg-primary/25"
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className={cn(
              "text-[8px] tabular-nums",
              isToday ? "text-primary font-semibold" : "text-muted-foreground/30"
            )}>
              {WEEK_DAYS[(new Date(date).getDay() + 6) % 7].slice(0, 1)}
            </span>
          </div>
        ))}
      </div>
      <span className="text-[11px] tabular-nums text-muted-foreground/50 font-medium shrink-0">
        {fmtMins(totalMins)}
      </span>
    </div>
  );
}

// ── StatsBar ───────────────────────────────────────────────────
function StatsBar({ date }: { date: string }) {
  const { getDayStats }  = usePlannerStore();
  const timeEntries      = useTimeStore((s) => s.entries);
  const focusSessions    = useFocusStore((s) => s.sessions);

  const s = getDayStats(date);

  const trackedMins = timeEntries
    .filter((e) => e.endAt && e.startAt.startsWith(date))
    .reduce((a, e) => a + (e.durationMinutes ?? 0), 0);

  const focusMins = focusSessions
    .filter((fs) => fs.type === "focus" && fs.completedAt && fs.startedAt?.startsWith(date))
    .reduce((a, fs) => a + (fs.actualMinutes ?? 0), 0);

  const totalTracked = trackedMins + focusMins;
  if (s.totalBlocks === 0 && totalTracked === 0) return null;

  return (
    <div className="flex items-center gap-3 px-6 py-2.5 border-b border-border/40 bg-surface-1/40 shrink-0 backdrop-blur-sm flex-wrap">
      {s.totalBlocks > 0 && <StatPill icon={<Layers size={9} />} label={`${s.totalBlocks} blocks`} />}
      {s.taskCount > 0 && (
        <><div className="w-px h-3 bg-border/40" />
        <StatPill icon={<CheckSquare size={9} />} label={`${s.taskCount} tasks`} /></>)}
      {s.focusMinutes > 0 && (
        <><div className="w-px h-3 bg-border/40" />
        <StatPill icon={<Clock size={9} />} label={`${fmtMins(s.focusMinutes)} planned`} accent /></>)}
      {s.breakMinutes > 0 && (
        <><div className="w-px h-3 bg-border/40" />
        <StatPill icon={<Coffee size={9} />} label={`${s.breakMinutes}m breaks`} /></>)}
      {trackedMins > 0 && (
        <><div className="w-px h-3 bg-border/40" />
        <StatPill icon={<Clock size={9} />} label={`${fmtMins(trackedMins)} tracked`} color="text-emerald-500" /></>)}
      {focusMins > 0 && (
        <><div className="w-px h-3 bg-border/40" />
        <StatPill icon={<Clock size={9} />} label={`${fmtMins(focusMins)} focus`} color="text-amber-500" /></>)}
    </div>
  );
}

function StatPill({ icon, label, accent = false, color }: { icon: React.ReactNode; label: string; accent?: boolean; color?: string }) {
  return (
    <div className={cn(
      "flex items-center gap-1.5 text-[11px] font-medium tabular-nums",
      color ?? (accent ? "text-primary" : "text-muted-foreground/60")
    )}>
      <span className={cn("opacity-60", (accent || color) && "opacity-100")}>{icon}</span>
      {label}
    </div>
  );
}

// ── Custom Plan Modal ────────────────────────────────────────────
function CustomPlanModal({ onClose }: { onClose: () => void }) {
  const { activeDate, templates, loadTemplates, savePlanTemplate, deleteTemplate, applyTemplate, getBlocksForDate } = usePlannerStore();
  const [newName, setNewName]   = useState("");
  const [saving, setSaving]     = useState(false);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-md mx-4 rounded-2xl bg-card/75 border border-border/40 shadow-premium flex flex-col max-h-[80vh] glass-panel animate-modal-in">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-border/40 shrink-0">
          <div className="flex items-center gap-2">
            <BookTemplate size={14} className="text-primary animate-pulse" />
            <h3 className="text-sm font-bold text-gradient">Custom Plan Templates</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-fast">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Save today as template</p>
            {todayBlocks.length === 0 ? (
              <p className="text-xs text-muted-foreground/60 italic">No blocks on {format(parseISO(activeDate), "MMM d")} — add blocks first.</p>
            ) : (
              <div className="flex gap-2">
                <input
                  value={newName} onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void handleSave()}
                  placeholder={`e.g. "Deep Work Day" (${todayBlocks.length} blocks)`}
                  className="flex-1 px-3 py-2 rounded-xl border border-border bg-background/50 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
                />
                <button onClick={() => void handleSave()} disabled={!newName.trim() || saving}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 shadow-sm shadow-primary/20">
                  <Save size={12} />{saving ? "Saving…" : "Save"}
                </button>
              </div>
            )}
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Saved templates</p>
            {templates.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center bg-muted/20 border border-dashed border-border/60 rounded-2xl">
                <BookTemplate size={24} className="text-muted-foreground/20 animate-bounce" />
                <p className="text-xs text-muted-foreground/60">No templates yet.<br />Save today’s plan to reuse it later.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {templates.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 p-3 rounded-2xl border border-border bg-card hover:border-primary/30 transition-all duration-200 group glow-card shadow-sm">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{t.name}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{t.blocks.length} blocks · {format(parseISO(t.createdAt), "MMM d, yyyy")}</p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {t.blocks.slice(0, 5).map((b, i) => (
                          <span key={i} className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                            style={{ background: b.color ? `${b.color}20` : "hsl(var(--muted))", color: b.color ?? "hsl(var(--muted-foreground))" }}>
                            {b.startTime} {b.title}
                          </span>
                        ))}
                        {t.blocks.length > 5 && <span className="text-[9px] text-muted-foreground">+{t.blocks.length - 5} more</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => void handleApply(t.id)} disabled={applying === t.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors disabled:opacity-50">
                        <Plus size={10} />{applying === t.id ? "Applying…" : "Apply"}
                      </button>
                      <button onClick={() => void deleteTemplate(t.id)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors opacity-0 group-hover:opacity-100">
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

  useEffect(() => { if (tasks.length === 0) void loadTasks(); }, []);

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

  const prev = view === "week" ? goPrevWeek : goPrevDay;
  const next = view === "week" ? goNextWeek : goNextDay;

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

      {/* Row 1: Title + actions */}
      <div className="flex items-center justify-between px-6 pt-6 pb-3 shrink-0">
        <div>
          <h1 className="text-[20px] font-bold leading-tight tracking-tight text-gradient">Planner</h1>
          <p className="text-[12px] text-muted-foreground mt-0.5 leading-tight font-medium">{rangeLabel}</p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1 bg-muted/40 dark:bg-muted/10 p-0.5 border border-border/40 rounded-xl">
            <Button variant="ghost" size="sm" onClick={prev} className="p-1.5 h-7 w-7">
              <ChevronLeft size={13} />
            </Button>
            <Button
              variant={isToday ? "secondary" : "ghost"}
              size="sm"
              onClick={goToday}
              className="h-7 text-[11px] font-bold"
            >
              Today
            </Button>
            <Button variant="ghost" size="sm" onClick={next} className="p-1.5 h-7 w-7">
              <ChevronRight size={13} />
            </Button>
          </div>
          <div className="w-px h-4 bg-border/40" />
          <Button variant="secondary" size="sm" onClick={() => setShowPlanModal(true)} className="h-8 gap-1.5 text-[12px] font-semibold">
            <BookTemplate size={13} className="text-primary" /> Templates
          </Button>
        </div>
      </div>

      {/* Row 2: View tabs with block count badges */}
      <div className="flex items-center px-6 py-2 border-b border-border/40 shrink-0 bg-surface-1/10">
        <div className="flex items-center gap-1 p-0.5 bg-muted/40 dark:bg-muted/25 border border-border/30 rounded-xl">
          {VIEW_OPTIONS.map(({ value, icon: Icon, label }) => {
            const dateSet = value === "week" ? weekDates : value === "3day" ? threeDates : [activeDate];
            const blockCount = dateSet.reduce((a, d) => a + getBlocksForDate(d).length, 0);
            return (
              <button
                key={value}
                onClick={() => setView(value)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-bold transition-all duration-200",
                  view === value
                    ? "bg-background text-foreground shadow-sm shadow-black/5 border border-border/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/40",
                )}
              >
                <Icon size={12} />
                {label}
                {blockCount > 0 && (
                  <span className={cn(
                    "text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full ml-1",
                    view === value
                      ? "bg-primary/10 text-primary"
                      : "bg-muted/80 text-muted-foreground/60"
                  )}>
                    {blockCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Stats bar (day view only) */}
      {view === "day" && <StatsBar date={activeDate} />}

      {/* Week utilisation bar (week/3day view) */}
      {view !== "day" && <WeekUtilBar weekDates={displayDates} />}

      <div className="flex flex-1 overflow-hidden">
        <TaskSidebar visibleDates={displayDates} />

        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Multi-day column headers */}
          {view !== "day" && (
            <div className="flex border-b border-border/50 shrink-0 bg-surface-1/20">
              <div className="w-10 shrink-0" />
              {displayDates.map((date, i) => {
                const d          = parseISO(date);
                const isDay      = date === toISODate(new Date());
                const weekDayIdx = view === "week" ? i : (d.getDay() + 6) % 7;
                const blockCount = getBlocksForDate(date).length;
                const taskCount  = tasks.filter((t) => t.scheduledDate === date && t.status !== "done").length;
                const trackedMins = useTimeStore.getState().entries
                  .filter((e) => e.endAt && e.startAt.startsWith(date))
                  .reduce((a, e) => a + (e.durationMinutes ?? 0), 0);
                return (
                  <button key={date}
                    onClick={() => { usePlannerStore.getState().setActiveDate(date); setView("day"); }}
                    className={cn(
                      "flex-1 flex flex-col items-center py-3 text-xs transition-colors hover:bg-accent/40 group",
                      isDay && "text-primary"
                    )}
                  >
                    <span className={cn(
                      "text-[10px] font-semibold tracking-widest uppercase mb-1.5",
                      isDay ? "text-primary/70" : "text-muted-foreground/40"
                    )}>
                      {WEEK_DAYS[weekDayIdx]}
                    </span>
                    {/* Today highlight ring */}
                    <span className={cn(
                      "w-7 h-7 flex items-center justify-center rounded-full text-[13px] font-semibold transition-colors",
                      isDay
                        ? "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-1"
                        : "text-foreground/80 group-hover:bg-accent"
                    )}>
                      {format(d, "d")}
                    </span>
                    <div className="mt-2 flex items-center gap-1 flex-wrap justify-center min-h-[16px]">
                      {blockCount > 0 && (
                        <span className={cn(
                          "text-[9px] font-medium tabular-nums px-1.5 py-0.5 rounded",
                          isDay ? "text-primary/80 bg-primary/10" : "text-muted-foreground/50 bg-muted/60"
                        )}>{blockCount}b</span>
                      )}
                      {taskCount > 0 && (
                        <span className="text-[9px] font-medium tabular-nums px-1.5 py-0.5 rounded text-amber-600 bg-amber-500/10">{taskCount}t</span>
                      )}
                      {trackedMins > 0 && (
                        <span className="text-[9px] font-medium tabular-nums px-1.5 py-0.5 rounded text-emerald-600 bg-emerald-500/10">{fmtMins(trackedMins)}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Scrollable grid */}
          <div className="flex flex-1 overflow-y-auto overflow-x-hidden">
            <div className="w-10 shrink-0 relative select-none" style={{ height: 1024 }}>
              {Array.from({ length: 16 }, (_, i) => i + 6).map((h) => (
                <div key={h} className="absolute left-0 right-0 flex justify-end pr-2" style={{ top: (h - 6) * 64 - 8 }}>
                  <span className={cn(
                    "text-[9px] font-medium tabular-nums leading-none",
                    h === 12 ? "text-muted-foreground/60" : "text-muted-foreground/30"
                  )}>
                    {h === 12 ? "12p" : h > 12 ? `${h - 12}p` : `${h}a`}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex flex-1 min-h-full" style={{ minHeight: 1024 }}>
              {view === "day" ? (
                <DayColumn date={activeDate} />
              ) : (
                <>
                  {displayDates.map((date) => (
                    <div
                      key={date}
                      className={cn(
                        "flex-1 border-l border-border/40 first:border-l-0",
                        date === toISODate(new Date()) && "bg-primary/[0.015]"
                      )}
                    >
                      <DayColumn date={date} compact={view === "week"} />
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {showPlanModal && <CustomPlanModal onClose={() => setShowPlanModal(false)} />}
    </div>
  );
}
