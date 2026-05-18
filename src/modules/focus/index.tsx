// ============================================================
// FOCUS + TIME TRACKING — COMBINED MODULE  (redesign v3)
// Fixes: session notes access, full history, tracked-time bar in planner
// ============================================================

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Timer, Square, Plus, Trash2, Edit2, Check,
  BarChart2, Clock, DollarSign, Tag, Play, Pause,
  Zap, Target, ChevronDown, ChevronUp, Moon, ChevronRight,
  FileText, Smile, AlertCircle,
} from "lucide-react";

import { registry } from "@/kernel/router";
import { RichEditor } from "@/shared/RichEditor";

import { focusManifest } from "@/modules/focus/manifest";
import { useFocusStore } from "@/modules/focus/store";
import { useFocusEventListeners } from "@/modules/focus/events";

import { TIME_MANIFEST } from "@/modules/time-tracking/manifest";
import { useTimeStore } from "@/modules/time-tracking/store";
import { setupTimeEventListeners } from "@/modules/time-tracking/events";

import { useTaskStore } from "@/modules/tasks/store";
import { useProjectStore } from "@/modules/projects/store";
import { useShellStore } from "@/shell/store";
import { EmptyState, ProjectDot } from "@/shared/ui";
import { cn, today } from "@/shared/utils";
import type { FocusSession, TimeEntry, Task } from "@/shared/types";

