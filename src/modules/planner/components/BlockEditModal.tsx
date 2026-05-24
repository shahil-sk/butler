// ============================================================
// PLANNER — BlockEditModal
// New: duration label, custom hex color input, block category
//      selector (Focus / Meeting / Break / Admin / Personal)
// ============================================================

import { useState } from "react";
import { X, Trash2, Unlink } from "lucide-react";
import { cn } from "@/shared/utils";
import { usePlannerStore, BLOCK_COLORS } from "../store";
import { useTaskStore } from "@/modules/tasks/store";
import { bus } from "@/kernel/event-bus";

const CATEGORIES = [
  { id: "focus",    label: "Focus",    color: "#3b82f6" },
  { id: "meeting",  label: "Meeting",  color: "#8b5cf6" },
  { id: "break",    label: "Break",    color: "#6b7280" },
  { id: "admin",    label: "Admin",    color: "#f59e0b" },
  { id: "personal", label: "Personal", color: "#10b981" },
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
  const [category,  setCategory]  = useState<BlockCategory | "">("focus");

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

      <div className="relative w-full max-w-sm mx-4 rounded-xl bg-card border border-border shadow-xl animate-fade-in">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
            <h3 className="text-sm font-semibold">Edit Block</h3>
          </div>
          <div className="flex items-center gap-2">
            {duration !== "—" && (
              <span className="text-[11px] tabular-nums font-medium text-muted-foreground">{duration}</span>
            )}
            <button onClick={onClose} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-fast">
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="px-4 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:border-primary transition-fast"
              placeholder="Block title…"
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Category</label>
            <div className="flex gap-1.5 flex-wrap">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => onCategoryChange(cat.id)}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border",
                    category === cat.id
                      ? "border-transparent text-white"
                      : "border-border text-muted-foreground hover:text-foreground bg-background"
                  )}
                  style={category === cat.id ? { background: cat.color, borderColor: cat.color } : {}}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time */}
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

          {/* Color */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Color</label>
            <div className="flex items-center gap-2 flex-wrap">
              {BLOCK_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => applyColor(c)}
                  className={cn(
                    "w-6 h-6 rounded-full transition-fast",
                    color === c && "ring-2 ring-offset-2 ring-offset-card ring-current scale-110"
                  )}
                  style={{ background: c, color: c }}
                />
              ))}
              {/* Custom hex input */}
              <div className="flex items-center gap-1.5 ml-1">
                <div
                  className="w-5 h-5 rounded-full border border-border shrink-0"
                  style={{ background: /^#[0-9a-fA-F]{6}$/.test(hexInput) ? hexInput : "#ccc" }}
                />
                <input
                  value={hexInput}
                  onChange={(e) => onHexChange(e.target.value)}
                  placeholder="#3b82f6"
                  className="w-20 px-2 py-1 rounded border border-border bg-background text-[11px] tabular-nums outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>

          {/* Break toggle */}
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">Mark as break</label>
            <button
              onClick={() => setIsBreak((v) => !v)}
              className={cn("w-9 h-5 rounded-full transition-fast relative", isBreak ? "bg-primary" : "bg-muted")}
            >
              <span className={cn(
                "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-[left] duration-150",
                isBreak ? "left-[18px]" : "left-0.5"
              )} />
            </button>
          </div>

          {/* Linked task */}
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
                  .map((t) => <option key={t.id} value={t.id}>{t.title}</option>)
                }
              </select>
            )}
          </div>

          {/* Notes */}
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
            onClick={() => void deleteBlock(block.id).then(onClose)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-500 hover:bg-rose-500/10 transition-fast"
          >
            <Trash2 size={12} /> Delete
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-accent transition-fast">
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
