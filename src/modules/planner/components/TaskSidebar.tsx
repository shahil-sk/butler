import { Search, ArrowUpDown, CalendarCheck, Clock, Plus, Info } from "lucide-react";
import { useState, useMemo } from "react";
import { cn, PRIORITY_COLORS, formatDate } from "@/shared/utils";
import { ProjectDot, PriorityDot, SectionLabel } from "@/shared/ui";
import { useTaskStore } from "@/modules/tasks/store";
import { useProjectStore } from "@/modules/projects/store";
import { useTimeStore } from "@/modules/time-tracking/store";
import { useFocusStore } from "@/modules/focus/store";
import { usePlannerStore } from "../store";
import { TaskDetailDrawer } from "./TaskDetailDrawer";
import { format, parseISO } from "date-fns";
import type { Task } from "@/shared/types";

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };

/** Compute total tracked minutes for a task (time entries + focus sessions) */
function useTaskTracked(taskId: string | undefined): number {
  const entries  = useTimeStore((s) => s.entries);
  const sessions = useFocusStore((s) => s.sessions);
  if (!taskId) return 0;
  const fromEntries  = entries.filter((e) => e.taskId === taskId && e.endAt).reduce((a, e) => a + (e.durationMinutes ?? 0), 0);
  const fromSessions = sessions.filter((s) => s.taskId === taskId && s.type === "focus" && s.completedAt).reduce((a, s) => a + (s.actualMinutes ?? 0), 0);
  return fromEntries + fromSessions;
}

function fmtMins(m: number) {
  const h = Math.floor(m / 60), r = m % 60;
  return h > 0 ? (r > 0 ? `${h}h ${r}m` : `${h}h`) : `${m}m`;
}

interface TaskSidebarProps {
  /** All dates currently visible in the planner grid */
  visibleDates: string[];
}

