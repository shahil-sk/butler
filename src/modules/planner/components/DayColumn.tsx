import { useRef, useState, useCallback, useEffect } from "react";
import { X, GripVertical, Pencil, Focus as FocusIcon, Check, Timer } from "lucide-react";
import { cn, toISODate } from "@/shared/utils";
import { usePlannerStore } from "../store";
import { snapMinutes, clampTime, blockSpentFraction } from "../utils";
import type { TimeBlock } from "../types";
import { useTaskStore } from "@/modules/tasks/store";
import { useProjectStore } from "@/modules/projects/store";
import { useCalendarStore } from "@/modules/calendar/store";
import { useFocusStore } from "@/modules/focus/store";
import { useTimeStore } from "@/modules/time-tracking/store";
import type { ISODate } from "@/shared/types";
import { BlockEditModal } from "./BlockEditModal";

// ── Layout constants ──────────────────────────────────────────
export const HOUR_HEIGHT = 72;
const GUTTER_W    = 52;
const START_HOUR  = 0;
const END_HOUR    = 24;
const HOURS       = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
const TOTAL_HEIGHT = HOUR_HEIGHT * HOURS.length;
const MAJOR_HOURS = new Set([0, 6, 9, 12, 15, 18, 21]);
const MIN_BLOCK_HEIGHT_PX = HOUR_HEIGHT / 4; // 15 min

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

