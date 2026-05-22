import { useEffect, useState } from "react";
import { BarChart2 } from "lucide-react";
import { cn } from "@/shared/utils";
import { formatDuration, daysAgo } from "@/shared/formatters";
import { EmptyState, ProjectDot } from "@/shared/ui";
import { useTimeStore } from "@/modules/time-tracking/store";
import { useProjectStore } from "@/modules/projects/store";
import { useTaskStore } from "@/modules/tasks/store";
import { dbLoadSessionsInRange } from "@/modules/focus/repository";
import type { FocusSession } from "@/shared/types";

type RangePreset = "7d" | "30d" | "90d" | "custom";

const RANGE_PRESETS: { id: RangePreset; label: string }[] = [
  { id: "7d",     label: "7 days" },
  { id: "30d",    label: "30 days" },
  { id: "90d",    label: "90 days" },
  { id: "custom", label: "Custom" },
];

function presetToDates(preset: RangePreset): { from: string; to: string } {
  const to   = new Date().toISOString().slice(0, 10);
  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
  return { from: daysAgo(days - 1), to };
}

export function ReportsTab() {
  const storeEntries = useTimeStore((s) => s.entries);
  const projects     = useProjectStore((s) => s.projects);
  const tasks        = useTaskStore((s) => s.tasks);

  const [preset,     setPreset]     = useState<RangePreset>("7d");
  const [customFrom, setCustomFrom] = useState(daysAgo(29));
  const [customTo,   setCustomTo]   = useState(new Date().toISOString().slice(0, 10));
  const [rangeSessions, setRangeSessions] = useState<FocusSession[]>([]);
  const [loadingRange,  setLoadingRange]  = useState(false);

  const activeFrom = preset === "custom" ? customFrom : presetToDates(preset).from;
  const activeTo   = preset === "custom" ? customTo   : presetToDates(preset).to;

  useEffect(() => {
    setLoadingRange(true);
    dbLoadSessionsInRange(activeFrom, activeTo)
      .then(setRangeSessions)
      .catch(console.error)
      .finally(() => setLoadingRange(false));
  }, [activeFrom, activeTo]);

  const completed = storeEntries.filter(
    (e) =>
      e.endAt &&
      e.durationMinutes &&
      e.startAt.slice(0, 10) >= activeFrom &&
      e.startAt.slice(0, 10) <= activeTo
  );

  const dayCount = Math.round(
    (new Date(activeTo).getTime() - new Date(activeFrom).getTime()) / 86400000
  ) + 1;
  const useWeekly = dayCount > 14;

  const chartBuckets = (() => {
    if (!useWeekly) {
      return Array.from({ length: dayCount }, (_, i) => {
        const d = new Date(new Date(activeFrom).getTime() + i * 86400000)
          .toISOString()
          .slice(0, 10);
        const mins = completed
          .filter((e) => e.startAt.slice(0, 10) === d)
          .reduce((a, e) => a + (e.durationMinutes ?? 0), 0);
        const focusMins = rangeSessions
          .filter((s) => s.type === "focus" && (s.startedAt ?? s.createdAt).slice(0, 10) === d)
          .reduce((a, s) => a + (s.actualMinutes ?? 0), 0);
        return {
          label: new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          mins,
          focusMins,
        };
      });
    }
    const weeks: { label: string; mins: number; focusMins: number }[] = [];
    let cursor = new Date(activeFrom);
    const end  = new Date(activeTo);
    while (cursor <= end) {
      const weekStart = cursor.toISOString().slice(0, 10);
      const weekEnd   = new Date(
        Math.min(cursor.getTime() + 6 * 86400000, end.getTime())
      ).toISOString().slice(0, 10);
      const mins = completed
        .filter((e) => e.startAt.slice(0, 10) >= weekStart && e.startAt.slice(0, 10) <= weekEnd)
        .reduce((a, e) => a + (e.durationMinutes ?? 0), 0);
      const focusMins = rangeSessions
        .filter(
          (s) =>
            s.type === "focus" &&
            (s.startedAt ?? s.createdAt).slice(0, 10) >= weekStart &&
            (s.startedAt ?? s.createdAt).slice(0, 10) <= weekEnd
        )
        .reduce((a, s) => a + (s.actualMinutes ?? 0), 0);
      weeks.push({
        label: new Date(weekStart).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        mins,
        focusMins,
      });
      cursor = new Date(cursor.getTime() + 7 * 86400000);
    }
    return weeks;
  })();

  const maxMins = Math.max(...chartBuckets.map((b) => b.mins), 60);

  const byProject = projects
    .map((p) => ({
      ...p,
      mins: completed
        .filter((e) => e.projectId === p.id)
        .reduce((a, e) => a + (e.durationMinutes ?? 0), 0),
    }))
    .filter((p) => p.mins > 0)
    .sort((a, b) => b.mins - a.mins);

  const totalTracked   = completed.reduce((a, e) => a + (e.durationMinutes ?? 0), 0);
  const billable       = completed.filter((e) => e.isBillable).reduce((a, e) => a + (e.durationMinutes ?? 0), 0);
  const totalFocusMins = rangeSessions
    .filter((s) => s.type === "focus" && s.completedAt)
    .reduce((a, s) => a + (s.actualMinutes ?? 0), 0);

  return (
    <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
      {/* Date range picker */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {RANGE_PRESETS.map(({ id, label }) => (
            <button
              key={id} onClick={() => setPreset(id)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                preset === id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
          <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
            {new Date(activeFrom).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            {" – "}
            {new Date(activeTo).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
        </div>
        {preset === "custom" && (
          <div className="flex items-center gap-2">
            <input
              type="date" value={customFrom} max={customTo}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="bg-background border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <input
              type="date" value={customTo} min={customFrom} max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setCustomTo(e.target.value)}
              className="bg-background border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
          </div>
        )}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Tracked",    value: formatDuration(totalTracked) },
          { label: "Focus time", value: formatDuration(totalFocusMins) },
          { label: "Billable",   value: formatDuration(billable) },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="flex flex-col gap-1 p-4 rounded-xl border"
            style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
          >
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className="text-xl font-semibold tabular-nums">{value}</span>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div
        className="rounded-xl border p-4"
        style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {useWeekly ? "Weekly" : "Daily"} tracked time
          </p>
          {loadingRange && (
            <span className="text-[10px] text-muted-foreground animate-pulse">Loading…</span>
          )}
        </div>
        <div className="flex items-end gap-1.5 h-24 overflow-x-auto">
          {chartBuckets.map(({ label, mins, focusMins }) => (
            <div key={label} className="flex-1 min-w-[20px] flex flex-col items-center gap-1">
              <span className="text-[9px] text-muted-foreground tabular-nums">
                {mins > 0 ? formatDuration(mins) : ""}
              </span>
              <div
                className="w-full flex flex-col items-stretch rounded-sm overflow-hidden"
                style={{
                  height: `${Math.max((mins / maxMins) * 80, mins > 0 ? 4 : 0)}px`,
                  minHeight: mins > 0 ? 4 : 0,
                }}
              >
                {focusMins > 0 && mins > 0 && (
                  <div style={{ flex: focusMins, background: "hsl(var(--primary))" }} />
                )}
                {mins - focusMins > 0 && (
                  <div style={{ flex: Math.max(mins - focusMins, 0), background: "hsl(var(--primary) / 0.3)" }} />
                )}
                {focusMins === 0 && mins > 0 && (
                  <div style={{ flex: 1, background: "hsl(var(--primary) / 0.3)" }} />
                )}
              </div>
              <span className="text-[9px] text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 mt-3">
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="w-2 h-2 rounded-sm inline-block" style={{ background: "hsl(var(--primary))" }} /> Focus
          </span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="w-2 h-2 rounded-sm inline-block" style={{ background: "hsl(var(--primary) / 0.3)" }} /> Tracked
          </span>
        </div>
      </div>

      {/* By project */}
      {byProject.length > 0 && (
        <div
          className="rounded-xl border p-4"
          style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
        >
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            By project
          </p>
          <div className="flex flex-col gap-2">
            {byProject.map((p) => (
              <div key={p.id} className="flex items-center gap-3">
                <ProjectDot color={p.color} size={8} />
                <span className="text-sm flex-1 truncate">{p.name}</span>
                <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                  {formatDuration(p.mins)}
                </span>
                <div
                  className="w-20 h-1.5 rounded-full overflow-hidden"
                  style={{ background: "hsl(var(--muted))" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(p.mins / (byProject[0]?.mins ?? 1)) * 100}%`,
                      background: p.color ?? "hsl(var(--primary))",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {completed.length === 0 && (
        <EmptyState
          icon={<BarChart2 size={26} />}
          title="No data for this period"
          description="Track time or complete focus sessions to see reports here."
        />
      )}
    </div>
  );
}
