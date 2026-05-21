// Re-exports shared formatDuration as the canonical implementation.
// formatSecs / fmtDuration were local aliases — both map to formatDuration in @/shared/utils.
export { formatDuration as fmtDuration, formatDuration } from "@/shared/utils";

/** Convert raw seconds to a human-readable string, e.g. 3661 → "1h 1m" */
export function formatSecs(seconds: number): string {
  return fmtDuration(Math.floor(seconds / 60));
}
