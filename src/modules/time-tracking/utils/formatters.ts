// Re-exports shared formatDuration as the canonical implementation.
// fmtDuration was a local alias — use formatDuration from @/shared/utils directly
// or via this barrel for co-location convenience.
export { formatDuration as fmtDuration, formatDuration } from "@/shared/utils";

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
