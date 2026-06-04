// ============================================================
// PLANNER — BlockEditModal
// New: duration label, custom hex color input, block category
//      selector (Focus / Meeting / Break / Admin / Personal)
// FIXED: Better spacing, larger inputs, improved visual hierarchy
// ============================================================

import { useState } from "react";
import { X, Trash2, Unlink } from "lucide-react";
import { cn } from "@/shared/utils";
import { usePlannerStore, BLOCK_COLORS } from "../store";
import { useTaskStore } from "@/modules/tasks/store";
import { bus } from "@/kernel/event-bus";

const CATEGORIES = [
  { id: "deep_work",    label: "Deep Work",    color: "#3b82f6" },
  { id: "shallow_work", label: "Shallow Work", color: "#0ea5e9" },
  { id: "meeting",      label: "Meeting",      color: "#8b5cf6" },
  { id: "admin",        label: "Admin",        color: "#f59e0b" },
  { id: "break",        label: "Break",        color: "#6b7280" },
  { id: "personal",     label: "Personal",     color: "#10b981" },
  { id: "buffer",       label: "Buffer",       color: "#84cc16" },
  { id: "blocked",      label: "Blocked",      color: "#ef4444" },
] as const;

type BlockCategory = typeof CATEGORIES[number]["id"];

function toMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function fmtDuration(start: string, end: string): string {
  const mins = toMin(end) - toMin(start);
  if (mins <= 0) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

export function BlockEditModal({ blockId, onClose }: { blockId: string; onClose: () => void }) {
  const block        = usePlannerStore((s) => s.blocks.find((b) => b.id === blockId));
  const { updateBlock, deleteBlock } = usePlannerStore();
  const tasks        = useTaskStore((s) => s.tasks);

  const [title,     setTitle]     = useState(block?.title     ?? "");
  const [startTime, setStartTime] = useState(block?.startTime ?? "09:00");
  const [endTime,   setEndTime]   = useState(block?.endTime   ?? "10:00");
  const [color,     setColor]     = useState(block?.color     ?? BLOCK_COLORS[0]);
  const [hexInput,  setHexInput]  = useState(block?.color     ?? BLOCK_COLORS[0]);
  const [isBreak,   setIsBreak]   = useState(block?.isBreak   ?? false);
  const [notes,     setNotes]     = useState(block?.notes     ?? "");
  const [taskId,    setTaskId]    = useState(block?.taskId    ?? "");
  const [category,  setCategory]  = useState<BlockCategory | "">(block?.category as BlockCategory ?? "deep_work");

  if (!block) return null;

  const linkedTask = tasks.find((t) => t.id === taskId);
  const duration   = fmtDuration(startTime, endTime);

  function applyColor(c: string) {
    setColor(c);
    setHexInput(c);
  }

  function onHexChange(val: string) {
    setHexInput(val);
    if (/^#[0-9a-fA-F]{6}$/.test(val)) setColor(val);
  }

  function onCategoryChange(cat: BlockCategory) {
    setCategory(cat);
    const catColor = CATEGORIES.find((c) => c.id === cat)?.color;
    if (catColor) applyColor(catColor);
    if (cat === "break") setIsBreak(true);
    else setIsBreak(false);
  }

  const save = async () => {
    const prevTaskId = block.taskId;
    const nextTaskId = taskId || undefined;
    await updateBlock(block.id, {
      title:   title.trim() || block.title,
      startTime, endTime, color, isBreak, 
      category: category || undefined,
      notes:   notes || undefined,
      taskId:  nextTaskId,
    });
    if (nextTaskId && nextTaskId !== prevTaskId) {
      bus.emit("planner:block-linked-task", { blockId: block.id, taskId: nextTaskId, date: block.date });
    }
    if (!nextTaskId && prevTaskId) {
      bus.emit("planner:block-unlinked-task", { blockId: block.id, previousTaskId: prevTaskId });
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />

      <div className="relative w-full max-w-md mx-4 rounded-xl bg-card border border-border shadow-xl animate-fade-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full shrink-0 ring-2 ring-offset-2 ring-offset-card" style={{ background: color, borderColor: color }} />
            <div>
              <h3 className="text-base font-semibold">Edit Block</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{duration}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-fast">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Title */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-fast"
              placeholder="Block title…"
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => onCategoryChange(cat.id)}
                  className={cn(
                    "px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border-2",
                    category === cat.id
                      ? "border-transparent text-white"
                      : "border-border text-muted-foreground hover:text-foreground bg-background hover:border-primary/30"
                  )}
                  style={category === cat.id ? { background: cat.color, borderColor: cat.color } : {}}
                  title={cat.label}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Start</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-fast tabular-nums font-mono"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">End</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-fast tabular-nums font-mono"
              />
            </div>
          </div>

          {/* Color */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Color</label>
            <div className="flex items-center gap-2 flex-wrap">
              {BLOCK_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => applyColor(c)}
                  className={cn(
                    "w-7 h-7 rounded-lg transition-all border-2",
                    color === c 
                      ? "ring-2 ring-offset-2 ring-offset-card ring-current scale-110 border-current" 
                      : "border-border hover:border-primary/50"
                  )}
                  style={{ background: c, color: c }}
                  title={c}
                />
              ))}
              {/* Custom hex input */}
              <div className="flex-1 min-w-max flex items-center gap-2 ml-1">
                <div
                  className="w-7 h-7 rounded-lg border-2 border-border shrink-0"
                  style={{ background: /^#[0-9a-fA-F]{6}$/.test(hexInput) ? hexInput : "#ccc" }}
                />
                <input
                  value={hexInput}
                  onChange={(e) => onHexChange(e.target.value)}
                  placeholder="#3b82f6"
                  className="px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs tabular-nums font-mono outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                />
              </div>
            </div>
          </div>

          {/* Break toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
            <label className="text-sm font-semibold text-foreground">Mark as break</label>
            <button
              onClick={() => setIsBreak((v) => !v)}
              className={cn("w-10 h-6 rounded-full transition-all relative border border-border", isBreak ? "bg-primary border-primary" : "bg-muted")}
            >
              <span className={cn(
                "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-[left] duration-150",
                isBreak ? "left-[18px]" : "left-0.5"
              )} />
            </button>
          </div>

          {/* Linked task */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Linked task</label>
            {linkedTask ? (
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg border border-border bg-primary/5">
                <span className="flex-1 text-sm truncate font-medium">{linkedTask.title}</span>
                <button
                  onClick={() => setTaskId("")}
                  className="shrink-0 text-muted-foreground hover:text-rose-500 transition-fast p-1"
                  title="Unlink task"
                >
                  <Unlink size={14} />
                </button>
              </div>
            ) : (
              <select
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-fast"
              >
                <option value="">— No task linked —</option>
                {tasks
                  .filter((t) => t.status !== "done" && t.status !== "archived")
                  .map((t) => <option key={t.id} value={t.id}>{t.title}</option>)
                }
              </select>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Optional notes…"
              className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-fast resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-border bg-muted/20">
          <button
            onClick={() => void deleteBlock(block.id).then(onClose)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium text-rose-500 hover:bg-rose-500/10 transition-fast"
          >
            <Trash2 size={14} /> Delete
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent transition-fast">
              Cancel
            </button>
            <button
              onClick={() => void save()}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-fast"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
