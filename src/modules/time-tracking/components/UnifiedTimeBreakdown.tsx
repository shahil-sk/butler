// ============================================================
// UnifiedTimeBreakdown
//
// Time-tracking Gap 3:
// Drop-in component for the Reports tab that shows:
//   Total time = [focus bar] + [manual bar]
// Props:
//   record  — a UnifiedRecord from useUnifiedTimeReport()
//   label   — task/project name (optional)
// ============================================================

import { cn } from "@/lib/utils";
import type { UnifiedRecord } from "../hooks/useUnifiedTimeReport";
import { formatDuration } from "@/shared/utils";

interface Props {
  record: UnifiedRecord;
  label?: string;
  className?: string;
}

export function UnifiedTimeBreakdown({ record, label, className }: Props) {
  const { totalMinutes, focusMinutes, manualMinutes, sessionCount, entryCount } = record;
  if (totalMinutes === 0) return null;

  const focusPct  = totalMinutes > 0 ? (focusMinutes  / totalMinutes) * 100 : 0;
  const manualPct = totalMinutes > 0 ? (manualMinutes / totalMinutes) * 100 : 0;

  return (
    <div className={cn("space-y-1", className)}>
      {label && (
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium truncate">{label}</span>
          <span className="text-sm tabular-nums ml-2 shrink-0">{formatDuration(totalMinutes)}</span>
        </div>
      )}

      {/* Stacked bar */}
      <div className="h-2 rounded-full overflow-hidden bg-muted flex">
        {focusPct > 0 && (
          <div
            className="h-full bg-emerald-500"
            style={{ width: `${focusPct}%` }}
            title={`Focus: ${formatDuration(focusMinutes)}`}
          />
        )}
        {manualPct > 0 && (
          <div
            className="h-full bg-sky-400"
            style={{ width: `${manualPct}%` }}
            title={`Manual: ${formatDuration(manualMinutes)}`}
          />
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {focusMinutes > 0 && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            Focus {formatDuration(focusMinutes)}
            {sessionCount > 0 && ` (${sessionCount} session${sessionCount !== 1 ? "s" : ""})`}
          </span>
        )}
        {manualMinutes > 0 && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-sky-400" />
            Manual {formatDuration(manualMinutes)}
            {entryCount > 0 && ` (${entryCount} entr${entryCount !== 1 ? "ies" : "y"})`}
          </span>
        )}
      </div>
    </div>
  );
}
