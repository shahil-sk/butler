import { db } from "@/kernel/db";
import { bus } from "@/kernel/event-bus";
import { generateId, now, today } from "@/shared/utils";
import { usePlannerStore } from "./store";
import type { TimeBlock, DayPlan, PlannerTemplate, ID } from "@/shared/types";
import { useTaskStore } from "@/modules/tasks/store";

export interface CreateBlockInput {
  date: string;
  startTime: string;
  endTime: string;
  title?: string;
  taskId?: ID;
  eventId?: ID;
  category?: TimeBlock["category"];
  color?: string;
  note?: string;
  isBreak?: boolean;
}

export class PlannerService {
  static async getDayPlan(date: string): Promise<DayPlan & { blocks: TimeBlock[] }> {
    const rows = await db.select<Record<string, unknown>>("SELECT * FROM day_plans WHERE date = ?", [date]);
    let plan = rows[0] as unknown as DayPlan;
    
    if (!plan) {
      plan = {
        id: generateId(),
        date,
        status: "draft",
        plannedMinutes: 0,
        actualMinutes: 0,
        tasksPlanned: 0,
        tasksCompleted: 0,
        overflowCount: 0,
        createdAt: now(),
      };
      await db.execute(
        `INSERT INTO day_plans (id, date, status, planned_minutes, actual_minutes, tasks_planned, tasks_completed, overflow_count, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [plan.id, plan.date, plan.status, plan.plannedMinutes, plan.actualMinutes, plan.tasksPlanned, plan.tasksCompleted, plan.overflowCount, plan.createdAt]
      );
    }
    
    const blocks = usePlannerStore.getState().getBlocksForDate(date);
    return { ...plan, blocks };
  }

  static async createBlock(input: CreateBlockInput): Promise<TimeBlock> {
    const block = await usePlannerStore.getState().createBlock({
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      title: input.title,
      taskId: input.taskId,
      color: input.color,
      isBreak: input.isBreak,
      notes: input.note,
    });
    
    if (input.category) {
      await usePlannerStore.getState().updateBlock(block.id, { category: input.category, eventId: input.eventId });
    }
    return usePlannerStore.getState().blocks.find(b => b.id === block.id)!;
  }

  static async updateBlock(id: ID, patch: Partial<TimeBlock>): Promise<TimeBlock> {
    await usePlannerStore.getState().updateBlock(id, patch);
    return usePlannerStore.getState().blocks.find(b => b.id === id)!;
  }

  static async deleteBlock(id: ID): Promise<void> {
    await usePlannerStore.getState().deleteBlock(id);
  }

  static async startFocusOnBlock(blockId: ID): Promise<any> {
    await this.updateBlock(blockId, { actualStart: now() });
    return { id: generateId(), blockId, startedAt: now() }; // Mock FocusSession
  }

  static async completeBlock(blockId: ID): Promise<TimeBlock> {
    await usePlannerStore.getState().completeBlock(blockId);
    const block = usePlannerStore.getState().blocks.find(b => b.id === blockId);
    if (block?.taskId) {
      // mark task as done via tasks API if needed
      useTaskStore.getState().completeTask(block.taskId);
    }
    return block!;
  }

  static async runEveningReview(date: string): Promise<TimeBlock[]> {
    const blocks = usePlannerStore.getState().getBlocksForDate(date);
    return blocks.filter(b => b.taskId && !b.isCompleted);
  }

  static async deferOverflowToTomorrow(blockIds: ID[]): Promise<void> {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tmrStr = tomorrow.toISOString().split("T")[0];
    
    for (const id of blockIds) {
      const block = usePlannerStore.getState().blocks.find(b => b.id === id);
      if (block && block.taskId) {
        await this.createBlock({
          date: tmrStr,
          startTime: block.startTime,
          endTime: block.endTime,
          taskId: block.taskId,
          title: block.title,
        });
        await this.updateBlock(id, { isOverflow: true });
      }
    }
  }

  static async applyTemplate(date: string, templateId: ID): Promise<void> {
    await usePlannerStore.getState().applyTemplate(templateId, date);
  }

  static async getPlanVsActual(startDate: Date, endDate: Date): Promise<any> {
    return { accuracy: 0.85 }; // mock response
  }
}

export interface PlannerModuleAPI {
  getDayPlan(date: Date): Promise<any>;
  scheduleTaskAsBlock(taskId: ID, date: Date, startTime: string, durationMinutes: number): Promise<TimeBlock>;
  importCalendarEventAsBlock(eventId: ID, date: Date): Promise<TimeBlock>;
  getUnscheduledTasksForDate(date: Date): Promise<any>;
  getPlanAccuracy(days: number): Promise<any>;
}

export const plannerApi: PlannerModuleAPI = {
  getDayPlan: (date) => PlannerService.getDayPlan(date.toISOString().split("T")[0]),
  scheduleTaskAsBlock: async (taskId, date, startTime, durationMinutes) => {
    const block = await usePlannerStore.getState().scheduleTask(taskId, date.toISOString().split("T")[0], startTime, durationMinutes);
    return block;
  },
  importCalendarEventAsBlock: async (eventId, date) => {
    return PlannerService.createBlock({
      date: date.toISOString().split("T")[0],
      startTime: "09:00",
      endTime: "10:00",
      eventId,
    });
  },
  getUnscheduledTasksForDate: async (date) => {
    return useTaskStore.getState().tasks.filter(t => !t.scheduledAt && t.status !== "done");
  },
  getPlanAccuracy: async (days) => {
    return { accuracy: 0.85 };
  }
};
