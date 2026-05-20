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
    <div className="flex items-center gap-3 px-6 py-2.5 border-b border-border/40 bg-surface-1/40 shrink-0 backdrop-blur-sm flex-wrap">
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
      "flex items-center gap-1.5 text-[11px] font-medium tabular-nums",
      color ?? (accent ? "text-primary" : "text-muted-foreground/60")
    )}>
      <span className={cn("opacity-60", (accent || color) && "opacity-100")}>{icon}</span>
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

          {/* Existing templates */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Apply a saved template</p>
            {templates.length === 0 ? (
              <p className="text-xs text-muted-foreground/60 italic">No templates saved yet.</p>
            ) : (
              <div className="space-y-1.5">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => void handleApply(t.id)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-border bg-background text-xs hover:border-primary/40 hover:bg-primary/5 transition-fast"
                    disabled={!!applying}
                  >
                    <span className="truncate">{t.name}</span>
                    <span className="flex items-center gap-2 text-[10px] text-muted-foreground/60">
                      <span>{t.blocks.length} blocks</span>
                      {applying === t.id && <span className="italic">Applying…</span>}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <p className="text-[10px] text-muted-foreground/60 border-t border-border pt-2 mt-2">
            Templates capture the structure of your day (blocks, colors, breaks) so you can quickly reuse your best routines.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main Planner Component ────────────────────────────────────

export default function PlannerPage() {
  const { activeDate, setActiveDate, view, setView } = usePlannerStore();
  const [showTemplates, setShowTemplates] = useState(false);

  const active = parseISO(activeDate);
  const weekStart = startOfWeek(active, { weekStartsOn: 1 });

  const visibleDates: string[] = (() => {
    if (view === "day") return [activeDate];
    if (view === "3day") return [0, 1, 2].map((i) => toISODate(addDays(active, i)));
    return Array.from({ length: 7 }, (_, i) => toISODate(addDays(weekStart, i)));
  })();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-surface-1/60 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveDate(toISODate(addDays(active, view === "week" ? -7 : -1)))}
            className="p-1.5 rounded-md border border-border/60 hover:bg-accent transition-fast"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => setActiveDate(toISODate(new Date()))}
            className="px-2.5 py-1.5 rounded-md border border-primary/70 bg-primary/10 text-[11px] font-semibold text-primary hover:bg-primary/15 transition-fast"
          >
            Today
          </button>
          <button
            onClick={() => setActiveDate(toISODate(addDays(active, view === "week" ? 7 : 1)))}
            className="p-1.5 rounded-md border border-border/60 hover:bg-accent transition-fast"
          >
            <ChevronRight size={14} />
          </button>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">
              {view === "week"
                ? `${format(weekStart, "MMM d")} – ${format(addDays(weekStart, 6), "MMM d, yyyy")}`
                : format(active, "EEEE, MMM d, yyyy")}
            </span>
            {view !== "week" && (
              <span className="text-[11px] text-muted-foreground/70">
                Plan your deep work, breaks, and meetings in one place.
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex items-center rounded-md border border-border bg-background text-[11px]">
            {VIEW_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setView(opt.value)}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1.5 rounded-md transition-fast",
                  view === opt.value
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent"
                )}
              >
                <opt.icon size={11} />
                {opt.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowTemplates(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border bg-background text-[11px] font-medium text-muted-foreground hover:bg-accent transition-fast"
          >
            <BookTemplate size={11} />
            Templates
          </button>
        </div>
      </div>

      {/* Stats bar for active day (only in day/3-day views) */}
      {view !== "week" && <StatsBar date={activeDate} />}

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Planner grid */}
        <div className="flex-1 flex flex-col border-r border-border bg-surface-1/40">
          {/* Day columns header */}
          <div className="grid" style={{ gridTemplateColumns: `repeat(${visibleDates.length}, minmax(0, 1fr))` }}>
            {visibleDates.map((d, idx) => {
              const dObj = parseISO(d);
              const isToday = d === toISODate(new Date());
              return (
                <button
                  key={d}
                  onClick={() => setActiveDate(d)}
                  className={cn(
                    "flex flex-col items-start gap-0.5 px-6 py-2 border-b border-border/60 bg-surface-1/60",
                    idx > 0 && "border-l border-border/60",
                    d === activeDate && "bg-primary/5"
                  )}
                >
                  <span className="text-[11px] font-medium text-muted-foreground/70 flex items-center gap-1">
                    {view === "week" && (
                      <span className="w-6 text-left text-[10px] text-muted-foreground/60 uppercase tracking-widest">
                        {WEEK_DAYS[dObj.getDay() === 0 ? 6 : dObj.getDay() - 1]}
                      </span>
                    )}
                    {isToday && <span className="px-1 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-semibold">Today</span>}
                  </span>
                  <span className="text-sm font-semibold tabular-nums">
                    {format(dObj, view === "week" ? "MMM d" : "MMM d, yyyy")}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Day columns body */}
          <div className="flex flex-1 min-h-0">
            {visibleDates.map((d) => (
              <DayColumn key={d} date={d as any} compact={view === "week"} />
            ))}
          </div>
        </div>

        {/* Task sidebar */}
        <div className="w-[320px] shrink-0 bg-surface-2 border-l border-border">
          <TaskSidebar visibleDates={visibleDates} />
        </div>
      </div>

      {showTemplates && <CustomPlanModal onClose={() => setShowTemplates(false)} />}
    </div>
  );
}

// Named export so Shell.tsx lazy import resolves correctly:
// lazy(() => import("@/modules/planner").then((m) => ({ default: m.PlannerModule })))
export const PlannerModule = PlannerPage;
