import { z } from "zod";

export const BlockTypeSchema = z.enum(["work", "routine", "break"]);
export type BlockType = z.infer<typeof BlockTypeSchema>;

export const TimeBlockSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  start_time: z.number(), // Milliseconds timestamp
  end_time: z.number(), // Milliseconds timestamp
  block_type: BlockTypeSchema,
  task_id: z.string().nullable(),
  created_at: z.number(),
  updated_at: z.number(),
});

export type TimeBlock = z.infer<typeof TimeBlockSchema>;

export const ReflectionSchema = z.object({
  id: z.string().uuid(),
  date: z.string(), // YYYY-MM-DD
  prompt_id: z.string(),
  response: z.string(),
  created_at: z.number(),
  updated_at: z.number(),
});

export type Reflection = z.infer<typeof ReflectionSchema>;
