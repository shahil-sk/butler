// ============================================================
// TASKS MODULE — STORE
// Pure UI state + thin delegation to service layer.
// No direct DB access. No business logic.
// ============================================================

import { create } from "zustand";
import { bus } from "@/kernel/event-bus";
import type { Task, Priority, TaskStatus, ID } from "@/shared/types";
import type { TaskFilter as _TaskFilter } from "./types";
import * as svc from "./service";
import * as repo from "./repository";

// ── View / sort / filter types ────────────────────────────────

export type TaskView    = "list" | "board" | "calendar" | "timeline" | "table";
export type TaskGroupBy = "none" | "status" | "priority" | "project" | "dueDate";
export type TaskSortBy  = "manual" | "dueDate" | "priority" | "createdAt" | "title";

export interface TaskFilter {
  statuses:   TaskStatus[];
  priorities: Priority[];
  projectIds: string[];
  labels:     string[];
  search?:    string;
}

// ── State / actions interfaces ────────────────────────────────

interface TaskState {
  tasks:           Task[];
  loading:         boolean;
  error:           string | null;
  selectedTaskIds: Set<ID>;
  openTaskId:      ID | null;
  quickAddOpen:    boolean;
  quickAddPrefill: Partial<Task>;
  view:            TaskView;
  groupBy:         TaskGroupBy;
  sortBy:          TaskSortBy;
  filter:          TaskFilter;
  activeRoute:     string;
}

interface TaskActions {
  // Data
  loadTasks:           () => Promise<void>;
  createTask:          (input: Partial<Task>) => Promise<Task>;
  updateTask:          (id: ID, patch: Partial<Task>) => Promise<void>;
  deleteTask:          (id: ID) => Promise<void>;
  completeTask:        (id: ID) => Promise<void>;
  restoreTask:         (id: ID) => Promise<void>;
  archiveTask:         (id: ID) => Promise<void>;
  duplicateTask:       (id: ID) => Promise<Task>;
  moveTask:            (id: ID, toProjectId: ID | null) => Promise<void>;
  reorderTasks:        (ids: ID[]) => Promise<void>;
  batchUpdate:         (ids: ID[], patch: Partial<Task>) => Promise<void>;
  batchDelete:         (ids: ID[]) => Promise<void>;
  addChecklistItem:    (taskId: ID, text: string) => Promise<void>;
  toggleChecklistItem: (taskId: ID, itemId: ID) => Promise<void>;
  deleteChecklistItem: (taskId: ID, itemId: ID) => Promise<void>;
  // UI
  openQuickAdd:        (prefill?: Partial<Task>) => void;
  closeQuickAdd:       () => void;
  openTask:            (id: ID) => void;
  closeTask:           () => void;
  selectTask:          (id: ID, multi?: boolean) => void;
  clearSelection:      () => void;
  setView:             (v: TaskView) => void;
  setGroupBy:          (g: TaskGroupBy) => void;
  setSortBy:           (s: TaskSortBy) => void;
  setFilter:           (f: Partial<TaskFilter>) => void;
  setActiveRoute:      (r: string) => void;
  // Derived
  getFilteredTasks:    () => Task[];
  getSubtasks:         (parentId: ID) => Task[];
  getTaskById:         (id: ID) => Task | undefined;
  getTodayTasks:       () => Task[];
  getUpcomingTasks:    () => Task[];
  getOverdueTasks:     () => Task[];
}

const DEFAULT_FILTER: TaskFilter = { statuses: [], priorities: [], projectIds: [], labels: [] };

// ── Helpers ───────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function taskMap(tasks: Task[]): Map<ID, Task> {
  return new Map(tasks.map((t) => [t.id, t]));
}

// ── Store ─────────────────────────────────────────────────────

