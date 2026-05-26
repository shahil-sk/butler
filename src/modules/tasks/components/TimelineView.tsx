import { useState, useMemo } from "react";
import {
  ChevronLeft, ChevronRight, CalendarPlus, Clock,
  Lock, CheckCircle2, Circle, AlertTriangle,
} from "lucide-react";
import { cn, formatDate } from "@/shared/utils";
import { ProjectDot, PriorityDot } from "@/shared/ui";
import { useTaskStore } from "../store";
import { useProjectStore } from "@/modules/projects/store";
import { bus } from "@/kernel/event-bus";
import type { Task } from "@/shared/types";

// Generate list of ISO dates in a range
function getDatesInRange(startDate: Date, days: number): string[] {
  const dates: string[] = [];
  const temp = new Date(startDate);
  for (let i = 0; i < days; i++) {
    dates.push(temp.toISOString().slice(0, 10));
    temp.setDate(temp.getDate() + 1);
  }
  return dates;
}

export function TimelineView() {
  const { tasks, openTask, completeTask, restoreTask } = useTaskStore();
  const allProjects = useProjectStore((s) => s.projects);

  // Timeline date range configuration
  const [windowOffset, setWindowOffset] = useState(0); // Offset in days from today
  const daysToShow = 14;

  const dates = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() + windowOffset);
    return getDatesInRange(start, daysToShow);
  }, [windowOffset]);

  const dateRangeLabel = useMemo(() => {
    if (dates.length === 0) return "";
    const first = new Date(dates[0]);
    const last = new Date(dates[dates.length - 1]);
    const opt: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    const yearOpt: Intl.DateTimeFormatOptions = { year: "numeric" };
    return `${first.toLocaleDateString(undefined, opt)} – ${last.toLocaleDateString(
      undefined,
      opt
    )}, ${last.toLocaleDateString(undefined, yearOpt)}`;
  }, [dates]);

  // Filter tasks that have at least one date or scheduledDate
  const timelineTasks = useMemo(() => {
    return tasks.filter(
      (t) => (t.dueDate || t.startDate || t.scheduledDate) && t.status !== "archived"
    );
  }, [tasks]);

  const undatedTasks = useMemo(() => {
    return tasks.filter(
      (t) => !t.dueDate && !t.startDate && !t.scheduledDate && t.status !== "archived" && t.status !== "done"
    );
  }, [tasks]);

  const handlePrevRange = () => setWindowOffset((o) => o - 7);
  const handleNextRange = () => setWindowOffset((o) => o + 7);
  const handleResetRange = () => setWindowOffset(0);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background overflow-hidden">
      {/* Top Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-border/40 shrink-0 bg-card/30">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
            Gantt Timeline
          </h2>
          <span className="text-xs font-semibold text-foreground/80 tabular-nums px-2 py-0.5 rounded-full bg-muted">
            {timelineTasks.length} tasks
          </span>
        </div>

        {/* Date Navigator */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground/70">{dateRangeLabel}</span>
          <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-muted/50 border border-border/50">
            <button
              onClick={handlePrevRange}
              className="p-1 rounded hover:bg-background text-muted-foreground hover:text-foreground transition-fast"
              title="Previous Week"
            >
              <ChevronLeft size={13} />
            </button>
            <button
              onClick={handleResetRange}
              className="px-2.5 py-1 rounded hover:bg-background text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-fast"
            >
              Today
            </button>
            <button
              onClick={handleNextRange}
              className="p-1 rounded hover:bg-background text-muted-foreground hover:text-foreground transition-fast"
              title="Next Week"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Gantt Grid Split Panel */}
      <div className="flex-1 flex min-h-0 divide-x divide-border/40 overflow-hidden">
        {/* Left Side: Task Info Columns */}
        <div className="w-64 flex flex-col min-h-0 shrink-0 select-none overflow-y-auto scrollbar-none bg-card/10">
          <div className="h-10 flex items-center px-4 border-b border-border/40 shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/40">
            Task
          </div>
          <div className="flex-1 divide-y divide-border/30">
            {timelineTasks.map((task) => {
              const project = allProjects.find((p) => p.id === task.projectId);
              const isCompleted = task.status === "done";
              return (
                <div
                  key={task.id}
                  onClick={() => openTask(task.id)}
                  className={cn(
                    "h-12 flex items-center gap-2 px-3 hover:bg-accent/40 cursor-pointer transition-colors duration-150 group",
                    isCompleted && "opacity-50"
                  )}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      isCompleted ? restoreTask(task.id) : completeTask(task.id);
                    }}
                    className={cn(
                      "shrink-0 transition-fast rounded-full",
                      isCompleted
                        ? "text-green-500 hover:text-muted-foreground/50"
                        : "text-muted-foreground/25 hover:text-primary"
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle2 size={14} strokeWidth={2} />
                    ) : (
                      <Circle size={14} strokeWidth={1.5} />
                    )}
                  </button>
                  <PriorityDot priority={task.priority} />
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "text-[12px] font-medium leading-snug truncate",
                        isCompleted && "line-through text-muted-foreground/40"
                      )}
                    >
                      {task.title}
                    </p>
                    {project && (
                      <div className="flex items-center gap-1 mt-0.5 opacity-60">
                        <ProjectDot color={project.color} size={5} />
                        <span className="text-[9px] font-medium text-muted-foreground truncate max-w-[120px]">
                          {project.name}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {timelineTasks.length === 0 && (
              <div className="p-4 text-center text-xs text-muted-foreground/40 italic">
                No scheduled tasks
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Timeline Grid scrollable container */}
        <div className="flex-1 flex flex-col min-h-0 overflow-x-auto overflow-y-auto">
          {/* Header Dates Grid */}
          <div className="flex h-10 border-b border-border/40 shrink-0 bg-card/15 sticky top-0 z-10">
            {dates.map((date) => {
              const d = new Date(date);
              const isCurrentToday = date === new Date().toISOString().slice(0, 10);
              const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
              return (
                <div
                  key={date}
                  className={cn(
                    "flex-1 min-w-[70px] border-r border-border/30 flex flex-col items-center justify-center select-none py-1",
                    isCurrentToday && "bg-primary/5"
                  )}
                >
                  <span className={cn("text-[9px] font-bold uppercase tracking-wider", isCurrentToday ? "text-primary" : "text-muted-foreground/50")}>
                    {dayNames[d.getDay()]}
                  </span>
                  <span className={cn("text-[11px] font-extrabold mt-0.5 tabular-nums", isCurrentToday ? "text-primary" : "text-foreground/80")}>
                    {d.getDate()}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Rows Grid */}
          <div className="flex-1 divide-y divide-border/30 min-w-max">
            {timelineTasks.map((task) => {
              const isBlocked =
                task.status !== "done" &&
                task.status !== "cancelled" &&
                task.dependencies?.some(
                  (depId) => tasks.find((t) => t.id === depId)?.status !== "done"
                );

              // Find bounds of current task bar in the date columns window
              const startIso = task.startDate || task.dueDate || task.scheduledDate || "";
              const endIso = task.dueDate || task.startDate || task.scheduledDate || "";

              let startIndex = dates.indexOf(startIso);
              let endIndex = dates.indexOf(endIso);

              // If start or end are out of boundary bounds, clamp them
              let spansVisibleRange = true;
              if (startIndex === -1 && endIndex === -1) {
                // Check if the task spans entirely over the visible range
                if (startIso && endIso && startIso < dates[0] && endIso > dates[dates.length - 1]) {
                  startIndex = 0;
                  endIndex = dates.length - 1;
                } else {
                  spansVisibleRange = false;
                }
              } else {
                if (startIndex === -1) startIndex = 0; // Starts before current range
                if (endIndex === -1) endIndex = dates.length - 1; // Ends after current range
              }

              return (
                <div key={task.id} className="h-12 flex relative group hover:bg-accent/10">
                  {/* Grid Column Backgrounds */}
                  {dates.map((date) => {
                    const isCurrentToday = date === new Date().toISOString().slice(0, 10);
                    return (
                      <div
                        key={date}
                        className={cn(
                          "flex-1 min-w-[70px] border-r border-border/20 h-full",
                          isCurrentToday && "bg-primary/[0.02]"
                        )}
                      />
                    );
                  })}

                  {/* Gantt Bar Layer */}
                  {spansVisibleRange && startIndex !== -1 && endIndex !== -1 && (
                    <div
                      style={{
                        left: `calc(${(startIndex / daysToShow) * 100}% + 4px)`,
                        width: `calc(${((endIndex - startIndex + 1) / daysToShow) * 100}% - 8px)`,
                      }}
                      className={cn(
                        "absolute top-2 bottom-2 rounded-lg flex items-center justify-between px-2.5 transition-all shadow-sm select-none border border-transparent",
                        task.status === "done"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                          : isBlocked
                          ? "bg-red-500/10 text-red-500 border-red-500/25 cursor-pointer hover:bg-red-500/15"
                          : "bg-primary/8 text-primary border-primary/15 cursor-pointer hover:bg-primary/12"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        openTask(task.id);
                      }}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {isBlocked && <Lock size={10} className="shrink-0 text-red-500" />}
                        <span className="text-[10px] font-semibold truncate leading-none">
                          {task.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        {task.estimateMinutes && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold opacity-70 px-1 rounded bg-background/50">
                            <Clock size={8} />
                            {task.estimateMinutes}m
                          </span>
                        )}

                        {/* Quick Add to Planner */}
                        {!task.scheduledDate && task.status !== "done" && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              bus.emit("task:schedule-in-planner", {
                                task,
                                date: task.dueDate || dates[0],
                              });
                            }}
                            className="p-1 rounded bg-background/40 hover:bg-background/80 transition-all text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100"
                            title="Schedule in Planner"
                          >
                            <CalendarPlus size={10} />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {timelineTasks.length === 0 && (
              <div className="h-20 flex items-center justify-center text-xs text-muted-foreground/35 italic">
                No tasks to schedule
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Undated Tasks Drawer at Bottom */}
      {undatedTasks.length > 0 && (
        <div className="shrink-0 border-t border-border bg-card/20 p-3 max-h-40 overflow-y-auto">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-2">
            Undated Tasks ({undatedTasks.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {undatedTasks.map((t) => (
              <button
                key={t.id}
                onClick={() => openTask(t.id)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border bg-background hover:bg-accent text-xs font-medium text-foreground transition-all"
              >
                <span>{t.title}</span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    // Set due date to today to place on timeline
                    useTaskStore.getState().updateTask(t.id, { dueDate: new Date().toISOString().slice(0, 10) });
                    bus.emit("ui:notification", {
                      type: "success",
                      message: `"${t.title}" scheduled for today!`,
                      durationMs: 3000,
                    });
                  }}
                  className="p-0.5 rounded text-primary hover:bg-primary/10"
                  title="Schedule for Today"
                >
                  <CalendarPlus size={11} />
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
