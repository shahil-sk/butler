// ─────────────────────────────────────────────────────────────────────────────
// FOCUS MODULE — entry & tab router
// Split from 1419-line monolith as part of Phase 1 audit
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { Timer, Clock, BarChart2, Target, Square } from "lucide-react";
import { cn } from "@/shared/utils";
import { formatDuration } from "@/shared/formatters";
import { ProjectDot } from "@/shared/ui";

import { registry } from "@/kernel/router";
import { focusManifest } from "@/modules/focus/manifest";
import { TIME_MANIFEST } from "@/modules/time-tracking/manifest";
import { useTimeStore } from "@/modules/time-tracking/store";
import { useTaskStore } from "@/modules/tasks/store";
import { useProjectStore } from "@/modules/projects/store";

import { FocusTab }   from "./ui/FocusTab";
import { TrackerTab } from "./ui/TrackerTab";
import { ReportsTab } from "./ui/ReportsTab";

registry.register(focusManifest);
registry.register(TIME_MANIFEST);

// ── Tab config ────────────────────────────────────────────────────────────────
type Tab = "focus" | "tracker" | "reports";
const TABS: { id: Tab; label: string; Icon: React.FC<{ size?: number; className?: string }> }[] = [
  { id: "focus",   label: "Focus",   Icon: Target },
  { id: "tracker", label: "Tracker", Icon: Clock },
  { id: "reports", label: "Reports", Icon: BarChart2 },
];

function SegmentControl({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="flex items-center rounded-lg p-0.5 gap-0.5" style={{ background: "hsl(var(--muted))" }}>
      {TABS.map(({ id, label, Icon }) => (
        <button
          key={id} onClick={() => onChange(id)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150 select-none",
            active === id
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Icon size={13} />
          {label}
        </button>
      ))}
    </div>
  );
}

// ── Active timer banner (cross-module) ────────────────────────────────────────
function ActiveTimerBanner({ onJump }: { onJump: () => void }) {
  const activeEntry = useTimeStore((s) => s.entries.find((e) => e.id === s.activeEntryId));
  const stopTimer   = useTimeStore((s) => s.stopTimer);
  const tasks       = useTaskStore((s) => s.tasks);
  const projects    = useProjectStore((s) => s.projects);

  const [elapsed, setElapsed] = useState("0m");
  useEffect(() => {
    if (!activeEntry) return;
    const tick = () => {
      const mins = Math.floor((Date.now() - new Date(activeEntry.startAt).getTime()) / 60000);
      const secs = Math.floor((Date.now() - new Date(activeEntry.startAt).getTime()) / 1000) % 60;
      setElapsed(mins > 0 ? formatDuration(mins) : `${secs}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeEntry]);

  if (!activeEntry) return null;

  const task    = activeEntry.taskId    ? tasks.find((t)    => t.id === activeEntry.taskId)    : null;
  const project = activeEntry.projectId ? projects.find((p) => p.id === activeEntry.projectId) : null;

  return (
    <div
      className="flex items-center gap-2.5 px-4 py-2 text-xs border-b shrink-0"
      style={{ background: "hsl(142 65% 44% / 0.07)", borderColor: "hsl(142 65% 44% / 0.18)" }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse" style={{ background: "hsl(142 65% 44%)" }} />
      <span className="font-bold tabular-nums w-10 shrink-0" style={{ color: "hsl(142 65% 34%)" }}>{elapsed}</span>
      {project && <ProjectDot color={project.color} size={8} title={project.name} />}
      <button
        onClick={onJump}
        className="flex-1 text-left truncate text-muted-foreground hover:text-foreground transition-colors"
      >
        {activeEntry.description || task?.title || "Running timer…"}
        {task && (
          <span className="text-muted-foreground/50 ml-1 hidden sm:inline">· {task.title}</span>
        )}
      </button>
      <button
        onClick={() => void stopTimer()}
        className="flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold transition-colors shrink-0"
        style={{ background: "hsl(var(--destructive) / 0.08)", color: "hsl(var(--destructive))" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "hsl(var(--destructive) / 0.16)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "hsl(var(--destructive) / 0.08)")}
      >
        <Square size={10} /> Stop
      </button>
    </div>
  );
}

// ── Root ─────────────────────────────────────────────────────────────────────
export default function FocusModule() {
  const [tab, setTab] = useState<Tab>("focus");

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ActiveTimerBanner onJump={() => setTab("tracker")} />
      <div
        className="flex items-center justify-between px-4 py-3 border-b shrink-0"
        style={{ borderColor: "hsl(var(--border))" }}
      >
        <SegmentControl active={tab} onChange={setTab} />
      </div>
      {tab === "focus"   && <FocusTab />}
      {tab === "tracker" && <TrackerTab />}
      {tab === "reports" && <ReportsTab />}
    </div>
  );
}
