import { useRef } from "react";
import { Plus, X, GripVertical } from "lucide-react";
import { cn, toISODate } from "@/shared/utils";
import { usePlannerStore, type TimeBlock } from "../store";
import { useTaskStore } from "@/modules/tasks/store";
import { useProjectStore } from "@/modules/projects/store";
import type { ISODate } from "@/shared/types";

const HOUR_HEIGHT = 64; // px per hour
const START_HOUR  = 6;  // 6am
const END_HOUR    = 22; // 10pm
const HOURS       = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

function timeToY(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return ((h - START_HOUR) + m / 60) * HOUR_HEIGHT;
}

function yToTime(y: number): string {
  const totalMinutes = Math.round(((y / HOUR_HEIGHT) + START_HOUR) * 60 / 15) * 15;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(Math.min(h, END_HOUR - 1)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatHour(h: number): string {
  if (h === 0 || h === 24) return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

export function DayColumn({ date, compact = false }: { date: ISODate; compact?: boolean }) {
  const { getBlocksForDate, createBlock, deleteBlock, dragTaskId, setDragTaskId, scheduleTask } = usePlannerStore();
  const tasks    = useTaskStore((s) => s.tasks);
  const projects = useProjectStore((s) => s.projects);
  const gridRef  = useRef<HTMLDivElement>(null);

  const blocks = getBlocksForDate(date);

  // Current time indicator
  const now     = new Date();
  const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const isToday = date === toISODate(now);
  const nowY    = isToday ? timeToY(nowTime) : null;

  const getDropY = (e: React.DragEvent): number => {
    const rect = gridRef.current!.getBoundingClientRect();
    return Math.max(0, e.clientY - rect.top);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const y          = getDropY(e);
    const startTime  = yToTime(y);
    const taskId     = dragTaskId ?? e.dataTransfer.getData("taskId") ?? undefined;

    if (taskId) {
      const task = tasks.find((t) => t.id === taskId);
      const dur  = task?.estimateMinutes ?? 60;
      await scheduleTask(taskId, date, startTime, dur);
      setDragTaskId(null);
    } else {
      await createBlock({ date, startTime, endTime: yToTime(y + HOUR_HEIGHT), title: "Block" });
    }
  };

  return (
    <div className="flex flex-col flex-1 min-w-0">
      <div
        ref={gridRef}
        className="relative flex-1 overflow-y-auto"
        style={{ height: HOUR_HEIGHT * HOURS.length }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => void handleDrop(e)}
      >
        {/* Hour lines */}
        {HOURS.map((h) => (
          <div
            key={h}
            className="absolute left-0 right-0 border-t border-border/40"
            style={{ top: (h - START_HOUR) * HOUR_HEIGHT }}
          >
            {!compact && (
              <span className="absolute -top-2.5 left-0 text-[10px] text-muted-foreground/50 w-10 text-right pr-2 select-none tabular-nums">
                {formatHour(h)}
              </span>
            )}
          </div>
        ))}

        {/* Half-hour lines */}
        {HOURS.map((h) => (
          <div
            key={`${h}-half`}
            className="absolute left-0 right-0 border-t border-border/20 border-dashed"
            style={{ top: (h - START_HOUR) * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
          />
        ))}

        {/* Current time indicator */}
        {nowY !== null && (
          <div
            className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
            style={{ top: nowY }}
          >
            <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 shrink-0" />
            <div className="flex-1 h-px bg-red-500" />
          </div>
        )}

        {/* Time blocks */}
        {blocks.map((block) => (
          <BlockCard
            key={block.id}
            block={block}
            tasks={tasks}
            projects={projects}
            compact={compact}
            onDelete={() => void deleteBlock(block.id)}
          />
        ))}
      </div>
    </div>
  );
}

function BlockCard({
  block, tasks, projects, compact, onDelete,
}: {
  block:    TimeBlock;
  tasks:    ReturnType<typeof useTaskStore.getState>["tasks"];
  projects: ReturnType<typeof useProjectStore.getState>["projects"];
  compact:  boolean;
  onDelete: () => void;
}) {
  const task    = block.taskId ? tasks.find((t) => t.id === block.taskId) : null;
  const project = task?.projectId ? projects.find((p) => p.id === task.projectId) : null;

  const top    = timeToY(block.startTime);
  const height = Math.max(timeToY(block.endTime) - top, 24);
  const color  = block.color ?? project?.color ?? (block.isBreak ? "#6b7280" : "#3b82f6");

  return (
    <div
      className={cn(
        "absolute left-11 right-1 rounded-md px-2 py-1 overflow-hidden",
        "border-l-2 cursor-pointer group transition-fast",
        "hover:brightness-105 hover:shadow-sm"
      )}
      style={{
        top,
        height,
        backgroundColor: `${color}18`,
        borderLeftColor: color,
      }}
    >
      <div className="flex items-start gap-1 h-full">
        <GripVertical size={10} className="text-muted-foreground/40 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate leading-tight" style={{ color }}>
            {task?.title ?? block.title}
          </p>
          {!compact && height > 40 && (
            <p className="text-[10px] text-muted-foreground/60 tabular-nums">
              {block.startTime} – {block.endTime}
            </p>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground hover:text-red-500 transition-fast shrink-0"
        >
          <X size={10} />
        </button>
      </div>
    </div>
  );
}
