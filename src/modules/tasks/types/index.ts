import { z } from "zod";

export const TaskStatusSchema = z.enum(["todo", "in_progress", "done"]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskPrioritySchema = z.enum(["low", "medium", "high"]);
export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

export const TaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  status: TaskStatusSchema,
  priority: TaskPrioritySchema,
  due_date: z.number().nullable(),
  parent_id: z.string().nullable(),
  project_id: z.string().nullable(),
  created_at: z.number(),
  updated_at: z.number(),
  tags: z.array(z.string()),
  metadata: z.string(),
});

export type Task = z.infer<typeof TaskSchema>;

export interface CreateTaskInput {
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: number | null;
  parent_id?: string | null;
  project_id?: string | null;
  tags: string[];
  metadata: string;
}
