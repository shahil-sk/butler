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

/** A single block entry inside a saved template */
export interface TemplateBlock {
  title: string;
  startTime: string;
  endTime: string;
  color?: string;
  isBreak: boolean;
  notes?: string;
}

/** A named, reusable day-plan template */
export interface PlanTemplate {
  id: ID;
  name: string;
  blocks: TemplateBlock[];
  createdAt: string;
}

export const BLOCK_COLORS = [
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#6b7280", // gray (break)
] as const;

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

/** Clamp time string within [START_HOUR, END_HOUR) */
export function clampTime(time: string, min = "06:00", max = "22:00"): string {
  if (time < min) return min;
  if (time > max) return max;
  return time;
}

/** Round minutes to nearest 15 */
export function snapMinutes(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const snapped = Math.round(m / 15) * 15;
  const hh = snapped === 60 ? h + 1 : h;
  const mm = snapped === 60 ? 0 : snapped;
  return `${String(Math.min(hh, 22)).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

// ── Helpers ───────────────────────────────────────────────────

function toMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Given a block's start/end and the total tracked minutes for the
 * linked task, return what fraction (0-1) of the block duration has
 * been "spent" — capped at 1.
 */
export function blockSpentFraction(block: TimeBlock, trackedMinutes: number): number {
  const duration = toMin(block.endTime) - toMin(block.startTime);
  if (duration <= 0) return 0;
  return Math.min(1, trackedMinutes / duration);
}

// ── State ─────────────────────────────────────────────────────

export type PlannerView = "day" | "3day" | "week";

interface PlannerState {
  blocks:           TimeBlock[];
  templates:        PlanTemplate[];
  activeDate:       ISODate;
  view:             PlannerView;
  loading:          boolean;
  dragTaskId:       ID | null;
  editingBlockId:   ID | null;
}

interface PlannerActions {
  loadBlocks:         (date: ISODate) => Promise<void>;
  loadWeekBlocks:     (startDate: ISODate) => Promise<void>;
  createBlock:        (input: Partial<TimeBlock> & { date: ISODate; startTime: string; endTime: string }) => Promise<TimeBlock>;
  updateBlock:        (id: ID, patch: Partial<TimeBlock>) => Promise<void>;
  deleteBlock:        (id: ID) => Promise<void>;
  rescheduleBlock:    (id: ID, newStart: string, newEnd: string) => Promise<void>;
  resizeBlock:        (id: ID, newEnd: string) => Promise<void>;
  scheduleTask:       (taskId: ID, date: ISODate, startTime: string, durationMinutes: number) => Promise<TimeBlock>;
  carryForward:       (taskId: ID, fromDate: ISODate, toDate: ISODate) => Promise<void>;
  // Template actions
  loadTemplates:      () => Promise<void>;
  savePlanTemplate:   (name: string, date: ISODate) => Promise<PlanTemplate>;
  deleteTemplate:     (id: ID) => Promise<void>;
  applyTemplate:      (templateId: ID, targetDate: ISODate) => Promise<void>;
  // Navigation
  setActiveDate:      (date: ISODate) => void;
  setView:            (v: PlannerView) => void;
  setDragTaskId:      (id: ID | null) => void;
  setEditingBlockId:  (id: ID | null) => void;
  getBlocksForDate:   (date: ISODate) => TimeBlock[];
  getDayStats:        (date: ISODate) => { totalBlocks: number; focusMinutes: number; breakMinutes: number; taskCount: number };
  goToday:            () => void;
  goNextDay:          () => void;
  goPrevDay:          () => void;
  goNextWeek:         () => void;
  goPrevWeek:         () => void;
}

// ── Migration guard for planner_templates table ───────────────
async function ensureTemplatesTable() {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS planner_templates (
        id         TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        blocks_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL
      )
    `, []);
  } catch {
    // table already exists — ignore
  }
}

