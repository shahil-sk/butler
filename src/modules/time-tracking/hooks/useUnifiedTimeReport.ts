// ============================================================
// useUnifiedTimeReport
//
// Time-tracking Gap 3:
// Returns a unified view of time spent per task and per project
// by merging:
//   - TimeEntry.durationMinutes  (source: 'manual' | 'focus')
//   - FocusSession.actualMinutes (type: 'focus', completedAt set)
//
// De-duplicates focus sessions that were already auto-converted
// to TimeEntries (identified by TimeEntry.focusSessionId).
//
// Shape returned:
//   tasks:    Map<taskId,    UnifiedRecord>
//   projects: Map<projectId, UnifiedRecord>
//   total:    UnifiedRecord
//
// ============================================================

import { useMemo } from "react";
import { useFocusStore } from "@/modules/focus/store";
import { useTimeStore }  from "@/modules/time-tracking/store";

export interface UnifiedRecord {
  totalMinutes:        number;
  focusMinutes:        number;   // from completed focus sessions
  manualMinutes:       number;   // from manually-started time entries
  sessionCount:        number;
  entryCount:          number;
}

function empty(): UnifiedRecord {
  return { totalMinutes: 0, focusMinutes: 0, manualMinutes: 0, sessionCount: 0, entryCount: 0 };
}

function add(rec: UnifiedRecord, key: "focusMinutes" | "manualMinutes", mins: number, isSession: boolean) {
  rec[key]       += mins;
  rec.totalMinutes += mins;
  if (isSession) rec.sessionCount++;
  else           rec.entryCount++;
}

export function useUnifiedTimeReport(
  filters: { taskId?: string; projectId?: string; since?: string; until?: string } = {}
) {
  const sessions = useFocusStore((s) => s.sessions);
  const entries  = useTimeStore( (s) => s.entries);

  return useMemo(() => {
    const tasks    = new Map<string, UnifiedRecord>();
    const projects = new Map<string, UnifiedRecord>();
    const total    = empty();

    // IDs of focus sessions already captured as a TimeEntry
    // (source === 'focus' entries carry focusSessionId)
    const coveredSessionIds = new Set(
      entries
        .filter((e) => (e as never as { focusSessionId?: string }).focusSessionId)
        .map(   (e) => (e as never as { focusSessionId?: string }).focusSessionId!)
    );

    // ---- Focus sessions -----------------------------------------
    for (const s of sessions) {
      if (s.type !== "focus" || !s.completedAt || !s.actualMinutes) continue;
      // Skip sessions that were already auto-converted to a TimeEntry
      // to avoid double-counting. If coveredSessionIds is empty (Phase
      // 1c not yet wired on this install) we include them directly.
      if (coveredSessionIds.size > 0 && coveredSessionIds.has(s.id)) continue;

      const date = s.startedAt?.slice(0, 10) ?? "";
      if (filters.since  && date < filters.since)  continue;
      if (filters.until  && date > filters.until)  continue;
      if (filters.taskId    && s.taskId    !== filters.taskId)    continue;
      if (filters.projectId && s.projectId !== filters.projectId) continue;

      const mins = s.actualMinutes;

      if (s.taskId) {
        if (!tasks.has(s.taskId)) tasks.set(s.taskId, empty());
        add(tasks.get(s.taskId)!, "focusMinutes", mins, true);
      }
      if (s.projectId) {
        if (!projects.has(s.projectId)) projects.set(s.projectId, empty());
        add(projects.get(s.projectId)!, "focusMinutes", mins, true);
      }
      add(total, "focusMinutes", mins, true);
    }

    // ---- Time entries -------------------------------------------
    for (const e of entries) {
      if (!e.durationMinutes) continue;

      const date = (e as never as { date?: string }).date ?? "";
      if (filters.since  && date < filters.since)  continue;
      if (filters.until  && date > filters.until)  continue;
      if (filters.taskId    && (e as never as { taskId?: string }).taskId    !== filters.taskId)    continue;
      if (filters.projectId && (e as never as { projectId?: string }).projectId !== filters.projectId) continue;

      const mins    = e.durationMinutes;
      const key     = (e as never as { source?: string }).source === "focus"
        ? "focusMinutes" : "manualMinutes";
      const tid     = (e as never as { taskId?: string }).taskId;
      const pid     = (e as never as { projectId?: string }).projectId;

      if (tid) {
        if (!tasks.has(tid)) tasks.set(tid, empty());
        add(tasks.get(tid)!, key, mins, false);
      }
      if (pid) {
        if (!projects.has(pid)) projects.set(pid, empty());
        add(projects.get(pid)!, key, mins, false);
      }
      add(total, key, mins, false);
    }

    return { tasks, projects, total };
  }, [sessions, entries, filters.taskId, filters.projectId, filters.since, filters.until]);
}
