import { create } from "zustand";
import { db } from "@/kernel/db";
import { bus } from "@/kernel/event-bus";
import { generateId, now, today, toISODate } from "@/shared/utils";
import type { ID, ISODate } from "@/shared/types";

// ── Types ─────────────────────────────────────────────────────

export interface TimeBlock {
  id: ID;
  date: ISODate;
  taskId?: ID;
  title: string;
  startTime: string;   // "09:00"
  endTime: string;     // "10:30"
  color?: string;
  isBreak: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

function rowToBlock(r: Record<string, unknown>): TimeBlock {
  return {
    id:        r.id as string,
    date:      r.date as string,
    taskId:    (r.task_id as string | null) ?? undefined,
    title:     r.title as string,
    startTime: r.start_time as string,
    endTime:   r.end_time as string,
    color:     (r.color as string | null) ?? undefined,
    isBreak:   Boolean(r.is_break),
    notes:     (r.notes as string | null) ?? undefined,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

const INSERT_BLOCK_SQL = `
  INSERT INTO planner_blocks
    (id, date, task_id, title, start_time, end_time, color, is_break, notes, created_at, updated_at)
  VALUES (?,?,?,?,?,?,?,?,?,?,?)
`;
const UPDATE_BLOCK_SQL = `
  UPDATE planner_blocks SET
    date=?, task_id=?, title=?, start_time=?, end_time=?,
    color=?, is_break=?, notes=?, updated_at=?
  WHERE id=?
`;

function insertBlockParams(b: TimeBlock): unknown[] {
  return [
    b.id, b.date, b.taskId ?? null, b.title, b.startTime, b.endTime,
    b.color ?? null, b.isBreak ? 1 : 0, b.notes ?? null, b.createdAt, b.updatedAt,
  ];
}
function updateBlockParams(b: TimeBlock): unknown[] {
  return [
    b.date, b.taskId ?? null, b.title, b.startTime, b.endTime,
    b.color ?? null, b.isBreak ? 1 : 0, b.notes ?? null, b.updatedAt,
    b.id,
  ];
}

// ── State ─────────────────────────────────────────────────────

export type PlannerView = "day" | "week";

interface PlannerState {
  blocks:       TimeBlock[];
  activeDate:   ISODate;
  view:         PlannerView;
  loading:      boolean;
  dragTaskId:   ID | null;
}

interface PlannerActions {
  loadBlocks:       (date: ISODate) => Promise<void>;
  loadWeekBlocks:   (startDate: ISODate) => Promise<void>;
  createBlock:      (input: Partial<TimeBlock> & { date: ISODate; startTime: string; endTime: string }) => Promise<TimeBlock>;
  updateBlock:      (id: ID, patch: Partial<TimeBlock>) => Promise<void>;
  deleteBlock:      (id: ID) => Promise<void>;
  scheduleTask:     (taskId: ID, date: ISODate, startTime: string, durationMinutes: number) => Promise<TimeBlock>;
  setActiveDate:    (date: ISODate) => void;
  setView:          (v: PlannerView) => void;
  setDragTaskId:    (id: ID | null) => void;
  getBlocksForDate: (date: ISODate) => TimeBlock[];
  goToday:          () => void;
  goNextDay:        () => void;
  goPrevDay:        () => void;
  goNextWeek:       () => void;
  goPrevWeek:       () => void;
}

export const usePlannerStore = create<PlannerState & PlannerActions>()((set, get) => ({
  blocks:     [],
  activeDate: today(),
  view:       "day",
  loading:    false,
  dragTaskId: null,

  loadBlocks: async (date) => {
    set({ loading: true });
    try {
      const rows = await db.select<Record<string, unknown>>(
        "SELECT * FROM planner_blocks WHERE date=? ORDER BY start_time ASC",
        [date]
      );
      // Merge — keep blocks from other dates already loaded
      set((s) => {
        const others = s.blocks.filter((b) => b.date !== date);
        return { blocks: [...others, ...rows.map(rowToBlock)], loading: false };
      });
    } catch (err) {
      console.error("[Planner] loadBlocks error:", err);
      set({ loading: false });
    }
  },

  loadWeekBlocks: async (startDate) => {
    set({ loading: true });
    try {
      // Load 7 days from startDate
      const start = new Date(startDate);
      const end   = new Date(startDate);
      end.setDate(end.getDate() + 7);
      const rows = await db.select<Record<string, unknown>>(
        "SELECT * FROM planner_blocks WHERE date >= ? AND date < ? ORDER BY date ASC, start_time ASC",
        [toISODate(start), toISODate(end)]
      );
      set((s) => {
        const outside = s.blocks.filter((b) => b.date < toISODate(start) || b.date >= toISODate(end));
        return { blocks: [...outside, ...rows.map(rowToBlock)], loading: false };
      });
    } catch (err) {
      console.error("[Planner] loadWeekBlocks error:", err);
      set({ loading: false });
    }
  },

  createBlock: async (input) => {
    const block: TimeBlock = {
      id:        generateId(),
      date:      input.date,
      taskId:    input.taskId,
      title:     input.title ?? "Block",
      startTime: input.startTime,
      endTime:   input.endTime,
      color:     input.color,
      isBreak:   input.isBreak ?? false,
      notes:     input.notes,
      createdAt: now(),
      updatedAt: now(),
    };
    await db.execute(INSERT_BLOCK_SQL, insertBlockParams(block));
    set((s) => ({ blocks: [...s.blocks, block] }));
    return block;
  },

  updateBlock: async (id, patch) => {
    const existing = get().blocks.find((b) => b.id === id);
    if (!existing) return;
    const updated: TimeBlock = { ...existing, ...patch, updatedAt: now() };
    await db.execute(UPDATE_BLOCK_SQL, updateBlockParams(updated));
    set((s) => ({ blocks: s.blocks.map((b) => b.id === id ? updated : b) }));
  },

  deleteBlock: async (id) => {
    await db.execute("DELETE FROM planner_blocks WHERE id=?", [id]);
    set((s) => ({ blocks: s.blocks.filter((b) => b.id !== id) }));
  },

  scheduleTask: async (taskId, date, startTime, durationMinutes) => {
    // Calculate end time
    const [h, m] = startTime.split(":").map(Number);
    const endMinutes = h * 60 + m + durationMinutes;
    const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;

    // Update task scheduled date
    bus.emit("task:updated", {
      task: { id: taskId } as never,
      changed: { scheduledDate: date },
    });

    return get().createBlock({ date, taskId, title: "", startTime, endTime });
  },

  setActiveDate: (date) => set({ activeDate: date }),
  setView:       (v)    => set({ view: v }),
  setDragTaskId: (id)   => set({ dragTaskId: id }),

  getBlocksForDate: (date) => get().blocks.filter((b) => b.date === date),

  goToday:    () => set({ activeDate: today() }),
  goNextDay:  () => set((s) => { const d = new Date(s.activeDate); d.setDate(d.getDate() + 1); return { activeDate: toISODate(d) }; }),
  goPrevDay:  () => set((s) => { const d = new Date(s.activeDate); d.setDate(d.getDate() - 1); return { activeDate: toISODate(d) }; }),
  goNextWeek: () => set((s) => { const d = new Date(s.activeDate); d.setDate(d.getDate() + 7); return { activeDate: toISODate(d) }; }),
  goPrevWeek: () => set((s) => { const d = new Date(s.activeDate); d.setDate(d.getDate() - 7); return { activeDate: toISODate(d) }; }),
}));
