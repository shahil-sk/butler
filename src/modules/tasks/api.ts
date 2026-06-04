import { db } from "@/kernel/db";
import { bus } from "@/kernel/event-bus";
import { generateId, now, today } from "@/shared/utils";
import { parseNaturalTaskInput } from "./nlp";
import { useTaskStore } from "./store";
import type { Task, ChecklistItem, ID, TaskStatus, Priority, TaskDependency, TaskComment, TaskActivity } from "@/shared/types";

// ============================================================
// RecurrenceService
// ============================================================
export class RecurrenceService {
  static expandRecurrence(rule: string, fromDate: Date, toDate: Date): Date[] {
    // simplified implementation
    return [];
  }

  static async createNextOccurrence(completedTaskId: ID): Promise<Task | null> {
    const task = await TaskService.getTask(completedTaskId);
    if (!task || !task.recurrenceRule) return null;

    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + 1); // Simple mock
    
    const nextTask = await TaskService.createTask({
      title: task.title,
      description: task.description,
      priority: task.priority,
      projectId: task.projectId,
      dueDate: nextDate.toISOString().split("T")[0],
      recurrenceRule: task.recurrenceRule,
      recurrenceParent: completedTaskId,
      status: "todo",
    });

    return nextTask;
  }

  static async updateRecurrenceSeries(taskId: ID, patch: Partial<Task>, scope: 'this' | 'future' | 'all'): Promise<void> {
    await TaskService.updateTask(taskId, patch);
  }
}

// ============================================================
// TaskSearchService
// ============================================================
export class TaskSearchService {
  static async search(query: string): Promise<Task[]> {
    const rows = await db.select<Record<string, unknown>>(
      "SELECT * FROM tasks WHERE title LIKE ? OR description LIKE ?",
      [`%${query}%`, `%${query}%`]
    );
    // Returning raw rows for now
    return rows as any;
  }
}

// ============================================================
// TaskService
// ============================================================
export class TaskService {
  static async createTask(input: Partial<Task>): Promise<Task> {
    const parsed = input.title ? parseNaturalTaskInput(input.title) : { title: input.title || "Untitled", dueDate: undefined, priority: undefined };
    
    const task: Task = {
      id: generateId(),
      title: parsed.title,
      description: input.description,
      status: input.status ?? "todo",
      priority: (parsed.priority as Priority) ?? input.priority ?? "none",
      projectId: input.projectId,
      parentTaskId: input.parentTaskId,
      goalId: input.goalId,
      assigneeId: input.assigneeId,
      dueDate: parsed.dueDate ?? input.dueDate,
      dueTime: input.dueTime,
      startDate: input.startDate,
      scheduledAt: input.scheduledAt,
      scheduledDuration: input.scheduledDuration,
      recurrenceRule: input.recurrenceRule,
      recurrenceParent: input.recurrenceParent,
      estimateMinutes: input.estimateMinutes,
      energyLevel: input.energyLevel,
      context: input.context ?? [],
      size: input.size,
      tags: input.tags ?? [],
      labels: input.labels ?? [],
      watchers: input.watchers ?? [],
      attachments: input.attachments ?? [],
      dependsOn: input.dependsOn ?? [],
      blocks: input.blocks ?? [],
      checklistItems: input.checklistItems ?? [],
      customFields: input.customFields,
      position: input.position ?? Date.now(),
      sectionId: input.sectionId,
      createdAt: now(),
      updatedAt: now(),
      createdBy: input.createdBy ?? "system",
      source: input.source ?? "manual",
      version: 1,
      order: 0,
      dependencies: input.dependencies ?? [],
      linkedNoteIds: input.linkedNoteIds ?? [],
      linkedEventIds: input.linkedEventIds ?? [],
      linkedPlannerBlockIds: input.linkedPlannerBlockIds ?? [],
      linkedResearchIds: input.linkedResearchIds ?? [],
    };

    // simplified insertion logic for the API layer to db directly or via store
    useTaskStore.getState().createTask(task); // this triggers DB insert in store
    
    await this.logActivity(task.id, task.createdBy ?? "system", "created");
    return task;
  }

  static async updateTask(id: ID, patch: Partial<Task>): Promise<Task> {
    await useTaskStore.getState().updateTask(id, patch);
    
    // Log activity
    await this.logActivity(id, "system", "field_updated", undefined, patch);
    
    const task = await this.getTask(id);
    if (patch.status === "done" && task) {
      await this.completeTaskLogic(task);
    }
    
    return task!;
  }

  static async completeTask(id: ID): Promise<Task> {
    await useTaskStore.getState().completeTask(id);
    await this.logActivity(id, "system", "status_changed", { status: "todo" }, { status: "done" });
    const task = await this.getTask(id);
    return task!;
  }

