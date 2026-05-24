// ============================================================
// TASKS MODULE — index.tsx
// New: sort dropdown, priority filter chips, bulk-select mode,
//      confetti on overdue→0, cross-module focus-cancel wire
// ============================================================

import { useEffect, useState, useRef } from "react";
import {
  Plus, LayoutGrid, List, CheckSquare,
  ChevronDown, AlertTriangle, SortAsc,
  CheckCheck, Trash2, CalendarClock, X,
} from "lucide-react";
import { useLocation } from "react-router-dom";
import { registry } from "@/kernel/router";
import { bus } from "@/kernel/event-bus";
import { tasksManifest } from "./manifest";
import { useTaskStore } from "./store";
import { setupTaskEventListeners } from "./events";
import { useProjectStore } from "@/modules/projects/store";
import { TaskCard } from "./components/TaskCard";
import { QuickAdd } from "./components/QuickAdd";
import { FilterBar, PrimaryButton, EmptyState, type FilterTab } from "@/shared/ui";
import { cn } from "@/shared/utils";
import type { Priority } from "@/shared/types";

registry.register(tasksManifest);

// ─── Types ───────────────────────────────────────────────────
type Task = ReturnType<ReturnType<typeof useTaskStore>["getFilteredTasks"]>[number];
type GroupId = "overdue" | "today" | "in_progress" | "todo" | "done";

interface TaskGroup {
  id: GroupId;
  label: string;
  colorClass: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  stripClass: string;
  defaultOpen: boolean;
}

// ─── Group config ────────────────────────────────────────────
const GROUPS: TaskGroup[] = [
  {
    id: "overdue",
    label: "Overdue",
    colorClass: "text-red-500",
    bgClass: "bg-red-100 dark:bg-red-950/60",
    textClass: "text-red-700 dark:text-red-300",
    borderClass: "border-l-red-500",
    stripClass: "bg-red-50/60 dark:bg-red-950/20",
    defaultOpen: true,
  },
  {
    id: "today",
    label: "Due Today",
    colorClass: "text-amber-500",
    bgClass: "bg-amber-100 dark:bg-amber-950/60",
    textClass: "text-amber-700 dark:text-amber-300",
    borderClass: "border-l-amber-500",
    stripClass: "bg-amber-50/60 dark:bg-amber-950/20",
    defaultOpen: true,
  },
  {
    id: "in_progress",
    label: "In Progress",
    colorClass: "text-blue-500",
    bgClass: "bg-blue-100 dark:bg-blue-950/60",
    textClass: "text-blue-700 dark:text-blue-300",
    borderClass: "border-l-blue-500",
    stripClass: "bg-blue-50/40 dark:bg-blue-950/20",
    defaultOpen: true,
  },
  {
    id: "todo",
    label: "To Do",
    colorClass: "text-foreground",
    bgClass: "bg-muted",
    textClass: "text-muted-foreground",
    borderClass: "border-l-border",
    stripClass: "bg-transparent",
    defaultOpen: true,
  },
  {
    id: "done",
    label: "Completed",
    colorClass: "text-emerald-500",
    bgClass: "bg-emerald-100 dark:bg-emerald-950/60",
    textClass: "text-emerald-700 dark:text-emerald-300",
    borderClass: "border-l-emerald-500",
    stripClass: "bg-emerald-50/40 dark:bg-emerald-950/20",
    defaultOpen: false,
  },
];

// ─── Sort options ─────────────────────────────────────────────
const SORT_OPTIONS = [
  { id: "manual",    label: "Manual order" },
  { id: "dueDate",   label: "Due date" },
  { id: "priority",  label: "Priority" },
  { id: "createdAt", label: "Created date" },
  { id: "title",     label: "Title" },
] as const;

// ─── Priority filter chips ────────────────────────────────────
const PRIORITY_CHIPS: { id: Priority | "all"; label: string; dot: string }[] = [
  { id: "all",    label: "All",    dot: "bg-muted-foreground/30" },
  { id: "urgent", label: "Urgent", dot: "bg-red-500" },
  { id: "high",   label: "High",   dot: "bg-orange-400" },
  { id: "medium", label: "Medium", dot: "bg-yellow-400" },
  { id: "low",    label: "Low",    dot: "bg-blue-400" },
];

// ─── Helpers ─────────────────────────────────────────────────
const isOverdue = (task: Task): boolean => {
  if (!task.dueDate || task.status === "done") return false;
  return new Date(task.dueDate) < new Date(new Date().toDateString());
};

