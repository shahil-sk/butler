// ============================================================
// PROJECTS — TYPES
// Zod schemas for all project module entities.
// Raw SQLite rows must never reach the UI — parse at DB boundary.
// ============================================================

import { z } from "zod";

// ── Sub-types ────────────────────────────────────────────────

export const projectStatusSchema = z.enum(["active", "on_hold", "completed", "archived"]);
export type ProjectStatus = z.infer<typeof projectStatusSchema>;

export const milestoneSchema = z.object({
  id:            z.string(),
  projectId:     z.string(),
  title:         z.string(),
  dueDate:       z.string().optional(),
  completedAt:   z.string().optional(),
  linkedTaskIds: z.array(z.string()).default([]),
});
export type Milestone = z.infer<typeof milestoneSchema>;

// ── Raw DB row schema (parse at repository boundary) ─────────
// milestones and linked_note_ids are stored as JSON TEXT in SQLite.

export const projectDbRowSchema = z.object({
  id:              z.string(),
  name:            z.string(),
  description:     z.string().nullable().optional(),
  status:          projectStatusSchema,
  color:           z.string(),
  icon:            z.string().nullable().optional(),
  start_date:      z.string().nullable().optional(),
  due_date:        z.string().nullable().optional(),
  milestones:      z.string().transform((s) => milestoneSchema.array().parse(JSON.parse(s))),
  linked_note_ids: z.string().transform((s) => JSON.parse(s) as string[]),
  sort_order:      z.number(),
  created_at:      z.string(),
  updated_at:      z.string(),
});
export type ProjectDbRow = z.infer<typeof projectDbRowSchema>;

// ── Domain schema ─────────────────────────────────────────────

export const projectSchema = z.object({
  id:            z.string(),
  name:          z.string(),
  description:   z.string().optional(),
  status:        projectStatusSchema,
  color:         z.string(),
  icon:          z.string().optional(),
  startDate:     z.string().optional(),
  dueDate:       z.string().optional(),
  milestones:    z.array(milestoneSchema).default([]),
  linkedNoteIds: z.array(z.string()).default([]),
  order:         z.number(),
  createdAt:     z.string(),
  updatedAt:     z.string(),
});
export type Project = z.infer<typeof projectSchema>;
