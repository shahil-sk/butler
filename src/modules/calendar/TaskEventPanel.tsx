// ============================================================
// TASK EVENT PANEL
// Shown when clicking a task shadow event in the calendar.
// View, quick-edit, complete, or navigate to full task detail.
// ============================================================

import { useState, useEffect } from "react";
import {
  X, CheckCircle2, Circle, ExternalLink,
  AlertTriangle, Flag,
} from "lucide-react";
import { cn } from "@/shared/utils";
import { useTaskStore } from "@/modules/tasks/store";
import { bus } from "@/kernel/event-bus";
import { DateTimePicker } from "./DateTimePicker";
import type { Priority, TaskStatus } from "@/shared/types";

const PRIORITY_LABELS: Record<Priority, string> = {
  none: "None", low: "Low", medium: "Medium", high: "High", urgent: "Urgent",
};
const PRIORITY_COLORS: Record<Priority, string> = {
  none: "text-muted-foreground",
  low: "text-blue-400",
  medium: "text-yellow-400",
  high: "text-orange-400",
  urgent: "text-red-400",
};
const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To Do", in_progress: "In Progress", done: "Done",
  cancelled: "Cancelled", archived: "Archived",
};

interface Props {
  taskId: string;
  onClose: () => void;
}

export function TaskEventPanel({ taskId, onClose }: Props) {
  const { tasks, updateTask, completeTask, restoreTask } = useTaskStore();
  const task = tasks.find((t) => t.id === taskId);

  const [editing,       setEditing]       = useState(false);
  const [title,         setTitle]         = useState("");
  const [dueDate,       setDueDate]       = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [priority,      setPriority]      = useState<Priority>("none");
  const [status,        setStatus]        = useState<TaskStatus>("todo");

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDueDate(task.dueDate ?? "");
      setScheduledDate(task.scheduledDate ?? "");
      setPriority(task.priority);
      setStatus(task.status);
      setEditing(false);
    }
  }, [taskId, task?.updatedAt]);

  if (!task) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-popover p-6 text-center">
          <p className="text-sm text-muted-foreground">Task not found</p>
          <button onClick={onClose} className="mt-4 text-xs text-primary hover:underline">Close</button>
        </div>
      </div>
    );
  }

  const isDone     = task.status === "done";
  const todayStr   = new Date().toISOString().slice(0, 10);
  const isOverdue  = task.dueDate && task.dueDate < todayStr && !isDone;
  const isDueToday = (task.dueDate === todayStr || task.scheduledDate === todayStr) && !isDone;

  const handleToggleComplete = async () => {
    if (isDone) await restoreTask(task.id);
    else { await completeTask(task.id); onClose(); }
  };

  const handleSave = async () => {
    await updateTask(task.id, {
      title:         title.trim() || task.title,
      dueDate:       dueDate       || undefined,
      scheduledDate: scheduledDate || undefined,
      priority,
      status,
    });
    setEditing(false);
  };

  const handleOpenInTasks = () => {
    bus.emit("navigate:to", { module: "tasks" });
    bus.emit("task:open",   { taskId: task.id });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-[420px] rounded-xl border border-border bg-popover shadow-2xl flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
          <span className={cn(
            "px-2 py-0.5 rounded-full text-[10px] font-medium",
            isDone     ? "bg-green-500/15 text-green-500" :
            isOverdue  ? "bg-red-500/15 text-red-500" :
            isDueToday ? "bg-orange-500/15 text-orange-500" :
                         "bg-primary/10 text-primary"
          )}>
            {isDone ? "Done" : isOverdue ? "Overdue" : isDueToday ? "Due today" : STATUS_LABELS[task.status]}
          </span>
          <span className="flex-1" />
          <button
            onClick={handleOpenInTasks}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-fast"
            title="Open full task detail"
          >
            <ExternalLink size={11} />
            Open in Tasks
          </button>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-fast ml-1">
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* Complete toggle + title */}
          <div className="flex items-start gap-3">
            <button
              onClick={handleToggleComplete}
              className={cn(
                "mt-0.5 shrink-0 transition-fast",
                isDone ? "text-green-500 hover:text-muted-foreground" : "text-muted-foreground hover:text-green-500"
              )}
              title={isDone ? "Mark incomplete" : "Mark complete"}
            >
              {isDone ? <CheckCircle2 size={18} /> : <Circle size={18} />}
            </button>

            {editing ? (
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="flex-1 text-sm font-semibold bg-transparent border-b border-primary outline-none pb-0.5"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleSave();
                  if (e.key === "Escape") setEditing(false);
                }}
              />
            ) : (
              <h2
                onClick={() => setEditing(true)}
                className={cn(
                  "flex-1 text-sm font-semibold cursor-text hover:text-primary transition-fast leading-snug",
                  isDone && "line-through text-muted-foreground"
                )}
                title="Click to edit title"
              >
                {task.title}
              </h2>
            )}
          </div>

          {/* Overdue warning */}
          {isOverdue && (
            <div className="flex items-center gap-1.5 text-[11px] text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
              <AlertTriangle size={11} />
              <span>This task is overdue. Update the due date or complete it.</span>
            </div>
          )}

          {/* Date pickers — date-only, timeDisabled, locked until editing */}
          <div className="grid grid-cols-2 gap-3">
            <DateTimePicker
              label="Due date"
              value={dueDate}
              timeDisabled
              disabled={!editing}
              onChange={setDueDate}
            />
            <DateTimePicker
              label="Scheduled"
              value={scheduledDate}
              timeDisabled
              disabled={!editing}
              onChange={setScheduledDate}
            />
          </div>

          {/* Priority + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wide">
                <Flag size={9} /> Priority
              </label>
              {editing ? (
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                  className="w-full text-xs bg-popover border border-border rounded-md px-2 py-1.5 outline-none"
                >
                  {(Object.keys(PRIORITY_LABELS) as Priority[]).map((p) => (
                    <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                  ))}
                </select>
              ) : (
                <p
                  onClick={() => setEditing(true)}
                  className={cn("text-xs font-medium cursor-pointer hover:brightness-110 transition-fast", PRIORITY_COLORS[task.priority])}
                >
                  {PRIORITY_LABELS[task.priority]}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide block">Status</label>
              {editing ? (
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  className="w-full text-xs bg-popover border border-border rounded-md px-2 py-1.5 outline-none"
                >
                  {(Object.keys(STATUS_LABELS) as TaskStatus[]).filter((s) => s !== "archived").map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              ) : (
                <p
                  onClick={() => setEditing(true)}
                  className="text-xs text-foreground cursor-pointer hover:text-primary transition-fast"
                >
                  {STATUS_LABELS[task.status]}
                </p>
              )}
            </div>
          </div>

          {/* Description */}
          {task.description && (
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Description</p>
              <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{task.description}</p>
            </div>
          )}

          {/* Checklist summary */}
          {task.checklistItems?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                Checklist ({task.checklistItems.filter((i) => i.checked).length}/{task.checklistItems.length})
              </p>
              {task.checklistItems.slice(0, 4).map((item) => (
                <div key={item.id} className="flex items-center gap-2 text-xs">
                  {item.checked
                    ? <CheckCircle2 size={11} className="text-green-500 shrink-0" />
                    : <Circle size={11} className="text-muted-foreground shrink-0" />
                  }
                  <span className={cn(item.checked && "line-through text-muted-foreground")}>{item.text}</span>
                </div>
              ))}
              {task.checklistItems.length > 4 && (
                <button onClick={handleOpenInTasks} className="text-[11px] text-primary hover:underline">
                  +{task.checklistItems.length - 4} more — open in Tasks
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-border shrink-0">
          {editing ? (
            <>
              <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-xs rounded-md border border-border hover:bg-accent transition-fast">Cancel</button>
              <button onClick={() => void handleSave()} className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-fast">Save</button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} className="px-3 py-1.5 text-xs rounded-md border border-border hover:bg-accent transition-fast">Edit</button>
              <button
                onClick={handleToggleComplete}
                className={cn(
                  "flex-1 py-1.5 text-xs rounded-md font-medium transition-fast",
                  isDone ? "bg-muted text-muted-foreground hover:bg-accent" : "bg-green-600 text-white hover:bg-green-700"
                )}
              >
                {isDone ? "Restore task" : "✓ Mark complete"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
