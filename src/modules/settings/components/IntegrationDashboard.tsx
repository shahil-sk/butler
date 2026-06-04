// ============================================================
// INTEGRATION DASHBOARD — UI for cross-module sync rules
// Shows all 8 wired integration rules, lets user toggle them,
// and displays a live activity feed from the event bus.
// ============================================================

import { useEffect, useRef, useState } from "react";
import {
  Zap, ToggleLeft, ToggleRight, CheckCircle2, Clock, Calendar,
  Brain, FileText, TimerIcon, ArrowRight, Activity, Info,
} from "lucide-react";
import { cn } from "@/shared/utils";
import { bus } from "@/kernel/event-bus";

// ── Types ────────────────────────────────────────────────────

type IntegrationRule = {
  id: string;
  title: string;
  description: string;
  from: { label: string; color: string };
  to: { label: string; color: string };
  event: string;
  enabled: boolean;
};

type ActivityEntry = {
  id: string;
  timestamp: number;
  ruleId: string;
  ruleTitle: string;
  detail?: string;
};

// ── Default rules (mirrors integration/index.ts logic) ───────

const DEFAULT_RULES: IntegrationRule[] = [
  {
    id: "task-completed-planner",
    title: "Task completed → mark planner block",
    description: "When a task is marked done, its linked planner block is greyed out with a ✓ prefix.",
    from: { label: "Tasks", color: "#3b82f6" },
    to:   { label: "Planner", color: "#8b5cf6" },
    event: "task:completed",
    enabled: true,
  },
  {
    id: "task-deleted-planner",
    title: "Task deleted → remove planner block",
    description: "Deleting a task removes all linked time-blocks from the Planner.",
    from: { label: "Tasks", color: "#3b82f6" },
    to:   { label: "Planner", color: "#8b5cf6" },
    event: "task:deleted",
    enabled: true,
  },
  {
    id: "task-scheduled-planner",
    title: "Task schedule date → auto-create/move planner block",
    description: "Setting or changing a task's scheduled date auto-creates or moves a planner time-block.",
    from: { label: "Tasks", color: "#3b82f6" },
    to:   { label: "Planner", color: "#8b5cf6" },
    event: "task:updated",
    enabled: true,
  },
  {
    id: "task-due-calendar",
    title: "Task due date → sync calendar event",
    description: "Changing a task's due date or title also updates any linked calendar event.",
    from: { label: "Tasks", color: "#3b82f6" },
    to:   { label: "Calendar", color: "#10b981" },
    event: "task:updated",
    enabled: true,
  },
  {
    id: "calendar-task-planner",
    title: "Calendar event with task → set task scheduled date",
    description: "Creating a calendar event linked to a task sets that task's scheduledDate automatically.",
    from: { label: "Calendar", color: "#10b981" },
    to:   { label: "Tasks", color: "#3b82f6" },
    event: "calendar:event-created",
    enabled: true,
  },
  {
    id: "calendar-event-planner-sync",
    title: "Calendar event updated → sync planner block time",
    description: "Moving a linked calendar event also moves the corresponding planner block to the new date/time.",
    from: { label: "Calendar", color: "#10b981" },
    to:   { label: "Planner", color: "#8b5cf6" },
    event: "calendar:event-updated",
    enabled: true,
  },
  {
    id: "focus-session-task",
    title: "Focus session → log actual minutes on task",
    description: "Completing a focus session adds its duration to the linked task's actual time tracked.",
    from: { label: "Focus", color: "#f59e0b" },
    to:   { label: "Tasks", color: "#3b82f6" },
    event: "focus:session-completed",
    enabled: true,
  },
  {
    id: "planner-block-task-date",
    title: "Planner block linked → set task scheduled date",
    description: "Linking a planner block to a task sets scheduledDate on that task.",
    from: { label: "Planner", color: "#8b5cf6" },
    to:   { label: "Tasks", color: "#3b82f6" },
    event: "planner:block-linked-task",
    enabled: true,
  },
];

