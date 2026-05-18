// ============================================================
// FOCUS + TIME TRACKING — COMBINED MODULE
// Single page with three tabs: Focus · Tracker · Reports
// No store/backend changes — UI-only integration.
// ============================================================

import { useEffect, useState, useRef, useCallback } from "react";
import { Routes, Route, NavLink, useNavigate } from "react-router-dom";
import {
  Timer, Square, Plus, Trash2, Edit2, Check, X,
  BarChart2, Clock, DollarSign, Tag, Play,
  Calendar, Briefcase, Focus, Zap, Target,
  ChevronRight, Moon, Pause,
} from "lucide-react";

import { registry } from "@/kernel/router";
import { bus } from "@/kernel/event-bus";
import { RichEditor } from "@/shared/RichEditor";

// Focus
import { focusManifest } from "@/modules/focus/manifest";
import { useFocusStore } from "@/modules/focus/store";
import { useFocusEventListeners } from "@/modules/focus/events";

// Time tracking
import { TIME_MANIFEST } from "@/modules/time-tracking/manifest";
import { useTimeStore } from "@/modules/time-tracking/store";
import { setupTimeEventListeners } from "@/modules/time-tracking/events";

// Shared
import { useTaskStore } from "@/modules/tasks/store";
import { useProjectStore } from "@/modules/projects/store";
import { useShellStore } from "@/shell/store";
import { PageHeader, EmptyState, PriorityDot, ProjectDot, SubNav } from "@/shared/ui";
import { cn, formatDate, today } from "@/shared/utils";
import type { FocusSession, TimeEntry, Task, ID } from "@/shared/types";

registry.register(focusManifest);
registry.register(TIME_MANIFEST);

// ─────────────────────────────────────────────────────────────────────────────
// SHARED HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function formatSecs(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m > 0 ? ` ${m}m` : ""}`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function isOverdue(task: Task): boolean {
  if (!task.dueDate) return false;
  return task.dueDate < new Date().toISOString().slice(0, 10);
}

function groupEntriesByDate(entries: TimeEntry[]): [string, TimeEntry[]][] {
  const map = new Map<string, TimeEntry[]>();
  for (const e of entries) {
    const date = e.startAt.slice(0, 10);
    if (!map.has(date)) map.set(date, []);
    map.get(date)!.push(e);
  }
  return Array.from(map.entries());
}

function totalMinutes(entries: TimeEntry[]): number {
  return entries.reduce((acc, e) => acc + (e.durationMinutes ?? 0), 0);
}

function sessionLabel(type: FocusSession["type"]): string {
  switch (type) {
    case "focus":       return "Focus";
    case "short_break": return "Short Break";
    case "long_break":  return "Long Break";
  }
}

function dateLabel(dateStr: string): string {
  const t = new Date().toISOString().slice(0, 10);
  const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (dateStr === t) return "Today";
  if (dateStr === y) return "Yesterday";
  return new Date(dateStr).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

const MOOD_LABELS: Record<number, string> = { 1: "😩", 2: "😕", 3: "😐", 4: "🙂", 5: "😄" };
const MOOD_DESC:   Record<number, string> = { 1: "Terrible", 2: "Rough", 3: "Okay", 4: "Good", 5: "Great" };

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVE TIMER BANNER — shared top bar shown when time-entry timer running
// ─────────────────────────────────────────────────────────────────────────────

function useLiveDuration(startAt: string | undefined): string {
  const [elapsed, setElapsed] = useState("0m");
  useEffect(() => {
    if (!startAt) return;
    const tick = () => {
      const mins = Math.floor((Date.now() - new Date(startAt).getTime()) / 60000);
      setElapsed(fmtDuration(mins));
    };
    tick();
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, [startAt]);
  return elapsed;
}

function ActiveTimerBanner() {
  const activeEntry = useTimeStore((s) => s.entries.find((e) => e.id === s.activeEntryId));
  const stopTimer   = useTimeStore((s) => s.stopTimer);
  const tasks       = useTaskStore((s) => s.tasks);
  const elapsed     = useLiveDuration(activeEntry?.startAt);
  if (!activeEntry) return null;
  const task = activeEntry.taskId ? tasks.find((t) => t.id === activeEntry.taskId) : null;
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 text-sm border-b"
      style={{ background: "hsl(142 68% 44% / 0.08)", borderColor: "hsl(142 68% 44% / 0.2)" }}>
      <span className="flex items-center gap-1.5 font-medium" style={{ color: "hsl(142 68% 36%)" }}>
        <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "hsl(142 68% 44%)" }} />
        {elapsed}
      </span>
      <span className="text-muted-foreground truncate flex-1">
        {activeEntry.description || task?.title || "Running timer…"}
      </span>
      <button onClick={() => stopTimer()}
        className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors"
        style={{ background: "hsl(var(--destructive) / 0.1)", color: "hsl(var(--destructive))" }}
        onMouseEnter={e => (e.currentTarget.style.background = "hsl(var(--destructive) / 0.2)")}
        onMouseLeave={e => (e.currentTarget.style.background = "hsl(var(--destructive) / 0.1)")}
      >
        <Square size={11} /> Stop
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB NAV
// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "focus",   label: "Focus",   icon: Target,    path: "/time" },
  { id: "tracker", label: "Tracker", icon: Clock,     path: "/time/tracker" },
  { id: "reports", label: "Reports", icon: BarChart2,  path: "/time/reports" },
] as const;

