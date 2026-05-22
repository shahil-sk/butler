// ============================================================
// JOURNAL — TYPES
// Zod schemas for all journal module entities.
// Raw SQLite rows must never reach the UI — parse at DB boundary.
// ============================================================

import { z } from "zod";

// ── Shared sub-types ─────────────────────────────────────────────

export const journalEntryTypeSchema = z.enum(["daily", "reflection", "gratitude", "freeform"]);
export type JournalEntryType = z.infer<typeof journalEntryTypeSchema>;

export const moodSchema = z.union([
  z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)
]).optional();

// ── Raw DB row schema (parse at repository boundary) ─────────────
// JSON array columns are stored as TEXT in SQLite and parsed here.

export const journalEntryDbRowSchema = z.object({
  id:                  z.string(),
  date:                z.string(),
  type:                journalEntryTypeSchema,
  content:             z.string().default("{}"),
  mood:                z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).nullable().optional(),
  linked_task_ids:     z.string().transform((s) => JSON.parse(s) as string[]),
  linked_project_ids:  z.string().transform((s) => JSON.parse(s) as string[]),
  tags:                z.string().transform((s) => JSON.parse(s) as string[]),
  created_at:          z.string(),
  updated_at:          z.string(),
});

export type JournalEntryDbRow = z.infer<typeof journalEntryDbRowSchema>;

// ── Domain schema ─────────────────────────────────────────────

export const journalEntrySchema = z.object({
  id:               z.string(),
  date:             z.string(),
  type:             journalEntryTypeSchema,
  content:          z.string().default("{}"),
  mood:             moodSchema,
  linkedTaskIds:    z.array(z.string()).default([]),
  linkedProjectIds: z.array(z.string()).default([]),
  tags:             z.array(z.string()).default([]),
  createdAt:        z.string(),
  updatedAt:        z.string(),
});

export type JournalEntry = z.infer<typeof journalEntrySchema>;
