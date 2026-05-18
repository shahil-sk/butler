import { useRef, useState, useCallback } from "react";
import { X, GripVertical, Pencil } from "lucide-react";
import { cn, toISODate } from "@/shared/utils";
import { usePlannerStore, type TimeBlock, snapMinutes, clampTime } from "../store";
import { useTaskStore } from "@/modules/tasks/store";
import { useProjectStore } from "@/modules/projects/store";
import type { ISODate } from "@/shared/types";
import { BlockEditModal } from "./BlockEditModal";

export const HOUR_HEIGHT = 64; // px per hour
const START_HOUR   = 6;
const END_HOUR     = 22;
const HOURS        = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
const TOTAL_HEIGHT = HOUR_HEIGHT * HOURS.length;

export function timeToY(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return ((h - START_HOUR) + m / 60) * HOUR_HEIGHT;
}

export function yToTime(y: number): string {
  const raw = y / HOUR_HEIGHT + START_HOUR;
  const h   = Math.floor(raw);
  const m   = Math.round((raw - h) * 60 / 15) * 15;
  const hh  = m === 60 ? h + 1 : h;
  const mm  = m === 60 ? 0 : m;
  return clampTime(`${String(Math.min(hh, END_HOUR)).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
}

function formatHour(h: number): string {
  if (h === 0 || h === 24) return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

// ── Drop preview ghost ─────────────────────────────────────────
function DropGhost({ y, height }: { y: number; height: number }) {
  return (
    <div
      className="absolute left-11 right-1 rounded-md border-2 border-primary/50 bg-primary/10 pointer-events-none z-30 transition-[top] duration-75"
      style={{ top: y, height }}
    />
  );
}

// ── Single ResizeHandle ────────────────────────────────────────
function ResizeHandle({ blockId, startY }: { blockId: string; startY: number }) {
  const { resizeBlock } = usePlannerStore();
  const rafRef = useRef<number | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();

      // Walk up to find the nearest .day-col-grid ancestor
      const grid = (e.target as HTMLElement).closest(".day-col-grid") as HTMLElement | null
        ?? document.querySelector(".day-col-grid") as HTMLElement | null;
      if (!grid) return;

      const gridRect = grid.getBoundingClientRect();

      const onMove = (ev: PointerEvent) => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          const y      = Math.max(startY + HOUR_HEIGHT / 4, ev.clientY - gridRect.top);
          const newEnd = snapMinutes(yToTime(y));
          // Optimistic in-memory update for smooth feel
          usePlannerStore.setState((s) => ({
            blocks: s.blocks.map((b) =>
              b.id === blockId ? { ...b, endTime: newEnd } : b
            ),
          }));
        });
      };

      const onUp = async () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        const b = usePlannerStore.getState().blocks.find((x) => x.id === blockId);
        if (b) await resizeBlock(blockId, b.endTime);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [blockId, startY, resizeBlock]
  );

  return (
    <div
      onPointerDown={onPointerDown}
      className="absolute bottom-0 left-0 right-0 h-2.5 cursor-ns-resize flex items-center justify-center opacity-0 group-hover:opacity-100 transition-fast touch-none"
    >
      <div className="w-8 h-0.5 rounded-full bg-current opacity-30" />
    </div>
  );
}

// ── BlockCard ──────────────────────────────────────────────────
function BlockCard({
  block, tasks, projects, compact, onDelete, onEdit, onPointerDownGrip,
}: {
  block:    TimeBlock;
  tasks:    ReturnType<typeof useTaskStore.getState>["tasks"];
  projects: ReturnType<typeof useProjectStore.getState>["projects"];
  compact:  boolean;
  onDelete: () => void;
  onEdit:   () => void;
  onPointerDownGrip: (e: React.PointerEvent) => void;
}) {
  const task    = block.taskId ? tasks.find((t) => t.id === block.taskId) : null;
  const project = task?.projectId ? projects.find((p) => p.id === task.projectId) : null;

  const top    = timeToY(block.startTime);
  const height = Math.max(timeToY(block.endTime) - top, 24);
  const color  = block.color ?? project?.color ?? (block.isBreak ? "#6b7280" : "#3b82f6");

  const [editing, setEditing] = useState(false);
  const [title, setTitle]     = useState(task?.title ?? block.title);
  const { updateBlock }       = usePlannerStore();

  const commitTitle = () => {
    setEditing(false);
    if (title.trim() && title !== block.title) {
      void updateBlock(block.id, { title: title.trim() });
    }
  };

  return (
    <div
      className={cn(
        "absolute left-11 right-1 rounded-md px-2 py-1 overflow-hidden",
        "border-l-[3px] group transition-fast z-10",
        "hover:shadow-md hover:z-20"
      )}
      style={{
        top,
        height,
        backgroundColor: `${color}18`,
        borderLeftColor: color,
        cursor: editing ? "text" : "default",
      }}
      onDoubleClick={onEdit}
    >
      <div className="flex items-start gap-1 h-full">
        {/* Grip — pointer drag handle */}
        <div
          className="shrink-0 mt-0.5 cursor-grab active:cursor-grabbing touch-none"
          onPointerDown={onPointerDownGrip}
        >
          <GripVertical size={10} className="text-muted-foreground/40" />
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-between h-full pb-3">
          {editing ? (
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitTitle();
                if (e.key === "Escape") setEditing(false);
              }}
              className="text-xs font-medium bg-transparent outline-none w-full"
              style={{ color }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <p
              className="text-xs font-medium truncate leading-tight"
              style={{ color }}
              onClick={() => !compact && setEditing(true)}
            >
              {task?.title ?? block.title}
            </p>
          )}

          {!compact && height > 44 && (
            <p className="text-[10px] text-muted-foreground/60 tabular-nums">
              {block.startTime} – {block.endTime}
              {task && <span className="ml-1 opacity-50">· {task.estimateMinutes ?? 0}m</span>}
            </p>
          )}
        </div>

        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0 transition-fast">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-fast"
          >
            <Pencil size={9} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-0.5 rounded text-muted-foreground hover:text-rose-500 transition-fast"
          >
            <X size={9} />
          </button>
        </div>
      </div>

      <ResizeHandle blockId={block.id} startY={top} />
    </div>
  );
}

// ── DayColumn ──────────────────────────────────────────────────
export function DayColumn({ date, compact = false }: { date: ISODate; compact?: boolean }) {
  const {
    getBlocksForDate, createBlock, deleteBlock,
    dragTaskId, setDragTaskId, scheduleTask,
    rescheduleBlock, editingBlockId, setEditingBlockId,
  } = usePlannerStore();
  const tasks    = useTaskStore((s) => s.tasks);
  const projects = useProjectStore((s) => s.projects);
  const gridRef  = useRef<HTMLDivElement>(null);

  const [ghost, setGhost] = useState<{ y: number; height: number } | null>(null);
  const dragMoveRef = useRef<{ blockId: string; offsetY: number; durationPx: number } | null>(null);

  const blocks  = getBlocksForDate(date);
  const nowObj  = new Date();
  const nowTime = `${String(nowObj.getHours()).padStart(2, "0")}:${String(nowObj.getMinutes()).padStart(2, "0")}`;
  const isToday = date === toISODate(nowObj);
  const nowY    = isToday ? timeToY(nowTime) : null;

  const getGridY = useCallback((clientY: number): number => {
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.max(0, Math.min(clientY - rect.top, TOTAL_HEIGHT));
  }, []);

  // ── Task drag-over / drop ──────────────────────────────────────
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const y        = getGridY(e.clientY);
    const snappedY = timeToY(snapMinutes(yToTime(y)));
    const taskId   = dragTaskId ?? e.dataTransfer.getData("taskId");
    const task     = tasks.find((t) => t.id === taskId);
    const durPx    = ((task?.estimateMinutes ?? 60) / 60) * HOUR_HEIGHT;
    setGhost({ y: snappedY, height: durPx });
  }, [dragTaskId, tasks, getGridY]);

  const onDragLeave = useCallback(() => setGhost(null), []);

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setGhost(null);
    const y         = getGridY(e.clientY);
    const startTime = snapMinutes(yToTime(y));
    const taskId    = dragTaskId ?? e.dataTransfer.getData("taskId") ?? undefined;

    if (taskId) {
      await scheduleTask(taskId, date, startTime, 60);
      setDragTaskId(null);
    } else {
      const endTime = snapMinutes(yToTime(y + HOUR_HEIGHT));
      await createBlock({ date, startTime, endTime, title: "Block" });
    }
  }, [dragTaskId, date, getGridY, scheduleTask, createBlock, setDragTaskId]);

  // ── Block drag-move ────────────────────────────────────────────
  const startBlockDrag = useCallback((e: React.PointerEvent, block: TimeBlock) => {
    e.preventDefault();
    const topY      = getGridY(e.clientY);
    const blockTopY = timeToY(block.startTime);
    const durPx     = timeToY(block.endTime) - blockTopY;
    dragMoveRef.current = { blockId: block.id, offsetY: topY - blockTopY, durationPx: durPx };

    const onMove = (ev: PointerEvent) => {
      const { offsetY, durationPx, blockId } = dragMoveRef.current!;
      const rawY     = getGridY(ev.clientY) - offsetY;
      const snapY    = timeToY(snapMinutes(yToTime(rawY)));
      const newStart = snapMinutes(yToTime(snapY));
      const newEnd   = snapMinutes(yToTime(snapY + durationPx));
      usePlannerStore.setState((s) => ({
        blocks: s.blocks.map((b) =>
          b.id === blockId ? { ...b, startTime: newStart, endTime: newEnd } : b
        ),
      }));
    };

    const onUp = async () => {
      const { blockId } = dragMoveRef.current!;
      dragMoveRef.current = null;
      const b = usePlannerStore.getState().blocks.find((x) => x.id === blockId);
      if (b) await rescheduleBlock(blockId, b.startTime, b.endTime);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [getGridY, rescheduleBlock]);

  const editingBlock = editingBlockId ? blocks.find((b) => b.id === editingBlockId) : null;

  return (
    <div className="flex flex-col flex-1 min-w-0">
      <div
        ref={gridRef}
        className="day-col-grid relative overflow-visible"
        style={{ height: TOTAL_HEIGHT }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={(e) => void onDrop(e)}
      >
        {/* Hour lines */}
        {HOURS.map((h) => (
          <div
            key={h}
            className="absolute left-0 right-0 border-t border-border/40"
            style={{ top: (h - START_HOUR) * HOUR_HEIGHT }}
          >
            {!compact && (
              <span className="absolute -top-2.5 left-0 text-[10px] text-muted-foreground/40 w-10 text-right pr-2 select-none tabular-nums">
                {formatHour(h)}
              </span>
            )}
          </div>
        ))}

        {/* Half-hour dashed lines */}
        {HOURS.map((h) => (
          <div
            key={`${h}-half`}
            className="absolute left-0 right-0 border-t border-border/15 border-dashed"
            style={{ top: (h - START_HOUR) * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
          />
        ))}

        {/* Drop ghost */}
        {ghost && <DropGhost y={ghost.y} height={ghost.height} />}

        {/* Now indicator */}
        {nowY !== null && (
          <div
            className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
            style={{ top: nowY }}
          >
            <div className="w-2 h-2 rounded-full bg-rose-500 -ml-1 shrink-0" />
            <div className="flex-1 h-px bg-rose-500 opacity-70" />
          </div>
        )}

        {/* Blocks */}
        {blocks.map((block) => (
          <BlockCard
            key={block.id}
            block={block}
            tasks={tasks}
            projects={projects}
            compact={compact}
            onDelete={() => void deleteBlock(block.id)}
            onEdit={() => setEditingBlockId(block.id)}
            onPointerDownGrip={(e) => startBlockDrag(e, block)}
          />
        ))}
      </div>

      {editingBlock && (
        <BlockEditModal
          block={editingBlock}
          onClose={() => setEditingBlockId(null)}
        />
      )}
    </div>
  );
}
