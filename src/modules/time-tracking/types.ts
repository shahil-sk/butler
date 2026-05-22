// ============================================================
// TIME TRACKING — TYPES
// Re-exports shared entity + adds module-local types.
// Only this file defines the DB row schema (Zod) used at the
// repository boundary — no other file does raw row parsing.
// ============================================================

import { z } from "zod";
export type { TimeEntry, ID, ISODateTime } from "@/shared/types";

// ── DB row schema ─────────────────────────────────────────────
// Validates raw SQLite rows at the repository boundary.

export const timeEntryDbRowSchema = z.object({
  id:               z.string(),
  task_id:          z.string().nullable(),
  project_id:       z.string().nullable(),
  focus_session_id: z.string().nullable(),
  description:      z.string().nullable(),
  start_at:         z.string(),
  end_at:           z.string().nullable(),
  duration_minutes: z.number().nullable(),
  is_billable:      z.number(),           // SQLite stores as 0/1
  tags:             z.string(),           // JSON array string
  created_at:       z.string(),
  updated_at:       z.string(),
});

export type TimeEntryDbRow = z.infer<typeof timeEntryDbRowSchema>;

// ── Aggregate / derived types ─────────────────────────────────

export interface TimeStats {
  todayMinutes:  number;
  weekMinutes:   number;
  totalMinutes:  number;
  todayEntries:  number;
  billableMinutes: number;
}

export interface CreateEntryInput {
  taskId?:          string;
  projectId?:       string;
  focusSessionId?:  string;
  description?:     string;
  startAt?:         string;   // defaults to now()
  endAt?:           string;
  durationMinutes?: number;
  isBillable?:      boolean;
  tags?:            string[];
  date?:            string;   // used when startAt is omitted (focus auto-entry)
  source?:          string;   // "focus" | "manual"
}
