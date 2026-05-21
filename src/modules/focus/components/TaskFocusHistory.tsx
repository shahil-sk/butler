// ============================================================
// TaskFocusHistory
//
// Gap 5: renders focus session history for a specific taskId.
// Mount this inside TaskDetail beneath the time-entries section.
//
// Shows:
//   - total time and session count header
//   - individual session rows (date, duration, mood, interrupts)
// ============================================================

import { useMemo } from "react";
import { useFocusStore } from "../store";
import { TimerIcon } from "lucide-react";
import { formatDuration, formatDate } from "@/shared/utils";

const MOOD_LABEL: Record<number, string> = {
  1: "😩", 2: "😕", 3: "😐", 4: "🙂", 5: "😄",
};

interface Props {
  taskId: string;
}

export function TaskFocusHistory({ taskId }: Props) {
  const sessions = useFocusStore((s) => s.sessions);

  const taskSessions = useMemo(
    () =>
      sessions
        .filter(
          (s) =>
            s.taskId === taskId &&
            s.type === "focus" &&
            s.completedAt &&
            s.actualMinutes
        )
        .sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? "")),
    [sessions, taskId]
  );

  if (taskSessions.length === 0) return null;

  const totalMinutes = taskSessions.reduce((a, s) => a + (s.actualMinutes ?? 0), 0);

  return (
    <div className="mt-4">
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-2">
        <TimerIcon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Focus sessions
        </span>
        <span className="text-xs text-muted-foreground ml-auto">
          {formatDuration(totalMinutes)} across {taskSessions.length} session{taskSessions.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Session list */}
      <div className="space-y-1">
        {taskSessions.map((s) => (
          <div
            key={s.id}
            className="flex items-center gap-2 text-xs text-muted-foreground py-1 border-b border-border/40 last:border-0"
          >
            <span className="w-20 shrink-0">
              {s.startedAt ? formatDate(s.startedAt) : "—"}
            </span>
            <span className="w-14 shrink-0">{formatDuration(s.actualMinutes ?? 0)}</span>
            {s.goal && (
              <span className="flex-1 truncate">{s.goal}</span>
            )}
            {s.mood != null && (
              <span title={`Mood: ${s.mood}/5`}>{MOOD_LABEL[s.mood] ?? ""}</span>
            )}
            {typeof s.interruptCount === "number" && s.interruptCount > 0 && (
              <span title={`${s.interruptCount} interruption(s)`}>
                ⚡ {s.interruptCount}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
