// ============================================================
// TASKS MODULE — STORE
// Added: sort, recurring auto-spawn, dependency unblock, NLP QuickAdd
// ============================================================

import { create } from "zustand";
import { db } from "@/kernel/db";
import { bus } from "@/kernel/event-bus";
import { getNextRecurrenceDate, generateId, now, today } from "@/shared/utils";
import { parseNaturalTaskInput } from "./nlp";
import type { Task, Priority, TaskStatus, ChecklistItem, RecurrenceRule, ID } from "@/shared/types";

// ── DB row → Task ─────────────────────────────────────────────

function rowToTask(r: Record<string, unknown>): Task {
  return {
    id:               r.id as string,
    title:            r.title as string,
    description:      (r.description as string | null) ?? undefined,
    status:           r.status as TaskStatus,
    priority:         r.priority as Priority,
    dueDate:          (r.due_date as string | null) ?? undefined,
    dueTime:          (r.due_time as string | null) ?? undefined,
    startDate:        (r.start_date as string | null) ?? undefined,
    scheduledDate:    (r.scheduled_date as string | null) ?? undefined,
    scheduledAt:      (r.scheduled_at as string | null) ?? undefined,
    scheduledDuration:(r.scheduled_duration as number | null) ?? undefined,
    completedAt:      (r.completed_at as string | null) ?? undefined,
    cancelledAt:      (r.cancelled_at as string | null) ?? undefined,
    projectId:        (r.project_id as string | null) ?? undefined,
    parentTaskId:     (r.parent_task_id as string | null) ?? undefined,
    goalId:           (r.goal_id as string | null) ?? undefined,
    assigneeId:       (r.assignee_id as string | null) ?? undefined,
    recurrence:       r.recurrence ? JSON.parse(r.recurrence as string) : undefined,
    recurrenceRule:   (r.recurrence_rule as string | null) ?? undefined,
    recurrenceParent: (r.recurrence_parent as string | null) ?? undefined,
    nextOccurrenceAt: (r.next_occurrence_at as string | null) ?? undefined,
    estimateMinutes:  (r.estimate_minutes as number | null) ?? undefined,
    actualMinutes:    (r.actual_minutes as number | null) ?? undefined,
    energyLevel:      (r.energy_level as "low" | "medium" | "high" | null) ?? undefined,
    context:          JSON.parse((r.context as string) || "[]"),
    size:             (r.size as "xs" | "s" | "m" | "l" | "xl" | null) ?? undefined,
    tags:             JSON.parse((r.tags as string) || "[]"),
    labels:           JSON.parse((r.labels as string) || "[]"),
    watchers:         JSON.parse((r.watchers as string) || "[]"),
    attachments:      JSON.parse((r.attachments as string) || "[]"),
    dependencies:     JSON.parse((r.dependencies as string) || "[]"),
    dependsOn:        JSON.parse((r.depends_on as string) || "[]"),
    blocks:           JSON.parse((r.blocks as string) || "[]"),
    checklistItems:   JSON.parse((r.checklist_items as string) || "[]"),
    customFields:     r.custom_fields ? JSON.parse(r.custom_fields as string) : undefined,
    order:            r.sort_order as number,
    position:         r.position as number,
    sectionId:        (r.section_id as string | null) ?? undefined,
    createdAt:        r.created_at as string,
    updatedAt:        r.updated_at as string,
    createdBy:        r.created_by as string,
    source:           (r.source as any) || "manual",
    version:          r.version as number,
    linkedNoteIds:    JSON.parse((r.linked_note_ids as string) || "[]"),
    linkedEventIds:   JSON.parse((r.linked_event_ids as string) || "[]"),
    linkedPlannerBlockIds: JSON.parse((r.linked_planner_block_ids as string) || "[]"),
    linkedResearchIds: JSON.parse((r.linked_research_ids as string) || "[]"),
  };
}

// ── SQL ───────────────────────────────────────────────────────

