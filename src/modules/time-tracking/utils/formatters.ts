// Pure time-formatting helpers.
// TODO: consolidate fmtDuration / fmtTime into src/shared/utils.ts
// as formatDuration / formatSeconds (identical copies exist in focus/utils/formatters.ts).

export function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function groupEntriesByDate<T extends { startAt: string }>(entries: T[]): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const e of entries) {
    const date = e.startAt.slice(0, 10);
    if (!map.has(date)) map.set(date, []);
    map.get(date)!.push(e);
  }
  return Array.from(map.entries());
}

export function totalMinutes<T extends { durationMinutes?: number | null }>(entries: T[]): number {
  return entries.reduce((acc, e) => acc + (e.durationMinutes ?? 0), 0);
}

export function useLiveDuration(startAt: string | undefined): string {
  // Re-exported from this module so callers don't reach into index.tsx.
  // Implementation lives alongside these pure helpers for co-location.
  throw new Error("Import useLiveDuration from ui/TrackerView instead — it's a hook, not a pure fn.");
}
