// ============================================================
// TASKS MODULE — STORE  (fixed)
// All SQL uses explicit column lists. No slice() tricks.
// ============================================================

import { create } from "zustand";
import { db } from "@/kernel/db";
import { bus } from "@/kernel/event-bus";
import { generateId, now, today } from "@/shared/utils";
import type { Task, Priority, TaskStatus, ChecklistItem, ID } from "@/shared/types";

// ── DB row → Task ─────────────────────────────────────────────

function rowToTask(r: Record<string, unknown>): Task {
  return {
    id:               r.id as string,
    title:            r.title as string,
    description:      (r.description as string | null) ?? undefined,
    status:           r.status as TaskStatus,
    priority:         r.priority as Priority,
    projectId:        (r.project_id as string | null) ?? undefined,
    parentTaskId:     (r.parent_task_id as string | null) ?? undefined,
    labels:           JSON.parse((r.labels as string) || "[]"),
    tags:             JSON.parse((r.tags as string) || "[]"),
    dueDate:          (r.due_date as string | null) ?? undefined,
    startDate:        (r.start_date as string | null) ?? undefined,
    scheduledDate:    (r.scheduled_date as string | null) ?? undefined,
    completedAt:      (r.completed_at as string | null) ?? undefined,
    estimateMinutes:  (r.estimate_minutes as number | null) ?? undefined,
    actualMinutes:    (r.actual_minutes as number | null) ?? undefined,
    recurrence:       r.recurrence ? JSON.parse(r.recurrence as string) : undefined,
    dependencies:     JSON.parse((r.dependencies as string) || "[]"),
    checklistItems:   JSON.parse((r.checklist_items as string) || "[]"),
    linkedNoteIds:    JSON.parse((r.linked_note_ids as string) || "[]"),
    linkedEventIds:   JSON.parse((r.linked_event_ids as string) || "[]"),
    order:            r.sort_order as number,
    createdAt:        r.created_at as string,
    updatedAt:        r.updated_at as string,
  };
}

// ── Task → INSERT params (23 values, matches 23 columns) ──────

const INSERT_SQL = `
  INSERT INTO tasks (
    id, title, description, status, priority,
    project_id, parent_task_id, labels, tags,
    due_date, start_date, scheduled_date, completed_at,
    estimate_minutes, actual_minutes, recurrence,
    dependencies, checklist_items, linked_note_ids, linked_event_ids,
    sort_order, created_at, updated_at
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
`;

const UPDATE_SQL = `
  UPDATE tasks SET
    title=?, description=?, status=?, priority=?,
    project_id=?, parent_task_id=?, labels=?, tags=?,
    due_date=?, start_date=?, scheduled_date=?, completed_at=?,
    estimate_minutes=?, actual_minutes=?, recurrence=?,
    dependencies=?, checklist_items=?, linked_note_ids=?, linked_event_ids=?,
    sort_order=?, updated_at=?
  WHERE id=?
`;

function insertParams(t: Task): unknown[] {
  return [
    t.id, t.title, t.description ?? null, t.status, t.priority,
    t.projectId ?? null, t.parentTaskId ?? null,
    JSON.stringify(t.labels), JSON.stringify(t.tags),
    t.dueDate ?? null, t.startDate ?? null, t.scheduledDate ?? null, t.completedAt ?? null,
    t.estimateMinutes ?? null, t.actualMinutes ?? null,
    t.recurrence ? JSON.stringify(t.recurrence) : null,
    JSON.stringify(t.dependencies), JSON.stringify(t.checklistItems),
    JSON.stringify(t.linkedNoteIds), JSON.stringify(t.linkedEventIds),
    t.order, t.createdAt, t.updatedAt,
  ];
}

function updateParams(t: Task): unknown[] {
  // 21 SET params + 1 WHERE id = 22 total
  return [
    t.title, t.description ?? null, t.status, t.priority,
    t.projectId ?? null, t.parentTaskId ?? null,
    JSON.stringify(t.labels), JSON.stringify(t.tags),
    t.dueDate ?? null, t.startDate ?? null, t.scheduledDate ?? null, t.completedAt ?? null,
    t.estimateMinutes ?? null, t.actualMinutes ?? null,
    t.recurrence ? JSON.stringify(t.recurrence) : null,
    JSON.stringify(t.dependencies), JSON.stringify(t.checklistItems),
    JSON.stringify(t.linkedNoteIds), JSON.stringify(t.linkedEventIds),
    t.order, t.updatedAt,
    t.id, // WHERE
  ];
}

// ── Types ─────────────────────────────────────────────────────

export type TaskView     = "list" | "board" | "calendar" | "timeline" | "table";
export type TaskGroupBy  = "none" | "status" | "priority" | "project" | "dueDate";
export type TaskSortBy   = "manual" | "dueDate" | "priority" | "createdAt" | "title";

