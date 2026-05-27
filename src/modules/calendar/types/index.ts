import { z } from "zod";

export const CalendarEventSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().nullable(),
  start_time: z.number(), // Milliseconds timestamp
  end_time: z.number(), // Milliseconds timestamp
  is_all_day: z.boolean(),
  created_at: z.number(),
  updated_at: z.number(),
});

export type CalendarEvent = z.infer<typeof CalendarEventSchema>;