const INSERT_SQL = `
  INSERT INTO tasks (
    id, title, description, status, priority, due_date, due_time, start_date, scheduled_at,
    scheduled_duration, completed_at, cancelled_at, project_id, parent_task_id, goal_id, assignee_id,
    recurrence, recurrence_rule, recurrence_parent, next_occurrence_at, estimate_minutes, actual_minutes,
    energy_level, context, size, tags, labels, watchers, attachments, depends_on, blocks,
    checklist_items, custom_fields, position, section_id, created_at, updated_at, created_by, source, version,
    linked_note_ids, linked_event_ids, linked_planner_block_ids, linked_research_ids, sort_order, dependencies
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
`;

const UPDATE_SQL = `
  UPDATE tasks SET
    title=?, description=?, status=?, priority=?, due_date=?, due_time=?, start_date=?, scheduled_at=?,
    scheduled_duration=?, completed_at=?, cancelled_at=?, project_id=?, parent_task_id=?, goal_id=?, assignee_id=?,
    recurrence=?, recurrence_rule=?, recurrence_parent=?, next_occurrence_at=?, estimate_minutes=?, actual_minutes=?,
    energy_level=?, context=?, size=?, tags=?, labels=?, watchers=?, attachments=?, depends_on=?, blocks=?,
    checklist_items=?, custom_fields=?, position=?, section_id=?, updated_at=?, version=?,
    linked_note_ids=?, linked_event_ids=?, linked_planner_block_ids=?, linked_research_ids=?, sort_order=?, dependencies=?
  WHERE id=?
`;

function insertParams(t: Task): unknown[] {
  return [
    t.id, t.title, t.description ?? null, t.status, t.priority, t.dueDate ?? null, t.dueTime ?? null, t.startDate ?? null, t.scheduledDate ?? t.scheduledAt ?? null,
    t.scheduledDuration ?? null, t.completedAt ?? null, t.cancelledAt ?? null, t.projectId ?? null, t.parentTaskId ?? null, t.goalId ?? null, t.assigneeId ?? null,
    t.recurrence ? JSON.stringify(t.recurrence) : null, t.recurrenceRule ?? null, t.recurrenceParent ?? null, t.nextOccurrenceAt ?? null, t.estimateMinutes ?? null, t.actualMinutes ?? null,
    t.energyLevel ?? null, JSON.stringify(t.context ?? []), t.size ?? null, JSON.stringify(t.tags ?? []), JSON.stringify(t.labels ?? []), JSON.stringify(t.watchers ?? []), JSON.stringify(t.attachments ?? []), JSON.stringify(t.dependsOn ?? []), JSON.stringify(t.blocks ?? []),
    JSON.stringify(t.checklistItems ?? []), t.customFields ? JSON.stringify(t.customFields) : null, t.position ?? 0, t.sectionId ?? null, t.createdAt, t.updatedAt, t.createdBy ?? 'system', t.source ?? 'manual', t.version ?? 1,
    JSON.stringify(t.linkedNoteIds ?? []), JSON.stringify(t.linkedEventIds ?? []), JSON.stringify(t.linkedPlannerBlockIds ?? []), JSON.stringify(t.linkedResearchIds ?? []), t.order ?? 0, JSON.stringify(t.dependencies ?? [])
  ];
}

function updateParams(t: Task): unknown[] {
  return [
    t.title, t.description ?? null, t.status, t.priority, t.dueDate ?? null, t.dueTime ?? null, t.startDate ?? null, t.scheduledDate ?? t.scheduledAt ?? null,
    t.scheduledDuration ?? null, t.completedAt ?? null, t.cancelledAt ?? null, t.projectId ?? null, t.parentTaskId ?? null, t.goalId ?? null, t.assigneeId ?? null,
    t.recurrence ? JSON.stringify(t.recurrence) : null, t.recurrenceRule ?? null, t.recurrenceParent ?? null, t.nextOccurrenceAt ?? null, t.estimateMinutes ?? null, t.actualMinutes ?? null,
    t.energyLevel ?? null, JSON.stringify(t.context ?? []), t.size ?? null, JSON.stringify(t.tags ?? []), JSON.stringify(t.labels ?? []), JSON.stringify(t.watchers ?? []), JSON.stringify(t.attachments ?? []), JSON.stringify(t.dependsOn ?? []), JSON.stringify(t.blocks ?? []),
    JSON.stringify(t.checklistItems ?? []), t.customFields ? JSON.stringify(t.customFields) : null, t.position ?? 0, t.sectionId ?? null, t.updatedAt, t.version ?? 1,
    JSON.stringify(t.linkedNoteIds ?? []), JSON.stringify(t.linkedEventIds ?? []), JSON.stringify(t.linkedPlannerBlockIds ?? []), JSON.stringify(t.linkedResearchIds ?? []),
    t.order ?? 0, JSON.stringify(t.dependencies ?? []),
    t.id,
  ];
}