export const usePlannerStore = create<PlannerState & PlannerActions>()((set, get) => ({
  blocks:           [],
  templates:        [],
  activeDate:       today(),
  view:             "day",
  loading:          false,
  dragTaskId:       null,
  editingBlockId:   null,

  loadBlocks: async (date) => {
    set({ loading: true });
    try {
      const rows = await db.select<Record<string, unknown>>(
        "SELECT * FROM planner_blocks WHERE date=? ORDER BY start_time ASC",
        [date]
      );
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

    if (block.taskId) {
      bus.emit("planner:block-linked-task", { taskId: block.taskId, date: block.date });
    }

    bus.emit("notify", { message: `Block "${block.title}" created`, type: "success" } as never);
    return block;
  },

  updateBlock: async (id, patch) => {
    const existing = get().blocks.find((b) => b.id === id);
    if (!existing) return;
    const updated: TimeBlock = { ...existing, ...patch, updatedAt: now() };
    await db.execute(UPDATE_BLOCK_SQL, updateBlockParams(updated));
    set((s) => ({ blocks: s.blocks.map((b) => b.id === id ? updated : b) }));

    const prevTaskId = existing.taskId;
    const nextTaskId = updated.taskId;

    if (prevTaskId && prevTaskId !== nextTaskId) {
      bus.emit("planner:block-unlinked-task", { previousTaskId: prevTaskId });
    }
    if (nextTaskId && nextTaskId !== prevTaskId) {
      bus.emit("planner:block-linked-task", { taskId: nextTaskId, date: updated.date });
    } else if (nextTaskId && updated.date !== existing.date) {
      bus.emit("planner:block-linked-task", { taskId: nextTaskId, date: updated.date });
    }
  },

  deleteBlock: async (id) => {
    const existing = get().blocks.find((b) => b.id === id);
    await db.execute("DELETE FROM planner_blocks WHERE id=?", [id]);
    set((s) => ({ blocks: s.blocks.filter((b) => b.id !== id) }));

    if (existing?.taskId) {
      bus.emit("planner:block-unlinked-task", { previousTaskId: existing.taskId });
    }
  },

  rescheduleBlock: async (id, newStart, newEnd) => {
    const existing = get().blocks.find((b) => b.id === id);
    if (!existing) return;
    const updated: TimeBlock = { ...existing, startTime: newStart, endTime: newEnd, updatedAt: now() };
    await db.execute(UPDATE_BLOCK_SQL, updateBlockParams(updated));
    set((s) => ({ blocks: s.blocks.map((b) => b.id === id ? updated : b) }));
  },

  resizeBlock: async (id, newEnd) => {
    const existing = get().blocks.find((b) => b.id === id);
    if (!existing) return;
    const safeEnd = newEnd > existing.startTime ? newEnd : existing.startTime;
    const updated: TimeBlock = { ...existing, endTime: safeEnd, updatedAt: now() };
    await db.execute(UPDATE_BLOCK_SQL, updateBlockParams(updated));
    set((s) => ({ blocks: s.blocks.map((b) => b.id === id ? updated : b) }));
  },

  scheduleTask: async (taskId, date, startTime, durationMinutes) => {
    const tasks = (await import("@/modules/tasks/store")).useTaskStore.getState().tasks;
    const task  = tasks.find((t) => t.id === taskId);
    const [h, m] = startTime.split(":").map(Number);
    const endMinutes = h * 60 + m + (task?.estimateMinutes ?? durationMinutes);
    const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;

    bus.emit("task:updated", {
      task: { id: taskId } as never,
      changed: { scheduledDate: date },
    });

    return get().createBlock({
      date, taskId,
      title: task?.title ?? "Task block",
      startTime,
      endTime: clampTime(endTime),
    });
  },

  carryForward: async (taskId, fromDate, toDate) => {
    const id = generateId();
    await db.execute(
      `INSERT INTO planner_carry_forward (id, task_id, from_date, to_date, created_at) VALUES (?,?,?,?,?)`,
      [id, taskId, fromDate, toDate, now()]
    );
    bus.emit("task:updated", {
      task: { id: taskId } as never,
      changed: { scheduledDate: toDate },
    });
  },

  // ── Template actions ────────────────────────────────────────

  loadTemplates: async () => {
    await ensureTemplatesTable();
    try {
      const rows = await db.select<Record<string, unknown>>(
        "SELECT * FROM planner_templates ORDER BY created_at DESC",
        []
      );
      const templates: PlanTemplate[] = rows.map((r) => ({
        id:        r.id as string,
        name:      r.name as string,
        blocks:    JSON.parse(r.blocks_json as string) as TemplateBlock[],
        createdAt: r.created_at as string,
      }));
      set({ templates });
    } catch (err) {
      console.error("[Planner] loadTemplates error:", err);
    }
  },

  savePlanTemplate: async (name, date) => {
    await ensureTemplatesTable();
    const sourceBlocks = get().blocks.filter((b) => b.date === date);
    const templateBlocks: TemplateBlock[] = sourceBlocks.map((b) => ({
      title:     b.title,
      startTime: b.startTime,
      endTime:   b.endTime,
      color:     b.color,
      isBreak:   b.isBreak,
      notes:     b.notes,
    }));
    const template: PlanTemplate = {
      id:        generateId(),
      name,
      blocks:    templateBlocks,
      createdAt: now(),
    };
    await db.execute(
      `INSERT INTO planner_templates (id, name, blocks_json, created_at) VALUES (?,?,?,?)`,
      [template.id, template.name, JSON.stringify(templateBlocks), template.createdAt]
    );
    set((s) => ({ templates: [template, ...s.templates] }));
    bus.emit("notify", { message: `Template "${name}" saved`, type: "success" } as never);
    return template;
  },

  deleteTemplate: async (id) => {
    await db.execute("DELETE FROM planner_templates WHERE id=?", [id]);
    set((s) => ({ templates: s.templates.filter((t) => t.id !== id) }));
  },

  applyTemplate: async (templateId, targetDate) => {
    const template = get().templates.find((t) => t.id === templateId);
    if (!template) return;
    for (const tb of template.blocks) {
      await get().createBlock({
        date:      targetDate,
        title:     tb.title,
        startTime: tb.startTime,
        endTime:   tb.endTime,
        color:     tb.color,
        isBreak:   tb.isBreak,
        notes:     tb.notes,
      });
    }
    bus.emit("notify", { message: `Applied template "${template.name}"`, type: "success" } as never);
  },

  setActiveDate:     (date) => set({ activeDate: date }),
  setView:           (v)    => set({ view: v }),
  setDragTaskId:     (id)   => set({ dragTaskId: id }),
  setEditingBlockId: (id)   => set({ editingBlockId: id }),

  getBlocksForDate: (date) => get().blocks.filter((b) => b.date === date),

  getDayStats: (date) => {
    const blocks = get().blocks.filter((b) => b.date === date);
    let focus = 0, brk = 0;
    for (const b of blocks) {
      const dur = toMin(b.endTime) - toMin(b.startTime);
      if (b.isBreak) brk += dur; else focus += dur;
    }
    // taskCount = distinct scheduled tasks for the date
    const taskIds = new Set(blocks.filter((b) => b.taskId).map((b) => b.taskId!));
    return { totalBlocks: blocks.length, focusMinutes: focus, breakMinutes: brk, taskCount: taskIds.size };
  },

  goToday:    () => set({ activeDate: today() }),
  goNextDay:  () => set((s) => { const d = new Date(s.activeDate); d.setDate(d.getDate() + 1); return { activeDate: toISODate(d) }; }),
  goPrevDay:  () => set((s) => { const d = new Date(s.activeDate); d.setDate(d.getDate() - 1); return { activeDate: toISODate(d) }; }),
  goNextWeek: () => set((s) => { const d = new Date(s.activeDate); d.setDate(d.getDate() + 7); return { activeDate: toISODate(d) }; }),
  goPrevWeek: () => set((s) => { const d = new Date(s.activeDate); d.setDate(d.getDate() - 7); return { activeDate: toISODate(d) }; }),
}));