export function TaskSidebar({ visibleDates }: TaskSidebarProps) {
  const [search,         setSearch]         = useState("");
  const [sortByPri,      setSortByPri]      = useState(false);
  const [tab,            setTab]            = useState<"unscheduled" | "scheduled">("unscheduled");
  // Task detail drawer
  const [detailTaskId,   setDetailTaskId]   = useState<string | null>(null);

  const { tasks }    = useTaskStore();
  const { quickAddOpen, quickAddPrefill } = useTaskStore();
  const openQuickAdd = useTaskStore((s) => s.openQuickAdd);
  const { projects } = useProjectStore();
  const { activeDate, dragTaskId, setDragTaskId } = usePlannerStore();

  const isMultiDay = visibleDates.length > 1;

  const unscheduled = useMemo(() => {
    let base = tasks.filter(
      (t) =>
        t.status !== "done" &&
        t.status !== "archived" &&
        t.parentTaskId == null &&
        !visibleDates.includes(t.scheduledDate ?? "")
    );
    if (search) {
      const q = search.toLowerCase();
      base = base.filter((t) => t.title.toLowerCase().includes(q));
    }
    if (sortByPri) {
      base = [...base].sort((a, b) =>
        (PRIORITY_ORDER[a.priority ?? "none"] ?? 4) - (PRIORITY_ORDER[b.priority ?? "none"] ?? 4)
      );
    }
    return base;
  }, [tasks, search, sortByPri, visibleDates]);

  const scheduledByDate = useMemo(() => {
    const result: { date: string; tasks: Task[] }[] = [];
    for (const date of visibleDates) {
      const dayTasks = tasks.filter(
        (t) => t.scheduledDate === date && t.status !== "done" && t.status !== "archived"
      );
      if (dayTasks.length > 0) result.push({ date, tasks: dayTasks });
    }
    return result;
  }, [tasks, visibleDates]);

  const totalScheduled = scheduledByDate.reduce((a, g) => a + g.tasks.length, 0);

  const overdue  = unscheduled.filter((t) => t.dueDate && t.dueDate < activeDate);
  const upcoming = unscheduled.filter((t) => t.dueDate && t.dueDate >= activeDate);
  const noDate   = unscheduled.filter((t) => !t.dueDate);

  return (
    <div className="flex flex-row h-full">
      {/* ── Task list sidebar ───────────────────────────────── */}
      <div className="flex flex-col w-56 shrink-0 border-r border-border bg-surface-1 overflow-hidden">
        {/* Header */}
        <div className="px-3 py-2.5 border-b border-border shrink-0 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Tasks</p>
            <div className="flex items-center gap-0.5">
              {/* Quick-add task button */}
              <button
                onClick={() => openQuickAdd?.({ scheduledDate: activeDate })}
                title="Add task"
                className="p-1 rounded transition-fast text-muted-foreground/50 hover:text-primary hover:bg-primary/10"
              >
                <Plus size={11} />
              </button>
              <button
                onClick={() => setSortByPri((v) => !v)}
                title="Sort by priority"
                className={cn(
                  "p-1 rounded transition-fast",
                  sortByPri ? "text-primary bg-primary/10" : "text-muted-foreground/50 hover:text-foreground hover:bg-accent"
                )}
              >
                <ArrowUpDown size={11} />
              </button>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex rounded-md overflow-hidden border border-border">
            <button
              onClick={() => setTab("unscheduled")}
              className={cn(
                "flex-1 py-1 text-[10px] font-medium transition-colors",
                tab === "unscheduled" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
              )}>
              Backlog {unscheduled.length > 0 && `(${unscheduled.length})`}
            </button>
            <button
              onClick={() => setTab("scheduled")}
              className={cn(
                "flex-1 py-1 text-[10px] font-medium transition-colors border-l border-border",
                tab === "scheduled" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
              )}>
              Scheduled {totalScheduled > 0 && `(${totalScheduled})`}
            </button>
          </div>

          {tab === "unscheduled" && (
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-background border border-border">
              <Search size={11} className="text-muted-foreground/50 shrink-0" />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter tasks…"
                className="flex-1 text-xs bg-transparent outline-none placeholder:text-muted-foreground/40" />
            </div>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto py-1">

          {/* ── BACKLOG tab ── */}
          {tab === "unscheduled" && (
            <>
              {overdue.length > 0 && (
                <>
                  <SectionLabel>
                    Overdue
                    <span className="ml-1 px-1 rounded text-[9px] bg-rose-500/15 text-rose-500 font-semibold">{overdue.length}</span>
                  </SectionLabel>
                  {overdue.map((t) => (
                    <DraggableTask
                      key={t.id} task={t} projects={projects}
                      isDragging={dragTaskId === t.id}
                      isSelected={detailTaskId === t.id}
                      onSelect={() => setDetailTaskId(detailTaskId === t.id ? null : t.id)}
                    />
                  ))}
                </>
              )}
              {upcoming.length > 0 && (
                <>
                  <SectionLabel>
                    Due soon
                    <span className="ml-1 px-1 rounded text-[9px] bg-amber-500/15 text-amber-600 font-semibold">{upcoming.length}</span>
                  </SectionLabel>
                  {upcoming.map((t) => (
                    <DraggableTask
                      key={t.id} task={t} projects={projects}
                      isDragging={dragTaskId === t.id}
                      isSelected={detailTaskId === t.id}
                      onSelect={() => setDetailTaskId(detailTaskId === t.id ? null : t.id)}
                    />
                  ))}
                </>
              )}
              {noDate.length > 0 && (
                <>
                  <SectionLabel>
                    No date
                    <span className="ml-1 px-1 rounded text-[9px] bg-muted text-muted-foreground font-semibold">{noDate.length}</span>
                  </SectionLabel>
                  {noDate.map((t) => (
                    <DraggableTask
                      key={t.id} task={t} projects={projects}
                      isDragging={dragTaskId === t.id}
                      isSelected={detailTaskId === t.id}
                      onSelect={() => setDetailTaskId(detailTaskId === t.id ? null : t.id)}
                    />
                  ))}
                </>
              )}
              {unscheduled.length === 0 && (
                <div className="px-3 py-8 text-center">
                  <CalendarCheck size={20} className="mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground/60">
                    {search ? "No matching tasks" : "All tasks scheduled!"}
                  </p>
                </div>
              )}
            </>
          )}

          {/* ── SCHEDULED tab ── */}
          {tab === "scheduled" && (
            <>
              {scheduledByDate.length === 0 ? (
                <div className="px-3 py-8 text-center">
                  <CalendarCheck size={20} className="mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground/60">No tasks scheduled<br />in this view.</p>
                </div>
              ) : (
                scheduledByDate.map(({ date, tasks: dayTasks }) => (
                  <div key={date}>
                    <SectionLabel>
                      {isMultiDay
                        ? format(parseISO(date), date === new Date().toISOString().slice(0, 10) ? "'Today'" : "EEE, MMM d")
                        : "Scheduled today"}
                    </SectionLabel>
                    {dayTasks.map((t) => (
                      <ScheduledTaskRow
                        key={t.id} task={t} projects={projects}
                        isSelected={detailTaskId === t.id}
                        onSelect={() => setDetailTaskId(detailTaskId === t.id ? null : t.id)}
                      />
                    ))}
                  </div>
                ))
              )}
            </>
          )}
        </div>

        <p className="px-3 py-2 text-[10px] text-muted-foreground/40 border-t border-border shrink-0 text-center">
          Drag to schedule · Click for details
        </p>
      </div>

      {/* ── Task detail drawer (inline, to the right of sidebar) ── */}
      {detailTaskId && (
        <TaskDetailDrawer
          taskId={detailTaskId}
          onClose={() => setDetailTaskId(null)}
        />
      )}
    </div>
  );
}

// ── Draggable backlog task card ─────────────────────────────

function DraggableTask({
  task, projects, isDragging, isSelected, onSelect,
}: {
  task: Task;
  projects: ReturnType<typeof useProjectStore.getState>["projects"];
  isDragging: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { setDragTaskId } = usePlannerStore();
  const project   = task.projectId ? projects.find((p) => p.id === task.projectId) : null;
  const isOverdue = task.dueDate && task.dueDate < new Date().toISOString().slice(0, 10);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("taskId", task.id);
        e.dataTransfer.effectAllowed = "move";
        setDragTaskId(task.id);
      }}
      onDragEnd={() => setDragTaskId(null)}
      onClick={onSelect}
      className={cn(
        "mx-2 mb-1 px-2.5 py-2 rounded-lg border bg-background",
        "cursor-grab active:cursor-grabbing hover:border-primary/30 hover:shadow-sm",
        "transition-fast select-none",
        isDragging && "opacity-40 scale-95",
        isSelected
          ? "border-primary/60 bg-primary/5 ring-1 ring-primary/20"
          : "border-border"
      )}
    >
      <div className="flex items-start gap-1.5">
        <PriorityDot priority={task.priority} />
        <span className="flex-1 text-xs leading-snug truncate">{task.title}</span>
        {/* Info icon hint */}
        <Info size={9} className="shrink-0 mt-0.5 text-muted-foreground/25 group-hover:text-muted-foreground/50" />
      </div>
      <div className="flex items-center gap-1.5 mt-1">
        {project && <ProjectDot color={project.color} size={6} title={project.name} />}
        {task.estimateMinutes && (
          <span className="text-[10px] text-muted-foreground/50 tabular-nums">{task.estimateMinutes}m</span>
        )}
        {task.dueDate && (
          <span className={cn(
            "text-[10px] ml-auto tabular-nums",
            isOverdue ? "text-rose-500" : "text-muted-foreground/50"
          )}>
            {formatDate(task.dueDate)}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Scheduled task row (shows tracked time) ───────────────────

function ScheduledTaskRow({
  task, projects, isSelected, onSelect,
}: {
  task: Task;
  projects: ReturnType<typeof useProjectStore.getState>["projects"];
  isSelected: boolean;
  onSelect: () => void;
}) {
  const tracked   = useTaskTracked(task.id);
  const project   = task.projectId ? projects.find((p) => p.id === task.projectId) : null;
  const estimate  = task.estimateMinutes ?? 0;
  const pct       = estimate > 0 ? Math.min(1, tracked / estimate) : 0;

  return (
    <div
      onClick={onSelect}
      className={cn(
        "mx-2 mb-1 px-2.5 py-2 rounded-lg border bg-background select-none cursor-pointer",
        "hover:border-primary/30 hover:shadow-sm transition-fast",
        task.status === "in_progress" && !isSelected && "border-primary/30 bg-primary/5",
        isSelected
          ? "border-primary/60 bg-primary/8 ring-1 ring-primary/20"
          : "border-border"
      )}
    >
      <div className="flex items-start gap-1.5">
        <PriorityDot priority={task.priority} />
        <span className="flex-1 text-xs leading-snug truncate">{task.title}</span>
        <Info size={9} className="shrink-0 mt-0.5 text-muted-foreground/25" />
      </div>
      <div className="flex items-center gap-1.5 mt-1">
        {project && <ProjectDot color={project.color} size={6} title={project.name} />}
        {estimate > 0 && (
          <span className="text-[10px] text-muted-foreground/50 tabular-nums">{estimate}m est</span>
        )}
        {tracked > 0 && (
          <span className="text-[10px] tabular-nums text-emerald-600">
            <Clock size={8} className="inline mr-0.5" />
            {fmtMins(tracked)}
          </span>
        )}
        {estimate > 0 && pct > 0 && (
          <div className="ml-auto w-12 bg-muted/60 rounded-full h-1">
            <div
              className={cn(
                "rounded-full h-1 transition-all",
                pct >= 1 ? "bg-emerald-500" : "bg-primary"
              )}
              style={{ width: `${pct * 100}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