// ── Priority weight for sort ──────────────────────────────────
const PRIORITY_WEIGHT: Record<string, number> = {
  urgent: 0, high: 1, medium: 2, low: 3, none: 4,
};

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
  loadTasks:            () => Promise<void>;
  createTask:           (input: Partial<Task>) => Promise<Task>;
  updateTask:           (id: ID, patch: Partial<Task>) => Promise<void>;
  deleteTask:           (id: ID) => Promise<void>;
  completeTask:         (id: ID) => Promise<void>;
  restoreTask:          (id: ID) => Promise<void>;
  archiveTask:          (id: ID) => Promise<void>;
  duplicateTask:        (id: ID) => Promise<Task>;
  moveTask:             (id: ID, toProjectId: ID | null) => Promise<void>;
  reorderTasks:         (ids: ID[]) => Promise<void>;
  batchUpdate:          (ids: ID[], patch: Partial<Task>) => Promise<void>;
  batchDelete:          (ids: ID[]) => Promise<void>;
  addChecklistItem:     (taskId: ID, text: string) => Promise<void>;
  toggleChecklistItem:  (taskId: ID, itemId: ID) => Promise<void>;
  deleteChecklistItem:  (taskId: ID, itemId: ID) => Promise<void>;
  openQuickAdd:         (prefill?: Partial<Task>) => void;
  closeQuickAdd:        () => void;
  openTask:             (id: ID) => void;
  closeTask:            () => void;
  selectTask:           (id: ID, multi?: boolean) => void;
  clearSelection:       () => void;
  setView:              (v: TaskView) => void;
  setGroupBy:           (g: TaskGroupBy) => void;
  setSortBy:            (s: TaskSortBy) => void;
  setFilter:            (f: Partial<TaskFilter>) => void;
  setActiveRoute:       (r: string) => void;
  getFilteredTasks:     () => Task[];
  getSubtasks:          (parentId: ID) => Task[];
  getTaskById:          (id: ID) => Task | undefined;
  getTodayTasks:        () => Task[];
  getUpcomingTasks:     () => Task[];
  getOverdueTasks:      () => Task[];
  /** Parse a natural language string then createTask() */
  parseAndCreateTask:   (raw: string) => Promise<Task>;
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
      scheduledAt:    input.scheduledAt,
      completedAt:    undefined,
      estimateMinutes: input.estimateMinutes,
      actualMinutes:  undefined,
      recurrence:     input.recurrence,
      recurrenceRule: input.recurrenceRule,
      dependencies:   input.dependencies  ?? [],
      dependsOn:      input.dependsOn     ?? [],
      checklistItems: input.checklistItems ?? [],
      linkedNoteIds:  input.linkedNoteIds  ?? [],
      linkedEventIds: input.linkedEventIds ?? [],
      linkedPlannerBlockIds: input.linkedPlannerBlockIds ?? [],
      linkedResearchIds: input.linkedResearchIds ?? [],
      order:          Date.now(),
      position:       Date.now(),
      createdAt:      now(),
      updatedAt:      now(),
      createdBy:      input.createdBy ?? "system",
      source:         input.source ?? "manual",
      version:        1,
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
    const task = get().tasks.find((t) => t.id === id);
    if (!task) return;

    // Check blockers
    const blockers = task.dependencies ?? [];
    const hasIncompleteBlocker = blockers.some((depId) => {
      const t = get().tasks.find((x) => x.id === depId);
      return t && t.status !== "done" && t.status !== "archived";
    });

    if (hasIncompleteBlocker) {
      bus.emit("ui:notification", {
        type: "warning",
        message: `Cannot complete "${task.title}". It has incomplete blockers.`,
        durationMs: 4000,
      });
      return;
    }

    const completedAt = now();
    await get().updateTask(id, { status: "done", completedAt });
    bus.emit("task:completed", { taskId: id, completedAt });

    // ── Auto-spawn next recurring instance ──────────────────
    if (task?.recurrence) {
      void spawnNextRecurring(task, get().createTask);
      bus.emit("ui:notification", {
        type: "success",
        message: `Next occurrence of "${task.title}" has been scheduled.`,
        durationMs: 4000,
      });
    }

    // ── Emit task:unblocked for any task whose blockers are all done ─
    const { tasks } = get();
    const nowDoneIds = new Set(
      tasks.filter((t) => t.status === "done" || t.id === id).map((t) => t.id)
    );
    tasks.forEach((t) => {
      if (t.id === id || t.status === "done" || t.status === "archived") return;
      if ((t.dependencies ?? []).length === 0) return;
      const wasBlocked = t.dependencies.some((depId) => !nowDoneIds.has(depId) && depId !== id);
      if (!wasBlocked && t.dependencies.includes(id)) {
        bus.emit("task:unblocked", { taskId: t.id });
      }
    });
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
    const { tasks, filter, activeRoute, sortBy } = get();
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

    // ── Apply sort ───────────────────────────────────────
    result = [...result];
    if (sortBy === "dueDate") {
      result.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
    } else if (sortBy === "priority") {
      result.sort((a, b) => (PRIORITY_WEIGHT[a.priority] ?? 4) - (PRIORITY_WEIGHT[b.priority] ?? 4));
    } else if (sortBy === "createdAt") {
      result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } else if (sortBy === "title") {
      result.sort((a, b) => a.title.localeCompare(b.title));
    }
    // "manual" → keep DB order (sort_order ASC from loadTasks)

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

  parseAndCreateTask: async (raw) => {
    const parsed = parseNaturalTaskInput(raw);
    // Resolve projectSlug → projectId by matching name prefix (case-insensitive)
    let projectId: string | undefined;
    if (parsed.projectSlug) {
      try {
        const { useProjectStore } = await import("@/modules/projects/store");
        const projects = useProjectStore.getState().projects;
        const match = projects.find(
          (p) => p.name.toLowerCase().startsWith(parsed.projectSlug!)
        );
        projectId = match?.id;
      } catch { /* project store not available */ }
    }
    return get().createTask({
      title:          parsed.title,
      dueDate:        parsed.dueDate,
      priority:       parsed.priority,
      projectId,
    });
  },
}));

// ── Recurring spawn helper ────────────────────────────────────

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// nextRecurringDate is removed, we use getNextRecurrenceDate from utils

async function spawnNextRecurring(
  completed: Task,
  createTask: (input: Partial<Task>) => Promise<Task>,
) {
  const rule = completed.recurrence!;
  const fromDate = completed.dueDate ?? completed.scheduledDate ?? today();

  // Respect endDate / count (simple guard)
  if (rule.endDate && fromDate >= rule.endDate) return;

  const nextDate = getNextRecurrenceDate(fromDate, rule);
  if (!nextDate) return;
  if (rule.endDate && nextDate > rule.endDate) return;

  await createTask({
    title:          completed.title,
    description:    completed.description,
    priority:       completed.priority,
    projectId:      completed.projectId,
    parentTaskId:   completed.parentTaskId,
    labels:         [...(completed.labels ?? [])],
    tags:           [...(completed.tags ?? [])],
    dueDate:        nextDate,
    estimateMinutes: completed.estimateMinutes,
    recurrence:     completed.recurrence,
    checklistItems: completed.checklistItems.map((i) => ({ ...i, checked: false })),
    linkedNoteIds:  [...(completed.linkedNoteIds ?? [])],
    status:         "todo",
  });
}
