import { formatDuration } from "@/shared/utils";

export { formatDuration as fmtDuration, formatDuration } from "@/shared/utils";

/** Convert raw seconds to a human-readable string, e.g. 3661 → "1h 1m" */
export function formatSecs(seconds: number): string {
  return formatDuration(Math.floor(seconds / 60));
}
