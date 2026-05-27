import { z } from "zod";

export const HabitFrequencySchema = z.enum(["daily", "weekly", "custom"]);
export type HabitFrequency = z.infer<typeof HabitFrequencySchema>;

export const RoutineGroupSchema = z.enum(["morning", "evening", "none"]);
export type RoutineGroup = z.infer<typeof RoutineGroupSchema>;

export const HabitSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string().nullable(),
  frequency: z.string(), // 'daily' | 'weekly' | 'custom'
  frequency_spec: z.string(), // JSON string
  target_streak: z.number().min(1),
  routine_group: z.string().nullable(), // 'morning' | 'evening' | null
  created_at: z.number(),
  updated_at: z.number(),
  tags: z.array(z.string()),
  metadata: z.string(),
});
export type Habit = z.infer<typeof HabitSchema>;

export const HabitLogSchema = z.object({
  id: z.string(),
  habit_id: z.string(),
  date: z.string(), // YYYY-MM-DD
  status: z.enum(["completed", "skipped", "failed"]),
});
export type HabitLog = z.infer<typeof HabitLogSchema>;

export const StreakStatsSchema = z.object({
  current_streak: z.number(),
  longest_streak: z.number(),
});
export type StreakStats = z.infer<typeof StreakStatsSchema>;

export interface CreateHabitInput {
  title: string;
  description?: string | null;
  frequency: HabitFrequency;
  frequency_spec: string;
  target_streak: number;
  routine_group?: string | null;
  tags?: string[];
  metadata?: string;
}
