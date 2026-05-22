// ============================================================
// PLANNER — STORE
// UI state only. Zero db import. Zero bus import. Zero SQL.
// Delegates all writes/reads to svc.*; navigation setters are
// pure state mutations.
// ============================================================

import { create } from "zustand";
import * as svc from "./service";
import { dbLoadBlocksByDate, dbLoadBlocksByDateRange } from "./repository";
import { toMin } from "./utils";
import type { TimeBlock, PlanTemplate, PlannerView } from "./types";
import { today, toISODate } from "@/shared/utils";

// ── State shape ───────────────────────────────────────────────

interface PlannerState {
  blocks:          TimeBlock[];
  templates:       PlanTemplate[];
  activeDate:      string;
  view:            PlannerView;
  loading:         boolean;
  dragTaskId:      string | null;
  editingBlockId:  string | null;

  loadBlocks:        (date: string) => Promise<void>;
  loadWeekBlocks:    (startDate: string) => Promise<void>;
  createBlock:       (input: Partial<TimeBlock> & { date: string; startTime: string; endTime: string }) => Promise<TimeBlock>;
  updateBlock:       (id: string, patch: Partial<TimeBlock>) => Promise<void>;
  deleteBlock:       (id: string) => Promise<void>;
  rescheduleBlock:   (id: string, newStart: string, newEnd: string) => Promise<void>;
  resizeBlock:       (id: string, newEnd: string) => Promise<void>;
  scheduleTask:      (taskId: string, taskTitle: string, estimateMinutes: number, date: string, startTime: string) => Promise<TimeBlock>;
  carryForward:      (taskId: string, taskStatus: string, fromDate: string, toDate: string) => Promise<void>;
  loadTemplates:     () => Promise<void>;
  savePlanTemplate:  (name: string, date: string) => Promise<PlanTemplate>;
  deleteTemplate:    (id: string) => Promise<void>;
  applyTemplate:     (templateId: string, targetDate: string) => Promise<void>;
  setActiveDate:     (date: string) => void;
  setView:           (v: PlannerView) => void;
  setDragTaskId:     (id: string | null) => void;
  setEditingBlockId: (id: string | null) => void;
  getBlocksForDate:  (date: string) => TimeBlock[];
  getDayStats:       (date: string) => { totalBlocks: number; focusMinutes: number; breakMinutes: number; taskCount: number };
  goToday:           () => void;
  goNextDay:         () => void;
  goPrevDay:         () => void;
  goNextWeek:        () => void;
  goPrevWeek:        () => void;
}

// ── Store ─────────────────────────────────────────────────────

