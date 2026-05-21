import { cn } from "@/shared/utils";
import { daysAgo, dateLabel } from "@/shared/formatters";
import type { FocusSession } from "@/shared/types";

export function StreakHeatmap({
  sessions,
  currentStreak,
}: {
  sessions: FocusSession[];
  currentStreak: number;
}) {
  const activeDays = new Set(
    sessions
      .filter((s) => s.type === "focus" && s.completedAt)
      .map((s) => (s.startedAt ?? s.createdAt).slice(0, 10))
  );

  const days = Array.from({ length: 14 }, (_, i) => daysAgo(13 - i));

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex items-center gap-[3px]">
        {days.map((d, i) => {
          const hasSession = activeDays.has(d);
          const isToday = d === new Date().toISOString().slice(0, 10);
          return (
            <div key={d} title={`${dateLabel(d)}${hasSession ? " · focus day" : ""}`} className="relative group">
              <div
                className={cn(
                  "w-4 h-4 rounded-sm transition-all",
                  hasSession ? "bg-primary" : "bg-border",
                  isToday && "ring-1 ring-primary ring-offset-1 ring-offset-background"
                )}
                style={hasSession ? { opacity: 0.6 + 0.4 * ((i + 1) / 14) } : { opacity: 0.3 }}
              />
              {i < 13 && hasSession && activeDays.has(days[i + 1]) && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 h-0.5 bg-primary"
                  style={{ left: "100%", width: 3, opacity: 0.5 }}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-1">
        <span
          className={cn(
            "text-base font-semibold tabular-nums",
            currentStreak >= 3 ? "text-primary" : "text-muted-foreground"
          )}
        >
          {currentStreak}d
        </span>
        <span className="text-xs text-muted-foreground">streak</span>
        {currentStreak >= 3 && <span className="text-xs">🔥</span>}
      </div>
    </div>
  );
}
