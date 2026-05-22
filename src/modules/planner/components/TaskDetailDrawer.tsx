// ============================================================
// PLANNER — TaskDetailDrawer
// Slide-in panel from the planner task sidebar that shows full
// task details and allows inline editing without leaving the
// planner view. Mirrors the data model from TaskDetail.tsx but
// scoped to planner context (no modal stack, side drawer).
// ============================================================

import { useState } from "react";
import {
  X, Flag, Calendar, Clock, CheckSquare, Circle,
  ChevronDown, FolderKanban, ExternalLink, AlignLeft,
  CircleDot,
} from "lucide-react";
import { cn, formatDate, PRIORITY_LABELS, today } from "@/shared/utils";
import { ProjectDot } from "@/shared/ui";
import { useTaskStore } from "@/modules/tasks/store";
import { useProjectStore } from "@/modules/projects/store";
import { bus } from "@/kernel/event-bus";
import type { Task, Priority, TaskStatus } from "@/shared/types";

const PRIORITY_OPTIONS: { value: Priority; label: string; dot: string }[] = [
  { value: "urgent", label: "Urgent", dot: "bg-red-500" },
  { value: "high",   label: "High",   dot: "bg-orange-400" },
  { value: "medium", label: "Medium", dot: "bg-yellow-400" },
  { value: "low",    label: "Low",    dot: "bg-blue-400" },
  { value: "none",   label: "None",   dot: "bg-muted-foreground/30" },
];

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "todo",        label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done",        label: "Done" },
  { value: "cancelled",   label: "Cancelled" },
];

interface Props {
  taskId: string;
  onClose: () => void;
}