export const usePlannerStore = create<PlannerState>()((set, get) => ({
  blocks: [], templates: [], activeDate: today(),
  view: "day", loading: false, dragTaskId: null, editingBlockId: null,

  loadBlocks: async (date) => {
    set({ loading: true });
    try {
      const fresh = await dbLoadBlocksByDate(date);
      set((s) => ({
        blocks:  [...s.blocks.filter((b) => b.date !== date), ...fresh],
        loading: false,
      }));
    } catch (err) {
      console.error("[Planner] loadBlocks error:", err);
      set({ loading: false });
    }
  },

  loadWeekBlocks: async (startDate) => {
    set({ loading: true });
    try {
      const { blocks, startDate: s, endDate: e } = await svc.loadBlocksByWeek(startDate);
      set((st) => ({
        blocks:  [...st.blocks.filter((b) => b.date < s || b.date >= e), ...blocks],
        loading: false,
      }));
    } catch (err) {
      console.error("[Planner] loadWeekBlocks error:", err);
      set({ loading: false });
    }
  },

  createBlock: async (input) => {
    const block = await svc.createBlock(input);
    set((s) => ({ blocks: [...s.blocks, block] }));
    return block;
  },

  updateBlock: async (id, patch) => {
    const existing = get().blocks.find((b) => b.id === id);
    if (!existing) return;
    const updated = await svc.updateBlock(existing, patch);
    set((s) => ({ blocks: s.blocks.map((b) => b.id === id ? updated : b) }));
  },

  deleteBlock: async (id) => {
    const existing = get().blocks.find((b) => b.id === id);
    if (!existing) return;
    await svc.deleteBlock(existing);
    set((s) => ({ blocks: s.blocks.filter((b) => b.id !== id) }));
  },

  rescheduleBlock: async (id, newStart, newEnd) => {
    const existing = get().blocks.find((b) => b.id === id);
    if (!existing) return;
    const updated = await svc.rescheduleBlock(existing, newStart, newEnd);
    set((s) => ({ blocks: s.blocks.map((b) => b.id === id ? updated : b) }));
  },

  resizeBlock: async (id, newEnd) => {
    const existing = get().blocks.find((b) => b.id === id);
    if (!existing) return;
    const updated = await svc.resizeBlock(existing, newEnd);
    set((s) => ({ blocks: s.blocks.map((b) => b.id === id ? updated : b) }));
  },

  scheduleTask: async (taskId, taskTitle, estimateMinutes, date, startTime) => {
    const block = await svc.scheduleTask({ taskId, taskTitle, estimateMinutes, date, startTime });
    set((s) => ({ blocks: [...s.blocks, block] }));
    return block;
  },

  carryForward: async (taskId, taskStatus, fromDate, toDate) => {
    await svc.carryForward({ taskId, taskStatus, fromDate, toDate });
  },

  loadTemplates: async () => {
    const templates = await svc.loadTemplates();
    set({ templates });
  },

  savePlanTemplate: async (name, date) => {
    const sourceBlocks = get().blocks.filter((b) => b.date === date);
    const template = await svc.savePlanTemplate(name, sourceBlocks);
    set((s) => ({ templates: [template, ...s.templates] }));
    return template;
  },

  deleteTemplate: async (id) => {
    await svc.deleteTemplate(id);
    set((s) => ({ templates: s.templates.filter((t) => t.id !== id) }));
  },

  applyTemplate: async (templateId, targetDate) => {
    const template = get().templates.find((t) => t.id === templateId);
    if (!template) return;
    const newBlocks = await svc.applyTemplate(template, targetDate);
    set((s) => ({ blocks: [...s.blocks, ...newBlocks] }));
  },

  setActiveDate:     (date) => set({ activeDate: date }),
  setView:           (v)    => set({ view: v }),
  setDragTaskId:     (id)   => set({ dragTaskId: id }),
  setEditingBlockId: (id)   => set({ editingBlockId: id }),

  getBlocksForDate: (date) => get().blocks.filter((b) => b.date === date),

  // Synchronous selector — no async, no dynamic import
  getDayStats: (date) => {
    const blocks = get().blocks.filter((b) => b.date === date);
    let focus = 0, brk = 0;
    const taskIds = new Set<string>();
    for (const b of blocks) {
      const dur = toMin(b.endTime) - toMin(b.startTime);
      if (b.isBreak) brk += dur; else focus += dur;
      if (b.taskId) taskIds.add(b.taskId);
    }
    return { totalBlocks: blocks.length, focusMinutes: focus, breakMinutes: brk, taskCount: taskIds.size };
  },

  goToday:    () => set({ activeDate: today() }),
  goNextDay:  () => set((s) => { const d = new Date(s.activeDate); d.setDate(d.getDate() + 1); return { activeDate: toISODate(d) }; }),
  goPrevDay:  () => set((s) => { const d = new Date(s.activeDate); d.setDate(d.getDate() - 1); return { activeDate: toISODate(d) }; }),
  goNextWeek: () => set((s) => { const d = new Date(s.activeDate); d.setDate(d.getDate() + 7); return { activeDate: toISODate(d) }; }),
  goPrevWeek: () => set((s) => { const d = new Date(s.activeDate); d.setDate(d.getDate() - 7); return { activeDate: toISODate(d) }; }),
}));