  static async completeTaskLogic(task: Task) {
    if (task.recurrenceRule) {
      await RecurrenceService.createNextOccurrence(task.id);
    }
    bus.emit("task:completed", { taskId: task.id, completedAt: now() });
  }

  static async deleteTask(id: ID, mode: 'soft' | 'hard' = 'soft'): Promise<void> {
    if (mode === 'soft') {
      await this.updateTask(id, { status: "cancelled", cancelledAt: now() });
    } else {
      await useTaskStore.getState().deleteTask(id);
    }
  }

  static async moveTask(id: ID, target: { projectId?: ID; sectionId?: ID; position?: number }): Promise<Task> {
    await this.updateTask(id, target);
    return this.getTask(id) as Promise<Task>;
  }

  static async getTask(id: ID): Promise<Task | null> {
    const task = useTaskStore.getState().getTaskById(id);
    return task || null;
  }

  static async queryTasks(filter: any): Promise<Task[]> {
    return useTaskStore.getState().getFilteredTasks();
  }

  static async getTaskWithContext(id: ID): Promise<any> {
    const task = await this.getTask(id);
    // mock fetching dependencies, comments, activity
    return {
      ...task,
      subtasks: [],
      comments: [],
      activity: [],
      dependencyChain: []
    };
  }

  static async scheduleTask(id: ID, scheduledAt: string, durationMinutes: number): Promise<Task> {
    return this.updateTask(id, { scheduledAt, scheduledDuration: durationMinutes });
  }

  static async getOverdueTasks(): Promise<Task[]> {
    return useTaskStore.getState().getOverdueTasks();
  }

  static async getTasksDueToday(): Promise<Task[]> {
    return useTaskStore.getState().getTodayTasks();
  }

  static async getUnscheduledTasksForPlanner(): Promise<Task[]> {
    const tasks = useTaskStore.getState().tasks;
    return tasks.filter(t => t.status !== "done" && !t.scheduledAt);
  }

  private static async logActivity(taskId: ID, actorId: ID, event: string, oldVal?: any, newVal?: any) {
    const id = generateId();
    await db.execute(
      "INSERT INTO task_activity (id, task_id, actor_id, event, old_value, new_value, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [id, taskId, actorId, event, oldVal ? JSON.stringify(oldVal) : null, newVal ? JSON.stringify(newVal) : null, now()]
    );
  }
}

// ============================================================
// Module API (Public Interface)
// ============================================================
export interface TaskModuleAPI {
  createTask(input: Partial<Task>): Promise<Task>;
  updateTask(id: ID, patch: Partial<Task>): Promise<Task>;
  completeTask(id: ID): Promise<Task>;
  getTask(id: ID): Promise<Task | null>;
  queryTasks(filter: any): Promise<Task[]>;
  getTasksDueToday(): Promise<Task[]>;
  getOverdueTasks(): Promise<Task[]>;
  getUnscheduledTasksForPlanner(): Promise<Task[]>;
  getCompletedTasksForDate(date: Date): Promise<Task[]>;
  scheduleTask(id: ID, scheduledAt: Date, durationMinutes: number): Promise<Task>;
  linkNoteToTask(taskId: ID, noteId: ID): Promise<void>;
  getTaskTimeSpent(id: ID): Promise<number>;
}

export const taskApi: TaskModuleAPI = {
  createTask: (input) => TaskService.createTask(input),
  updateTask: (id, patch) => TaskService.updateTask(id, patch),
  completeTask: (id) => TaskService.completeTask(id),
  getTask: (id) => TaskService.getTask(id),
  queryTasks: (filter) => TaskService.queryTasks(filter),
  getTasksDueToday: () => TaskService.getTasksDueToday(),
  getOverdueTasks: () => TaskService.getOverdueTasks(),
  getUnscheduledTasksForPlanner: () => TaskService.getUnscheduledTasksForPlanner(),
  getCompletedTasksForDate: async (date) => {
    const dateStr = date.toISOString().split("T")[0];
    const tasks = useTaskStore.getState().tasks;
    return tasks.filter(t => t.status === "done" && t.completedAt?.startsWith(dateStr));
  },
  scheduleTask: (id, scheduledAt, durationMinutes) => TaskService.scheduleTask(id, scheduledAt.toISOString(), durationMinutes),
  linkNoteToTask: async (taskId, noteId) => {
    const task = await TaskService.getTask(taskId);
    if (task) {
      await TaskService.updateTask(taskId, { linkedNoteIds: [...(task.linkedNoteIds || []), noteId] });
    }
  },
  getTaskTimeSpent: async (id) => {
    const task = await TaskService.getTask(id);
    return task?.actualMinutes || 0;
  }
};
