import { useState } from "react";
import { X, Trash2, Unlink, Plus, Calendar } from "lucide-react";
import { cn } from "@/shared/utils";
import { usePlannerStore } from "../store";
import { BLOCK_COLORS } from "../types";
import { useTaskStore } from "@/modules/tasks/store";
import { bus } from "@/kernel/event-bus";

// Accepts blockId (string) so callers never have to pass the full object —
// avoids crash when editingBlockId is set before blocks array re-renders.
export function BlockEditModal({ blockId, onClose }: { blockId: string; onClose: () => void }) {
  const block        = usePlannerStore((s) => s.blocks.find((b) => b.id === blockId));
  const { updateBlock, deleteBlock } = usePlannerStore();
  const tasks        = useTaskStore((s) => s.tasks);
  const createTask   = useTaskStore((s) => s.createTask);

  // All useState must be called unconditionally — guard below this block.
  const [title,     setTitle]     = useState(block?.title     ?? "");
  const [startTime, setStartTime] = useState(block?.startTime ?? "09:00");
  const [endTime,   setEndTime]   = useState(block?.endTime   ?? "10:00");
  const [color,     setColor]     = useState(block?.color     ?? BLOCK_COLORS[0]);
  const [isBreak,   setIsBreak]   = useState(block?.isBreak   ?? false);
  const [notes,     setNotes]     = useState(block?.notes     ?? "");
  const [taskId,    setTaskId]    = useState(block?.taskId    ?? "");
  const [syncDueDate, setSyncDueDate] = useState(false);

  // After all hooks: safe to early-return if block not found
  if (!block) return null;

  const linkedTask = tasks.find((t) => t.id === taskId);
  const originalDate = block.date;
  
  // Check if linked task has a due date that's different from the block's date
  const taskHasDifferentDueDate = linkedTask && linkedTask.dueDate && linkedTask.dueDate !== originalDate;

  const save = async () => {
    const prevTaskId = block.taskId;
    const nextTaskId = taskId || undefined;

    await updateBlock(block.id, {
      title:     title.trim() || block.title,
      startTime,
      endTime,
      color,
      isBreak,
      notes:     notes || undefined,
      taskId:    nextTaskId,
    });

    // If user opted to sync due date and task is linked
    if (syncDueDate && nextTaskId && linkedTask) {
      const { useTaskStore } = await import("@/modules/tasks/store");
      await useTaskStore.getState().updateTask(nextTaskId, { dueDate: originalDate });
    }

    if (nextTaskId && nextTaskId !== prevTaskId) {
      bus.emit("planner:block-linked-task", {
        blockId: block.id,
        taskId:  nextTaskId,
        date:    block.date,
      });
    }
    if (!nextTaskId && prevTaskId) {
      bus.emit("planner:block-unlinked-task", {
        blockId:        block.id,
        previousTaskId: prevTaskId,
      });
    }

    onClose();
  };

  const handleDelete = async () => {
    await deleteBlock(block.id);
    onClose();
  };

  const handleCreateTask = async () => {
    if (!title.trim()) return;
    
    // Calculate duration in minutes
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const durationMins = (eh * 60 + em) - (sh * 60 + sm);

    const newTask = await createTask({
      title: title.trim(),
      scheduledDate: block.date,
      dueDate: block.date,
      estimateMinutes: durationMins > 0 ? durationMins : undefined,
      notes,
    });

    // Link the new task to this block
    setTaskId(newTask.id);
    bus.emit("notify", { message: `Task "${newTask.title}" created and linked`, type: "success" } as never);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />

      <div className="relative w-full max-w-sm mx-4 rounded-xl bg-card border border-border shadow-xl animate-fade-in">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">Edit Block</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-fast"
          >
            ✕
          </button>
        </div>

        <div className="px-4 py-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary transition-fast"
              placeholder="Block title…"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Start</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary transition-fast tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">End</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary transition-fast tabular-nums"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Color</label>
            <div className="flex items-center gap-2">
              {BLOCK_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "w-6 h-6 rounded-full transition-fast",
                    color === c && "ring-2 ring-offset-2 ring-offset-card ring-current scale-110"
                  )}
                  style={{ background: c, color: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">Mark as break</label>
            <button
              onClick={() => setIsBreak((v) => !v)}
              className={cn(
                "w-9 h-5 rounded-full transition-fast relative",
                isBreak ? "bg-primary" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-[left] duration-150",
                  isBreak ? "left-[18px]" : "left-0.5"
                )}
              />
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Linked task</label>
            {linkedTask ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background">
                  <span className="flex-1 text-xs truncate">{linkedTask.title}</span>
                  <button
                    onClick={() => setTaskId("")}
                    className="shrink-0 text-muted-foreground hover:text-rose-500 transition-fast"
                    title="Unlink task"
                  >
                    <Unlink size={12} />
                  </button>
                </div>
                
                {/* Show sync due date option if task has different due date */}
                {taskHasDifferentDueDate && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20">
                    <button
                      onClick={() => setSyncDueDate((v) => !v)}
                      className={cn(
                        "shrink-0 mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center transition-fast",
                        syncDueDate
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-muted-foreground/30 hover:border-primary/50"
                      )}
                    >
                      {syncDueDate && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5L4 7L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-amber-700 dark:text-amber-500 leading-tight">
                        Update due date to {new Date(originalDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </p>
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                        Task is due {new Date(linkedTask.dueDate!).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} but scheduled for {new Date(originalDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <select
                  value={taskId}
                  onChange={(e) => setTaskId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs outline-none focus:border-primary transition-fast"
                >
                  <option value="">— No task linked —</option>
                  {tasks
                    .filter((t) => t.status !== "done" && t.status !== "archived" && t.status !== "cancelled")
                    .map((t) => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))
                  }
                </select>
                
                {/* Show "Create task" button if no task is linked and title exists */}
                {!taskId && title.trim() && (
                  <button
                    onClick={() => void handleCreateTask()}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 transition-fast text-xs font-medium"
                  >
                    <Plus size={12} />
                    Create task from this block
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional notes…"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs outline-none focus:border-primary transition-fast resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-500 hover:bg-rose-500/10 transition-fast"
          >
            <Trash2 size={12} />
            Delete
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-accent transition-fast"
            >
              Cancel
            </button>
            <button
              onClick={() => void save()}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 transition-fast"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