const isToday = (task: Task): boolean => {
  if (!task.dueDate || task.status === "done") return false;
  return new Date(task.dueDate).toDateString() === new Date().toDateString();
};

const bucketTask = (task: Task): GroupId => {
  if (task.status === "done") return "done";
  if (isOverdue(task)) return "overdue";
  if (isToday(task)) return "today";
  if (task.status === "in_progress") return "in_progress";
  return "todo";
};

// ─── Confetti (vanilla canvas — no library) ───────────────────
function fireConfetti() {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999";
  document.body.appendChild(canvas);
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext("2d")!;
  const particles = Array.from({ length: 90 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height * 0.4,
    vx: (Math.random() - 0.5) * 4,
    vy: Math.random() * 3 + 1,
    color: ["#22c55e","#3b82f6","#f59e0b","#ec4899","#8b5cf6"][Math.floor(Math.random() * 5)],
    size: Math.random() * 6 + 3,
    angle: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.2,
  }));
  let frame = 0;
  const MAX = 90;
  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.07; p.angle += p.spin;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, 1 - frame / MAX);
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.5);
      ctx.restore();
    }
    frame++;
    if (frame < MAX) requestAnimationFrame(tick);
    else canvas.remove();
  }
  tick();
}

// ─── Filter tabs ──────────────────────────────────────────────
const FILTER_TABS: FilterTab[] = [
  { id: "all",      label: "All" },
  { id: "today",    label: "Today" },
  { id: "upcoming", label: "Upcoming" },
  { id: "overdue",  label: "Overdue" },
  { id: "inbox",    label: "Inbox" },
];

