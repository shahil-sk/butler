import { useState } from "react";
import { X, Trash2, Unlink } from "lucide-react";
import { cn } from "@/shared/utils";
import { usePlannerStore, BLOCK_COLORS } from "../store";
import { useTaskStore } from "@/modules/tasks/store";
import { bus } from "@/kernel/event-bus";

// Accepts blockId (string) so callers never have to pass the full object —
// avoids crash when editingBlockId is set before blocks array re-renders.
export function BlockEditModal({ blockId, onClose }: { blockId: string; onClose: () => void }) {
  const block        = usePlannerStore((s) => s.blocks.find((b) => b.id === blockId));
  const { updateBlock, deleteBlock } = usePlannerStore();
  const tasks        = useTaskStore((s) => s.tasks);

  // All useState must be called unconditionally — guard below this block.
  const [title,     setTitle]     = useState(block?.title     ?? "");
  const [startTime, setStartTime] = useState(block?.startTime ?? "09:00");
  const [endTime,   setEndTime]   = useState(block?.endTime   ?? "10:00");
  const [color,     setColor]     = useState(block?.color     ?? BLOCK_COLORS[0]);
  const [isBreak,   setIsBreak]   = useState(block?.isBreak   ?? false);
  const [notes,     setNotes]     = useState(block?.notes     ?? "");
  const [taskId,    setTaskId]    = useState(block?.taskId    ?? "");

  // After all hooks: safe to early-return if block not found
  if (!block) return null;

  const linkedTask = tasks.find((t) => t.id === taskId);

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
            <X size={14} />
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
            ) : (
              <select
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-xs outline-none focus:border-primary transition-fast"
              >
                <option value="">— No task linked —</option>
                {tasks
                  .filter((t) => t.status !== "done" && t.status !== "archived")
                  .map((t) => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))
                }
              </select>
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
