// ============================================================
// PLANNER — TYPES
// Zod schemas for all planner module entities.
// Raw SQLite rows must never reach the UI — parse at DB boundary.
// ============================================================

import { z } from "zod";

// ── Enums / constants ─────────────────────────────────────────────

export const BLOCK_COLORS = [
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#6b7280", // gray (break)
] as const;

export type PlannerView = "day" | "3day" | "week";

// ── Raw DB row schemas (parse at repository boundary) ─────────────

export const timeBlockDbRowSchema = z.object({
  id:         z.string(),
  date:       z.string(),
  task_id:    z.string().nullable().optional(),
  title:      z.string(),
  start_time: z.string(),
  end_time:   z.string(),
  color:      z.string().nullable().optional(),
  is_break:   z.union([z.number(), z.boolean()]).transform(Boolean),  // SQLite stores as 0/1
  notes:      z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type TimeBlockDbRow = z.infer<typeof timeBlockDbRowSchema>;

export const planTemplateDbRowSchema = z.object({
  id:          z.string(),
  name:        z.string(),
  blocks_json: z.string().transform((s) => JSON.parse(s) as TemplateBlock[]),
  created_at:  z.string(),
});
export type PlanTemplateDbRow = z.infer<typeof planTemplateDbRowSchema>;

// ── Domain schemas ─────────────────────────────────────────────

export const templateBlockSchema = z.object({
  title:     z.string(),
  startTime: z.string(),
  endTime:   z.string(),
  color:     z.string().optional(),
  isBreak:   z.boolean().default(false),
  notes:     z.string().optional(),
});
export type TemplateBlock = z.infer<typeof templateBlockSchema>;

export const planTemplateSchema = z.object({
  id:        z.string(),
  name:      z.string(),
  blocks:    z.array(templateBlockSchema).default([]),
  createdAt: z.string(),
});
export type PlanTemplate = z.infer<typeof planTemplateSchema>;

export const timeBlockSchema = z.object({
  id:        z.string(),
  date:      z.string(),
  taskId:    z.string().optional(),
  title:     z.string(),
  startTime: z.string(),
  endTime:   z.string(),
  color:     z.string().optional(),
  isBreak:   z.boolean().default(false),
  notes:     z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TimeBlock = z.infer<typeof timeBlockSchema>;