// ─── KPI card ─────────────────────────────────────────────────
function KpiCard({
  label, value, total, accent, warn = false,
}: {
  label: string; value: number; total: number; accent: string; warn?: boolean;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="rounded-xl border border-border bg-card px-4 pt-3 pb-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        {warn && value > 0 && <AlertTriangle size={12} className="text-red-500 shrink-0" />}
      </div>
      <p className={cn(
        "text-[26px] font-bold tabular-nums leading-none",
        warn && value > 0 ? "text-red-500" : "text-foreground",
      )}>
        {value}
      </p>
      <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-500", accent)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Sort dropdown ────────────────────────────────────────────
function SortDropdown({ value, onChange }: {
  value: string;
  onChange: (v: "manual" | "dueDate" | "priority" | "createdAt" | "title") => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const current = SORT_OPTIONS.find((o) => o.id === value);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-colors border",
          open
            ? "bg-accent border-border text-foreground"
            : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent"
        )}
      >
        <SortAsc size={12} />
        {current?.label}
        <ChevronDown size={11} className={cn("transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-40 rounded-xl border border-border bg-popover shadow-lg py-1">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => { onChange(opt.id); setOpen(false); }}
              className={cn(
                "w-full text-left px-3 py-2 text-[13px] transition-colors hover:bg-accent",
                value === opt.id ? "text-foreground font-semibold" : "text-muted-foreground"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Priority filter chips ─────────────────────────────────────
function PriorityFilter({ value, onChange }: {
  value: Priority | "all";
  onChange: (v: Priority | "all") => void;
}) {
  return (
    <div className="flex items-center gap-1.5 px-6 py-2 shrink-0">
      <span className="text-[11px] text-muted-foreground/50 font-medium mr-1">Priority:</span>
      {PRIORITY_CHIPS.map((chip) => (
        <button
          key={chip.id}
          onClick={() => onChange(chip.id)}
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all",
            value === chip.id
              ? "bg-foreground text-background"
              : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", chip.dot)} />
          {chip.label}
        </button>
      ))}
    </div>
  );
}

// ─── Bulk action bar ──────────────────────────────────────────
function BulkActionBar({
  selectedIds,
  onComplete,
  onDelete,
  onReschedule,
  onClear,
}: {
  selectedIds: Set<string>;
  onComplete: () => void;
  onDelete: () => void;
  onReschedule: () => void;
  onClear: () => void;
}) {
  const count = selectedIds.size;
  if (count === 0) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl border border-border bg-card shadow-xl">
      <span className="text-[13px] font-semibold tabular-nums text-foreground mr-2">
        {count} selected
      </span>
      <button
        onClick={onComplete}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[12px] font-medium hover:bg-emerald-500/20 transition-colors"
      >
        <CheckCheck size={13} /> Mark done
      </button>
      <button
        onClick={onReschedule}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[12px] font-medium hover:bg-blue-500/20 transition-colors"
      >
        <CalendarClock size={13} /> Reschedule
      </button>
      <button
        onClick={onDelete}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-[12px] font-medium hover:bg-destructive/20 transition-colors"
      >
        <Trash2 size={13} /> Delete
      </button>
      <button
        onClick={onClear}
        className="ml-1 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        title="Clear selection"
      >
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Reschedule modal (simple) ────────────────────────────────
function RescheduleModal({ onConfirm, onClose }: {
  onConfirm: (date: string) => void;
  onClose: () => void;
}) {
  const [date, setDate] = useState("");
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />
      <div className="relative w-72 rounded-xl border border-border bg-card shadow-xl p-5 flex flex-col gap-4">
        <h3 className="text-sm font-semibold">Reschedule tasks</h3>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
        />
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => { if (date) { onConfirm(date); onClose(); } }}
            disabled={!date}
            className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Task group section ───────────────────────────────────────
function TaskGroupSection({
  group, tasks, view, openQuickAdd, selectMode, selectedIds, onSelect,
}: {
  group: TaskGroup;
  tasks: Task[];
  view: "grid" | "list";
  openQuickAdd: () => void;
  selectMode: boolean;
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(group.defaultOpen);
  const dotColor = group.colorClass.replace("text-", "bg-");

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2.5 mb-3">
        <span className={cn("w-2 h-2 rounded-full shrink-0", dotColor)} aria-hidden />
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 group"
        >
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground group-hover:text-foreground transition-colors">
            {group.label}
          </span>
          <span className={cn(
            "text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded",
            tasks.length > 0 ? cn(group.bgClass, group.textClass) : "text-muted-foreground/40",
          )}>
            {tasks.length}
          </span>
          <ChevronDown
            size={12}
            className={cn(
              "text-muted-foreground/40 group-hover:text-muted-foreground transition-all duration-200",
              open ? "rotate-0" : "-rotate-90",
            )}
          />
        </button>
        <div className="flex-1 h-px bg-border/50" />
        {group.id !== "done" && (
          <button
            onClick={openQuickAdd}
            className="text-muted-foreground/40 hover:text-foreground transition-colors rounded p-0.5"
            title={`Add to ${group.label}`}
          >
            <Plus size={13} />
          </button>
        )}
      </div>

      {open && tasks.length > 0 && (
        <div className={cn(
          view === "grid"
            ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
            : "flex flex-col gap-1.5",
        )}>
          {tasks.map((t) => (
            <div
              key={t.id}
              className={cn(
                "relative",
                selectMode && "cursor-pointer",
                selectMode && selectedIds.has(t.id) && "ring-2 ring-primary rounded-xl"
              )}
              onClick={selectMode ? (e) => { e.preventDefault(); e.stopPropagation(); onSelect(t.id); } : undefined}
            >
              {selectMode && (
                <div className={cn(
                  "absolute top-2 left-2 z-10 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors",
                  selectedIds.has(t.id)
                    ? "bg-primary border-primary"
                    : "bg-background border-muted-foreground/40"
                )}>
                  {selectedIds.has(t.id) && <CheckCheck size={10} className="text-primary-foreground" />}
                </div>
              )}
              <TaskCard key={t.id} task={t} view={view} />
            </div>
          ))}
        </div>
      )}

      {open && tasks.length === 0 && (
        <p className="text-[12px] text-muted-foreground/40 pl-0 py-1 italic">No tasks</p>
      )}
    </div>
  );
}

// ─── Main module ──────────────────────────────────────────────
export function TasksModule() {
  const {
    loadTasks,
    getFilteredTasks,
    quickAddOpen,
    openQuickAdd,
    setActiveRoute,
    activeRoute,
    getOverdueTasks,
    getTodayTasks,
    setSortBy,
    sortBy,
    batchUpdate,
    batchDelete,
  } = useTaskStore();

  const loadProjects = useProjectStore((s) => s.loadProjects);
  const location = useLocation();

  const [localView,     setLocalView]     = useState<"grid" | "list">("grid");
  const [layout,        setLayout]        = useState<"grouped" | "flat">("grouped");
  const [activePriority, setActivePriority] = useState<Priority | "all">("all");
  const [selectMode,    setSelectMode]    = useState(false);
  const [selectedIds,   setSelectedIds]   = useState<Set<string>>(new Set());
  const [showReschedule, setShowReschedule] = useState(false);

  // Track previous overdue count to fire confetti when it hits 0
  const prevOverdueRef = useRef(0);

  useEffect(() => {
    void loadTasks();
    void loadProjects();
    const cleanup = setupTaskEventListeners();
    return cleanup;
  }, []);

  useEffect(() => {
    const segment = location.pathname.split("/")[2] ?? "";
    setActiveRoute(segment || "all");
  }, [location.pathname, setActiveRoute]);

  // Confetti when overdue count drops to 0
  const rawTasks    = getFilteredTasks();
  const overdueCount = getOverdueTasks().length;
  useEffect(() => {
    if (prevOverdueRef.current > 0 && overdueCount === 0) {
      fireConfetti();
    }
    prevOverdueRef.current = overdueCount;
  }, [overdueCount]);

  const todayCount      = getTodayTasks().length;
  const doneCount       = rawTasks.filter((t) => t.status === "done").length;
  const inProgressCount = rawTasks.filter((t) => t.status === "in_progress").length;

  // Apply priority filter on top of store filter
  const tasks = activePriority === "all"
    ? rawTasks
    : rawTasks.filter((t) => t.priority === activePriority);

  const handleFilterSelect = (id: string) => {
    setActiveRoute(id);
    const paths: Record<string, string> = {
      all: "/tasks", today: "/tasks/today",
      upcoming: "/tasks/upcoming", overdue: "/tasks/overdue", inbox: "/tasks/inbox",
    };
    bus.emit("navigate:to", { path: paths[id] ?? "/tasks" });
  };

  const grouped = GROUPS.map((g) => ({
    group: g,
    tasks: tasks.filter((t) => bucketTask(t) === g.id),
  }));

  // ── Bulk select helpers ───────────────────────────────────
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setSelectMode(false);
  }

  async function handleBulkComplete() {
    await batchUpdate([...selectedIds], { status: "done", completedAt: new Date().toISOString() });
    clearSelection();
  }

  async function handleBulkDelete() {
    if (!confirm(`Delete ${selectedIds.size} task(s)? This cannot be undone.`)) return;
    await batchDelete([...selectedIds]);
    clearSelection();
  }

  async function handleBulkReschedule(date: string) {
    await batchUpdate([...selectedIds], { dueDate: date, scheduledDate: date });
    clearSelection();
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Row 1: Title + actions ──────────────────────── */}
      <div className="flex items-center justify-between px-6 pt-6 pb-3 shrink-0">
        <div>
          <h1 className="text-[18px] font-bold leading-tight tracking-tight">Tasks</h1>
          <p className="text-[12px] leading-tight flex items-center gap-1.5 mt-0.5">
            <span className="text-muted-foreground">
              {rawTasks.length} task{rawTasks.length !== 1 ? "s" : ""}
            </span>
            {overdueCount > 0 && (
              <span className="inline-flex items-center gap-1 text-red-500 font-medium">
                <AlertTriangle size={10} />
                {overdueCount} overdue
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Select mode toggle */}
          <button
            onClick={() => { setSelectMode((v) => !v); setSelectedIds(new Set()); }}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium border transition-colors",
              selectMode
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
          >
            <CheckCheck size={13} />
            {selectMode ? "Selecting" : "Select"}
          </button>
          <PrimaryButton onClick={() => openQuickAdd()}>
            <Plus size={13} />
            New task
          </PrimaryButton>
        </div>
      </div>

      {/* ── Row 2: View switcher + sort ────────────────── */}
      <div className="flex items-center px-6 border-b border-border shrink-0">
        {([
          { id: "board",   icon: LayoutGrid,  label: "Board"   },
          { id: "list",    icon: List,         label: "List"    },
          { id: "grouped", icon: CheckSquare,  label: "Grouped" },
        ] as const).map(({ id, icon: Icon, label }) => {
          const active =
            id === "board"   ? localView === "grid" && layout === "flat" :
            id === "list"    ? localView === "list" && layout === "flat" :
            layout === "grouped";
          return (
            <button
              key={id}
              onClick={() => {
                if (id === "board")   { setLocalView("grid");  setLayout("flat"); }
                if (id === "list")    { setLocalView("list");  setLayout("flat"); }
                if (id === "grouped") { setLayout("grouped"); }
              }}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-3 text-[13px] font-medium",
                "border-b-2 -mb-px transition-colors",
                active
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
              )}
            >
              <Icon size={13} />
              {label}
            </button>
          );
        })}
        <div className="ml-auto pb-1">
          <SortDropdown
            value={sortBy}
            onChange={(v) => setSortBy(v)}
          />
        </div>
      </div>

      {/* ── KPI strip ──────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3 px-6 py-4 shrink-0">
        <KpiCard label="Total"       value={rawTasks.length}  total={rawTasks.length}  accent="bg-foreground/30" />
        <KpiCard label="In Progress" value={inProgressCount}  total={rawTasks.length}  accent="bg-blue-500" />
        <KpiCard label="Completed"   value={doneCount}        total={rawTasks.length}  accent="bg-emerald-500" />
        <KpiCard label="Overdue"     value={overdueCount}     total={rawTasks.length}  accent="bg-red-500" warn />
      </div>

      {/* ── Filter bar ─────────────────────────────────── */}
      <FilterBar
        tabs={FILTER_TABS.map((t) => ({
          ...t,
          badge:
            t.id === "today"   ? todayCount   :
            t.id === "overdue" ? overdueCount : undefined,
        }))}
        activeId={activeRoute}
        onSelect={handleFilterSelect}
      />

      {/* ── Priority filter chips ───────────────────────── */}
      <PriorityFilter value={activePriority} onChange={setActivePriority} />

      {/* ── Content ─────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {tasks.length === 0 ? (
          <EmptyState
            title={
              activeRoute === "today"    ? "Nothing due today"   :
              activeRoute === "upcoming" ? "All clear ahead"     :
              activeRoute === "overdue"  ? "All caught up"       :
              activeRoute === "inbox"    ? "Inbox is empty"      :
              "No tasks yet"
            }
            subtitle={
              activeRoute === "today"    ? "Enjoy the clear schedule."          :
              activeRoute === "upcoming" ? "No upcoming tasks scheduled."       :
              activeRoute === "overdue"  ? "No overdue tasks."                  :
              activeRoute === "inbox"    ? "Unassigned tasks will appear here." :
              "Create your first task to get started."
            }
            action={{ label: "New task", onClick: () => openQuickAdd() }}
          />
        ) : layout === "grouped" ? (
          <div className="flex flex-col">
            {grouped.map(({ group, tasks: groupTasks }) => (
              <TaskGroupSection
                key={group.id}
                group={group}
                tasks={groupTasks}
                view={localView}
                openQuickAdd={openQuickAdd}
                selectMode={selectMode}
                selectedIds={selectedIds}
                onSelect={toggleSelect}
              />
            ))}
          </div>
        ) : localView === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {tasks.map((t) => (
              <div
                key={t.id}
                className={cn(
                  "relative",
                  selectMode && "cursor-pointer",
                  selectMode && selectedIds.has(t.id) && "ring-2 ring-primary rounded-xl"
                )}
                onClick={selectMode ? (e) => { e.preventDefault(); e.stopPropagation(); toggleSelect(t.id); } : undefined}
              >
                {selectMode && (
                  <div className={cn(
                    "absolute top-2 left-2 z-10 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors",
                    selectedIds.has(t.id) ? "bg-primary border-primary" : "bg-background border-muted-foreground/40"
                  )}>
                    {selectedIds.has(t.id) && <CheckCheck size={10} className="text-primary-foreground" />}
                  </div>
                )}
                <TaskCard task={t} view="grid" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {tasks.map((t) => (
              <div
                key={t.id}
                className={cn(
                  "relative",
                  selectMode && "cursor-pointer",
                  selectMode && selectedIds.has(t.id) && "ring-2 ring-primary rounded-lg"
                )}
                onClick={selectMode ? (e) => { e.preventDefault(); e.stopPropagation(); toggleSelect(t.id); } : undefined}
              >
                {selectMode && (
                  <div className={cn(
                    "absolute top-2 left-2 z-10 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors",
                    selectedIds.has(t.id) ? "bg-primary border-primary" : "bg-background border-muted-foreground/40"
                  )}>
                    {selectedIds.has(t.id) && <CheckCheck size={10} className="text-primary-foreground" />}
                  </div>
                )}
                <TaskCard task={t} view="list" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Bulk action bar ─────────────────────────────── */}
      <BulkActionBar
        selectedIds={selectedIds}
        onComplete={() => void handleBulkComplete()}
        onDelete={() => void handleBulkDelete()}
        onReschedule={() => setShowReschedule(true)}
        onClear={clearSelection}
      />

      {showReschedule && (
        <RescheduleModal
          onConfirm={(date) => void handleBulkReschedule(date)}
          onClose={() => setShowReschedule(false)}
        />
      )}

      {quickAddOpen && <QuickAdd />}
    </div>
  );
}
