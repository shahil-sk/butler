// ============================================================
// PLANNER — UTILS
// Pure functions with no side effects and no external imports.
// Safe to use in UI, service, or tests without any mocking.
// ============================================================

import type { TimeBlock } from "./types";

/** Convert "HH:MM" to total minutes since midnight. */
export function toMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** Clamp a "HH:MM" string within [min, max]. */
export function clampTime(time: string, min = "06:00", max = "22:00"): string {
  if (time < min) return min;
  if (time > max) return max;
  return time;
}

/** Round "HH:MM" to the nearest 15-minute boundary. */
export function snapMinutes(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const snapped = Math.round(m / 15) * 15;
  const hh = snapped === 60 ? h + 1 : h;
  const mm = snapped === 60 ? 0 : snapped;
  return `${String(Math.min(hh, 22)).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/**
 * Return what fraction (0–1) of a block's duration has been spent,
 * given the total tracked minutes for the linked task.
 */
export function blockSpentFraction(block: TimeBlock, trackedMinutes: number): number {
  const duration = toMin(block.endTime) - toMin(block.startTime);
  if (duration <= 0) return 0;
  return Math.min(1, trackedMinutes / duration);
}

/**
 * Compute end time string given a start time and duration in minutes.
 * Result is clamped to "22:00".
 */
export function addMinutesToTime(startTime: string, durationMinutes: number): string {
  const endMinutes = toMin(startTime) + durationMinutes;
  const h = Math.floor(endMinutes / 60);
  const m = endMinutes % 60;
  const raw = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  return clampTime(raw);
}