function TabNav({ active }: { active: string }) {
  const navigate = useNavigate();
  return (
    <div className="flex items-center gap-1 px-4 pt-4 pb-0 border-b" style={{ borderColor: "hsl(var(--border))" }}>
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => navigate(tab.path)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-md border-b-2 -mb-px transition-colors",
              isActive
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon size={14} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FOCUS TAB
// ─────────────────────────────────────────────────────────────────────────────

function RingTimer({ secondsLeft, totalSeconds, state }: {
  secondsLeft: number; totalSeconds: number; state: FocusSession["state"] | "idle";
}) {
  const r = 88;
  const circ = 2 * Math.PI * r;
  const progress = totalSeconds > 0 ? (totalSeconds - secondsLeft) / totalSeconds : 0;
  const offset   = circ * (1 - progress);
  const color =
    state === "break"    ? "hsl(142 68% 44%)" :
    state === "paused"   ? "hsl(38 92% 50%)"  :
    state === "focusing" ? "hsl(var(--primary))" :
    "hsl(var(--border))";
  return (
    <div className="relative flex items-center justify-center w-52 h-52">
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 210 210">
        <circle cx="105" cy="105" r={r} fill="none" strokeWidth="7" stroke="hsl(var(--border))" />
        <circle cx="105" cy="105" r={r} fill="none" strokeWidth="7"
          stroke={color} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      </svg>
      <div className="flex flex-col items-center select-none">
        <span className="text-5xl font-mono font-semibold tabular-nums leading-none tracking-tight">
          {formatSecs(secondsLeft)}
        </span>
        <span className="text-xs text-muted-foreground mt-2 capitalize tracking-wide">
          {state === "idle" ? "ready" : state === "break" ? "on break" : state}
        </span>
      </div>
    </div>
  );
}

function SessionNotesArea() {
  const active     = useFocusStore((s) => s.activeSession);
  const setNotes   = useFocusStore((s) => s.setSessionNotes);
  if (!active || active.type !== "focus" || active.state !== "focusing") return null;
  return (
    <div className="w-full max-w-sm">
      <label className="text-xs text-muted-foreground mb-1 block">Session notes</label>
      <RichEditor
        content={active.notes ?? ""}
        onChange={(v) => void setNotes(active.id, v)}
        placeholder="Capture thoughts mid-session…"
        className="min-h-[64px] text-sm"
      />
    </div>
  );
}

function MoodPicker({ sessionId, currentMood }: { sessionId: string; currentMood?: number }) {
  const setMood   = useFocusStore((s) => s.setSessionMood);
  const clearLast = useFocusStore((s) => s.clearLastCompleted);
  const [sel, setSel] = useState<number | null>(currentMood ?? null);
  function pick(m: number) {
    setSel(m);
    void setMood(sessionId, m as 1|2|3|4|5);
    setTimeout(clearLast, 800);
  }
  return (
    <div className="flex flex-col items-center gap-3 p-4 rounded-xl border w-full max-w-xs"
      style={{ background: "hsl(var(--muted) / 0.4)", borderColor: "hsl(var(--border))" }}>
      <p className="text-sm font-medium">How was that session?</p>
      <div className="flex gap-2">
        {[1,2,3,4,5].map((m) => (
          <button key={m} onClick={() => pick(m)} title={MOOD_DESC[m]}
            className={cn("text-2xl w-10 h-10 rounded-lg transition-all hover:scale-110",
              sel === m ? "ring-2 ring-primary" : "hover:bg-accent"
            )}
            style={sel === m ? { background: "hsl(var(--primary) / 0.15)" } : {}}
          >
            {MOOD_LABELS[m]}
          </button>
        ))}
      </div>
      {sel && <p className="text-xs text-muted-foreground">{MOOD_DESC[sel]} · saved</p>}
    </div>
  );
}

function DurationSelect({ label, value, options, onChange, disabled }: {
  label: string; value: number; options: number[]; onChange: (v: number) => void; disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 items-center">
      <label className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="bg-background border border-border rounded px-2 py-1 text-sm disabled:opacity-50"
      >
        {options.map((o) => <option key={o} value={o}>{o}m</option>)}
      </select>
    </div>
  );
}

function FocusHistoryPanel({ sessions }: { sessions: FocusSession[] }) {
  const grouped = (() => {
    const map = new Map<string, FocusSession[]>();
    for (const s of sessions) {
      const d = s.startedAt?.slice(0,10) ?? s.createdAt.slice(0,10);
      if (!map.has(d)) map.set(d,[]);
      map.get(d)!.push(s);
    }
    return Array.from(map.entries()).map(([date, list]) => ({ date, list })).slice(0, 7);
  })();

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ width: 280, minWidth: 260 }}>
      <div className="px-4 py-3 border-b" style={{ borderColor: "hsl(var(--border))" }}>
        <h3 className="text-sm font-semibold">Session history</h3>
      </div>
      <div className="flex-1 overflow-y-auto">
        {grouped.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 px-4 text-center">
            <Target size={28} className="text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No sessions yet</p>
          </div>
        ) : grouped.map(({ date, list }) => (
          <div key={date} className="px-4 py-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {dateLabel(date)}
            </p>
            {list.map((s) => (
              <div key={s.id} className="flex items-start gap-2 py-2 border-b last:border-0"
                style={{ borderColor: "hsl(var(--border) / 0.5)" }}>
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full mt-1.5 shrink-0",
                  s.type === "focus" ? "bg-primary" :
                  s.type === "long_break" ? "bg-emerald-500" : "bg-amber-400"
                )} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{sessionLabel(s.type)}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {s.actualMinutes ? `${s.actualMinutes}m` : "–"}
                    </span>
                  </div>
                  {s.goal && <p className="text-[11px] text-muted-foreground truncate italic mt-0.5">"{s.goal}"</p>}
                  <div className="flex items-center gap-2 mt-0.5">
                    {s.mood && <span className="text-[11px]">{MOOD_LABELS[s.mood]}</span>}
                    {(s.interruptCount ?? 0) > 0 && (
                      <span className="text-[11px] text-amber-500">{s.interruptCount} interrupt{(s.interruptCount ?? 0) > 1 ? "s" : ""}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function FocusStats() {
  const stats = useFocusStore((s) => s.stats);
  const items = [
    { label: "Today",     value: `${stats.todayMinutes}m`,  sub: `${stats.todaySessions} sessions` },
    { label: "This week", value: `${stats.weekMinutes}m`,   sub: undefined },
    { label: "Streak",    value: `${stats.currentStreak}d`, sub: undefined, accent: stats.currentStreak >= 3 },
    { label: "All time",  value: `${Math.round(stats.totalMinutes / 60)}h`, sub: `${stats.totalSessions} total` },
  ];
  return (
    <div className="flex gap-5 flex-wrap">
      {items.map((it) => (
        <div key={it.label} className="flex flex-col items-center">
          <span className={cn("text-lg font-semibold tabular-nums", it.accent && "text-primary")}>{it.value}</span>
          <span className="text-xs text-muted-foreground">{it.label}</span>
          {it.sub && <span className="text-[10px] text-muted-foreground/70">{it.sub}</span>}
        </div>
      ))}
    </div>
  );
}

function FocusTab() {
  useFocusEventListeners();

  const load       = useFocusStore((s) => s.load);
  const sessions   = useFocusStore((s) => s.sessions);
  const active     = useFocusStore((s) => s.activeSession);
  const secsLeft   = useFocusStore((s) => s.secondsLeft);
  const doneCount  = useFocusStore((s) => s.completedFocusCount);
  const lastDone   = useFocusStore((s) => s.lastCompletedSession);
  const pendingGoal = useFocusStore((s) => s.pendingGoal);
  const startFocus = useFocusStore((s) => s.startFocus);
  const pause      = useFocusStore((s) => s.pause);
  const resume     = useFocusStore((s) => s.resume);
  const cancel     = useFocusStore((s) => s.cancel);
  const startBreak = useFocusStore((s) => s.startBreak);
  const skipBreak  = useFocusStore((s) => s.skipBreak);
  const setTaskId  = useFocusStore((s) => s.setTaskId);
  const setProjectId = useFocusStore((s) => s.setProjectId);
  const setGoal    = useFocusStore((s) => s.setGoal);

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

  useEffect(() => { void load(); void loadTasks(); void loadProjects(); }, [load, loadTasks, loadProjects]);

  useEffect(() => {
    if (active?.taskId)    setSelTask(active.taskId);
    if (active?.projectId) setSelProject(active.projectId);
  }, [active?.taskId, active?.projectId]);

  useEffect(() => {
    const unsub = useFocusStore.subscribe((state) => {
      const pending = (state as Record<string, unknown>)._pendingTaskId as string | undefined;
      if (pending && !state.activeSession) {
        setSelTask(pending);
        useFocusStore.setState({ _pendingTaskId: undefined } as never);
      }
    });
    return unsub;
  }, []);

  const state      = active?.state ?? "idle";
  const isIdle     = !active || state === "idle";
  const isFocusing = state === "focusing";
  const isPaused   = state === "paused";
  const isBreak    = state === "break";
  const totalSecs  = active ? active.plannedMinutes * 60 : focusMins * 60;
  const dispSecs   = isIdle ? focusMins * 60 : secsLeft;

  const openTasks = tasks
    .filter((t) => t.status !== "done" && t.status !== "archived" && t.status !== "cancelled")
    .sort((a, b) => {
      if (isOverdue(a) !== isOverdue(b)) return isOverdue(a) ? -1 : 1;
      const w = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };
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
      config: {
        focusMinutes:            focusMins,
        shortBreakMinutes:       shortBreakMins,
        longBreakMinutes:        longBreakMins,
        sessionsBeforeLongBreak: sessionsBeforeLong,
      },
    });
  }

  function handleBreakAfterFocus() {
    const isLong = (doneCount % sessionsBeforeLong) === 0 && doneCount > 0;
    if (isLong) startBreak("long_break", longBreakMins);
    else        startBreak("short_break", shortBreakMins);
  }

  const showBreakOffer = !!lastDone && lastDone.type === "focus" && isIdle;
  const showMoodRater  = !!lastDone && lastDone.type !== "focus" && isIdle;

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* ── Center: Timer ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8 overflow-y-auto py-8">
        <FocusStats />

        <RingTimer secondsLeft={dispSecs} totalSeconds={totalSecs} state={state} />

        {/* Pomodoro dots */}
        <div className="flex gap-1.5">
          {Array.from({ length: sessionsBeforeLong }).map((_, i) => (
            <div key={i} className={cn("w-2 h-2 rounded-full transition-colors",
              i < (doneCount % sessionsBeforeLong) ? "bg-primary" : "bg-border"
            )} />
          ))}
        </div>

        {/* ── IDLE: setup controls ── */}
        {isIdle && !showBreakOffer && !showMoodRater && (
          <>
            <input
              value={pendingGoal ?? ""}
              onChange={(e) => setGoal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleStart()}
              placeholder="What's your intention for this session?"
              className="w-full max-w-sm px-3 py-2 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <div className="flex gap-2 w-full max-w-sm">
              <select value={selTask} onChange={(e) => handleTaskChange(e.target.value)}
                className="flex-1 bg-background border border-border rounded-lg px-2 py-2 text-sm focus:outline-none truncate">
                <option value="">— No task —</option>
                {openTasks.map((t) => <option key={t.id} value={t.id}>{isOverdue(t) ? "⚠ " : ""}{t.title}</option>)}
              </select>
              <select value={selProject} onChange={(e) => setSelProject(e.target.value)}
                className="flex-1 bg-background border border-border rounded-lg px-2 py-2 text-sm focus:outline-none truncate">
                <option value="">— No project —</option>
                {projects.filter((p) => p.status === "active").map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="flex gap-5">
              <DurationSelect label="Focus"       value={focusMins}      options={[15,20,25,30,45,50,60]} onChange={setFocusMins}      disabled={false} />
              <DurationSelect label="Short break" value={shortBreakMins} options={[3,5,10]}               onChange={setShortBreakMins} disabled={false} />
              <DurationSelect label="Long break"  value={longBreakMins}  options={[10,15,20,30]}          onChange={setLongBreakMins}  disabled={false} />
            </div>
            <button onClick={handleStart}
              className="px-10 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity text-sm">
              Start Focus
            </button>
          </>
        )}

        {/* ── FOCUSING ── */}
        {isFocusing && (
          <div className="flex flex-col items-center gap-4 w-full max-w-sm">
            {active?.goal && <p className="text-sm text-muted-foreground italic text-center">"{active.goal}"</p>}
            {(active?.interruptCount ?? 0) > 0 && (
              <p className="text-xs text-amber-500">{active!.interruptCount} interruption{(active!.interruptCount ?? 0) > 1 ? "s" : ""}</p>
            )}
            <SessionNotesArea />
            <div className="flex gap-3">
              <button onClick={pause}
                className="px-5 py-2.5 rounded-lg border border-border hover:bg-accent transition-colors text-sm flex items-center gap-1.5">
                <Pause size={14} /> Pause
              </button>
              <button onClick={() => void cancel()}
                className="px-5 py-2.5 rounded-lg border text-sm hover:bg-destructive/10 transition-colors"
                style={{ borderColor: "hsl(var(--destructive))", color: "hsl(var(--destructive))" }}>
                Stop
              </button>
            </div>
          </div>
        )}

        {/* ── PAUSED ── */}
        {isPaused && (
          <div className="flex gap-3">
            <button onClick={resume}
              className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity text-sm flex items-center gap-1.5">
              <Play size={14} /> Resume
            </button>
            <button onClick={() => void cancel()}
              className="px-5 py-2.5 rounded-lg border text-sm hover:bg-destructive/10 transition-colors"
              style={{ borderColor: "hsl(var(--destructive))", color: "hsl(var(--destructive))" }}>
              Stop
            </button>
          </div>
        )}

        {/* ── BREAK ── */}
        {isBreak && (
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {active?.type === "long_break" ? "☕ Long break" : "🍃 Short break"}
            </span>
            <button onClick={skipBreak}
              className="px-5 py-2.5 rounded-lg border border-border hover:bg-accent transition-colors text-sm">
              Skip break
            </button>
          </div>
        )}

        {/* ── POST-SESSION: break offer ── */}
        {showBreakOffer && (
          <div className="flex flex-col items-center gap-3 p-5 rounded-xl border w-full max-w-xs text-center"
            style={{ background: "hsl(var(--muted) / 0.4)" }}>
            <p className="font-medium text-sm">Session complete 🎉</p>
            <p className="text-xs text-muted-foreground">
              {(doneCount % sessionsBeforeLong) === 0 && doneCount > 0 ? "Time for a long break" : "Take a short break"}
            </p>
            <div className="flex gap-2">
              <button onClick={handleBreakAfterFocus}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
                Start break
              </button>
              <button onClick={() => useFocusStore.getState().clearLastCompleted()}
                className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-accent transition-colors">
                Skip
              </button>
            </div>
          </div>
        )}

        {/* ── POST-BREAK: mood rater ── */}
        {showMoodRater && lastDone && (
          <MoodPicker sessionId={lastDone.id} currentMood={lastDone.mood} />
        )}
      </div>

      {/* ── Right: Focus history ────────────────────────────────────────── */}
      <div className="border-l shrink-0 overflow-hidden" style={{ borderColor: "hsl(var(--border))" }}>
        <FocusHistoryPanel sessions={sessions} />
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
  const [taskId,    setTaskId]    = useState<string>(initial.taskId ?? "");
  const [projectId, setProjectId] = useState<string>(initial.projectId ?? "");
  const [billable,  setBillable]  = useState(initial.isBillable ?? false);
  const [startAt,   setStartAt]   = useState(initial.startAt ? initial.startAt.slice(0,16) : new Date().toISOString().slice(0,16));
  const [endAt,     setEndAt]     = useState(initial.endAt   ? initial.endAt.slice(0,16)   : "");

  const save = () => onSave({
    description: desc, taskId: taskId || undefined, projectId: projectId || undefined,
    isBillable: billable, startAt: new Date(startAt).toISOString(),
    endAt: endAt ? new Date(endAt).toISOString() : undefined,
  });

  return (
    <div className="p-4 border-b bg-muted/20 flex flex-col gap-3" style={{ borderColor: "hsl(var(--border))" }}>
      <input autoFocus value={desc} onChange={(e) => setDesc(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()}
        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
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
          <label className="text-xs text-muted-foreground mb-1 block">End</label>
          <input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)}
            className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none" />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <button type="button" onClick={() => setBillable((b) => !b)}
            className={cn("w-4 h-4 rounded border flex items-center justify-center transition-colors",
              billable ? "bg-primary border-primary text-primary-foreground" : "border-border")}>
            {billable && <Check size={10} />}
          </button>
          <DollarSign size={12} className="text-muted-foreground" /> Billable
        </label>
        <div className="flex gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 text-sm rounded hover:bg-muted transition-colors">Cancel</button>
          <button onClick={save} className="px-3 py-1.5 text-sm rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity">Save</button>
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

  return (
    <div className="group flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors border-b last:border-0" style={{ borderColor: "hsl(var(--border) / 0.5)" }}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm truncate">
            {entry.description || <span className="text-muted-foreground italic">No description</span>}
          </span>
          {entry.isBillable && <DollarSign size={11} className="text-emerald-500 shrink-0" />}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {project && <span className="flex items-center gap-1 text-xs text-muted-foreground"><ProjectDot color={project.color} size="xs" />{project.name}</span>}
          {task    && <span className="text-xs text-muted-foreground truncate">· {task.title}</span>}
          {entry.focusSessionId && <span className="text-[10px] px-1 py-0.5 rounded text-muted-foreground" style={{ background: "hsl(var(--primary) / 0.08)" }}>via Focus</span>}
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-xs text-muted-foreground tabular-nums">
          {fmtTime(entry.startAt)}{entry.endAt ? ` – ${fmtTime(entry.endAt)}` : ""}
        </span>
        <span className="text-sm font-medium tabular-nums w-12 text-right">
          {entry.durationMinutes ? fmtDuration(entry.durationMinutes) : "—"}
        </span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onResume(entry)} title="Restart" className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <Play size={13} />
          </button>
          <button onClick={() => onEdit(entry.id)} title="Edit" className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <Edit2 size={13} />
          </button>
          <button onClick={() => onDelete(entry.id)} title="Delete" className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-destructive">
            <Trash2 size={13} />
          </button>
        </div>
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
  const addEntry      = useTimeStore((s) => s.addEntry);
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
  const shown       = todayOnly ? completed.filter((e) => e.startAt.startsWith(today())) : completed;
  const grouped     = groupEntriesByDate([...shown].sort((a, b) => b.startAt.localeCompare(a.startAt)));
  const activeEntry = entries.find((e) => e.id === activeEntryId);

  function handleQuickStart() {
    void startTimer({ description: quickDesc || undefined, taskId: quickTask || undefined });
    setQuickDesc("");
    setQuickTask("");
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Quick-start bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: "hsl(var(--border))" }}>
        <input value={quickDesc} onChange={(e) => setQuickDesc(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !activeEntry && handleQuickStart()}
          placeholder="What are you working on?"
          className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          disabled={!!activeEntry}
        />
        <select value={quickTask} onChange={(e) => setQuickTask(e.target.value)}
          className="bg-background border border-border rounded-lg px-2 py-2 text-sm focus:outline-none max-w-[160px] truncate"
          disabled={!!activeEntry}>
          <option value="">No task</option>
          {tasks.filter((t) => t.status !== "done" && t.status !== "archived").map((t) => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>
        {!activeEntry ? (
          <button onClick={handleQuickStart}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity shrink-0">
            <Play size={14} /> Start
          </button>
        ) : (
          <button onClick={() => stopTimer()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium shrink-0 transition-colors"
            style={{ background: "hsl(var(--destructive) / 0.1)", color: "hsl(var(--destructive))" }}
            onMouseEnter={e => (e.currentTarget.style.background = "hsl(var(--destructive) / 0.2)")}
            onMouseLeave={e => (e.currentTarget.style.background = "hsl(var(--destructive) / 0.1)")}>
            <Square size={14} /> Stop
          </button>
        )}
        <button onClick={() => setShowForm((v) => !v)}
          className="p-2 rounded-lg border border-border hover:bg-muted transition-colors"
          title="Add manual entry">
          <Plus size={16} />
        </button>
      </div>

      {showForm && (
        <EntryForm
          onSave={(data) => { void addEntry(data); setShowForm(false); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b text-sm" style={{ borderColor: "hsl(var(--border))" }}>
        <button onClick={() => setTodayOnly(true)}
          className={cn("px-3 py-1 rounded-md transition-colors",
            todayOnly ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground")}>
          Today
        </button>
        <button onClick={() => setTodayOnly(false)}
          className={cn("px-3 py-1 rounded-md transition-colors",
            !todayOnly ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground")}>
          All entries
        </button>
        {todayOnly && (
          <span className="ml-auto text-muted-foreground text-xs tabular-nums">
            {fmtDuration(totalMinutes(shown))} today
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

        {grouped.length === 0 ? (
          <EmptyState icon={<Clock size={28} />} title="No entries yet"
            description="Start a timer or add an entry manually." />
        ) : (
          grouped.map(([date, dayEntries]) => (
            <div key={date}>
              <div className="flex items-center justify-between px-4 py-2 sticky top-0 z-10 border-b"
                style={{ background: "hsl(var(--surface-2))", borderColor: "hsl(var(--border))" }}>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {dateLabel(date)}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {fmtDuration(totalMinutes(dayEntries))}
                </span>
              </div>
              {dayEntries.map((e) => (
                <EntryRow
                  key={e.id} entry={e}
                  onEdit={setEditingId}
                  onDelete={(id) => void deleteEntry(id)}
                  onResume={(entry) => void startTimer({
                    description: entry.description,
                    taskId: entry.taskId,
                    projectId: entry.projectId,
                    isBillable: entry.isBillable,
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

type RangePreset = "today" | "week" | "month" | "custom";

function ReportsTab() {
  const entries   = useTimeStore((s) => s.entries.filter((e) => e.endAt));
  const sessions  = useFocusStore((s) => s.sessions.filter((s) => s.type === "focus" && s.completedAt));
  const projects  = useProjectStore((s) => s.projects);
  const tasks     = useTaskStore((s) => s.tasks);

  const [preset,   setPreset]   = useState<RangePreset>("week");
  const [fromDate, setFromDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0,10); });
  const [toDate,   setToDate]   = useState(() => new Date().toISOString().slice(0,10));

  const applyPreset = (p: RangePreset) => {
    setPreset(p);
    const n = new Date();
    if (p === "today")  { const d = n.toISOString().slice(0,10); setFromDate(d); setToDate(d); }
    else if (p === "week")  { const f = new Date(n); f.setDate(n.getDate()-7); setFromDate(f.toISOString().slice(0,10)); setToDate(n.toISOString().slice(0,10)); }
    else if (p === "month") { setFromDate(new Date(n.getFullYear(), n.getMonth(), 1).toISOString().slice(0,10)); setToDate(n.toISOString().slice(0,10)); }
  };

  const filtered  = entries.filter((e) => e.startAt.slice(0,10) >= fromDate && e.startAt.slice(0,10) <= toDate);
  const totalMins = totalMinutes(filtered);
  const billable  = totalMinutes(filtered.filter((e) => e.isBillable));

  const focusMinsInRange = sessions
    .filter((s) => s.startedAt && s.startedAt.slice(0,10) >= fromDate && s.startedAt.slice(0,10) <= toDate)
    .reduce((acc, s) => acc + (s.actualMinutes ?? 0), 0);

  const byProject = new Map<string, number>();
  filtered.forEach((e) => {
    const key = e.projectId ?? "__none__";
    byProject.set(key, (byProject.get(key) ?? 0) + (e.durationMinutes ?? 0));
  });
  const projectRows = Array.from(byProject.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id, mins]) => ({ project: id !== "__none__" ? projects.find((p) => p.id === id) : null, mins }));

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Range */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {(["today","week","month","custom"] as RangePreset[]).map((p) => (
          <button key={p} onClick={() => applyPreset(p)}
            className={cn("px-3 py-1.5 text-sm rounded-lg capitalize transition-colors",
              preset === p ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80")}>
            {p === "week" ? "Last 7 days" : p === "month" ? "This month" : p}
          </button>
        ))}
        {preset === "custom" && (
          <div className="flex items-center gap-2">
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
              className="bg-background border border-border rounded-lg px-2 py-1.5 text-sm" />
            <span className="text-muted-foreground">–</span>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
              className="bg-background border border-border rounded-lg px-2 py-1.5 text-sm" />
          </div>
        )}
      </div>

      {/* KPI cards — 4-up including Focus time from focus store */}
      <div className="grid grid-cols-2 gap-3 mb-8 sm:grid-cols-4">
        {[
          { label: "Tracked",  value: fmtDuration(totalMins),        icon: Clock,       color: "text-primary" },
          { label: "Focus",    value: fmtDuration(focusMinsInRange),  icon: Target,      color: "text-amber-500" },
          { label: "Billable", value: fmtDuration(billable),          icon: DollarSign,  color: "text-emerald-500" },
          { label: "Entries",  value: String(filtered.length),        icon: Tag,         color: "text-muted-foreground" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border border-border p-4 flex items-start gap-3"
            style={{ background: "hsl(var(--card))" }}>
            <div className="p-2 rounded-lg" style={{ background: "hsl(var(--muted))" }}>
              <Icon size={14} className={color} />
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
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">By Project</h3>
        {projectRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tracked time in this range.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {projectRows.map(({ project, mins }) => (
              <div key={project?.id ?? "none"} className="flex items-center gap-3">
                {project ? <ProjectDot color={project.color} size="sm" /> : <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />}
                <span className="text-sm flex-1 truncate">{project?.name ?? "No project"}</span>
                <span className="text-sm tabular-nums text-muted-foreground">{fmtDuration(mins)}</span>
                <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: "hsl(var(--muted))" }}>
                  <div className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(100, totalMins > 0 ? (mins / totalMins) * 100 : 0)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE ROOT
// ─────────────────────────────────────────────────────────────────────────────

export default function TimeModule() {
  const activeEntryId = useTimeStore((s) => s.activeEntryId);

  const path = window.location.pathname;
  const activeTab =
    path.includes("/time/reports") ? "reports" :
    path.includes("/time/tracker") ? "tracker" : "focus";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Module header */}
      <div className="flex items-center justify-between px-5 py-3 border-b shrink-0"
        style={{ borderColor: "hsl(var(--border))" }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: "hsl(var(--primary) / 0.12)" }}>
            <Zap size={15} style={{ color: "hsl(var(--primary))" }} />
          </div>
          <h1 className="text-sm font-semibold">Focus &amp; Time</h1>
        </div>
        {activeEntryId && (
          <span className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full"
            style={{ background: "hsl(142 68% 44% / 0.1)", color: "hsl(142 68% 36%)" }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "hsl(142 68% 44%)" }} />
            Timer running
          </span>
        )}
      </div>

      {/* Active tracker banner — shown on all tabs */}
      <ActiveTimerBanner />

      {/* Tab navigation */}
      <TabNav active={activeTab} />

      {/* Tab content */}
      <div className="flex flex-1 overflow-hidden">
        <Routes>
          <Route index          element={<FocusTab />} />
          <Route path="tracker" element={<TrackerTab />} />
          <Route path="reports" element={<ReportsTab />} />
        </Routes>
      </div>
    </div>
  );
}
