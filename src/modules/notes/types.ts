// src/modules/notes/types.ts
// Zod schemas for all Notes module entities.
// Raw SQLite rows never cross this boundary.

import { z } from 'zod';

// ── Note type ───────────────────────────────────────────────────

export const noteTypeSchema = z.enum(['note', 'daily', 'meeting']);
export type NoteType = z.infer<typeof noteTypeSchema>;

export const noteFilterSchema = z.enum(['all', 'note', 'daily', 'meeting', 'pinned']);
export type NoteFilter = z.infer<typeof noteFilterSchema>;

// ── Note ───────────────────────────────────────────────────────

export const noteSchema = z.object({
  id:               z.string().min(1),
  title:            z.string(),
  // content is a serialised ProseMirror / TipTap JSON document
  content:          z.string(),
  type:             noteTypeSchema,
  date:             z.string().optional(),   // YYYY-MM-DD, required for daily notes
  linkedTaskIds:    z.array(z.string()),
  linkedProjectIds: z.array(z.string()),
  linkedEventIds:   z.array(z.string()),
  backlinks:        z.array(z.string()),      // ids of notes that link to this one
  tags:             z.array(z.string()),
  isPinned:         z.boolean(),
  createdAt:        z.string().min(1),
  updatedAt:        z.string().min(1),
});
export type Note = z.infer<typeof noteSchema>;

// ── Create / update inputs ───────────────────────────────────────

export const createNoteInputSchema = noteSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .partial();
export type CreateNoteInput = z.infer<typeof createNoteInputSchema>;

export const updateNoteInputSchema = noteSchema
  .omit({ id: true, createdAt: true, updatedAt: true })
  .partial();
export type UpdateNoteInput = z.infer<typeof updateNoteInputSchema>;

// ── FTS search result ────────────────────────────────────────────

export interface NoteFtsResult {
  id:      string;
  title:   string;
  snippet: string;  // FTS5 snippet() highlight
  rank:    number;
}
