import { useState } from "react";
import { Clock, DollarSign, Tag } from "lucide-react";
import { useTimeStore } from "../store";
import { useProjectStore } from "@/modules/projects/store";
import { useTaskStore } from "@/modules/tasks/store";
import { ProjectDot } from "@/shared/ui";
import { fmtDuration, totalMinutes } from "../utils/formatters";

type RangePreset = "today" | "week" | "month" | "custom";

export function ReportsView() {
  const entries  = useTimeStore((s) => s.entries.filter((e) => e.endAt));
  const projects = useProjectStore((s) => s.projects);
  const tasks    = useTaskStore((s) => s.tasks);

  const [preset,   setPreset]   = useState<RangePreset>("week");
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));

  const applyPreset = (p: RangePreset) => {
    setPreset(p);
    const now = new Date();
    if (p === "today") {
      const d = now.toISOString().slice(0, 10);
      setFromDate(d); setToDate(d);
    } else if (p === "week") {
      const from = new Date(now); from.setDate(now.getDate() - 7);
      setFromDate(from.toISOString().slice(0, 10));
      setToDate(now.toISOString().slice(0, 10));
    } else if (p === "month") {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      setFromDate(from.toISOString().slice(0, 10));
      setToDate(now.toISOString().slice(0, 10));
    }
  };

  const filtered = entries.filter(
    (e) => e.startAt.slice(0, 10) >= fromDate && e.startAt.slice(0, 10) <= toDate
  );

  const totalMins    = totalMinutes(filtered);
  const billableMins = totalMinutes(filtered.filter((e) => e.isBillable));

  const byProject = new Map<string, number>();
  filtered.forEach((e) => {
    const key = e.projectId ?? "__none__";
    byProject.set(key, (byProject.get(key) ?? 0) + (e.durationMinutes ?? 0));
  });
  const projectRows = Array.from(byProject.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id, mins]) => ({
      project: id !== "__none__" ? projects.find((p) => p.id === id) : null,
      mins,
    }));

  return (
    <div className="p-6 overflow-y-auto h-full">
      {/* Range controls */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {(["today", "week", "month", "custom"] as RangePreset[]).map((p) => (
          <button
            key={p}
            onClick={() => applyPreset(p)}
            className={`px-3 py-1.5 text-sm rounded-md capitalize transition-colors ${
              preset === p
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80"
            }`}
          >
            {p === "week" ? "Last 7 days" : p === "month" ? "This month" : p}
          </button>
        ))}

        {preset === "custom" && (
          <div className="flex items-center gap-2 ml-2">
            <input
              type="date"
              className="bg-background border border-border rounded px-2 py-1 text-sm"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
            <span className="text-muted-foreground text-sm">–</span>
            <input
              type="date"
              className="bg-background border border-border rounded px-2 py-1 text-sm"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Total",   value: fmtDuration(totalMins),    icon: Clock },
          { label: "Billable", value: fmtDuration(billableMins), icon: DollarSign },
          { label: "Entries",  value: String(filtered.length),   icon: Tag },
        ].map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="rounded-xl border border-border bg-muted/20 p-4 flex items-start gap-3"
          >
            <div className="p-2 rounded-lg bg-muted">
              <Icon size={14} className="text-muted-foreground" />
            </div>
            <div>
              <div className="text-2xl font-semibold tabular-nums">{value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* By project */}
      <div>
        <h3 className="text-sm font-medium mb-3 text-muted-foreground uppercase tracking-wider">
          By Project
        </h3>
        {projectRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data for this range.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {projectRows.map(({ project, mins }) => (
              <div key={project?.id ?? "none"} className="flex items-center gap-3">
                {project ? (
                  <ProjectDot color={project.color} size="sm" />
                ) : (
                  <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
                )}
                <span className="text-sm flex-1 truncate">
                  {project?.name ?? "No project"}
                </span>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {fmtDuration(mins)}
                </span>
                <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(100, (mins / totalMins) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