export interface TaskFilter {
  statuses:   TaskStatus[];
  priorities: Priority[];
  projectIds: string[];
  labels:     string[];
  search?:    string;
}

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
  loadTasks:          () => Promise<void>;
  createTask:         (input: Partial<Task>) => Promise<Task>;
  updateTask:         (id: ID, patch: Partial<Task>) => Promise<void>;
  deleteTask:         (id: ID) => Promise<void>;
  completeTask:       (id: ID) => Promise<void>;
  restoreTask:        (id: ID) => Promise<void>;
  archiveTask:        (id: ID) => Promise<void>;
  duplicateTask:      (id: ID) => Promise<Task>;
  moveTask:           (id: ID, toProjectId: ID | null) => Promise<void>;
  reorderTasks:       (ids: ID[]) => Promise<void>;
  batchUpdate:        (ids: ID[], patch: Partial<Task>) => Promise<void>;
  batchDelete:        (ids: ID[]) => Promise<void>;
  addChecklistItem:   (taskId: ID, text: string) => Promise<void>;
  toggleChecklistItem:(taskId: ID, itemId: ID) => Promise<void>;
  deleteChecklistItem:(taskId: ID, itemId: ID) => Promise<void>;
  openQuickAdd:       (prefill?: Partial<Task>) => void;
  closeQuickAdd:      () => void;
  openTask:           (id: ID) => void;
  closeTask:          () => void;
  selectTask:         (id: ID, multi?: boolean) => void;
  clearSelection:     () => void;
  setView:            (v: TaskView) => void;
  setGroupBy:         (g: TaskGroupBy) => void;
  setSortBy:          (s: TaskSortBy) => void;
  setFilter:          (f: Partial<TaskFilter>) => void;
  setActiveRoute:     (r: string) => void;
  getFilteredTasks:   () => Task[];
  getSubtasks:        (parentId: ID) => Task[];
  getTaskById:        (id: ID) => Task | undefined;
  getTodayTasks:      () => Task[];
  getUpcomingTasks:   () => Task[];
  getOverdueTasks:    () => Task[];
}