export const useTaskStore = create<TaskState & TaskActions>()((set, get) => ({
  tasks: [], loading: false, error: null,
  selectedTaskIds: new Set(), openTaskId: null,
  quickAddOpen: false, quickAddPrefill: {},
  view: "list", groupBy: "none", sortBy: "manual",
  filter: DEFAULT_FILTER, activeRoute: "all",

  // ── Data ──────────────────────────────────────────────────

  loadTasks: async () => {
    set({ loading: true, error: null });
    try {
      // Purge stale done/cancelled tasks before loading
      const purgedIds = await svc.purgeCompleted();
      const tasks = await repo.dbFindAllActive();
      set({
        tasks,
        loading: false,
        // Close detail panel if its task was purged
        openTaskId: purgedIds.includes(get().openTaskId ?? "") ? null : get().openTaskId,
      });
    } catch (err) {
      console.error("[Tasks] loadTasks failed:", err);
      set({ error: String(err), loading: false });
    }
  },

  createTask: async (input) => {
    const task = await svc.createTask(input as Parameters<typeof svc.createTask>[0]);
    set((s) => ({ tasks: [task, ...s.tasks] }));
    return task;
  },

  updateTask: async (id, patch) => {
    const existing = get().tasks.find((t) => t.id === id);
    if (!existing) { console.warn("[Tasks] updateTask: not found", id); return; }
    const updated = await svc.updateTask(id, patch, existing);
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? updated : t)) }));
  },

  deleteTask: async (id) => {
    await svc.deleteTask(id);
    set((s) => ({
      tasks: s.tasks.filter((t) => t.id !== id),
      openTaskId: s.openTaskId === id ? null : s.openTaskId,
    }));
  },

  completeTask: async (id) => {
    const existing = get().tasks.find((t) => t.id === id);
    if (!existing) return;
    const updated = await svc.completeTask(id, existing);
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? updated : t)) }));
  },

  restoreTask: async (id) => {
    const existing = get().tasks.find((t) => t.id === id);
    if (!existing) return;
    const updated = await svc.restoreTask(id, existing);
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? updated : t)) }));
  },

  archiveTask: async (id) => {
    const existing = get().tasks.find((t) => t.id === id);
    if (!existing) return;
    await svc.archiveTask(id, existing);
    set((s) => ({
      tasks: s.tasks.filter((t) => t.id !== id),
      openTaskId: s.openTaskId === id ? null : s.openTaskId,
    }));
  },

  duplicateTask: async (id) => {
    const src = get().tasks.find((t) => t.id === id);
    if (!src) throw new Error("Task not found");
    const copy = await svc.duplicateTask(src);
    set((s) => ({ tasks: [copy, ...s.tasks] }));
    return copy;
  },

  moveTask: async (id, toProjectId) => {
    const existing = get().tasks.find((t) => t.id === id);
    if (!existing) return;
    const updated = await svc.moveTask(id, toProjectId, existing);
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? updated : t)) }));
  },

  reorderTasks: async (ids) => {
    await svc.reorderTasks(ids);
    set((s) => {
      const map = new Map(s.tasks.map((t) => [t.id, t]));
      return {
        tasks: ids
          .map((id, i) => ({ ...map.get(id)!, order: i * 1000 }))
          .concat(s.tasks.filter((t) => !ids.includes(t.id))),
      };
    });
  },

  batchUpdate: async (ids, patch) => {
    const updated = await svc.batchUpdateTasks(ids, patch, taskMap(get().tasks));
    const updatedMap = new Map(updated.map((t) => [t.id, t]));
    set((s) => ({
      tasks: s.tasks.map((t) => updatedMap.get(t.id) ?? t),
      selectedTaskIds: new Set(),
    }));
  },

  batchDelete: async (ids) => {
    await svc.deleteTasks(ids);
    set((s) => ({ tasks: s.tasks.filter((t) => !ids.includes(t.id)), selectedTaskIds: new Set() }));
  },

  addChecklistItem: async (taskId, text) => {
    const task = get().tasks.find((t) => t.id === taskId);
    if (!task) return;
    const updated = await svc.addChecklistItem(task, text);
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === taskId ? updated : t)) }));
  },

  toggleChecklistItem: async (taskId, itemId) => {
    const task = get().tasks.find((t) => t.id === taskId);
    if (!task) return;
    const updated = await svc.toggleChecklistItem(task, itemId);
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === taskId ? updated : t)) }));
  },

  deleteChecklistItem: async (taskId, itemId) => {
    const task = get().tasks.find((t) => t.id === taskId);
    if (!task) return;
    const updated = await svc.deleteChecklistItem(task, itemId);
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === taskId ? updated : t)) }));
  },

  // ── UI ────────────────────────────────────────────────────

  openQuickAdd: (prefill = {}) => set({ quickAddOpen: true, quickAddPrefill: prefill }),
  closeQuickAdd: ()            => set({ quickAddOpen: false, quickAddPrefill: {} }),
  openTask:  (id) => { set({ openTaskId: id }); bus.emit("task:open", { taskId: id }); },
  closeTask: ()   => set({ openTaskId: null }),

  selectTask: (id, multi = false) => set((s) => {
    const next = new Set(multi ? s.selectedTaskIds : []);
    if (next.has(id)) next.delete(id); else next.add(id);
    return { selectedTaskIds: next };
  }),
  clearSelection: () => set({ selectedTaskIds: new Set() }),

  setView:        (v) => set({ view: v }),
  setGroupBy:     (g) => set({ groupBy: g }),
  setSortBy:      (s) => set({ sortBy: s }),
  setFilter:      (f) => set((s) => ({ filter: { ...s.filter, ...f } })),
  setActiveRoute: (r) => set({ activeRoute: r }),

  // ── Derived ───────────────────────────────────────────────

  getFilteredTasks: () => {
    const { tasks, filter, activeRoute } = get();
    const t = todayStr();
    let result = tasks.filter((task) => task.parentTaskId == null);

    switch (activeRoute) {
      case "today":
        result = result.filter((task) =>
          task.status !== "done" && (task.scheduledDate === t || task.dueDate === t));
        break;
      case "upcoming":
        result = result.filter((task) =>
          task.status !== "done" && task.dueDate != null && task.dueDate > t);
        break;
      case "overdue":
        result = result.filter((task) =>
          task.status !== "done" && task.dueDate != null && task.dueDate < t);
        break;
      case "inbox":
        result = result.filter((task) => !task.projectId && task.status === "todo");
        break;
    }

    if (filter.statuses.length)   result = result.filter((t) => filter.statuses.includes(t.status));
    if (filter.priorities.length) result = result.filter((t) => filter.priorities.includes(t.priority));
    if (filter.projectIds.length) result = result.filter(
      (t) => t.projectId != null && filter.projectIds.includes(t.projectId));
    if (filter.labels.length)     result = result.filter(
      (t) => filter.labels.some((l) => t.labels.includes(l)));
    if (filter.search) {
      const q = filter.search.toLowerCase();
      result = result.filter((t) =>
        t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q));
    }
    return result;
  },

  getSubtasks:      (parentId) => get().tasks.filter((t) => t.parentTaskId === parentId),
  getTaskById:      (id)       => get().tasks.find((t) => t.id === id),
  getTodayTasks:    () => {
    const t = todayStr();
    return get().tasks.filter((task) =>
      task.status !== "done" && (task.scheduledDate === t || task.dueDate === t));
  },
  getUpcomingTasks: () => {
    const t = todayStr();
    return get().tasks.filter((task) =>
      task.status !== "done" && task.dueDate != null && task.dueDate > t);
  },
  getOverdueTasks:  () => {
    const t = todayStr();
    return get().tasks.filter((task) =>
      task.status !== "done" && task.dueDate != null && task.dueDate < t);
  },
}));
