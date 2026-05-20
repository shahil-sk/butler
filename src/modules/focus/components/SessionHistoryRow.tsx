// ============================================================
// SessionHistoryRow
//
// Gap 5: visually differentiates 'cancelled' sessions from
//        completed ones. Cancelled rows show:
//          - muted text + line-through on the session label
//          - ZapOffIcon instead of CheckCircle
//          - a "Cancelled" badge
// ============================================================

import { cn } from "@/lib/utils";
import { CheckCircle2Icon, ZapOffIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { FocusSession } from "@/shared/types";
import { formatDuration, formatTime } from "@/shared/utils";

interface Props {
  session: FocusSession;
}

export function SessionHistoryRow({ session }: Props) {
  const isCancelled = session.state === "cancelled";
  const isBreak     = session.type !== "focus";

  return (
    <div
      className={cn(
        "flex items-start gap-3 py-2 px-1",
        isCancelled && "opacity-60"
      )}
    >
      {/* Icon */}
      {isCancelled ? (
        <ZapOffIcon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
      ) : (
        <CheckCircle2Icon
          className={cn(
            "h-4 w-4 mt-0.5 shrink-0",
            isBreak ? "text-sky-500" : "text-emerald-500"
          )}
        />
      )}

      {/* Label + meta */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm font-medium leading-none truncate",
            isCancelled && "line-through text-muted-foreground"
          )}
        >
          {isBreak ? "Break" : (session.goal ?? "Focus session")}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {session.startedAt ? formatTime(session.startedAt) : "—"}
          {session.actualMinutes != null && (
            <> &middot; {formatDuration(session.actualMinutes)}</>
          )}
          {typeof session.interruptCount === "number" && session.interruptCount > 0 && (
            <> &middot; {session.interruptCount} interruption{session.interruptCount !== 1 ? "s" : ""}</>
          )}
        </p>
      </div>

      {/* Badges */}
      <div className="flex items-center gap-1 shrink-0">
        {isCancelled && (
          <Badge variant="outline" className="text-xs text-muted-foreground">
            Cancelled
          </Badge>
        )}
      </div>
    </div>
  );
}