const DEFAULT_FILTER: TaskFilter = { statuses: [], priorities: [], projectIds: [], labels: [] };

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
      const rows = await db.select<Record<string, unknown>>(
        "SELECT * FROM tasks WHERE status != 'archived' ORDER BY sort_order ASC, created_at DESC"
      );
      set({ tasks: rows.map(rowToTask), loading: false });
    } catch (err) {
      console.error("[Tasks] loadTasks failed:", err);
      set({ error: String(err), loading: false });
    }
  },

  createTask: async (input) => {
    const task: Task = {
      id:             generateId(),
      title:          input.title?.trim() || "Untitled task",
      description:    input.description,
      status:         input.status      ?? "todo",
      priority:       input.priority    ?? "none",
      projectId:      input.projectId,
      parentTaskId:   input.parentTaskId,
      labels:         input.labels      ?? [],
      tags:           input.tags        ?? [],
      dueDate:        input.dueDate,
      startDate:      input.startDate,
      scheduledDate:  input.scheduledDate,
      completedAt:    undefined,
      estimateMinutes:input.estimateMinutes,
      actualMinutes:  undefined,
      recurrence:     input.recurrence,
      dependencies:   input.dependencies   ?? [],
      checklistItems: input.checklistItems ?? [],
      linkedNoteIds:  input.linkedNoteIds  ?? [],
      linkedEventIds: input.linkedEventIds ?? [],
      order:          Date.now(),
      createdAt:      now(),
      updatedAt:      now(),
    };

    try {
      await db.execute(INSERT_SQL, insertParams(task));
    } catch (err) {
      console.error("[Tasks] createTask DB error:", err);
      throw err;
    }

    set((s) => ({ tasks: [task, ...s.tasks] }));
    bus.emit("task:created", { task });
    bus.emit("search:index-invalidated", { entityType: "task", id: task.id });
    return task;
  },

  updateTask: async (id, patch) => {
    const existing = get().tasks.find((t) => t.id === id);
    if (!existing) { console.warn("[Tasks] updateTask: task not found", id); return; }

    const updated: Task = { ...existing, ...patch, updatedAt: now() };

    try {
      await db.execute(UPDATE_SQL, updateParams(updated));
    } catch (err) {
      console.error("[Tasks] updateTask DB error:", err);
      throw err;
    }

    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? updated : t)) }));
    bus.emit("task:updated", { task: updated, changed: patch });
    bus.emit("search:index-invalidated", { entityType: "task", id });
  },

  deleteTask: async (id) => {
    await db.execute("DELETE FROM tasks WHERE id=?", [id]);
    set((s) => ({
      tasks: s.tasks.filter((t) => t.id !== id),
      openTaskId: s.openTaskId === id ? null : s.openTaskId,
    }));
    bus.emit("task:deleted", { taskId: id });
  },

  completeTask: async (id) => {
    const completedAt = now();
    await get().updateTask(id, { status: "done", completedAt });
    bus.emit("task:completed", { taskId: id, completedAt });
  },

  restoreTask: async (id) => {
    await get().updateTask(id, { status: "todo", completedAt: undefined });
    bus.emit("task:restored", { taskId: id });
  },

  archiveTask: async (id) => {
    await get().updateTask(id, { status: "archived" });
    set((s) => ({
      tasks: s.tasks.filter((t) => t.id !== id),
      openTaskId: s.openTaskId === id ? null : s.openTaskId,
    }));
  },

  duplicateTask: async (id) => {
    const src = get().tasks.find((t) => t.id === id);
    if (!src) throw new Error("Task not found");
    return get().createTask({ ...src, title: `${src.title} (copy)`, status: "todo", completedAt: undefined });
  },

  moveTask: async (id, toProjectId) => {
    await get().updateTask(id, { projectId: toProjectId ?? undefined });
    bus.emit("task:moved", { taskId: id, toProjectId: toProjectId! });
  },

  reorderTasks: async (ids) => {
    await db.transaction(async (tx) => {
      for (let i = 0; i < ids.length; i++) {
        await tx.execute("UPDATE tasks SET sort_order=?, updated_at=? WHERE id=?", [i * 1000, now(), ids[i]]);
      }
    });
    set((s) => {
      const map = new Map(s.tasks.map((t) => [t.id, t]));
      return {
        tasks: ids.map((id, i) => ({ ...map.get(id)!, order: i * 1000 }))
          .concat(s.tasks.filter((t) => !ids.includes(t.id))),
      };
    });
  },

  batchUpdate: async (ids, patch) => {
    for (const id of ids) await get().updateTask(id, patch);
    get().clearSelection();
  },

  batchDelete: async (ids) => {
    await db.transaction(async (tx) => {
      for (const id of ids) await tx.execute("DELETE FROM tasks WHERE id=?", [id]);
    });
    set((s) => ({ tasks: s.tasks.filter((t) => !ids.includes(t.id)), selectedTaskIds: new Set() }));
    ids.forEach((id) => bus.emit("task:deleted", { taskId: id }));
  },

  // ── Checklist ─────────────────────────────────────────────

  addChecklistItem: async (taskId, text) => {
    const task = get().tasks.find((t) => t.id === taskId);
    if (!task) return;
    const item: ChecklistItem = { id: generateId(), text, checked: false, order: task.checklistItems.length };
    await get().updateTask(taskId, { checklistItems: [...task.checklistItems, item] });
  },

  toggleChecklistItem: async (taskId, itemId) => {
    const task = get().tasks.find((t) => t.id === taskId);
    if (!task) return;
    await get().updateTask(taskId, {
      checklistItems: task.checklistItems.map((i) => i.id === itemId ? { ...i, checked: !i.checked } : i),
    });
  },

  deleteChecklistItem: async (taskId, itemId) => {
    const task = get().tasks.find((t) => t.id === taskId);
    if (!task) return;
    await get().updateTask(taskId, {
      checklistItems: task.checklistItems.filter((i) => i.id !== itemId),
    });
  },

  // ── UI ────────────────────────────────────────────────────

  openQuickAdd: (prefill = {}) => set({ quickAddOpen: true, quickAddPrefill: prefill }),
  closeQuickAdd: () => set({ quickAddOpen: false, quickAddPrefill: {} }),
  openTask: (id) => { set({ openTaskId: id }); bus.emit("task:open", { taskId: id }); },
  closeTask: () => set({ openTaskId: null }),
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
    const t = today();
    let result = tasks.filter((task) => task.parentTaskId == null);

    if (activeRoute === "today") {
      result = result.filter((task) =>
        task.status !== "done" && (task.scheduledDate === t || task.dueDate === t)
      );
    } else if (activeRoute === "upcoming") {
      result = result.filter((task) => task.status !== "done" && task.dueDate != null && task.dueDate > t);
    } else if (activeRoute === "overdue") {
      result = result.filter((task) => task.status !== "done" && task.dueDate != null && task.dueDate < t);
    } else if (activeRoute === "inbox") {
      result = result.filter((task) => !task.projectId && task.status === "todo");
    }

    if (filter.statuses.length)   result = result.filter((t) => filter.statuses.includes(t.status));
    if (filter.priorities.length) result = result.filter((t) => filter.priorities.includes(t.priority));
    if (filter.projectIds.length) result = result.filter((t) => t.projectId != null && filter.projectIds.includes(t.projectId));
    if (filter.search) {
      const q = filter.search.toLowerCase();
      result = result.filter((t) => t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q));
    }
    return result;
  },

  getSubtasks:    (parentId) => get().tasks.filter((t) => t.parentTaskId === parentId),
  getTaskById:    (id) => get().tasks.find((t) => t.id === id),
  getTodayTasks:  () => {
    const t = today();
    return get().tasks.filter((task) => task.status !== "done" && (task.scheduledDate === t || task.dueDate === t));
  },
  getUpcomingTasks: () => {
    const t = today();
    return get().tasks.filter((task) => task.status !== "done" && task.dueDate != null && task.dueDate > t);
  },
  getOverdueTasks: () => {
    const t = today();
    return get().tasks.filter((task) => task.status !== "done" && task.dueDate != null && task.dueDate < t);
  },
}));
