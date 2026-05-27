import { z } from "zod";

export const TimeLogSchema = z.object({
  id: z.string().uuid(),
  task_id: z.string().nullable(),
  duration: z.number(), // Duration in seconds
  description: z.string().min(1),
  category: z.string().min(1),
  started_at: z.number(),
  created_at: z.number(),
  updated_at: z.number(),
});

export type TimeLog = z.infer<typeof TimeLogSchema>;
