import { z } from "zod";

export const SessionTypeSchema = z.enum(["pomodoro", "deep_work"]);
export type SessionType = z.infer<typeof SessionTypeSchema>;

export const FocusSessionSchema = z.object({
  id: z.string().uuid(),
  task_id: z.string().nullable(),
  duration: z.number(), // Duration in seconds
  session_type: SessionTypeSchema,
  completed_at: z.number(),
  created_at: z.number(),
  updated_at: z.number(),
});

export type FocusSession = z.infer<typeof FocusSessionSchema>;
