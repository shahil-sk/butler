// ─────────────────────────────────────────────────────────────────────────────
// SHARED FORMATTERS  (consolidated from focus + time-tracking)
// Single source of truth — replaces duplicate fmtDuration/formatSecs in both
// focus/utils/formatters.ts and time-tracking/utils/formatters.ts
// ─────────────────────────────────────────────────────────────────────────────

import type { Task, TimeEntry, FocusSession } from "@/shared/types";

export function formatSeconds(s: number): string {
  return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

export function formatDuration(m: number): string {
  if (m <= 0) return "0m";
  const h = Math.floor(m / 60), r = m % 60;
  return h === 0 ? `${r}m` : r === 0 ? `${h}h` : `${h}h ${r}m`;
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function fmtDateShort(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

export function isOverdue(t: Task): boolean {
  return !!t.dueDate && t.dueDate < new Date().toISOString().slice(0, 10);
}

export function totalMins(es: TimeEntry[]): number {
  return es.reduce((a, e) => a + (e.durationMinutes ?? 0), 0);
}

export function groupByDate(es: TimeEntry[]): [string, TimeEntry[]][] {
  const m = new Map<string, TimeEntry[]>();
  for (const e of es) {
    const d = e.startAt.slice(0, 10);
    if (!m.has(d)) m.set(d, []);
    m.get(d)!.push(e);
  }
  return Array.from(m.entries());
}

export function groupSessionsByDate(sessions: FocusSession[]): [string, FocusSession[]][] {
  const m = new Map<string, FocusSession[]>();
  for (const s of sessions) {
    const d = s.startedAt?.slice(0, 10) ?? s.createdAt.slice(0, 10);
    if (!m.has(d)) m.set(d, []);
    m.get(d)!.push(s);
  }
  return Array.from(m.entries()).sort((a, b) => b[0].localeCompare(a[0]));
}

export function dateLabel(d: string): string {
  const t = new Date().toISOString().slice(0, 10);
  const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  return d === t
    ? "Today"
    : d === y
    ? "Yesterday"
    : new Date(d).toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
}

export function sessionLabel(type: FocusSession["type"]): string {
  return type === "focus" ? "Focus" : type === "long_break" ? "Long Break" : "Short Break";
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}