registry.register(focusManifest);
registry.register(TIME_MANIFEST);

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function formatSecs(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}
function fmtDuration(m: number) {
  if (m <= 0) return "0m";
  const h = Math.floor(m / 60), r = m % 60;
  return h === 0 ? `${r}m` : r === 0 ? `${h}h` : `${h}h ${r}m`;
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function isOverdue(t: Task) { return !!t.dueDate && t.dueDate < new Date().toISOString().slice(0, 10); }
function totalMins(es: TimeEntry[]) { return es.reduce((a, e) => a + (e.durationMinutes ?? 0), 0); }
function groupByDate(es: TimeEntry[]): [string, TimeEntry[]][] {
  const m = new Map<string, TimeEntry[]>();
  for (const e of es) { const d = e.startAt.slice(0, 10); if (!m.has(d)) m.set(d, []); m.get(d)!.push(e); }
  return Array.from(m.entries());
}
function groupSessionsByDate(sessions: FocusSession[]): [string, FocusSession[]][] {
  const m = new Map<string, FocusSession[]>();
  for (const s of sessions) {
    const d = s.startedAt?.slice(0, 10) ?? s.createdAt.slice(0, 10);
    if (!m.has(d)) m.set(d, []);
    m.get(d)!.push(s);
  }
  return Array.from(m.entries()).sort((a, b) => b[0].localeCompare(a[0]));
}
function dateLabel(d: string) {
  const t = new Date().toISOString().slice(0, 10);
  const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  return d === t ? "Today" : d === y ? "Yesterday" : new Date(d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
function sessionLabel(type: FocusSession["type"]) {
  return type === "focus" ? "Focus" : type === "long_break" ? "Long Break" : "Short Break";
}
// Strip html tags for snippet
function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}

const MOOD = { 1: "😩", 2: "😕", 3: "😐", 4: "🙂", 5: "😄" } as Record<number, string>;
const MOOD_DESC = { 1: "Terrible", 2: "Rough", 3: "Okay", 4: "Good", 5: "Great" } as Record<number, string>;

// ─────────────────────────────────────────────────────────────────────────────
// SEGMENT CONTROL
// ─────────────────────────────────────────────────────────────────────────────

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
        <button key={id} onClick={() => onChange(id)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150 select-none",
            active === id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}>
          <Icon size={13} />
          {label}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE DURATION HOOK  (ticks every second for running timers)
// ─────────────────────────────────────────────────────────────────────────────

function useLiveDuration(startAt?: string, stopped = false): string {
  const [elapsed, setElapsed] = useState("0m");
  useEffect(() => {
    if (!startAt || stopped) return;
    const tick = () => {
      const mins = Math.floor((Date.now() - new Date(startAt).getTime()) / 60000);
      const secs = Math.floor((Date.now() - new Date(startAt).getTime()) / 1000) % 60;
      setElapsed(mins > 0 ? fmtDuration(mins) : `${secs}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startAt, stopped]);
  return elapsed;
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVE TIMER BANNER
// ─────────────────────────────────────────────────────────────────────────────

function ActiveTimerBanner({ onJump }: { onJump: () => void }) {
  const activeEntry = useTimeStore((s) => s.entries.find((e) => e.id === s.activeEntryId));
  const stopTimer   = useTimeStore((s) => s.stopTimer);
  const tasks       = useTaskStore((s) => s.tasks);
  const projects    = useProjectStore((s) => s.projects);
  const elapsed     = useLiveDuration(activeEntry?.startAt, !activeEntry);

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
      <button onClick={onJump} className="flex-1 text-left truncate text-muted-foreground hover:text-foreground transition-colors">
        {activeEntry.description || task?.title || "Running timer…"}
        {task && <span className="text-muted-foreground/50 ml-1 hidden sm:inline">· {task.title}</span>}
      </button>
      <button onClick={() => void stopTimer()}
        className="flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold transition-colors shrink-0"
        style={{ background: "hsl(var(--destructive) / 0.08)", color: "hsl(var(--destructive))" }}
        onMouseEnter={e => (e.currentTarget.style.background = "hsl(var(--destructive) / 0.16)")}
        onMouseLeave={e => (e.currentTarget.style.background = "hsl(var(--destructive) / 0.08)")}>
        <Square size={10} /> Stop
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FOCUS HISTORY SIDEBAR  (expandable session notes + full history)
// ─────────────────────────────────────────────────────────────────────────────

function SessionDetail({ session }: { session: FocusSession }) {
  const setMood = useFocusStore((s) => s.setSessionMood);
  return (
    <div className="mt-1.5 flex flex-col gap-2 pb-2">
      {/* Start time + duration */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground/70">
        <span>{session.startedAt ? fmtDateShort(session.startedAt) : "—"}</span>
        <span className="tabular-nums">{session.actualMinutes != null ? fmtDuration(session.actualMinutes) : "—"}</span>
      </div>

      {/* Interrupts */}
      {(session.interruptCount ?? 0) > 0 && (
        <div className="flex items-center gap-1 text-[10px] text-amber-500">
          <AlertCircle size={9} />
          {session.interruptCount} interruption{(session.interruptCount ?? 0) > 1 ? "s" : ""}
        </div>
      )}

      {/* Notes */}
      {session.notes && stripHtml(session.notes) && (
        <div className="rounded-md p-2 text-[11px]" style={{ background: "hsl(var(--muted) / 0.5)" }}>
          <div className="flex items-center gap-1 mb-1 text-muted-foreground">
            <FileText size={9} /> Notes
          </div>
          <div
            className="text-foreground/80 leading-snug line-clamp-6 prose prose-xs max-w-none"
            dangerouslySetInnerHTML={{ __html: session.notes }}
          />
        </div>
      )}

      {/* Mood rating (editable inline) */}
      {session.type === "focus" && session.completedAt && (
        <div>
          <p className="text-[10px] text-muted-foreground mb-1">Rate session:</p>
          <div className="flex gap-1">
            {[1,2,3,4,5].map((m) => (
              <button key={m}
                onClick={() => void setMood(session.id, m as 1|2|3|4|5)}
                title={MOOD_DESC[m]}
                className={cn(
                  "text-base w-7 h-7 rounded-md transition-all hover:scale-110 flex items-center justify-center",
                  session.mood === m ? "ring-2 ring-primary" : "hover:bg-muted"
                )}
                style={session.mood === m ? { background: "hsl(var(--primary) / 0.12)" } : {}}>
                {MOOD[m]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FocusHistorySidebar({ sessions }: { sessions: FocusSession[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAll,    setShowAll]    = useState(false);

  const grouped = groupSessionsByDate(sessions);
  const visibleGroups = showAll ? grouped : grouped.slice(0, 7);
  const hasMore = grouped.length > 7;

  return (
    <div className="flex flex-col h-full overflow-hidden border-r" style={{ width: 230, borderColor: "hsl(var(--border))" }}>
      <div className="px-3 py-3 border-b shrink-0" style={{ borderColor: "hsl(var(--border))" }}>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Session History</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {grouped.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center px-3">
            <Target size={22} className="text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">No sessions yet</p>
          </div>
        ) : (
          <>
            {visibleGroups.map(([date, list]) => (
              <div key={date} className="px-3 pt-3 pb-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  {dateLabel(date)}
                </p>
                {list.map((s) => {
                  const isOpen   = expandedId === s.id;
                  const hasNotes = s.notes && stripHtml(s.notes);
                  const snippet  = s.goal ? `"${s.goal.slice(0, 40)}${s.goal.length > 40 ? "…" : ""}"` : null;

                  return (
                    <div key={s.id} className="mb-1">
                      <button
                        onClick={() => setExpandedId(isOpen ? null : s.id)}
                        className={cn(
                          "w-full flex items-start gap-2 py-1.5 px-1.5 rounded-lg text-left transition-colors",
                          isOpen ? "bg-muted" : "hover:bg-muted/50"
                        )}
                      >
                        <div className={cn("w-1.5 h-1.5 rounded-full mt-1 shrink-0",
                          s.type === "focus" ? "bg-primary" : s.type === "long_break" ? "bg-emerald-500" : "bg-amber-400"
                        )} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[11px] font-medium">{sessionLabel(s.type)}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              {s.mood && <span className="text-[10px]">{MOOD[s.mood]}</span>}
                              {hasNotes && <FileText size={8} className="text-muted-foreground/50" />}
                              <span className="text-[10px] text-muted-foreground tabular-nums">
                                {s.actualMinutes ? `${s.actualMinutes}m` : "–"}
                              </span>
                              <ChevronRight size={9} className={cn(
                                "text-muted-foreground/40 transition-transform",
                                isOpen && "rotate-90"
                              )} />
                            </div>
                          </div>
                          {snippet && !isOpen && (
                            <p className="text-[10px] text-muted-foreground/70 truncate italic mt-0.5">{snippet}</p>
                          )}
                        </div>
                      </button>
                      {/* Expanded detail */}
                      {isOpen && (
                        <div className="px-3 pb-1">
                          <SessionDetail session={s} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            {hasMore && (
              <div className="px-3 pb-3">
                <button
                  onClick={() => setShowAll((v) => !v)}
                  className="w-full text-[11px] text-muted-foreground hover:text-foreground py-1.5 rounded-lg hover:bg-muted transition-colors text-center"
                >
                  {showAll ? "Show less" : `Show ${grouped.length - 7} older days`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MOOD CARD  (post-break / session rating)
// ─────────────────────────────────────────────────────────────────────────────

function MoodCard({ sessionId, mood }: { sessionId: string; mood?: number }) {
  const setMood   = useFocusStore((s) => s.setSessionMood);
  const clearLast = useFocusStore((s) => s.clearLastCompleted);
  const [sel, setSel] = useState<number | null>(mood ?? null);

  function pick(m: number) {
    setSel(m);
    void setMood(sessionId, m as 1|2|3|4|5);
    setTimeout(clearLast, 800);
  }

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-xs p-4 rounded-xl border"
      style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}>
      <p className="text-sm font-medium">How was that session?</p>
      <div className="flex gap-1.5">
        {[1,2,3,4,5].map((m) => (
          <button key={m} onClick={() => pick(m)} title={MOOD_DESC[m]}
            className={cn("text-xl w-9 h-9 rounded-lg transition-all hover:scale-110 flex items-center justify-center",
              sel === m ? "ring-2 ring-primary" : "hover:bg-muted"
            )}
            style={sel === m ? { background: "hsl(var(--primary) / 0.12)" } : {}}>
            {MOOD[m]}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        {sel && <p className="text-[11px] text-muted-foreground">{MOOD_DESC[sel]} · saved</p>}
        <button onClick={clearLast}
          className="text-[11px] text-muted-foreground/60 hover:text-foreground transition-colors">
          Dismiss
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RING TIMER
// ─────────────────────────────────────────────────────────────────────────────

function RingTimer({ secondsLeft, totalSeconds, state }: {
  secondsLeft: number; totalSeconds: number; state: FocusSession["state"] | "idle";
}) {
  const r = 100, circ = 2 * Math.PI * r;
  const progress = totalSeconds > 0 ? (totalSeconds - secondsLeft) / totalSeconds : 0;
  const offset   = circ * (1 - progress);
  const ringColor =
    state === "break"    ? "hsl(142 65% 44%)"    :
    state === "paused"   ? "hsl(38 92% 52%)"     :
    state === "focusing" ? "hsl(var(--primary))"  :
    "hsl(var(--border))";
  const stateText =
    state === "idle"     ? "ready"    :
    state === "focusing" ? "focusing" :
    state === "paused"   ? "paused"   : "on break";

  return (
    <div className="relative flex items-center justify-center" style={{ width: 240, height: 240 }}>
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 240 240">
        <circle cx="120" cy="120" r={r} fill="none" strokeWidth="8" stroke="hsl(var(--border))" />
        <circle cx="120" cy="120" r={r} fill="none" strokeWidth="8"
          stroke={ringColor} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s linear, stroke 0.4s ease" }}
        />
      </svg>
      <div className="flex flex-col items-center select-none z-10">
        <span className="text-5xl font-mono font-semibold tabular-nums leading-none tracking-tight">
          {formatSecs(secondsLeft)}
        </span>
        <span className="text-xs text-muted-foreground mt-2 tracking-widest uppercase">{stateText}</span>
      </div>
    </div>
  );
}

function PillButtons({ label, value, options, onChange, disabled }: {
  label: string; value: number; options: number[]; onChange: (v: number) => void; disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="flex gap-1">
        {options.map((o) => (
          <button key={o} disabled={disabled} onClick={() => onChange(o)}
            className={cn(
              "px-2.5 py-1 rounded-md text-xs font-medium transition-all",
              value === o
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/70 disabled:opacity-40"
            )}>
            {o}m
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FOCUS TAB
// ─────────────────────────────────────────────────────────────────────────────

function FocusTab() {
  useFocusEventListeners();

  const load        = useFocusStore((s) => s.load);
  const sessions    = useFocusStore((s) => s.sessions);
  const active      = useFocusStore((s) => s.activeSession);
  const secsLeft    = useFocusStore((s) => s.secondsLeft);
  const doneCount   = useFocusStore((s) => s.completedFocusCount);
  const lastDone    = useFocusStore((s) => s.lastCompletedSession);
  const pendingGoal = useFocusStore((s) => s.pendingGoal);
  const stats       = useFocusStore((s) => s.stats);
  const startFocus  = useFocusStore((s) => s.startFocus);
  const pause       = useFocusStore((s) => s.pause);
  const resume      = useFocusStore((s) => s.resume);
  const cancel      = useFocusStore((s) => s.cancel);
  const startBreak  = useFocusStore((s) => s.startBreak);
  const skipBreak   = useFocusStore((s) => s.skipBreak);
  const setTaskId   = useFocusStore((s) => s.setTaskId);
  const setProjectId = useFocusStore((s) => s.setProjectId);
  const setGoal     = useFocusStore((s) => s.setGoal);
  const setNotes    = useFocusStore((s) => s.setSessionNotes);
  const clearLast   = useFocusStore((s) => s.clearLastCompleted);

  const tasks        = useTaskStore((s) => s.tasks);
  const loadTasks    = useTaskStore((s) => s.loadTasks);
  const projects     = useProjectStore((s) => s.projects);
  const loadProjects = useProjectStore((s) => s.loadProjects);
  const settings     = useShellStore((s) => s.settings);

  const [focusMins,      setFocusMins]      = useState(() => settings?.focusModePomodoroMinutes   ?? 25);
  const [shortBreakMins, setShortBreakMins] = useState(() => settings?.focusModeShortBreakMinutes ?? 5);
  const [longBreakMins,  setLongBreakMins]  = useState(() => settings?.focusModeLongBreakMinutes  ?? 15);
  const sessionsBeforeLong = settings?.focusModeSessionsBeforeLongBreak ?? 4;

  const [selTask,    setSelTask]    = useState("");
  const [selProject, setSelProject] = useState("");
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => { void load(); void loadTasks(); void loadProjects(); }, [load, loadTasks, loadProjects]);
  useEffect(() => {
    if (active?.taskId)    setSelTask(active.taskId);
    if (active?.projectId) setSelProject(active.projectId);
  }, [active?.taskId, active?.projectId]);

  const state      = active?.state ?? "idle";
  const isIdle     = !active || state === "idle";
  const isFocusing = state === "focusing";
  const isPaused   = state === "paused";
  const isBreak    = state === "break";
  const totalSecs  = active ? active.plannedMinutes * 60 : focusMins * 60;
  const dispSecs   = isIdle ? focusMins * 60 : secsLeft;

  const showBreakOffer = !!lastDone && lastDone.type === "focus" && isIdle;
  const showMoodRater  = !!lastDone && lastDone.type !== "focus" && isIdle;

  const openTasks = tasks
    .filter((t) => t.status !== "done" && t.status !== "archived" && t.status !== "cancelled")
    .sort((a, b) => {
      if (isOverdue(a) !== isOverdue(b)) return isOverdue(a) ? -1 : 1;
      const w: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };
      return (w[a.priority] ?? 4) - (w[b.priority] ?? 4);
    });

  function handleTaskChange(id: string) {
    setSelTask(id);
    if (active) setTaskId(id || undefined);
    const t = id ? tasks.find((x) => x.id === id) : null;
    const pid = t?.projectId ?? "";
    setSelProject(pid);
    if (active) setProjectId(pid || undefined);
  }

  function handleStart() {
    void startFocus({
      taskId:    selTask    || undefined,
      projectId: selProject || undefined,
      config: { focusMinutes: focusMins, shortBreakMinutes: shortBreakMins, longBreakMinutes: longBreakMins, sessionsBeforeLongBreak: sessionsBeforeLong },
    });
  }

  function handleBreakAfterFocus() {
    const isLong = doneCount > 0 && (doneCount % sessionsBeforeLong) === 0;
    if (isLong) startBreak("long_break", longBreakMins);
    else        startBreak("short_break", shortBreakMins);
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left: history sidebar */}
      <FocusHistorySidebar sessions={sessions} />

      {/* Right: main timer area */}
      <div className="flex-1 flex flex-col items-center justify-start overflow-y-auto py-8 px-6 gap-5">

        {/* Stats chips row */}
        <div className="flex items-center gap-4 flex-wrap justify-center">
          {[
            { label: "Today",    value: `${stats.todayMinutes}m`,                  chip: stats.todaySessions > 0 ? `${stats.todaySessions} sessions` : undefined },
            { label: "Week",     value: `${stats.weekMinutes}m`,                   chip: undefined },
            { label: "Streak",   value: `${stats.currentStreak}d`,                chip: undefined, accent: stats.currentStreak >= 3 },
            { label: "All time", value: `${Math.round(stats.totalMinutes / 60)}h`, chip: undefined },
          ].map(({ label, value, chip, accent }) => (
            <div key={label} className="flex items-baseline gap-1.5">
              <span className={cn("text-base font-semibold tabular-nums", accent && "text-primary")}>{value}</span>
              <span className="text-xs text-muted-foreground">{label}</span>
              {chip && <span className="text-[10px] text-muted-foreground/60">({chip})</span>}
            </div>
          ))}
        </div>

        {/* Ring timer */}
        <RingTimer secondsLeft={dispSecs} totalSeconds={totalSecs} state={state} />

        {/* Pomodoro dots */}
        <div className="flex gap-2">
          {Array.from({ length: sessionsBeforeLong }).map((_, i) => (
            <div key={i} className={cn("w-2 h-2 rounded-full transition-colors",
              i < (doneCount % sessionsBeforeLong) ? "bg-primary" : "bg-border"
            )} />
          ))}
        </div>

        {/* ── IDLE ── */}
        {isIdle && !showBreakOffer && !showMoodRater && (
          <div className="flex flex-col items-center gap-4 w-full max-w-sm">
            <input
              value={pendingGoal ?? ""}
              onChange={(e) => setGoal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleStart()}
              placeholder="What's your intention for this session?"
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
            <div className="grid grid-cols-2 gap-2 w-full">
              <select value={selTask} onChange={(e) => handleTaskChange(e.target.value)}
                className="bg-background border border-border rounded-lg px-2 py-2 text-sm focus:outline-none truncate">
                <option value="">— No task —</option>
                {openTasks.map((t) => <option key={t.id} value={t.id}>{isOverdue(t) ? "⚠ " : ""}{t.title}</option>)}
              </select>
              <select value={selProject} onChange={(e) => setSelProject(e.target.value)}
                className="bg-background border border-border rounded-lg px-2 py-2 text-sm focus:outline-none truncate">
                <option value="">— No project —</option>
                {projects.filter((p) => p.status === "active").map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <button onClick={() => setShowConfig((v) => !v)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors self-start">
              {showConfig ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              Timer settings
            </button>
            {showConfig && (
              <div className="flex flex-col gap-3 w-full p-3 rounded-xl border" style={{ background: "hsl(var(--muted) / 0.3)", borderColor: "hsl(var(--border))" }}>
                <PillButtons label="Focus"       value={focusMins}      options={[15,20,25,30,45,60]} onChange={setFocusMins}      disabled={false} />
                <PillButtons label="Short break" value={shortBreakMins} options={[3,5,10]}            onChange={setShortBreakMins} disabled={false} />
                <PillButtons label="Long break"  value={longBreakMins}  options={[10,15,20,30]}       onChange={setLongBreakMins}  disabled={false} />
              </div>
            )}
            <button onClick={handleStart}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity">
              Start Focus
            </button>
          </div>
        )}

        {/* ── FOCUSING ── */}
        {isFocusing && (
          <div className="flex flex-col items-center gap-4 w-full max-w-sm">
            {active?.goal && <p className="text-sm text-muted-foreground italic text-center">"{active.goal}"</p>}
            {(active?.interruptCount ?? 0) > 0 && (
              <p className="text-xs text-amber-500">{active!.interruptCount} interruption{(active!.interruptCount ?? 0) > 1 ? "s" : ""}</p>
            )}
            <div className="w-full">
              <label className="text-xs text-muted-foreground mb-1 block">Session notes</label>
              <RichEditor
                content={active?.notes ?? ""}
                onChange={(v) => setNotes(v)}
                placeholder="Capture thoughts mid-session…"
                className="min-h-[60px] text-sm"
              />
            </div>
            <div className="flex gap-2 w-full">
              <button onClick={pause}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-border hover:bg-muted transition-colors text-sm font-medium">
                <Pause size={13} /> Pause
              </button>
              <button onClick={() => void cancel()}
                className="flex-1 py-2.5 rounded-lg border text-sm font-medium hover:bg-destructive/10 transition-colors"
                style={{ borderColor: "hsl(var(--destructive) / 0.4)", color: "hsl(var(--destructive))" }}>
                Stop
              </button>
            </div>
          </div>
        )}

        {/* ── PAUSED ── */}
        {isPaused && (
          <div className="flex flex-col items-center gap-3 w-full max-w-sm">
            {active?.notes && stripHtml(active.notes) && (
              <div className="w-full rounded-lg p-3 text-xs" style={{ background: "hsl(var(--muted) / 0.5)" }}>
                <p className="text-muted-foreground mb-1 text-[10px] uppercase tracking-wider">Notes so far</p>
                <div dangerouslySetInnerHTML={{ __html: active.notes }} className="prose prose-xs max-w-none line-clamp-4" />
              </div>
            )}
            <div className="flex gap-2 w-full">
              <button onClick={resume}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
                <Play size={13} /> Resume
              </button>
              <button onClick={() => void cancel()}
                className="flex-1 py-2.5 rounded-xl border text-sm font-medium hover:bg-destructive/10 transition-colors"
                style={{ borderColor: "hsl(var(--destructive) / 0.4)", color: "hsl(var(--destructive))" }}>
                Stop
              </button>
            </div>
          </div>
        )}

        {/* ── BREAK ── */}
        {isBreak && (
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-muted-foreground">
              {active?.type === "long_break" ? "☕ Long break — you earned it" : "🍃 Short break"}
            </p>
            <button onClick={skipBreak}
              className="px-6 py-2 rounded-lg border border-border hover:bg-muted transition-colors text-sm">
              Skip break
            </button>
          </div>
        )}

        {/* ── POST-FOCUS: break offer ── */}
        {showBreakOffer && (
          <div className="flex flex-col items-center gap-3 p-5 rounded-2xl border w-full max-w-xs text-center"
            style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}>
            <p className="font-semibold">Session complete 🎉</p>
            <p className="text-xs text-muted-foreground">
              {doneCount > 0 && (doneCount % sessionsBeforeLong) === 0 ? "You've earned a long break" : "Take a short break"}
            </p>
            <div className="flex gap-2 w-full">
              <button onClick={handleBreakAfterFocus}
                className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
                Start break
              </button>
              <button onClick={clearLast}
                className="flex-1 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">
                Skip
              </button>
            </div>
          </div>
        )}

        {/* ── POST-BREAK: mood ── */}
        {showMoodRater && lastDone && <MoodCard sessionId={lastDone.id} mood={lastDone.mood} />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TRACKER TAB
// ─────────────────────────────────────────────────────────────────────────────

function EntryForm({ initial = {}, onSave, onCancel }: {
  initial?: Partial<TimeEntry>;
  onSave: (data: Partial<TimeEntry>) => void;
  onCancel: () => void;
}) {
  const tasks    = useTaskStore((s) => s.tasks);
  const projects = useProjectStore((s) => s.projects);
  const [desc,      setDesc]      = useState(initial.description ?? "");
  const [taskId,    setTaskId]    = useState(initial.taskId ?? "");
  const [projectId, setProjectId] = useState(initial.projectId ?? "");
  const [billable,  setBillable]  = useState(initial.isBillable ?? false);
  const [startAt,   setStartAt]   = useState(() => {
    if (initial.startAt) return initial.startAt.slice(0, 16);
    return new Date().toISOString().slice(0, 16);
  });
  const [endAt, setEndAt] = useState(() => {
    if (initial.endAt) return initial.endAt.slice(0, 16);
    const d = new Date(initial.startAt ?? Date.now());
    d.setHours(d.getHours() + 1);
    return d.toISOString().slice(0, 16);
  });

  const durationPreview = (() => {
    try {
      const diff = Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000);
      return diff > 0 ? fmtDuration(diff) : null;
    } catch { return null; }
  })();

  const save = () => onSave({
    description: desc, taskId: taskId || undefined, projectId: projectId || undefined,
    isBillable: billable,
    startAt: new Date(startAt).toISOString(),
    endAt:   endAt ? new Date(endAt).toISOString() : undefined,
  });

  return (
    <div className="border-b shrink-0" style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--muted) / 0.2)" }}>
      <div className="p-3 flex flex-col gap-2.5">
        <input autoFocus value={desc} onChange={(e) => setDesc(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
          placeholder="What are you working on?" />
        <div className="grid grid-cols-2 gap-2">
          <select value={taskId} onChange={(e) => setTaskId(e.target.value)}
            className="bg-background border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none">
            <option value="">No task</option>
            {tasks.filter((t) => t.status !== "done" && t.status !== "archived").map((t) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)}
            className="bg-background border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none">
            <option value="">No project</option>
            {projects.filter((p) => p.status === "active").map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Start</label>
            <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 flex items-center justify-between">
              End
              {durationPreview && <span className="text-primary font-semibold tabular-nums">{durationPreview}</span>}
            </label>
            <input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none" />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => setBillable((b) => !b)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors select-none">
            <div className={cn("w-4 h-4 rounded border flex items-center justify-center transition-colors",
              billable ? "bg-primary border-primary text-primary-foreground" : "border-border")}>
              {billable && <Check size={10} />}
            </div>
            <DollarSign size={11} /> Billable
          </button>
          <div className="flex gap-2">
            <button onClick={onCancel} className="px-3 py-1.5 text-sm rounded-lg hover:bg-muted transition-colors">Cancel</button>
            <button onClick={save} className="px-3 py-1.5 text-sm rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity font-medium">Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EntryRow({ entry, onEdit, onDelete, onResume }: {
  entry: TimeEntry; onEdit: (id: string) => void; onDelete: (id: string) => void; onResume: (e: TimeEntry) => void;
}) {
  const tasks    = useTaskStore((s) => s.tasks);
  const projects = useProjectStore((s) => s.projects);
  const task     = entry.taskId    ? tasks.find((t)    => t.id === entry.taskId)    : null;
  const project  = entry.projectId ? projects.find((p) => p.id === entry.projectId) : null;
  const isRunning = !entry.endAt;
  const liveDur   = useLiveDuration(entry.startAt, !isRunning);

  return (
    <div className="group flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors border-b last:border-0"
      style={{ borderColor: "hsl(var(--border) / 0.5)" }}>
      {isRunning && (
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm truncate leading-tight">
            {entry.description || <span className="text-muted-foreground italic">No description</span>}
          </span>
          {entry.isBillable && <DollarSign size={10} className="text-emerald-500 shrink-0" />}
          {entry.focusSessionId && (
            <span className="text-[9px] px-1 py-0.5 rounded shrink-0 text-muted-foreground"
              style={{ background: "hsl(var(--primary) / 0.07)" }}>Focus</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {project && <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><ProjectDot color={project.color} size={8} />{project.name}</span>}
          {task    && <span className="text-[11px] text-muted-foreground/70 truncate">· {task.title}</span>}
          <span className="text-[11px] text-muted-foreground/50 ml-auto hidden sm:block">
            {fmtTime(entry.startAt)}{entry.endAt ? `–${fmtTime(entry.endAt)}` : " (running)"}
          </span>
        </div>
      </div>
      <span className={cn("text-sm font-semibold tabular-nums w-12 text-right shrink-0", isRunning && "text-emerald-600")}>
        {isRunning ? liveDur : (entry.durationMinutes ? fmtDuration(entry.durationMinutes) : "—")}
      </span>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => onResume(entry)} title="Resume"
          className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          <Play size={12} />
        </button>
        <button onClick={() => onEdit(entry.id)} title="Edit"
          className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          <Edit2 size={12} />
        </button>
        <button onClick={() => onDelete(entry.id)} title="Delete"
          className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-destructive">
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

function TrackerTab() {
  useEffect(() => { setupTimeEventListeners(); }, []);

  const entries       = useTimeStore((s) => s.entries);
  const activeEntryId = useTimeStore((s) => s.activeEntryId);
  const startTimer    = useTimeStore((s) => s.startTimer);
  const stopTimer     = useTimeStore((s) => s.stopTimer);
  const addEntry      = useTimeStore((s) => s.createEntry);
  const updateEntry   = useTimeStore((s) => s.updateEntry);
  const deleteEntry   = useTimeStore((s) => s.deleteEntry);
  const load          = useTimeStore((s) => s.load);
  const tasks         = useTaskStore((s) => s.tasks);
  const loadTasks     = useTaskStore((s) => s.loadTasks);
  const loadProjects  = useProjectStore((s) => s.loadProjects);

  const [showForm,  setShowForm]  = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [todayOnly, setTodayOnly] = useState(true);
  const [quickDesc, setQuickDesc] = useState("");
  const [quickTask, setQuickTask] = useState("");

  useEffect(() => { void load(); void loadTasks(); void loadProjects(); }, [load, loadTasks, loadProjects]);

  const completed   = entries.filter((e) => e.endAt);
  const running     = entries.find((e) => e.id === activeEntryId && !e.endAt);
  const shown       = todayOnly ? completed.filter((e) => e.startAt.startsWith(today())) : completed;
  const grouped     = groupByDate([...shown].sort((a, b) => b.startAt.localeCompare(a.startAt)));
  const activeEntry = running;

  function handleQuickStart() {
    const task = quickTask ? tasks.find((t) => t.id === quickTask) : null;
    void startTimer({
      description: quickDesc || task?.title || undefined,
      taskId:      quickTask || undefined,
    });
    setQuickDesc(""); setQuickTask("");
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Quick-start bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b shrink-0" style={{ borderColor: "hsl(var(--border))" }}>
        <input
          value={quickDesc} onChange={(e) => setQuickDesc(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !activeEntry) handleQuickStart(); }}
          placeholder="What are you working on?"
          disabled={!!activeEntry}
          className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 disabled:opacity-50"
        />
        <select value={quickTask} onChange={(e) => setQuickTask(e.target.value)}
          disabled={!!activeEntry}
          className="bg-background border border-border rounded-lg px-2 py-2 text-sm focus:outline-none max-w-[140px] disabled:opacity-50 hidden sm:block">
          <option value="">No task</option>
          {tasks.filter((t) => t.status !== "done" && t.status !== "archived").map((t) => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>
        {!activeEntry ? (
          <button onClick={handleQuickStart}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity shrink-0">
            <Play size={13} /> Start
          </button>
        ) : (
          <button onClick={() => void stopTimer()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold shrink-0 transition-colors"
            style={{ background: "hsl(var(--destructive) / 0.08)", color: "hsl(var(--destructive))" }}
            onMouseEnter={e => (e.currentTarget.style.background = "hsl(var(--destructive) / 0.16)")}
            onMouseLeave={e => (e.currentTarget.style.background = "hsl(var(--destructive) / 0.08)")}>
            <Square size={13} /> Stop
          </button>
        )}
        <button onClick={() => { setShowForm((v) => !v); setEditingId(null); }}
          className={cn("p-2 rounded-lg border transition-colors shrink-0",
            showForm ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted")}
          title="Add manual entry">
          <Plus size={15} />
        </button>
      </div>

      {/* Manual entry form */}
      {showForm && !editingId && (
        <EntryForm
          onSave={(data) => { void addEntry({ startAt: data.startAt!, ...data }); setShowForm(false); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Running entry row (always visible when active) */}
      {activeEntry && (
        <EntryRow
          entry={activeEntry}
          onEdit={(id) => { setEditingId(id); setShowForm(false); }}
          onDelete={(id) => void deleteEntry(id)}
          onResume={() => {/* already running */}}
        />
      )}

      {/* Filter pills + day total */}
      <div className="flex items-center gap-1.5 px-4 py-2 border-b shrink-0" style={{ borderColor: "hsl(var(--border))" }}>
        <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ background: "hsl(var(--muted))" }}>
          <button onClick={() => setTodayOnly(true)}
            className={cn("px-3 py-1 rounded-md text-xs font-medium transition-all",
              todayOnly ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            Today
          </button>
          <button onClick={() => setTodayOnly(false)}
            className={cn("px-3 py-1 rounded-md text-xs font-medium transition-all",
              !todayOnly ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            All
          </button>
        </div>
        {shown.length > 0 && (
          <span className="ml-auto text-xs font-semibold tabular-nums text-muted-foreground">
            {fmtDuration(totalMins(shown))}
          </span>
        )}
      </div>

      {/* Entry list */}
      <div className="flex-1 overflow-y-auto">
        {editingId && (
          <EntryForm
            initial={entries.find((e) => e.id === editingId)}
            onSave={(data) => { void updateEntry(editingId, data); setEditingId(null); }}
            onCancel={() => setEditingId(null)}
          />
        )}
        {grouped.length === 0 && !activeEntry ? (
          <EmptyState icon={<Clock size={26} />} title="No entries yet" description="Start a timer or add an entry manually." />
        ) : (
          grouped.map(([date, dayEntries]) => (
            <div key={date}>
              <div className="flex items-center justify-between px-4 py-2 sticky top-0 z-10 border-b"
                style={{ background: "hsl(var(--background))", borderColor: "hsl(var(--border))" }}>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{dateLabel(date)}</span>
                <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">{fmtDuration(totalMins(dayEntries))}</span>
              </div>
              {dayEntries.map((e) => (
                <EntryRow key={e.id} entry={e}
                  onEdit={(id) => { setEditingId(id); setShowForm(false); }}
                  onDelete={(id) => void deleteEntry(id)}
                  onResume={(entry) => void startTimer({
                    description: entry.description,
                    taskId:      entry.taskId,
                    projectId:   entry.projectId,
                  })}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORTS TAB
// ─────────────────────────────────────────────────────────────────────────────

function ReportsTab() {
  const entries  = useTimeStore((s) => s.entries);
  const projects = useProjectStore((s) => s.projects);
  const tasks    = useTaskStore((s) => s.tasks);

  const completed = entries.filter((e) => e.endAt && e.durationMinutes);

  // Last 7 days bar chart data
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const mins = completed.filter((e) => e.startAt.startsWith(d)).reduce((a, e) => a + (e.durationMinutes ?? 0), 0);
    return { date: d, label: dateLabel(d).split(",")[0], mins };
  }).reverse();

  const maxMins = Math.max(...days.map((d) => d.mins), 60);

  // By project
  const byProject = projects
    .map((p) => {
      const mins = completed.filter((e) => e.projectId === p.id).reduce((a, e) => a + (e.durationMinutes ?? 0), 0);
      return { ...p, mins };
    })
    .filter((p) => p.mins > 0)
    .sort((a, b) => b.mins - a.mins);

  const totalTracked = completed.reduce((a, e) => a + (e.durationMinutes ?? 0), 0);
  const billable     = completed.filter((e) => e.isBillable).reduce((a, e) => a + (e.durationMinutes ?? 0), 0);

  return (
    <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total tracked", value: fmtDuration(totalTracked) },
          { label: "Billable",      value: fmtDuration(billable) },
          { label: "Entries",       value: String(completed.length) },
        ].map(({ label, value }) => (
          <div key={label} className="flex flex-col gap-1 p-4 rounded-xl border"
            style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}>
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className="text-xl font-semibold tabular-nums">{value}</span>
          </div>
        ))}
      </div>

      {/* 7-day bar chart */}
      <div className="rounded-xl border p-4" style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Last 7 days</p>
        <div className="flex items-end gap-2 h-24">
          {days.map(({ date, label, mins }) => (
            <div key={date} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[9px] text-muted-foreground tabular-nums">{mins > 0 ? fmtDuration(mins) : ""}</span>
              <div className="w-full rounded-sm transition-all"
                style={{
                  height: `${Math.max((mins / maxMins) * 80, mins > 0 ? 4 : 0)}px`,
                  background: "hsl(var(--primary))",
                  opacity: mins > 0 ? 1 : 0.15,
                  minHeight: mins > 0 ? 4 : 0,
                }} />
              <span className="text-[9px] text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* By project */}
      {byProject.length > 0 && (
        <div className="rounded-xl border p-4" style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">By project</p>
          <div className="flex flex-col gap-2">
            {byProject.map((p) => (
              <div key={p.id} className="flex items-center gap-3">
                <ProjectDot color={p.color} size={8} />
                <span className="text-sm flex-1 truncate">{p.name}</span>
                <span className="text-xs font-semibold tabular-nums text-muted-foreground">{fmtDuration(p.mins)}</span>
                <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: "hsl(var(--muted))" }}>
                  <div className="h-full rounded-full" style={{
                    width: `${(p.mins / (byProject[0]?.mins ?? 1)) * 100}%`,
                    background: p.color ?? "hsl(var(--primary))",
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {completed.length === 0 && (
        <EmptyState icon={<BarChart2 size={26} />} title="No data yet" description="Track time to see your reports here." />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT MODULE
// ─────────────────────────────────────────────────────────────────────────────

export default function FocusModule() {
  const [tab, setTab] = useState<Tab>("focus");

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Active timer banner (cross-tab) */}
      <ActiveTimerBanner onJump={() => setTab("tracker")} />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0"
        style={{ borderColor: "hsl(var(--border))" }}>
        <SegmentControl active={tab} onChange={setTab} />
      </div>

      {/* Tab content */}
      {tab === "focus"   && <FocusTab />}
      {tab === "tracker" && <TrackerTab />}
      {tab === "reports" && <ReportsTab />}
    </div>
  );
}
