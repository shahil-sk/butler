import { z } from "zod";

export const GoalHorizonSchema = z.enum(["weekly", "quarterly", "annual", "life"]);
export type GoalHorizon = z.infer<typeof GoalHorizonSchema>;

export const GoalStatusSchema = z.enum(["active", "completed", "abandoned"]);
export type GoalStatus = z.infer<typeof GoalStatusSchema>;

export const KeyResultTypeSchema = z.enum(["binary", "numeric"]);
export type KeyResultType = z.infer<typeof KeyResultTypeSchema>;

export const GoalSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  horizon: GoalHorizonSchema,
  status: GoalStatusSchema,
  target_date: z.number().nullable().optional(),
  created_at: z.number(),
  updated_at: z.number(),
  tags: z.array(z.string()),
  metadata: z.string(),
});

export type Goal = z.infer<typeof GoalSchema>;

export const KeyResultSchema = z.object({
  id: z.string().uuid(),
  goal_id: z.string().uuid(),
  title: z.string().min(1),
  target_value: z.number().nonnegative(),
  current_value: z.number().nonnegative(),
  unit: z.string(),
  key_result_type: KeyResultTypeSchema,
  created_at: z.number(),
  updated_at: z.number(),
  tags: z.array(z.string()),
  metadata: z.string(),
});

export type KeyResult = z.infer<typeof KeyResultSchema>;

export interface GoalLink {
  id: string;
  goal_id: string;
  entity_id: string;
  entity_type: "project" | "habit" | "task";
}

export interface CreateGoalInput {
  title: string;
  description?: string | null;
  horizon: GoalHorizon;
  status: GoalStatus;
  target_date?: number | null;
  tags: string[];
  metadata?: string;
}