const MODULE_ICON: Record<string, typeof Zap> = {
  Tasks:    CheckCircle2,
  Planner:  Clock,
  Calendar: Calendar,
  Focus:    TimerIcon,
  Notes:    FileText,
  Research: Brain,
};

// ── Component ────────────────────────────────────────────────

export function IntegrationDashboard() {
  const [rules, setRules] = useState<IntegrationRule[]>(DEFAULT_RULES);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [selectedRule, setSelectedRule] = useState<string | null>(null);
  const activityRef = useRef<HTMLDivElement>(null);

  // Listen to all tracked events and push to activity feed
  useEffect(() => {
    const tracked = [
      "task:completed", "task:deleted", "task:updated", "task:created",
      "calendar:event-created", "calendar:event-updated",
      "focus:session-completed",
      "planner:block-linked-task",
    ] as const;

    const unsubs = tracked.map((event) =>
      bus.on(event as any, (payload: any) => {
        // Find which rule this event maps to
        const matchedRule = rules.find((r) => r.event === event && r.enabled);
        if (!matchedRule) return;

        const entry: ActivityEntry = {
          id:         `${Date.now()}-${Math.random()}`,
          timestamp:  Date.now(),
          ruleId:     matchedRule.id,
          ruleTitle:  matchedRule.title,
          detail:     payload?.task?.title ?? payload?.event?.title ?? payload?.session?.taskId ?? undefined,
        };
        setActivity((prev) => [entry, ...prev].slice(0, 50));
      })
    );
    return () => unsubs.forEach((u) => u());
  }, [rules]);

  // Auto-scroll activity feed to top
  useEffect(() => {
    activityRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [activity.length]);

  const toggleRule = (id: string) => {
    setRules((prev) => prev.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const enabledCount  = rules.filter((r) => r.enabled).length;
  const disabledCount = rules.length - enabledCount;

  const selectedRuleData = rules.find((r) => r.id === selectedRule);

  return (
    <div className="flex h-full min-h-0 overflow-hidden" style={{ background: "hsl(var(--background))" }}>
      {/* Rules list */}
      <div
        className="flex flex-col shrink-0 overflow-hidden"
        style={{ width: 340, borderRight: "1px solid hsl(var(--border))" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 shrink-0"
          style={{ borderBottom: "1px solid hsl(var(--border))" }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "hsl(var(--primary) / 0.1)" }}
            >
              <Zap size={14} style={{ color: "hsl(var(--primary))" }} />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">Integration Rules</p>
              <p className="text-[10px] text-muted-foreground">
                {enabledCount} active · {disabledCount} disabled
              </p>
            </div>
          </div>
        </div>

        {/* Rules */}
        <div className="flex-1 overflow-y-auto py-1.5 px-1.5 space-y-1">
          {rules.map((rule) => {
            const FromIcon = MODULE_ICON[rule.from.label] ?? Zap;
            const ToIcon   = MODULE_ICON[rule.to.label]   ?? Zap;
            const isSelected = selectedRule === rule.id;

            return (
              <div
                key={rule.id}
                onClick={() => setSelectedRule(isSelected ? null : rule.id)}
                className={cn(
                  "group flex items-start gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-fast border",
                  isSelected
                    ? "border-primary/30 bg-primary/[0.06]"
                    : "border-transparent hover:border-border hover:bg-accent/50"
                )}
              >
                {/* From → To icons */}
                <div className="flex items-center gap-1 shrink-0 mt-0.5">
                  <span
                    className="w-5 h-5 rounded flex items-center justify-center text-white text-[9px]"
                    style={{ background: rule.from.color }}
                    title={rule.from.label}
                  >
                    <FromIcon size={10} />
                  </span>
                  <ArrowRight size={8} className="text-muted-foreground/40" />
                  <span
                    className="w-5 h-5 rounded flex items-center justify-center text-white text-[9px]"
                    style={{ background: rule.to.color }}
                    title={rule.to.label}
                  >
                    <ToIcon size={10} />
                  </span>
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-[11px] font-medium truncate",
                    rule.enabled ? "text-foreground" : "text-muted-foreground/50 line-through"
                  )}>
                    {rule.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                    {rule.from.label} → {rule.to.label}
                  </p>
                </div>

                {/* Toggle */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleRule(rule.id); }}
                  aria-label={rule.enabled ? "Disable rule" : "Enable rule"}
                  className="shrink-0 mt-0.5 transition-fast"
                  style={{ color: rule.enabled ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }}
                >
                  {rule.enabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right panel: rule detail + activity feed */}
      <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
        {/* Rule detail card */}
        {selectedRuleData ? (
          <div
            className="shrink-0 px-5 py-4 border-b border-border"
            style={{ background: "hsl(var(--surface-1))" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Info size={13} className="text-primary shrink-0" />
              <p className="text-xs font-semibold text-foreground">{selectedRuleData.title}</p>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">{selectedRuleData.description}</p>
            <div className="flex items-center gap-2 mt-3">
              <span
                className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full text-white"
                style={{ background: selectedRuleData.from.color }}
              >
                {selectedRuleData.from.label}
              </span>
              <ArrowRight size={10} className="text-muted-foreground/50" />
              <span
                className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full text-white"
                style={{ background: selectedRuleData.to.color }}
              >
                {selectedRuleData.to.label}
              </span>
              <span className="ml-auto text-[10px] font-mono text-muted-foreground/50 bg-surface-2 px-2 py-0.5 rounded">
                {selectedRuleData.event}
              </span>
            </div>
          </div>
        ) : (
          <div
            className="shrink-0 px-5 py-3 border-b border-border flex items-center gap-2"
            style={{ background: "hsl(var(--surface-1))" }}
          >
            <Info size={12} className="text-muted-foreground/50" />
            <p className="text-[11px] text-muted-foreground/60">Click a rule to see details</p>
          </div>
        )}

        {/* Activity feed */}
        <div
          className="flex items-center justify-between px-4 py-2 shrink-0"
          style={{ borderBottom: "1px solid hsl(var(--border))" }}
        >
          <div className="flex items-center gap-1.5">
            <Activity size={12} className="text-primary" />
            <span className="text-[11px] font-semibold text-foreground">Live activity</span>
          </div>
          {activity.length > 0 && (
            <button
              type="button"
              onClick={() => setActivity([])}
              className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-fast"
            >
              Clear
            </button>
          )}
        </div>

        <div ref={activityRef} className="flex-1 overflow-y-auto px-3 py-2">
          {activity.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <Activity size={20} className="text-muted-foreground/20" />
              <p className="text-[11px] text-muted-foreground/50">
                No events fired yet.<br />Activity appears here as modules sync.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {activity.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-2.5 px-3 py-2 rounded-lg border border-border/50 bg-surface-1"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/60 mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-foreground/80 leading-snug">{entry.ruleTitle}</p>
                    {entry.detail && (
                      <p className="text-[10px] text-muted-foreground/60 truncate mt-0.5">{entry.detail}</p>
                    )}
                  </div>
                  <span className="text-[9px] text-muted-foreground/40 tabular-nums shrink-0 mt-0.5">
                    {new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Summary footer */}
        <div
          className="shrink-0 flex items-center justify-between px-4 py-2.5 border-t border-border"
          style={{ background: "hsl(var(--surface-1))" }}
        >
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className="text-base font-bold tabular-nums text-foreground">{enabledCount}</p>
              <p className="text-[10px] text-muted-foreground/60">active</p>
            </div>
            <div className="text-center">
              <p className="text-base font-bold tabular-nums text-foreground">{activity.length}</p>
              <p className="text-[10px] text-muted-foreground/60">fired</p>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground/40">Rules persist in-memory only — restart resets toggles.</p>
        </div>
      </div>
    </div>
  );
}