export function TaskDetailDrawer({ taskId, onClose }: Props) {
  const { tasks, updateTask, completeTask, restoreTask, openTask } = useTaskStore();
  const { projects } = useProjectStore();

  const task    = tasks.find((t) => t.id === taskId);
  const project = task?.projectId ? projects.find((p) => p.id === task.projectId) : undefined;

  // ── Local edit state (mirrors task fields) ────────────────
  const [title,       setTitle]       = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [status,      setStatus]      = useState<TaskStatus>(task?.status ?? "todo");
  const [priority,    setPriority]    = useState<Priority>(task?.priority ?? "none");
  const [dueDate,     setDueDate]     = useState(task?.dueDate ?? "");
  const [estimate,    setEstimate]    = useState(String(task?.estimateMinutes ?? ""));
  const [dirty,       setDirty]       = useState(false);
  const [saving,      setSaving]      = useState(false);

  if (!task) return null;

  const isDone      = status === "done";
  const isOverdue   = !isDone && !!dueDate && dueDate < today();
  const checklistItems = task.checklistItems ?? [];
  const doneItems      = checklistItems.filter((i) => i.checked).length;

  function markDirty() { setDirty(true); }

  async function handleSave() {
    if (!task) return;
    if (!dirty) return onClose();
    setSaving(true);
    try {
      await updateTask(task.id, {
        title:           title.trim() || task.title,
        description:     description.trim() || undefined,
        status,
        priority,
        dueDate:         dueDate || undefined,
        estimateMinutes: estimate ? parseInt(estimate, 10) : undefined,
      });
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }

  function handleToggleComplete() {
    if (!task) return;
    if (isDone) { restoreTask(task.id); setStatus("todo"); }
    else        { completeTask(task.id); setStatus("done"); }
    markDirty();
  }

  function openFullDetail() {
    if (!task) return;
    openTask(task.id);
    onClose();
  }

  return (
    <div className="flex flex-col h-full border-l border-border bg-card w-72 shrink-0 overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border shrink-0">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
          Task Detail
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={openFullDetail}
            title="Open full detail"
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <ExternalLink size={13} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3">

        {/* Complete toggle + title */}
        <div className="flex items-start gap-2">
          <button
            onClick={handleToggleComplete}
            className={cn(
              "shrink-0 mt-0.5 transition-colors",
              isDone ? "text-emerald-500" : "text-muted-foreground/40 hover:text-primary"
            )}
          >
            {isDone ? <CheckSquare size={16} /> : <Circle size={16} strokeWidth={1.5} />}
          </button>
          <textarea
            value={title}
            onChange={(e) => { setTitle(e.target.value); markDirty(); }}
            onBlur={() => void handleSave()}
            rows={2}
            className={cn(
              "flex-1 text-sm font-medium bg-transparent outline-none resize-none leading-snug",
              isDone && "line-through text-muted-foreground/50"
            )}
          />
        </div>

        {/* Project */}
        {project && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ProjectDot color={project.color} size={8} />
            <span className="truncate">{project.name}</span>
          </div>
        )}

        {/* Status + Priority row */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status select */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-border bg-background">
            <CircleDot size={11} className="text-muted-foreground/50 shrink-0" />
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value as TaskStatus); markDirty(); void handleSave(); }}
              className="text-[11px] bg-transparent outline-none text-foreground"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Priority select */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-border bg-background">
            <Flag size={11} className="text-muted-foreground/50 shrink-0" />
            <select
              value={priority}
              onChange={(e) => { setPriority(e.target.value as Priority); markDirty(); void handleSave(); }}
              className="text-[11px] bg-transparent outline-none text-foreground"
            >
              {PRIORITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Due date */}
        <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl border border-border bg-background">
          <Calendar size={12} className={cn("shrink-0", isOverdue ? "text-rose-500" : "text-muted-foreground/50")} />
          <input
            type="date"
            value={dueDate}
            onChange={(e) => { setDueDate(e.target.value); markDirty(); }}
            onBlur={() => void handleSave()}
            className="flex-1 text-xs bg-transparent outline-none text-foreground"
          />
          {isOverdue && <span className="text-[10px] text-rose-500 font-medium">Overdue</span>}
        </div>

        {/* Estimate */}
        <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl border border-border bg-background">
          <Clock size={12} className="text-muted-foreground/50 shrink-0" />
          <input
            type="number"
            value={estimate}
            min={0}
            onChange={(e) => { setEstimate(e.target.value); markDirty(); }}
            onBlur={() => void handleSave()}
            placeholder="Estimate (min)"
            className="flex-1 text-xs bg-transparent outline-none text-foreground placeholder:text-muted-foreground/40 tabular-nums"
          />
          {estimate && <span className="text-[10px] text-muted-foreground/50">min</span>}
        </div>

        {/* Description */}
        <div className="flex gap-1.5 px-2.5 py-2 rounded-xl border border-border bg-background">
          <AlignLeft size={12} className="text-muted-foreground/50 shrink-0 mt-0.5" />
          <textarea
            value={description}
            onChange={(e) => { setDescription(e.target.value); markDirty(); }}
            onBlur={() => void handleSave()}
            placeholder="Add description…"
            rows={3}
            className="flex-1 text-xs bg-transparent outline-none resize-none text-foreground placeholder:text-muted-foreground/40"
          />
        </div>

        {/* Checklist preview */}
        {checklistItems.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Checklist ({doneItems}/{checklistItems.length})
            </p>
            <div className="w-full bg-muted/40 rounded-full h-1">
              <div
                className="bg-primary rounded-full h-1 transition-all"
                style={{ width: `${(doneItems / checklistItems.length) * 100}%` }}
              />
            </div>
            {checklistItems.slice(0, 5).map((item) => (
              <div key={item.id} className="flex items-center gap-1.5">
                <span className={cn("w-3 h-3 rounded", item.checked ? "text-emerald-500" : "text-muted-foreground/30")}>
                  {item.checked ? <CheckSquare size={12} /> : <Circle size={12} strokeWidth={1.5} />}
                </span>
                <span className={cn(
                  "text-xs truncate",
                  item.checked && "line-through text-muted-foreground/40"
                )}>
                  {item.label}
                </span>
              </div>
            ))}
            {checklistItems.length > 5 && (
              <p className="text-[10px] text-muted-foreground/50">
                +{checklistItems.length - 5} more — open full view
              </p>
            )}
          </div>
        )}

        {/* Metadata footer */}
        <div className="pt-1 border-t border-border/50 flex flex-col gap-1">
          <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wider font-semibold">Created</p>
          <p className="text-[11px] text-muted-foreground/60 tabular-nums">
            {new Date(task.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Save indicator */}
      {dirty && (
        <div className="px-3 py-2 border-t border-border shrink-0 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground/60">Unsaved changes</span>
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="px-3 py-1 rounded-lg bg-primary text-primary-foreground text-[11px] font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}
