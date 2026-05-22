// ============================================================
// TASKS — ZOD VALIDATION BOUNDARY
// Validates raw SQLite rows before they enter UI state.
// Use taskRowSchema.parse(row) in rowToTask() to catch schema drift early.
// ============================================================

import { z } from "zod";

// ── Primitive schemas ─────────────────────────────────────────

export const taskStatusSchema = z.enum([
  "todo",
  "in_progress",
  "done",
  "cancelled",
  "archived",
]);

export const prioritySchema = z.enum(["none", "low", "medium", "high", "urgent"]);

export const checklistItemSchema = z.object({
  id:      z.string(),
  text:    z.string(),
  checked: z.boolean(),
  order:   z.number(),
});

export const recurrenceRuleSchema = z.object({
  frequency: z.enum(["daily", "weekly", "monthly", "yearly", "custom"]),
  interval: z.number().int().positive(),
  daysOfWeek: z.array(z.number()).optional(),
  endDate: z.string().optional(),
  count: z.number().int().positive().optional(),
});

// ── Task schema (mirrors Task interface in @/shared/types) ─────

export const taskSchema = z.object({
  id:               z.string(),
  title:            z.string().min(1),
  description:      z.string().optional(),
  status:           taskStatusSchema,
  priority:         prioritySchema,
  projectId:        z.string().optional(),
  parentTaskId:     z.string().optional(),
  labels:           z.array(z.string()),
  tags:             z.array(z.string()),
  dueDate:          z.string().optional(),
  startDate:        z.string().optional(),
  scheduledDate:    z.string().optional(),
  scheduledTime:    z.string().optional(),
  completedAt:      z.string().optional(),
  estimateMinutes:  z.number().int().nonnegative().optional(),
  actualMinutes:    z.number().int().nonnegative().optional(),
  recurrence:       recurrenceRuleSchema.optional(),
  dependencies:     z.array(z.string()),
  checklistItems:   z.array(checklistItemSchema),
  linkedNoteIds:    z.array(z.string()),
  linkedEventIds:   z.array(z.string()),
  order:            z.number(),
  createdAt:        z.string(),
  updatedAt:        z.string(),
});

export type TaskSchema       = z.infer<typeof taskSchema>;
export type TaskStatus       = z.infer<typeof taskStatusSchema>;
export type Priority         = z.infer<typeof prioritySchema>;
export type ChecklistItem    = z.infer<typeof checklistItemSchema>;
export type RecurrenceRule   = z.infer<typeof recurrenceRuleSchema>;

// ── DB row schema (raw SQLite column names, JSON strings) ──────

export const taskDbRowSchema = z.object({
  id:               z.string(),
  title:            z.string(),
  description:      z.string().nullable(),
  status:           taskStatusSchema,
  priority:         prioritySchema,
  project_id:       z.string().nullable(),
  parent_task_id:   z.string().nullable(),
  labels:           z.string(),          // JSON
  tags:             z.string(),          // JSON
  due_date:         z.string().nullable(),
  start_date:       z.string().nullable(),
  scheduled_date:   z.string().nullable(),
  scheduled_time:   z.string().nullable().optional(),
  completed_at:     z.string().nullable(),
  estimate_minutes: z.number().nullable(),
  actual_minutes:   z.number().nullable(),
  recurrence:       z.string().nullable(), // JSON
  dependencies:     z.string(),           // JSON
  checklist_items:  z.string(),           // JSON
  linked_note_ids:  z.string(),           // JSON
  linked_event_ids: z.string(),           // JSON
  sort_order:       z.number(),
  created_at:       z.string(),
  updated_at:       z.string(),
});

export type TaskDbRow = z.infer<typeof taskDbRowSchema>;

// ── Partial input schema for createTask / updateTask ──────────

import type { Task } from "@/shared/types";

export const createTaskInputSchema = taskSchema
  .partial()
  .required({ title: true });

export const updateTaskInputSchema = taskSchema.partial();

export type CreateTaskInput = Partial<Task> & { title: string };
export type UpdateTaskInput = Partial<Task>;
