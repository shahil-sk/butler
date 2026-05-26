// ============================================================
// TASKS MODULE — index.tsx  (REDESIGNED UI + DnD + Responsive)
// Backend: untouched. UI: fully rebuilt.
// Drag-and-drop: native HTML5 DnD, no external deps.
// Responsive: kanban collapses to scrollable stack on mobile.
// ============================================================

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Plus, LayoutGrid, List, Kanban,
  ChevronDown, AlertTriangle, SortAsc,
  CheckCheck, Trash2, CalendarClock, X,
  Filter, Clock, TrendingUp, Circle, GripVertical, Sparkles,
} from "lucide-react";
import { useLocation } from "react-router-dom";
import { registry } from "@/kernel/router";
import { bus } from "@/kernel/event-bus";
import { tasksManifest } from "./manifest";
import { useTaskStore } from "./store";
import { setupTaskEventListeners } from "./events";
import { useProjectStore } from "@/modules/projects/store";
import { TaskCard } from "./components/TaskCard";
import { TaskBoardView } from "./components/TaskBoardView";
import { QuickAdd } from "./components/QuickAdd";
import { TimelineView } from "./components/TimelineView";
import { PrimaryButton, EmptyState, type FilterTab } from "@/shared/ui";
import { cn } from "@/shared/utils";
import type { Task, Priority } from "@/shared/types";

registry.register(tasksManifest);

