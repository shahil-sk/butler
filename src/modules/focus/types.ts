// ============================================================
// FOCUS — TYPES
// Zod schemas for all focus module entities.
// Raw SQLite rows must never reach the UI — parse at DB boundary.
// ============================================================

import { z } from "zod";

// ── Raw DB row schema (parse at repository boundary) ─────────

export const focusSessionDbRowSchema = z.object({
  id:               z.string(),
  task_id:          z.string().nullable().optional(),
  project_id:       z.string().nullable().optional(),
  type:             z.enum(["focus", "short_break", "long_break"]),
  planned_minutes:  z.number(),
  actual_minutes:   z.number().nullable().optional(),
  state:            z.enum(["idle", "focusing", "paused", "break", "cancelled"]),
  started_at:       z.string().nullable().optional(),
  completed_at:     z.string().nullable().optional(),
  notes:            z.string().nullable().optional(),
  goal:             z.string().nullable().optional(),
  interrupt_count:  z.number().nullable().optional(),
  mood:             z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).nullable().optional(),
  created_at:       z.string(),
});

export type FocusSessionDbRow = z.infer<typeof focusSessionDbRowSchema>;

// ── Domain schema ─────────────────────────────────────────────

export const focusSessionSchema = z.object({
  id:             z.string(),
  taskId:         z.string().optional(),
  projectId:      z.string().optional(),
  type:           z.enum(["focus", "short_break", "long_break"]),
  plannedMinutes: z.number().int().positive(),
  actualMinutes:  z.number().int().nonnegative().optional(),
  state:          z.enum(["idle", "focusing", "paused", "break", "cancelled"]),
  startedAt:      z.string().optional(),
  completedAt:    z.string().optional(),
  notes:          z.string().optional(),
  goal:           z.string().optional(),
  interruptCount: z.number().int().nonnegative().default(0),
  mood:           z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
  createdAt:      z.string(),
});

export type FocusSession = z.infer<typeof focusSessionSchema>;

// ── Timer config schema ───────────────────────────────────────

export const timerConfigSchema = z.object({
  focusMinutes:            z.number().int().positive().default(25),
  shortBreakMinutes:       z.number().int().positive().default(5),
  longBreakMinutes:        z.number().int().positive().default(15),
  sessionsBeforeLongBreak: z.number().int().positive().default(4),
});

export type TimerConfig = z.infer<typeof timerConfigSchema>;

export const DEFAULT_TIMER_CONFIG: TimerConfig = {
  focusMinutes:            25,
  shortBreakMinutes:       5,
  longBreakMinutes:        15,
  sessionsBeforeLongBreak: 4,
};

// ── Stats schema ──────────────────────────────────────────────

export const focusStatsSchema = z.object({
  todayMinutes:  z.number(),
  todaySessions: z.number(),
  weekMinutes:   z.number(),
  currentStreak: z.number(),
  totalMinutes:  z.number(),
  totalSessions: z.number(),
});

export type FocusStats = z.infer<typeof focusStatsSchema>;

export const EMPTY_STATS: FocusStats = {
  todayMinutes:  0,
  todaySessions: 0,
  weekMinutes:   0,
  currentStreak: 0,
  totalMinutes:  0,
  totalSessions: 0,
};