function formatHourLabel(h: number): string {
  if (h === 0)  return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

function fmt12(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const suffix = h < 12 ? "AM" : "PM";
  const hh = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hh}:${String(m).padStart(2, "0")} ${suffix}`;
}

// ── Drop ghost ────────────────────────────────────────────────
function DropGhost({ y, height }: { y: number; height: number }) {
  return (
    <div
      className="absolute rounded-md border-2 border-primary/50 bg-primary/10 pointer-events-none z-30"
      style={{ top: y, height, left: GUTTER_W + 4, right: 4 }}
    />
  );
}

// ── ResizeHandle ──────────────────────────────────────────────
function ResizeHandle({ blockId, startY }: { blockId: string; startY: number }) {
  const { resizeBlock } = usePlannerStore();
  const rafRef  = useRef<number | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons === 0) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const grid = document.querySelector(".day-col-grid") as HTMLElement;
      if (!grid) return;
      const rect = grid.getBoundingClientRect();
      const y = Math.max(startY + MIN_BLOCK_HEIGHT_PX, e.clientY - rect.top);
      const newEnd = snapMinutes(yToTime(y));
      usePlannerStore.setState((s) => ({
        blocks: s.blocks.map((b) => b.id === blockId ? { ...b, endTime: newEnd } : b),
      }));
    });
  }, [blockId, startY]);

  const onPointerUp = useCallback(async (e: React.PointerEvent<HTMLDivElement>) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    e.currentTarget.releasePointerCapture(e.pointerId);
    const b = usePlannerStore.getState().blocks.find((x) => x.id === blockId);
    if (b) await resizeBlock(blockId, b.endTime);
  }, [blockId, resizeBlock]);

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize flex items-center justify-center opacity-0 group-hover:opacity-100 transition-fast touch-none"
    >
      <div className="w-8 h-0.5 rounded-full bg-current opacity-40" />
    </div>
  );
}

// ── CalendarEventStrip ────────────────────────────────────────
function CalendarEventStrip({ event }: { event: { id: string; title: string; startAt: string; endAt: string; color?: string } }) {
  const startTime = event.startAt.slice(11, 16);
  const endTime   = event.endAt.slice(11, 16);
  const top    = timeToY(clampTime(startTime));
  const bottom = timeToY(clampTime(endTime));
  const height = Math.max(bottom - top, 18);
  const color  = event.color ?? "#06b6d4";

  return (
    <div
      className="absolute rounded-sm overflow-hidden pointer-events-none z-5"
      style={{ top, height, left: GUTTER_W + 2, width: 36,
        backgroundColor: `${color}22`, borderLeft: `2px solid ${color}99` }}
      title={event.title}
    >
      {height > 22 && (
        <p className="text-[8px] font-medium px-1 pt-0.5 leading-tight truncate" style={{ color }}>
          {event.title}
        </p>
      )}
    </div>
  );
}

const PRIORITY_BLOCK_COLOR: Record<string, string> = {
  urgent: "#ef4444", high: "#f97316", medium: "#eab308", low: "#0ea5e9", none: "#6b7280",
};

function getBlockDurationMinutes(block: TimeBlock): number {
  const [sh, sm] = block.startTime.split(":").map(Number);
  const [eh, em] = block.endTime.split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

// ── BlockCard ─────────────────────────────────────────────────
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

  const priorityColor = task ? PRIORITY_BLOCK_COLOR[task.priority ?? "none"] ?? PRIORITY_BLOCK_COLOR.none : undefined;
  const baseColor = block.color || project?.color || priorityColor || (block.isBreak ? "#6b7280" : "#3b82f6");

  const [editing, setEditing] = useState(false);
  const [title, setTitle]     = useState(task?.title ?? block.title);
  const { updateBlock }       = usePlannerStore();

  const activeSession  = useFocusStore((s) => s.activeSession);
  const sessions       = useFocusStore((s) => s.sessions);
  const timeEntries    = useTimeStore((s) => s.entries);
  const blockDuration  = Math.max(0, getBlockDurationMinutes(block));

  const focusedMinutes = task
    ? sessions
        .filter((s) => s.taskId === task.id && s.type === "focus" && s.completedAt && (s.actualMinutes ?? 0) > 0)
        .reduce((a, s) => a + (s.actualMinutes ?? 0), 0)
    : 0;
  const trackedMinutes = task
    ? timeEntries
        .filter((e) => e.taskId === task.id && e.endAt && e.durationMinutes)
        .reduce((a, e) => a + (e.durationMinutes ?? 0), 0)
    : 0;

  const totalSpentMinutes = focusedMinutes + trackedMinutes;
  const focusPct = blockDuration > 0 ? Math.min(1, totalSpentMinutes / blockDuration) : 0;

  const isTaskCompleted = task && (task.status === "done" || task.status === "cancelled" || task.status === "archived");
  const isTaskCancelled = task && (task.status === "cancelled" || task.status === "archived");
  const now      = new Date();
  const blockEnd = new Date(`${block.date}T${block.endTime}:00`);
  const isPast   = blockEnd < now;
  const hasEnoughFocus = focusPct >= 0.9;
  const isActiveFocus  = Boolean(
    activeSession && activeSession.type === "focus" &&
    activeSession.taskId && task && activeSession.taskId === task.id
  );
  const isMissed = !isTaskCompleted && isPast && !hasEnoughFocus && !isActiveFocus;

  const commitTitle = () => {
    setEditing(false);
    if (title.trim() && title !== block.title) void updateBlock(block.id, { title: title.trim() });
  };
  const handleStartFocus = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!task) return;
    await useFocusStore.getState().startFocus({ taskId: task.id, projectId: task.projectId });
  };
  const handleStartTimer = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await useTimeStore.getState().startTimer({
      taskId: task?.id, projectId: task?.projectId,
      description: task?.title ?? block.title,
    });
  };
  const spentFraction = blockSpentFraction(block, totalSpentMinutes);

  return (
    <div
      className={cn(
        "absolute rounded-lg px-2.5 py-1 overflow-hidden",
        "border-l-[3px] group transition-fast z-10",
        "hover:shadow-md hover:z-20",
        isTaskCompleted && "opacity-50",
        isActiveFocus  && "ring-2 ring-primary/70 ring-offset-1 ring-offset-background",
        isMissed       && "border border-rose-400/60 bg-rose-500/5"
      )}
      style={{
        top, height,
        left: GUTTER_W + 4, right: 4,
        backgroundColor: isTaskCompleted ? `#6b728018` : `${baseColor}18`,
        borderLeftColor: isTaskCompleted ? "#6b7280" : baseColor,
        cursor: editing ? "text" : "default",
      }}
      onDoubleClick={onEdit}
    >
      <div className="flex items-start gap-1.5 h-full">
        {/* Grip handle */}
        <div
          className="shrink-0 mt-0.5 cursor-grab active:cursor-grabbing touch-none"
          onPointerDown={onPointerDownGrip}
        >
          <GripVertical size={11} className="text-muted-foreground/40" />
        </div>

        <div className={cn("flex-1 min-w-0 flex flex-col justify-between h-full", height > 40 ? "pb-3" : "pb-1")}>
          {editing ? (
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => { if (e.key === "Enter") commitTitle(); if (e.key === "Escape") setEditing(false); }}
              className="text-xs font-semibold bg-transparent outline-none w-full leading-snug"
              style={{ color: isTaskCompleted ? "#6b7280" : baseColor }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <p
              className={cn("text-xs font-semibold truncate leading-snug", isTaskCancelled && "line-through")}
              style={{ color: isTaskCompleted ? "#6b7280" : baseColor }}
            >
              {task?.title ?? block.title}
              {isTaskCancelled && <span className="ml-1 text-[10px] text-muted-foreground/60">(cancelled)</span>}
              {task?.status === "done" && <span className="ml-1 text-[10px] text-muted-foreground/60">(done)</span>}
              {isMissed && !isTaskCompleted && <span className="ml-1 text-[10px] text-rose-500 font-medium">Missed</span>}
            </p>
          )}

          {!compact && height > 40 && (
            <div className="mt-0.5 space-y-1">
              <p className="text-[10px] text-muted-foreground/70 tabular-nums flex items-center justify-between gap-1">
                <span className="font-medium">
                  {fmt12(block.startTime)} \u2013 {fmt12(block.endTime)}
                  {blockDuration > 0 && (
                    <span className="ml-1 opacity-50">
                      {blockDuration >= 60
                        ? `${Math.floor(blockDuration / 60)}h${blockDuration % 60 > 0 ? ` ${blockDuration % 60}m` : ""}`
                        : `${blockDuration}m`}
                    </span>
                  )}
                </span>
                <span className="inline-flex items-center gap-1">
                  {task && (
                    <button
                      onClick={handleStartFocus}
                      className={cn(
                        "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border text-[9px] font-medium transition-fast",
                        isActiveFocus
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border/60 text-muted-foreground/70 hover:bg-primary/5 hover:border-primary/60"
                      )}
                    >
                      {isActiveFocus ? <Check size={8} /> : <FocusIcon size={8} />}
                      {isActiveFocus ? "Focusing" : "Focus"}
                    </button>
                  )}
                  <button
                    onClick={handleStartTimer}
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border border-border/60 text-[9px] text-muted-foreground/70 hover:bg-primary/5 hover:border-primary/60 transition-fast"
                  >
                    <Timer size={8} /> Log
                  </button>
                </span>
              </p>

              {task && totalSpentMinutes > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn("h-1 rounded-full transition-all", hasEnoughFocus ? "bg-emerald-500" : "bg-primary")}
                      style={{ width: `${focusPct * 100}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-muted-foreground/70 tabular-nums whitespace-nowrap">{totalSpentMinutes}m</span>
                </div>
              )}
              {!task && spentFraction > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                    <div className="h-1 rounded-full bg-primary transition-all" style={{ width: `${spentFraction * 100}%` }} />
                  </div>
                  <span className="text-[9px] text-muted-foreground/70 tabular-nums whitespace-nowrap">{Math.round(spentFraction * 100)}%</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0 transition-fast">
          <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-fast">
            <Pencil size={9} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-0.5 rounded text-muted-foreground hover:text-rose-500 transition-fast">
            <X size={9} />
          </button>
        </div>
      </div>

      <ResizeHandle blockId={block.id} startY={top} />
    </div>
  );
}

// ── DayColumn ─────────────────────────────────────────────────
export function DayColumn({ date, compact = false, hideGutter = false }: { date: ISODate; compact?: boolean; hideGutter?: boolean }) {
  const {
    getBlocksForDate, createBlock, deleteBlock,
    dragTaskId, setDragTaskId, scheduleTask,
    rescheduleBlock, editingBlockId, setEditingBlockId,
  } = usePlannerStore();

  const tasks     = useTaskStore((s) => s.tasks);
  const projects  = useProjectStore((s) => s.projects);
  const calEvents = useCalendarStore((s) => s.getEventsForDay(date));
  const gridRef   = useRef<HTMLDivElement>(null);
  const wrapRef   = useRef<HTMLDivElement>(null);
  const gutterW   = hideGutter ? 0 : GUTTER_W;

  const [ghost, setGhost] = useState<{ y: number; height: number } | null>(null);

  const dragMoveRef = useRef<{
    blockId:      string;
    offsetY:      number;
    durationPx:   number;
    pointerId:    number;
  } | null>(null);

  const blocks  = getBlocksForDate(date);
  const nowObj  = new Date();
  const nowTime = `${String(nowObj.getHours()).padStart(2, "0")}:${String(nowObj.getMinutes()).padStart(2, "0")}`;
  const isToday = date === toISODate(nowObj);
  const nowY    = isToday ? timeToY(nowTime) : null;

  useEffect(() => {
    const el = wrapRef.current?.closest('.planner-scroll-container');
    if (!el) return;
    const targetY = nowY !== null ? Math.max(0, nowY - 120) : timeToY("08:00") - 60;
    el.scrollTop = targetY;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const getGridY = useCallback((clientY: number): number => {
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.max(0, Math.min(clientY - rect.top, TOTAL_HEIGHT));
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const y      = getGridY(e.clientY);
    const snappedY = timeToY(snapMinutes(yToTime(Math.max(0, y))));
    const taskId = dragTaskId ?? e.dataTransfer.getData("taskId");
    const task   = tasks.find((t) => t.id === taskId);
    const durPx  = ((task?.estimateMinutes ?? 60) / 60) * HOUR_HEIGHT;
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
      const task = tasks.find((t) => t.id === taskId);
      await scheduleTask(taskId, task?.title ?? "Task", task?.estimateMinutes ?? 60, date, startTime);
      setDragTaskId(null);
    } else {
      const endTime = snapMinutes(yToTime(y + HOUR_HEIGHT));
      await createBlock({ date, startTime, endTime, title: "Block" });
    }
  }, [dragTaskId, date, getGridY, scheduleTask, createBlock, setDragTaskId, tasks]);

  const onPointerDownGrip = useCallback(
    (e: React.PointerEvent, blockId: string) => {
      e.preventDefault();
      const block = usePlannerStore.getState().blocks.find((b) => b.id === blockId);
      if (!block) return;

      const blockTop = timeToY(block.startTime);
      const startY   = getGridY(e.clientY);

      dragMoveRef.current = {
        blockId,
        offsetY: startY - blockTop,
        durationPx: timeToY(block.endTime) - blockTop,
        pointerId: e.pointerId,
      };

      gridRef.current?.setPointerCapture(e.pointerId);
    },
    [getGridY]
  );

  const onGridPointerMove = useCallback((e: React.PointerEvent) => {
    const ref = dragMoveRef.current;
    if (!ref || e.pointerId !== ref.pointerId) return;
    const y        = getGridY(e.clientY) - ref.offsetY;
    const snappedY = timeToY(snapMinutes(yToTime(Math.max(0, y))));
    setGhost({ y: snappedY, height: ref.durationPx });
  }, [getGridY]);

  const onGridPointerUp = useCallback(async (e: React.PointerEvent) => {
    const ref = dragMoveRef.current;
    dragMoveRef.current = null;
    setGhost(null);
    if (!ref || e.pointerId !== ref.pointerId) return;

    const y        = getGridY(e.clientY) - ref.offsetY;
    const newStart = snapMinutes(yToTime(Math.max(0, y)));
    const [sh, sm] = newStart.split(":").map(Number);
    const liveBlock = usePlannerStore.getState().blocks.find((b) => b.id === ref.blockId);
    if (!liveBlock) return;
    const dur =
      (parseInt(liveBlock.endTime.split(":")[0]) * 60 + parseInt(liveBlock.endTime.split(":")[1])) -
      (parseInt(liveBlock.startTime.split(":")[0]) * 60 + parseInt(liveBlock.startTime.split(":")[1]));
    const em2    = sh * 60 + sm + dur;
    const newEnd = clampTime(`${String(Math.floor(em2 / 60)).padStart(2, "0")}:${String(em2 % 60).padStart(2, "0")}`);
    await rescheduleBlock(ref.blockId, newStart, newEnd);
  }, [getGridY, rescheduleBlock]);

  return (
    <div ref={wrapRef} className="flex flex-col flex-1 min-w-0 border-r border-border/20 last:border-r-0 relative">
      <div
        ref={gridRef}
        className="day-col-grid relative shrink-0"
        style={{ height: TOTAL_HEIGHT }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onPointerMove={onGridPointerMove}
        onPointerUp={onGridPointerUp}
      >
        {/* Gutter */}
        {!hideGutter && (
          <div
            className="absolute top-0 bottom-0 left-0 bg-muted/20 border-r border-border/40 pointer-events-none z-0"
            style={{ width: gutterW }}
          />
        )}

        {/* Hour lines + labels */}
        {HOURS.map((h) => {
          const y       = timeToY(`${String(h).padStart(2, "0")}:00`);
          const isMajor = MAJOR_HOURS.has(h);
          return (
            <div key={h} className="absolute left-0 right-0 pointer-events-none" style={{ top: y }}>
              <div
                className={cn("absolute right-0 border-t", isMajor ? "border-border/50" : "border-border/20")}
                style={{ left: gutterW }}
              />
              {!hideGutter && (
                <span
                  className={cn(
                    "absolute right-0 -translate-y-1/2 pr-2 tabular-nums select-none leading-none",
                    isMajor ? "text-[11px] font-semibold text-muted-foreground/80" : "text-[10px] font-normal text-muted-foreground/45"
                  )}
                  style={{ width: gutterW }}
                >
                  {formatHourLabel(h)}
                </span>
              )}
            </div>
          );
        })}

        {/* Half-hour ticks */}
        {HOURS.map((h) => (
          <div
            key={`${h}:30`}
            className="absolute right-0 border-t border-border/15 pointer-events-none"
            style={{ top: timeToY(`${String(h).padStart(2, "0")}:30`), left: gutterW }}
          />
        ))}

        {/* Now indicator */}
        {nowY !== null && (
          <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: nowY }}>
            <div className="relative flex items-center">
              <span
                className="absolute text-[9px] font-bold tabular-nums text-primary bg-primary/10 px-1 py-0.5 rounded-full leading-none z-10 -translate-y-1/2"
                style={{ width: gutterW, textAlign: "center", top: "50%", display: hideGutter ? 'none' : 'block' }}
              >
                {nowTime}
              </span>
              <div className="w-2 h-2 rounded-full bg-primary shrink-0 z-10" style={{ marginLeft: gutterW > 0 ? gutterW - 4 : -4 }} />
              <div className="flex-1 h-px bg-primary/70" />
            </div>
          </div>
        )}

        {/* Calendar events */}
        {calEvents.map((ev) => <CalendarEventStrip key={ev.id} event={ev} />)}

        {/* Blocks */}
        {blocks.map((b) => (
          <BlockCard
            key={b.id}
            block={b}
            tasks={tasks}
            projects={projects}
            compact={compact}
            onDelete={() => deleteBlock(b.id)}
            onEdit={() => setEditingBlockId(b.id)}
            onPointerDownGrip={(e) => onPointerDownGrip(e, b.id)}
          />
        ))}

        {ghost && <DropGhost y={ghost.y} height={ghost.height} />}
      </div>

      {editingBlockId && (
        <BlockEditModal blockId={editingBlockId} onClose={() => setEditingBlockId(null)} />
      )}
    </div>
  );
}