// ─── Types ───────────────────────────────────────────────────
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
const PRIORITY_CHIPS: { id: Priority | "all"; label: string; color: string; bg: string }[] = [
  { id: "all",    label: "All",    color: "text-muted-foreground", bg: "bg-muted/60" },
  { id: "urgent", label: "Urgent", color: "text-red-600 dark:text-red-400",       bg: "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800" },
  { id: "high",   label: "High",   color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800" },
  { id: "medium", label: "Medium", color: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-950/40 border-yellow-200 dark:border-yellow-800" },
  { id: "low",    label: "Low",    color: "text-blue-600 dark:text-blue-400",     bg: "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800" },
];

// ─── Kanban column config ─────────────────────────────────────
const KANBAN_COLS: {
  id: GroupId;
  label: string;
  accent: string;
  headerBg: string;
  countBg: string;
  countText: string;
  dropRing: string;
}[] = [
  {
    id: "overdue",
    label: "Overdue",
    accent: "border-t-red-500",
    headerBg: "bg-red-50/60 dark:bg-red-950/30",
    countBg: "bg-red-100 dark:bg-red-950/60",
    countText: "text-red-700 dark:text-red-300",
    dropRing: "ring-red-400/60",
  },
  {
    id: "today",
    label: "Due Today",
    accent: "border-t-amber-500",
    headerBg: "bg-amber-50/60 dark:bg-amber-950/30",
    countBg: "bg-amber-100 dark:bg-amber-950/60",
    countText: "text-amber-700 dark:text-amber-300",
    dropRing: "ring-amber-400/60",
  },
  {
    id: "in_progress",
    label: "In Progress",
    accent: "border-t-blue-500",
    headerBg: "bg-blue-50/40 dark:bg-blue-950/20",
    countBg: "bg-blue-100 dark:bg-blue-950/60",
    countText: "text-blue-700 dark:text-blue-300",
    dropRing: "ring-blue-400/60",
  },
  {
    id: "todo",
    label: "To Do",
    accent: "border-t-border",
    headerBg: "bg-muted/30",
    countBg: "bg-muted",
    countText: "text-muted-foreground",
    dropRing: "ring-border",
  },
  {
    id: "done",
    label: "Completed",
    accent: "border-t-emerald-500",
    headerBg: "bg-emerald-50/40 dark:bg-emerald-950/20",
    countBg: "bg-emerald-100 dark:bg-emerald-950/60",
    countText: "text-emerald-700 dark:text-emerald-300",
    dropRing: "ring-emerald-400/60",
  },
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
  if (task.status === "done" || task.status === "cancelled") return "done";
  if (isOverdue(task)) return "overdue";
  if (isToday(task)) return "today";
  if (task.status === "in_progress") return "in_progress";
  return "todo";
};

// Map GroupId → status update payload
const GROUP_TO_STATUS: Record<GroupId, Partial<Task>> = {
  overdue:     { status: "todo" },
  today:       { status: "todo" },
  in_progress: { status: "in_progress" },
  todo:        { status: "todo" },
  done:        { status: "done", completedAt: new Date().toISOString() },
};

// ─── Confetti ─────────────────────────────────────────────────
function fireConfetti() {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999";
  document.body.appendChild(canvas);
  canvas.width = window.innerWidth;
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
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
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

// ─── Stat Bar ────────────────────────────────────────────────
function StatBar({ total, inProgress, done, overdue, today }: {
  total: number; inProgress: number; done: number; overdue: number; today: number;
}) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const stats = [
    { label: "Total",       value: total,      icon: Circle,        iconCls: "text-muted-foreground/50" },
    { label: "In Progress", value: inProgress, icon: TrendingUp,    iconCls: "text-primary" },
    { label: "Done",        value: done,       icon: CheckCheck,    iconCls: "text-emerald-500" },
    { label: "Today",       value: today,      icon: Clock,         iconCls: "text-amber-500" },
    { label: "Overdue",     value: overdue,    icon: AlertTriangle, iconCls: overdue > 0 ? "text-red-500 animate-pulse" : "text-muted-foreground/30" },
  ];
  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-border/40 bg-card/40 backdrop-blur-md shrink-0 overflow-x-auto scrollbar-none">
      <div className="hidden lg:flex flex-col justify-center px-4 py-2 bg-black/5 dark:bg-white/5 border border-border/30 rounded-2xl min-w-[160px] shrink-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/50">Progress</span>
          <span className="text-[11px] font-bold tabular-nums text-foreground/80">{pct}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700 ease-spring" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="flex flex-1 gap-2 items-center">
        {stats.map(({ label, value, icon: Icon, iconCls }) => (
          <div
            key={label}
            className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-muted/40 border border-transparent hover:border-border/60 hover:bg-card hover:shadow-xs transition-all duration-300 ease-spring shrink-0"
          >
            <div className={cn("w-6 h-6 rounded-xl flex items-center justify-center bg-black/5 dark:bg-white/5 shrink-0", iconCls)}>
              <Icon size={12} className="shrink-0" />
            </div>
            <div>
              <p className="text-[15px] font-extrabold tabular-nums leading-none text-foreground">{value}</p>
              <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/60 mt-1 whitespace-nowrap hidden sm:block">{label}</p>
            </div>
          </div>
        ))}
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
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const current = SORT_OPTIONS.find((o) => o.id === value);
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1.5 h-8 px-3 rounded-xl text-[11px] font-bold transition-all duration-300 ease-spring active:scale-95 border",
          open ? "bg-foreground text-background border-foreground shadow-sm"
               : "border-border/50 text-muted-foreground hover:text-foreground hover:border-border bg-transparent"
        )}
      >
        <SortAsc size={12} />
        <span>{current?.label}</span>
        <ChevronDown size={11} className={cn("transition-transform duration-300 ease-spring", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-44 rounded-2xl border border-border/80 bg-popover/95 backdrop-blur-md shadow-premium p-1.5 flex flex-col gap-0.5 animate-in fade-in slide-in-from-top-2 duration-300 ease-spring">
          {SORT_OPTIONS.map((opt) => (
            <button key={opt.id} onClick={() => { onChange(opt.id); setOpen(false); }}
              className={cn("w-full text-left px-3.5 py-2 rounded-xl text-[11.5px] font-medium transition-all duration-300 ease-spring hover:bg-accent/80 active:scale-95",
                value === opt.id ? "text-foreground font-bold bg-accent/50" : "text-muted-foreground"
              )}>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Priority filter pills ────────────────────────────────────
function PriorityFilter({ value, onChange }: {
  value: Priority | "all";
  onChange: (v: Priority | "all") => void;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {PRIORITY_CHIPS.map((chip) => (
        <button key={chip.id} onClick={() => onChange(chip.id)}
          className={cn("h-8 px-3.5 rounded-xl text-[11px] font-bold transition-all duration-300 ease-spring active:scale-95 border",
            value === chip.id
              ? cn(chip.bg, chip.color, "shadow-sm border-border/80")
              : "border-transparent text-muted-foreground/70 hover:text-foreground hover:bg-accent/60 bg-transparent"
          )}>
          {chip.label}
        </button>
      ))}
    </div>
  );
}

// ─── Bulk action bar ──────────────────────────────────────────
function BulkActionBar({ selectedIds, onComplete, onDelete, onReschedule, onClear }: {
  selectedIds: Set<string>;
  onComplete: () => void; onDelete: () => void;
  onReschedule: () => void; onClear: () => void;
}) {
  const count = selectedIds.size;
  if (count === 0) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] p-1 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-2xl shadow-premium backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4 duration-300 ease-spring">
      <div className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 rounded-[calc(1rem-0.0625rem)] bg-card/90">
        <span className="text-[11.5px] font-bold tabular-nums text-foreground px-2.5 py-1 rounded-lg bg-foreground/[0.06] whitespace-nowrap">{count} selected</span>
        <div className="w-px h-4 bg-border/60 mx-0.5 shrink-0" />
        <button onClick={onComplete} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold transition-all duration-300 ease-spring active:scale-95 border border-emerald-500/10 whitespace-nowrap">
          <CheckCheck size={12} strokeWidth={2.5} /><span className="hidden xs:inline">Done</span>
        </button>
        <button onClick={onReschedule} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-bold transition-all duration-300 ease-spring active:scale-95 border border-primary/10 whitespace-nowrap">
          <CalendarClock size={12} strokeWidth={2.25} /><span className="hidden sm:inline">Reschedule</span>
        </button>
        <button onClick={onDelete} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-destructive/10 hover:bg-destructive/20 text-destructive text-[11px] font-bold transition-all duration-300 ease-spring active:scale-95 border border-destructive/15 whitespace-nowrap">
          <Trash2 size={12} strokeWidth={2.25} /><span className="hidden xs:inline">Delete</span>
        </button>
        <button onClick={onClear} className="ml-0.5 w-7 h-7 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-300 ease-spring active:scale-90 shrink-0">
          <X size={13} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}

// ─── Reschedule modal ─────────────────────────────────────────
function RescheduleModal({ onConfirm, onClose }: {
  onConfirm: (date: string) => void; onClose: () => void;
}) {
  const [date, setDate] = useState("");
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-background/70 backdrop-blur-md" />
      <div className="relative w-full max-w-xs p-1.5 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-[2rem] shadow-premium animate-modal-in flex flex-col">
        <div className="flex-1 flex flex-col bg-card rounded-[calc(2rem-0.375rem)] p-6 gap-4 border border-border/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-foreground">Reschedule Tasks</h3>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-accent transition-all duration-300 ease-spring active:scale-90 text-muted-foreground hover:text-foreground">
              <X size={14} strokeWidth={2.5} />
            </button>
          </div>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40" />
          <div className="flex gap-2.5 mt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-xs font-bold hover:bg-muted transition-all duration-300 ease-spring active:scale-95 text-muted-foreground">Cancel</button>
            <button onClick={() => { if (date) { onConfirm(date); onClose(); } }} disabled={!date}
              className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-all duration-300 ease-spring active:scale-95 disabled:opacity-40">Apply</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Task group section (list/board views) ────────────────────
function TaskGroupSection({ group, tasks, view, openQuickAdd, selectMode, selectedIds, onSelect }: {
  group: TaskGroup; tasks: Task[]; view: "grid" | "list";
  openQuickAdd: () => void; selectMode: boolean;
  selectedIds: Set<string>; onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(group.defaultOpen);
  const accentDot = { overdue: "bg-red-500", today: "bg-amber-500", in_progress: "bg-blue-500", todo: "bg-muted-foreground/40", done: "bg-emerald-500" }[group.id];
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2 cursor-pointer group/hdr select-none" onClick={() => setOpen((v) => !v)}>
        <span className={cn("w-2 h-2 rounded-full shrink-0", accentDot)} />
        <span className={cn("text-[11px] font-bold uppercase tracking-widest transition-colors", open ? "text-foreground/80" : "text-muted-foreground/60", "group-hover/hdr:text-foreground")}>{group.label}</span>
        <span className={cn("text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-md", tasks.length > 0 ? cn(group.bgClass, group.textClass) : "text-muted-foreground/30")}>{tasks.length}</span>
        <div className="flex-1 h-px bg-border/40" />
        {group.id !== "done" && (
          <button onClick={(e) => { e.stopPropagation(); openQuickAdd(); }}
            className="opacity-0 group-hover/hdr:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground/60 hover:text-foreground">
            <Plus size={12} />
          </button>
        )}
        <ChevronDown size={12} className={cn("text-muted-foreground/40 transition-transform duration-200", open ? "rotate-0" : "-rotate-90")} />
      </div>
      {open && tasks.length > 0 && (
        <div className={cn(view === "grid" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3" : "flex flex-col gap-1.5")}>
          {tasks.map((t) => (
            <div key={t.id} className={cn("relative", selectMode && "cursor-pointer", selectMode && selectedIds.has(t.id) && "ring-2 ring-primary rounded-xl")}
              onClick={selectMode ? (e) => { e.preventDefault(); e.stopPropagation(); onSelect(t.id); } : undefined}>
              {selectMode && (
                <div className={cn("absolute top-3 left-3 z-10 w-4 h-4 rounded-md border-2 flex items-center justify-center transition-all",
                  selectedIds.has(t.id) ? "bg-primary border-primary" : "bg-background/90 border-muted-foreground/40")}>
                  {selectedIds.has(t.id) && <CheckCheck size={10} className="text-primary-foreground" />}
                </div>
              )}
              <TaskCard task={t} view={view} />
            </div>
          ))}
        </div>
      )}
      {open && tasks.length === 0 && <p className="text-[11px] text-muted-foreground/35 italic pl-4 py-1">No tasks</p>}
    </div>
  );
}

// ─── View toggle ─────────────────────────────────────────────
function ViewToggle({ localView, layout, setLocalView, setLayout }: {
  localView: "grid" | "list";
  layout: "kanban" | "board" | "grouped" | "flat" | "timeline";
  setLocalView: (v: "grid" | "list") => void;
  setLayout: (v: "kanban" | "board" | "grouped" | "flat" | "timeline") => void;
}) {
  const options = [
    { id: "kanban",   icon: Kanban,     label: "Kanban"   },
    { id: "board",    icon: LayoutGrid, label: "Board"    },
    { id: "list",     icon: List,       label: "List"     },
    { id: "timeline", icon: Clock,      label: "Timeline" },
  ] as const;

  const activeId =
    layout === "kanban" || layout === "grouped" ? "kanban" :
    layout === "board"    ? "board" :
    layout === "timeline" ? "timeline" :
    layout === "flat"     ? "list" : "kanban";

  return (
    <div className="flex gap-0.5 bg-muted/50 p-1 rounded-2xl border border-border/30 shrink-0">
      {options.map(({ id, icon: Icon, label }) => (
        <button key={id} title={label}
          onClick={() => {
            if (id === "kanban")   setLayout("kanban");
            if (id === "board")    setLayout("board");
            if (id === "list")     { setLocalView("list");  setLayout("flat"); }
            if (id === "timeline") setLayout("timeline");
          }}
          className={cn("inline-flex items-center gap-1.5 h-8 px-2.5 sm:px-3 rounded-xl text-[11px] font-bold transition-all duration-300 ease-spring active:scale-95",
            activeId === id ? "bg-card text-foreground shadow-sm border border-border/10" : "text-muted-foreground/60 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5")}>
          <Icon size={12} />
          <span className="hidden xs:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Nav tabs ─────────────────────────────────────────────────
function NavTabs({ tabs, activeId, onSelect, overdueCount, todayCount }: {
  tabs: FilterTab[]; activeId: string; onSelect: (id: string) => void;
  overdueCount: number; todayCount: number;
}) {
  return (
    <div className="flex gap-1 bg-muted/50 p-1 rounded-2xl border border-border/30 w-max max-w-full overflow-x-auto scrollbar-none shrink-0 mb-1">
      {tabs.map((tab) => {
        const badge = tab.id === "overdue" ? overdueCount : tab.id === "today" ? todayCount : undefined;
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            className={cn(
              "inline-flex items-center gap-2 h-8 px-4 rounded-xl text-[11.5px] font-bold whitespace-nowrap transition-all duration-300 ease-spring active:scale-95",
              isActive
                ? "bg-card text-foreground shadow-sm border border-border/10"
                : "text-muted-foreground/60 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
            )}
          >
            {tab.label}
            {badge !== undefined && badge > 0 && (
              <span className={cn(
                "inline-flex items-center justify-center min-w-[16px] h-4 px-1.5 rounded-full text-[9px] font-extrabold text-white shrink-0",
                tab.id === "overdue" ? "bg-red-500 shadow-sm" : "bg-amber-500 shadow-sm"
              )}>
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// KANBAN VIEW — with native HTML5 drag-and-drop
// ─────────────────────────────────────────────────────────────

// Mobile column selector (shown on small screens instead of side-scroll)
function MobileColSelector({ cols, activeColId, onSelect }: {
  cols: typeof KANBAN_COLS;
  activeColId: GroupId;
  onSelect: (id: GroupId) => void;
}) {
  return (
    <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
      {cols.map((col) => (
        <button key={col.id} onClick={() => onSelect(col.id)}
          className={cn("flex-shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all",
            activeColId === col.id
              ? cn(col.countBg, col.countText, "border-transparent shadow-sm")
              : "border-border/40 text-muted-foreground/60 hover:text-foreground bg-transparent"
          )}>
          {col.label}
        </button>
      ))}
    </div>
  );
}

function KanbanView({ tasks, openQuickAdd, selectMode, selectedIds, onSelect, onDropTask }: {
  tasks: Task[];
  openQuickAdd: () => void;
  selectMode: boolean;
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  onDropTask: (taskId: string, targetCol: GroupId) => void;
}) {
  const [dragOverCol, setDragOverCol] = useState<GroupId | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  // Mobile: which column is currently shown
  const [mobileCol, setMobileCol] = useState<GroupId>("todo");
  // Detect mobile
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("taskId", taskId);
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(taskId);
    // Slightly delayed so the ghost renders properly
    setTimeout(() => {
      (e.target as HTMLElement).style.opacity = "0.4";
    }, 0);
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    (e.target as HTMLElement).style.opacity = "";
    setDraggingId(null);
    setDragOverCol(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, colId: GroupId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(colId);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if leaving the column entirely (not just a child)
    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
      setDragOverCol(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, colId: GroupId) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("taskId");
    if (taskId) onDropTask(taskId, colId);
    setDragOverCol(null);
    setDraggingId(null);
  }, [onDropTask]);

  // We'll show all columns but use horizontal scroll with snapping on mobile
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sync mobile selector with scroll position
  useEffect(() => {
    if (!isMobile || !scrollRef.current) return;
    const el = scrollRef.current;
    const handleScroll = () => {
      const index = Math.round(el.scrollLeft / el.offsetWidth);
      if (KANBAN_COLS[index]) setMobileCol(KANBAN_COLS[index].id);
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [isMobile]);

  // Jump to column when selector is used
  const scrollToCol = (id: GroupId) => {
    setMobileCol(id);
    if (!scrollRef.current) return;
    const index = KANBAN_COLS.findIndex(c => c.id === id);
    if (index !== -1) {
      scrollRef.current.scrollTo({
        left: index * scrollRef.current.offsetWidth,
        behavior: "smooth"
      });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Mobile column picker - now acts as an indicator/jump-to */}
      <div className="shrink-0 pb-3 px-4 sm:hidden">
        <MobileColSelector cols={KANBAN_COLS} activeColId={mobileCol} onSelect={scrollToCol} />
      </div>

      {/* Columns container */}
      <div 
        ref={scrollRef}
        className={cn(
          "flex gap-3 flex-1 min-h-0 overflow-x-auto pb-4",
          "scrollbar-thin scrollbar-thumb-border/40 scrollbar-track-transparent",
          "snap-x snap-mandatory sm:snap-none px-4 sm:px-5"
        )}
      >
        {KANBAN_COLS.map((col) => {
          const colTasks = tasks.filter((t) => bucketTask(t) === col.id);
          const isOver = dragOverCol === col.id;
          return (
            <div
              key={col.id}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.id)}
              className={cn(
                "group/col relative p-1.5 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-[1.75rem] shadow-sm transition-all duration-300 ease-spring snap-center shrink-0 flex flex-col min-h-0",
                "w-[calc(100vw-40px)] sm:w-[260px] md:w-[260px] lg:w-[280px] xl:w-[300px] 2xl:w-[320px]",
                isOver && "scale-[1.01] bg-black/10 dark:bg-white/10 border-black/15 dark:border-white/15"
              )}
            >
              {/* Inner column container */}
              <div className="flex-1 flex flex-col bg-card rounded-[calc(1.75rem-0.375rem)] overflow-hidden shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
                {/* Column header */}
                <div className={cn(
                  "flex items-center justify-between px-3.5 py-3 border-b border-border/40 border-t-2 shrink-0",
                  col.accent, col.headerBg,
                )}>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-extrabold uppercase tracking-widest text-foreground/80">{col.label}</span>
                    <span className={cn("text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-md", col.countBg, col.countText)}>
                      {colTasks.length}
                    </span>
                  </div>
                  {col.id !== "done" && (
                    <button onClick={openQuickAdd}
                      className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-background/50 text-muted-foreground/60 hover:text-foreground transition-all duration-300 ease-spring active:scale-[0.85]">
                      <Plus size={12} />
                    </button>
                  )}
                </div>

                {/* Drop zone hint */}
                {isOver && (
                  <div className="mx-2 mt-2 h-10 rounded-xl border-2 border-dashed border-primary/35 bg-primary/5 flex items-center justify-center shrink-0">
                    <span className="text-[10px] text-primary/60 font-semibold">Drop here</span>
                  </div>
                )}

                {/* Cards */}
                <div className="flex-1 p-2 flex flex-col gap-2 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar">
                  {colTasks.length === 0 && !isOver && (
                    <div className="flex-1 flex items-center justify-center min-h-[120px] rounded-xl border border-dashed border-border/40 m-1 bg-muted/10">
                      <span className="text-[11px] text-muted-foreground/30 font-medium italic select-none">No tasks</span>
                    </div>
                  )}
                  {colTasks.map((t) => (
                    <div
                      key={t.id}
                      draggable={!selectMode}
                      onDragStart={(e) => handleDragStart(e, t.id)}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        "relative group/card",
                        !selectMode && "cursor-grab active:cursor-grabbing",
                        selectMode && "cursor-pointer",
                        selectMode && selectedIds.has(t.id) && "ring-2 ring-primary rounded-[1.5rem]",
                        draggingId === t.id && "opacity-40",
                      )}
                      onClick={selectMode ? (e) => { e.preventDefault(); e.stopPropagation(); onSelect(t.id); } : undefined}
                    >
                      {/* Drag handle indicator */}
                      {!selectMode && (
                        <div className="absolute top-3 right-8 z-10 opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 pointer-events-none">
                          <GripVertical size={11} className="text-muted-foreground/45" />
                        </div>
                      )}
                      {selectMode && (
                        <div className={cn("absolute top-3.5 left-3.5 z-10 w-4 h-4 rounded-md border-2 flex items-center justify-center transition-all duration-300 ease-spring",
                          selectedIds.has(t.id) ? "bg-primary border-primary scale-105" : "bg-background/90 border-muted-foreground/40")}>
                          {selectedIds.has(t.id) && <CheckCheck size={10} className="text-primary-foreground" />}
                        </div>
                      )}
                      <TaskCard task={t} view="grid" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main module ──────────────────────────────────────────────
export function TasksModule() {
  const {
    loadTasks, getFilteredTasks, quickAddOpen, openQuickAdd,
    setActiveRoute, activeRoute, getOverdueTasks, getTodayTasks,
    setSortBy, sortBy, batchUpdate, batchDelete, updateTask,
    parseAndCreateTask,
  } = useTaskStore();

  const loadProjects = useProjectStore((s) => s.loadProjects);
  const location = useLocation();

  const [localView,          setLocalView]          = useState<"grid" | "list">("grid");
  const [layout,             setLayout]             = useState<"kanban" | "board" | "grouped" | "flat" | "timeline">("kanban");
  const [activePriority,     setActivePriority]     = useState<Priority | "all">("all");
  const [selectMode,         setSelectMode]         = useState(false);
  const [selectedIds,        setSelectedIds]        = useState<Set<string>>(new Set());
  const [showReschedule,     setShowReschedule]     = useState(false);
  const [showPriorityFilter, setShowPriorityFilter] = useState(false);
  const [nlpInput,           setNlpInput]           = useState("");
  const [nlpFocused,         setNlpFocused]         = useState(false);
  const [nlpSubmitting,      setNlpSubmitting]      = useState(false);
  const nlpRef = useRef<HTMLInputElement>(null);

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

  const rawTasks     = getFilteredTasks();
  const overdueCount = getOverdueTasks().length;

  useEffect(() => {
    if (prevOverdueRef.current > 0 && overdueCount === 0) fireConfetti();
    prevOverdueRef.current = overdueCount;
  }, [overdueCount]);

  const todayCount      = getTodayTasks().length;
  const doneCount       = rawTasks.filter((t) => t.status === "done").length;
  const inProgressCount = rawTasks.filter((t) => t.status === "in_progress").length;

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

  // ── Drag-and-drop handler ─────────────────────────────────
  const handleDropTask = useCallback(async (taskId: string, targetCol: GroupId) => {
    const task = rawTasks.find((t) => t.id === taskId);
    if (!task) return;
    // Don't update if already in that bucket
    if (bucketTask(task) === targetCol) return;
    const patch = GROUP_TO_STATUS[targetCol];
    await updateTask(taskId, patch);
  }, [rawTasks, updateTask]);

  // ── Bulk select helpers ────────────────────────────────────
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function clearSelection() { setSelectedIds(new Set()); setSelectMode(false); }

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

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">

      {/* ══ HEADER ══════════════════════════════════════════════ */}
      <div className="shrink-0 px-4 sm:px-5 pt-4 sm:pt-5 pb-3 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-2 sm:gap-3 min-w-0 overflow-hidden">
            <h1 className="text-xl font-extrabold tracking-tight text-foreground leading-none whitespace-nowrap">Tasks</h1>
            {overdueCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-500/10 text-red-500 text-[11px] font-bold border border-red-500/20 whitespace-nowrap shrink-0">
                <AlertTriangle size={10} className="animate-pulse shrink-0" />
                {overdueCount}
              </span>
            )}
            <span className="text-[11px] text-muted-foreground/50 font-medium tabular-nums hidden sm:block whitespace-nowrap">
              {rawTasks.length} task{rawTasks.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={() => { setSelectMode((v) => !v); setSelectedIds(new Set()); }}
              className={cn(
                "inline-flex items-center gap-1.5 h-8 px-2.5 sm:px-3 rounded-xl text-[11px] font-semibold border transition-all duration-150",
                selectMode ? "bg-primary text-primary-foreground border-primary"
                          : "border-border/50 text-muted-foreground hover:text-foreground hover:border-border bg-transparent"
              )}>
              <CheckCheck size={12} />
              <span className="hidden sm:inline">{selectMode ? "Selecting" : "Select"}</span>
            </button>
            <PrimaryButton onClick={() => openQuickAdd()}>
              <Plus size={12} />
              <span className="hidden xs:inline">New Task</span>
              <span className="xs:hidden">New</span>
            </PrimaryButton>
          </div>
        </div>

        {/* NLP QuickAdd bar */}
        <div className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-xl border transition-all duration-200",
          nlpFocused
            ? "border-primary/40 bg-card shadow-sm ring-2 ring-primary/15"
            : "border-border/40 bg-muted/20 hover:border-border/60"
        )}>
          <Sparkles size={13} className={cn("shrink-0 transition-colors", nlpFocused ? "text-primary" : "text-muted-foreground/40")} />
          <input
            ref={nlpRef}
            value={nlpInput}
            onChange={(e) => setNlpInput(e.target.value)}
            onFocus={() => setNlpFocused(true)}
            onBlur={() => setNlpFocused(false)}
            onKeyDown={async (e) => {
              if (e.key === "Enter" && nlpInput.trim()) {
                setNlpSubmitting(true);
                try {
                  await parseAndCreateTask(nlpInput.trim());
                  setNlpInput("");
                } finally {
                  setNlpSubmitting(false);
                }
              } else if (e.key === "Escape") {
                setNlpInput("");
                nlpRef.current?.blur();
              }
            }}
            placeholder='Quick add — try "finish report tomorrow 3pm #work !high"'
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/35 text-foreground"
            disabled={nlpSubmitting}
          />
          {nlpInput && (
            <button
              onClick={() => setNlpInput("")}
              className="shrink-0 p-0.5 rounded text-muted-foreground/40 hover:text-foreground transition-colors"
            >
              <X size={11} />
            </button>
          )}
          {nlpSubmitting && (
            <div className="shrink-0 w-3.5 h-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          )}
        </div>
      </div>

      {/* ══ STATS BAR ══════════════════════════════════════════ */}
      <StatBar total={rawTasks.length} inProgress={inProgressCount} done={doneCount} overdue={overdueCount} today={todayCount} />

      {/* ══ TOOLBAR ════════════════════════════════════════════ */}
      <div className="shrink-0 px-4 sm:px-5 pt-3 pb-0 flex flex-col gap-2">
        <NavTabs tabs={FILTER_TABS} activeId={activeRoute} onSelect={handleFilterSelect} overdueCount={overdueCount} todayCount={todayCount} />

        <div className="flex items-center justify-between gap-2 pb-2">
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none flex-nowrap min-w-0">
            <ViewToggle localView={localView} layout={layout} setLocalView={setLocalView} setLayout={(v) => setLayout(v as "kanban" | "board" | "grouped" | "flat" | "timeline")} />

            <button
              onClick={() => setShowPriorityFilter((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1.5 h-8 px-2.5 sm:px-3 rounded-xl text-[11px] font-semibold border transition-all duration-150 shrink-0",
                (showPriorityFilter || activePriority !== "all")
                  ? "bg-foreground text-background border-foreground"
                  : "border-border/50 text-muted-foreground hover:text-foreground hover:border-border bg-transparent"
              )}>
              <Filter size={11} />
              <span className="hidden xs:inline">{activePriority === "all" ? "Filter" : `${activePriority}`}</span>
              {activePriority !== "all" && (
                <span className="w-3.5 h-3.5 flex items-center justify-center rounded-full bg-background/20 hover:bg-background/40 transition-colors text-[9px]"
                  onClick={(e) => { e.stopPropagation(); setActivePriority("all"); }}>×</span>
              )}
            </button>

            {showPriorityFilter && <PriorityFilter value={activePriority} onChange={setActivePriority} />}
          </div>

          <SortDropdown value={sortBy} onChange={(v) => setSortBy(v)} />
        </div>
      </div>

      {/* ══ CONTENT ════════════════════════════════════════════ */}
      <div className={cn(
        "flex-1 min-h-0",
        layout === "kanban" || layout === "board" || layout === "timeline"
          ? "overflow-hidden flex flex-col"
          : "px-4 sm:px-5 py-3 sm:py-4 overflow-y-auto",
      )}>
        {tasks.length === 0 ? (
          <EmptyState
            title={
              activeRoute === "today"    ? "Nothing due today"   :
              activeRoute === "upcoming" ? "All clear ahead"     :
              activeRoute === "overdue"  ? "All caught up"       :
              activeRoute === "inbox"    ? "Inbox is empty"      : "No tasks yet"
            }
            subtitle={
              activeRoute === "today"    ? "Enjoy your clear schedule." :
              activeRoute === "upcoming" ? "No upcoming tasks scheduled." :
              activeRoute === "overdue"  ? "No overdue tasks. You're all caught up!" :
              activeRoute === "inbox"    ? "Unassigned tasks will appear here." :
              "Create your first task to get started."
            }
            action={{ label: "New Task", onClick: () => openQuickAdd() }}
          />
        ) : layout === "timeline" ? (
          <TimelineView />
        ) : layout === "board" ? (
          <TaskBoardView />
        ) : layout === "kanban" ? (
          <KanbanView
            tasks={tasks}
            openQuickAdd={openQuickAdd}
            selectMode={selectMode}
            selectedIds={selectedIds}
            onSelect={toggleSelect}
            onDropTask={handleDropTask}
          />
        ) : layout === "grouped" ? (
          <div>
            {grouped.map(({ group, tasks: groupTasks }) => (
              <TaskGroupSection key={group.id} group={group} tasks={groupTasks} view={localView}
                openQuickAdd={openQuickAdd} selectMode={selectMode} selectedIds={selectedIds} onSelect={toggleSelect} />
            ))}
          </div>
        ) : localView === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {tasks.map((t) => (
              <div key={t.id} className={cn("relative", selectMode && "cursor-pointer", selectMode && selectedIds.has(t.id) && "ring-2 ring-primary rounded-xl")}
                onClick={selectMode ? (e) => { e.preventDefault(); e.stopPropagation(); toggleSelect(t.id); } : undefined}>
                {selectMode && (
                  <div className={cn("absolute top-2.5 left-2.5 z-10 w-4 h-4 rounded-md border-2 flex items-center justify-center transition-all",
                    selectedIds.has(t.id) ? "bg-primary border-primary" : "bg-background/90 border-muted-foreground/40")}>
                    {selectedIds.has(t.id) && <CheckCheck size={10} className="text-primary-foreground" />}
                  </div>
                )}
                <TaskCard task={t} view="grid" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {tasks.map((t) => (
              <div key={t.id} className={cn("relative", selectMode && "cursor-pointer", selectMode && selectedIds.has(t.id) && "ring-2 ring-primary rounded-xl")}
                onClick={selectMode ? (e) => { e.preventDefault(); e.stopPropagation(); toggleSelect(t.id); } : undefined}>
                {selectMode && (
                  <div className={cn("absolute top-3 left-3 z-10 w-4 h-4 rounded-md border-2 flex items-center justify-center transition-all",
                    selectedIds.has(t.id) ? "bg-primary border-primary" : "bg-background/90 border-muted-foreground/40")}>
                    {selectedIds.has(t.id) && <CheckCheck size={10} className="text-primary-foreground" />}
                  </div>
                )}
                <TaskCard task={t} view="list" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══ BULK ACTION BAR ═════════════════════════════════════ */}
      <BulkActionBar
        selectedIds={selectedIds}
        onComplete={() => void handleBulkComplete()}
        onDelete={() => void handleBulkDelete()}
        onReschedule={() => setShowReschedule(true)}
        onClear={clearSelection}
      />

      {showReschedule && (
        <RescheduleModal onConfirm={(date) => void handleBulkReschedule(date)} onClose={() => setShowReschedule(false)} />
      )}

      {quickAddOpen && <QuickAdd />}
    </div>
  );
}
