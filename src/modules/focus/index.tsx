// ============================================================
// FOCUS & TIME — Module  (redesigned with TaskDetail DNA)
// ============================================================

import { useEffect, useState, useRef, useCallback } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  Play, Pause, Square, AlertCircle, Plus, X, Trash2,
  Target, Clock, Flame, TrendingUp, Zap, ArrowRight,
  Edit2, Check, ChevronDown, ChevronUp, RotateCcw,
  Activity, Star, Timer
} from "lucide-react";

import { focusManifest }               from "./manifest";
import { useFocusStore }               from "./store";
import { TIME_MANIFEST }               from "../time-tracking/manifest";
import { useTimeStore }                from "../time-tracking/store";
import { setupTimeEventListeners }     from "../time-tracking/events";
import { useTaskStore }                from "../tasks/store";
import { useProjectStore }             from "../projects/store";
import { registry }                    from "@/kernel/router";
import { cn, today }                   from "@/shared/utils";
import type { TimeEntry }              from "@/shared/types";

registry.register(focusManifest);
registry.register(TIME_MANIFEST);

// ─────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────
function formatSecs(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}
function fmtMins(m: number) {
  if (m <= 0) return "0m";
  const h = Math.floor(m / 60), r = m % 60;
  return h === 0 ? `${r}m` : r === 0 ? `${h}h` : `${h}h ${r}m`;
}
function fmtClock(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function dayLabel(iso: string) {
  const t = today();
  const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const d = iso.slice(0, 10);
  return d === t ? "Today" : d === y ? "Yesterday" :
    new Date(d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
function groupByDate(es: TimeEntry[]): [string, TimeEntry[]][] {
  const m = new Map<string, TimeEntry[]>();
  for (const e of es) {
    const d = e.startAt.slice(0, 10);
    if (!m.has(d)) m.set(d, []);
    m.get(d)!.push(e);
  }
  return Array.from(m.entries()).sort(([a], [b]) => b.localeCompare(a));
}
function useLiveDuration(startAt?: string, stopped = false): string {
  const [el, setEl] = useState("0m");
  useEffect(() => {
    if (!startAt || stopped) return;
    const tick = () => {
      const mins = Math.floor((Date.now() - new Date(startAt).getTime()) / 60000);
      const secs = Math.floor((Date.now() - new Date(startAt).getTime()) / 1000) % 60;
      setEl(mins > 0 ? fmtMins(mins) : `${secs}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startAt, stopped]);
  return el;
}

// ─────────────────────────────────────────────────────────────
// HERO HEADER (matches Tasks HeroHeader style)
// ─────────────────────────────────────────────────────────────
function FocusHeroHeader({
  stats, todayTracked, streakDays, activeView
}: {
  stats: { todayMinutes: number; todaySessions: number; weekMinutes: number; currentStreak: number; totalMinutes: number };
  todayTracked: number;
  streakDays: { d: string; has: boolean }[];
  activeView: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    gsap.from(".focus-hero-text", {
      y: 40, opacity: 0, duration: 1, stagger: 0.08, ease: "power4.out", clearProps: "all"
    });
  }, { scope: containerRef });

  const STAT_CARDS = [
    { label: "Focus Today",  value: fmtMins(stats.todayMinutes),              sub: `${stats.todaySessions} sessions`, color: "text-primary",       bg: "bg-primary/10",   border: "border-primary/20"     },
    { label: "Tracked Today",value: fmtMins(todayTracked),                    sub: "time logged",                     color: "text-emerald-400",   bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
    { label: "This Week",    value: fmtMins(stats.weekMinutes),               sub: "focus minutes",                   color: "text-violet-400",    bg: "bg-violet-500/10",  border: "border-violet-500/20"  },
    { label: "Streak",       value: `${stats.currentStreak}d`,                sub: stats.currentStreak >= 3 ? "🔥 on fire" : "keep going",          color: "text-amber-400", bg: "bg-amber-500/10",   border: "border-amber-500/20"   },
  ];

  return (
    <div ref={containerRef} className="px-8 md:px-16 pt-8 pb-10 w-full text-center">
      {/* Big headline */}
      <p className="focus-hero-text text-sm font-bold tracking-[0.2em] uppercase text-muted-foreground mb-4">
        {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
      </p>
      <h1 className="focus-hero-text text-5xl md:text-7xl font-black tracking-tighter text-foreground mb-4 leading-none">
        {activeView === "focus" ? (
          <>Stay in<span className="text-primary"> Flow.</span></>
        ) : (
          <>Your <span className="text-emerald-400">Time</span> Log.</>
        )}
      </h1>
      <p className="focus-hero-text text-base text-muted-foreground mb-10 max-w-md mx-auto">
        {activeView === "focus"
          ? `${stats.todaySessions} sessions completed today · ${fmtMins(stats.todayMinutes)} deep work`
          : `${fmtMins(todayTracked)} tracked today across all activities`}
      </p>

      {/* Stat bento row */}
      <div className="focus-hero-text flex flex-wrap justify-center gap-4 mb-8">
        {STAT_CARDS.map(({ label, value, sub, color, bg, border }) => (
          <div key={label} className={cn("flex flex-col items-center px-6 py-4 rounded-2xl border backdrop-blur-sm", bg, border)}>
            <span className={cn("text-3xl font-black tabular-nums", color)}>{value}</span>
            <span className="text-xs font-semibold text-foreground mt-0.5">{label}</span>
            <span className="text-[10px] text-muted-foreground mt-0.5">{sub}</span>
          </div>
        ))}
      </div>

      {/* 14-day streak dots */}
      <div className="focus-hero-text flex justify-center gap-1.5">
        {streakDays.map(({ d, has }) => (
          <div
            key={d}
            title={d}
            className={cn(
              "w-3 h-3 rounded-full transition-all",
              has ? "bg-primary shadow-[0_0_6px_rgba(var(--primary),0.6)]" : "bg-muted"
            )}
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// RING TIMER (central focus element)
// ─────────────────────────────────────────────────────────────
function RingTimer({
  secondsLeft, totalSeconds, state, goal, onGoalChange,
  onStart, onPause, onResume, onCancel, onInterrupt, onSkipBreak,
  interruptCount, tasks, selTask, onTaskChange, focusMins, onFocusMinsChange,
  doneCount, sessionsBeforeLong
}: {
  secondsLeft: number; totalSeconds: number; state: string;
  goal: string; onGoalChange: (v: string) => void;
  onStart: () => void; onPause: () => void; onResume: () => void;
  onCancel: () => void; onInterrupt: () => void; onSkipBreak: () => void;
  interruptCount: number; tasks: any[];
  selTask: string; onTaskChange: (v: string) => void;
  focusMins: number; onFocusMinsChange: (v: number) => void;
  doneCount: number; sessionsBeforeLong: number;
}) {
  const r = 130;
  const circ = 2 * Math.PI * r;
  const progress = totalSeconds > 0 ? (totalSeconds - secondsLeft) / totalSeconds : 0;
  const offset = circ * (1 - progress);

  const isIdle = state === "idle";
  const isFocusing = state === "focusing";
  const isPaused = state === "paused";
  const isBreak = state === "break";

  const ringColor = isFocusing ? "hsl(var(--primary))" : isBreak ? "#22c55e" : isPaused ? "#f59e0b" : "hsl(var(--border))";
  const stateLabel = isIdle ? "ready" : isFocusing ? "deep work" : isPaused ? "paused" : "break";

  return (
    <div className="flex flex-col items-center gap-8">
      {/* The ring */}
      <div className="relative flex items-center justify-center" style={{ width: 300, height: 300 }}>
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 300 300">
          <circle cx="150" cy="150" r={r} fill="none" strokeWidth="6" stroke="hsl(var(--border))" strokeOpacity="0.3" />
          <circle
            cx="150" cy="150" r={r} fill="none" strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            stroke={ringColor}
            style={{ transition: "stroke-dashoffset 1s linear, stroke 0.5s ease" }}
          />
        </svg>

        <div className="flex flex-col items-center select-none z-10">
          <span className="text-6xl font-mono font-black tabular-nums tracking-tighter leading-none">
            {formatSecs(secondsLeft)}
          </span>
          <span className="text-xs font-bold tracking-[0.2em] uppercase text-muted-foreground mt-3">
            {stateLabel}
          </span>
          {/* Pomodoro dots */}
          <div className="flex gap-2 mt-4">
            {Array.from({ length: sessionsBeforeLong }).map((_, i) => (
              <div key={i} className={cn(
                "w-2.5 h-2.5 rounded-full transition-all duration-300",
                i < (doneCount % sessionsBeforeLong) ? "bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.6)]" : "bg-border"
              )} />
            ))}
          </div>
        </div>
      </div>

      {/* Goal / intention input */}
      {isIdle && (
        <input
          value={goal}
          onChange={(e) => onGoalChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onStart()}
          placeholder="What's your intention for this session?"
          className="w-full max-w-sm text-center bg-transparent border-b-2 border-border/40 pb-2 text-sm text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors placeholder:text-muted-foreground/30"
        />
      )}
      {(isFocusing || isPaused) && goal && (
        <p className="text-sm italic text-muted-foreground text-center max-w-xs">"{goal}"</p>
      )}

      {/* Task picker (idle) */}
      {isIdle && (
        <div className="flex items-center gap-3 w-full max-w-sm">
          <select
            value={selTask}
            onChange={(e) => onTaskChange(e.target.value)}
            className="flex-1 bg-muted/30 border border-border/40 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
          >
            <option value="">— No task —</option>
            {tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>

          {/* Duration pills */}
          <div className="flex gap-1">
            {[25, 45, 60].map(m => (
              <button
                key={m}
                onClick={() => onFocusMinsChange(m)}
                className={cn(
                  "px-3 py-2 rounded-xl text-xs font-bold transition-all",
                  focusMins === m ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
                )}
              >{m}m</button>
            ))}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-4">
        {isIdle && (
          <button
            onClick={onStart}
            className="flex items-center gap-2 px-10 py-4 rounded-2xl bg-primary text-primary-foreground font-bold text-base shadow-[0_8px_32px_-8px_hsl(var(--primary)/0.5)] hover:brightness-110 hover:scale-[1.02] active:scale-100 transition-all"
          >
            <Play fill="currentColor" size={20} />
            Start Focus
          </button>
        )}

        {isFocusing && (
          <>
            <button
              onClick={onPause}
              className="flex items-center justify-center w-14 h-14 rounded-2xl bg-muted border border-border/50 hover:bg-muted/70 text-foreground transition-all hover:scale-105"
            >
              <Pause fill="currentColor" size={20} />
            </button>
            <button
              onClick={onInterrupt}
              title="Log interruption"
              className="relative flex items-center justify-center w-14 h-14 rounded-2xl border border-amber-500/30 text-amber-500 hover:bg-amber-500/10 transition-all hover:scale-105"
            >
              <AlertCircle size={20} />
              {interruptCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-amber-500 text-black text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full">
                  {interruptCount}
                </span>
              )}
            </button>
            <button
              onClick={onCancel}
              className="flex items-center justify-center w-14 h-14 rounded-2xl bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all hover:scale-105"
            >
              <Square fill="currentColor" size={18} />
            </button>
          </>
        )}

        {isPaused && (
          <>
            <button
              onClick={onResume}
              className="flex items-center gap-2 px-8 py-4 rounded-2xl bg-primary text-primary-foreground font-bold shadow-[0_8px_32px_-8px_hsl(var(--primary)/0.5)] hover:brightness-110 hover:scale-[1.02] transition-all"
            >
              <Play fill="currentColor" size={18} />
              Resume
              <kbd className="text-[10px] font-mono opacity-60">Space</kbd>
            </button>
            <button
              onClick={onCancel}
              className="flex items-center justify-center w-14 h-14 rounded-2xl bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all"
            >
              <Square fill="currentColor" size={18} />
            </button>
          </>
        )}

        {isBreak && (
          <button
            onClick={onSkipBreak}
            className="px-8 py-4 rounded-2xl border border-border font-bold hover:bg-muted transition-all"
          >
            Skip Break →
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SESSION HISTORY PANEL (right sidebar on Focus tab)
// ─────────────────────────────────────────────────────────────
function SessionPanel({ sessions }: { sessions: any[] }) {
  const MOOD_EMOJI: Record<number, string> = { 1: "😩", 2: "😕", 3: "😐", 4: "🙂", 5: "😄" };

  const recent = sessions
    .filter(s => s.type === "focus" && s.completedAt)
    .sort((a, b) => (b.startedAt ?? b.createdAt).localeCompare(a.startedAt ?? a.createdAt))
    .slice(0, 12);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 py-5 border-b border-border/40 shrink-0">
        <h3 className="text-sm font-bold tracking-wider uppercase text-muted-foreground">
          Session History
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto">
        {recent.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground/30 gap-3">
            <Target size={32} />
            <p className="text-sm">No sessions yet.</p>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {recent.map(s => (
              <div
                key={s.id}
                className="group flex items-start gap-3 p-3 rounded-2xl hover:bg-muted/50 transition-colors"
              >
                <div className={cn(
                  "mt-0.5 w-2 h-2 rounded-full shrink-0",
                  s.type === "focus" ? "bg-primary" : "bg-emerald-500"
                )} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground truncate">
                      {s.goal ? `"${s.goal.slice(0, 32)}${s.goal.length > 32 ? "…" : ""}"` : "Focus session"}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums font-mono">
                      {s.actualMinutes ? `${s.actualMinutes}m` : "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">
                      {s.startedAt ? new Date(s.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                    </span>
                    {s.mood && <span className="text-[11px]">{MOOD_EMOJI[s.mood]}</span>}
                    {(s.interruptCount ?? 0) > 0 && (
                      <span className="text-[10px] text-amber-500 flex items-center gap-0.5">
                        <AlertCircle size={9} />{s.interruptCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TIME ENTRY CARD (inspired by TaskCard bento style)
// ─────────────────────────────────────────────────────────────
function TimeEntryCard({
  entry, isActive, liveDur, projects, tasks, onDelete, onStop
}: {
  entry: TimeEntry; isActive: boolean; liveDur: string;
  projects: any[]; tasks: any[];
  onDelete: () => void; onStop: () => void;
}) {
  const project = entry.projectId ? projects.find(p => p.id === entry.projectId) : null;
  const task    = entry.taskId    ? tasks.find(t => t.id === entry.taskId)        : null;
  const dur     = isActive ? liveDur : entry.durationMinutes ? fmtMins(entry.durationMinutes) : "—";
  const ref     = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    gsap.from(ref.current, { y: 20, opacity: 0, duration: 0.4, ease: "back.out(1.2)", clearProps: "all" });
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        "group relative p-4 rounded-2xl border transition-all duration-300",
        "hover:shadow-[0_4px_24px_-8px_rgba(0,0,0,0.15)] hover:scale-[1.01]",
        isActive
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-border/50 bg-card hover:border-border"
      )}
    >
      {isActive && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Live</span>
        </div>
      )}

      <div className="flex items-start gap-3 pr-16">
        {project && (
          <div
            className="w-3 h-3 rounded-full shrink-0 mt-1"
            style={{ backgroundColor: project.color }}
          />
        )}
        <div className="flex-1 min-w-0">
          <p className={cn("text-sm font-semibold leading-tight", !entry.description && "text-muted-foreground italic")}>
            {entry.description || "No description"}
          </p>
          {task && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">↳ {task.title}</p>
          )}
          {project && (
            <p className="text-xs mt-0.5 font-medium" style={{ color: project.color }}>
              {project.name}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-3">
        <span className="text-[10px] text-muted-foreground font-mono">
          {fmtClock(entry.startAt)} {entry.endAt ? `– ${fmtClock(entry.endAt)}` : "→ now"}
        </span>
        <span className={cn("text-base font-black tabular-nums", isActive ? "text-emerald-500" : "text-foreground")}>
          {dur}
        </span>
      </div>

      {/* Hover actions */}
      <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {isActive && (
          <button
            onClick={onStop}
            className="p-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
          >
            <Square size={12} fill="currentColor" />
          </button>
        )}
        {!isActive && (
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// QUICK TRACK BAR (top of tracker view)
// ─────────────────────────────────────────────────────────────
function QuickTrackBar({ tasks, activeEntry, liveDur, onStart, onStop }: {
  tasks: any[]; activeEntry: TimeEntry | null; liveDur: string;
  onStart: (desc: string, taskId?: string) => void;
  onStop: () => void;
}) {
  const [desc, setDesc] = useState("");
  const [taskId, setTaskId] = useState("");

  const handleStart = () => {
    onStart(desc, taskId || undefined);
    setDesc(""); setTaskId("");
  };

  return (
    <div className={cn(
      "sticky top-0 z-10 px-8 py-5 border-b border-border/40 bg-card/80 backdrop-blur-md",
      activeEntry ? "bg-emerald-500/5 border-emerald-500/20" : ""
    )}>
      {activeEntry ? (
        /* Active state — big live display */
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold tracking-wider uppercase text-emerald-500 mb-1">Currently tracking</p>
            <p className="text-lg font-bold text-foreground">
              {activeEntry.description || "No description"}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-3xl font-black tabular-nums text-emerald-500">{liveDur}</span>
            <button
              onClick={onStop}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-destructive/10 text-destructive border border-destructive/20 font-bold hover:bg-destructive/20 transition-all"
            >
              <Square fill="currentColor" size={14} /> Stop
            </button>
          </div>
        </div>
      ) : (
        /* Idle state — input bar */
        <div className="flex items-center gap-3">
          <input
            value={desc}
            onChange={e => setDesc(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleStart()}
            placeholder="What are you working on?"
            className="flex-1 bg-transparent text-lg font-semibold placeholder:text-muted-foreground/30 focus:outline-none"
          />
          <select
            value={taskId}
            onChange={e => setTaskId(e.target.value)}
            className="bg-muted/30 border border-border/40 rounded-xl px-3 py-2 text-sm focus:outline-none max-w-[180px] text-muted-foreground"
          >
            <option value="">No task</option>
            {tasks.filter(t => t.status !== "done").map(t => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
          <button
            onClick={handleStart}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary text-primary-foreground font-bold hover:brightness-110 hover:scale-[1.02] transition-all shadow-lg shadow-primary/20"
          >
            <Play fill="currentColor" size={14} /> Start
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN MODULE
// ─────────────────────────────────────────────────────────────
export default function FocusModule() {
  const { load: loadFocus, sessions, activeSession, secondsLeft,
    stats, pendingGoal, setGoal, startFocus, pause, resume, cancel,
    startBreak, skipBreak, incrementInterrupt, completedFocusCount
  } = useFocusStore();

  const { load: loadTime, entries, activeEntryId, startTimer, stopTimer, deleteEntry } = useTimeStore();
  const { loadTasks, tasks } = useTaskStore();
  const { loadProjects, projects } = useProjectStore();

  useEffect(() => {
    setupTimeEventListeners();
    void loadFocus(); void loadTime(); void loadTasks(); void loadProjects();
  }, [loadFocus, loadTime, loadTasks, loadProjects]);

  const [activeView, setActiveView] = useState<"focus" | "tracker">(() =>
    (localStorage.getItem("focus_module_view") as any) || "focus"
  );
  const [focusMins, setFocusMins] = useState(25);
  const [selTask, setSelTask] = useState("");

  useEffect(() => { localStorage.setItem("focus_module_view", activeView); }, [activeView]);

  // Spacebar handler
  useEffect(() => {
    const state = activeSession?.state;
    if (!state || state === "break") return;
    const h = (e: KeyboardEvent) => {
      if (e.code === "Space" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement)?.contentEditable === "true")) {
        e.preventDefault();
        if (state === "focusing") pause();
        else if (state === "paused") resume();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [activeSession?.state, pause, resume]);

  // GSAP view transition
  const mainRef = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    gsap.from(".view-panel", { y: 24, opacity: 0, duration: 0.45, ease: "power3.out", clearProps: "all" });
  }, [activeView]);

  const state = activeSession?.state ?? "idle";
  const totalSecs = activeSession ? (activeSession.plannedMinutes ?? focusMins) * 60 : focusMins * 60;
  const dispSecs = state === "idle" ? totalSecs : secondsLeft;
  const sessionsBeforeLong = 4;

  const activeEntry = entries.find(e => e.id === activeEntryId);
  const liveDur = useLiveDuration(activeEntry?.startAt, !activeEntry);

  const todayEntries = entries.filter(e => e.startAt.startsWith(today()));
  const todayTracked = todayEntries.filter(e => e.durationMinutes).reduce((a, e) => a + (e.durationMinutes ?? 0), 0);

  const openTasks = tasks.filter(t => t.status !== "done" && t.status !== "archived");

  const streakDays = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const has = sessions.some(s => s.type === "focus" && s.completedAt && (s.startedAt ?? s.createdAt).startsWith(d));
    return { d, has };
  }).reverse();

  const groupedEntries = groupByDate(
    [...entries].sort((a, b) => b.startAt.localeCompare(a.startAt))
  );

  return (
    <main ref={mainRef} className="w-full h-full flex flex-col overflow-hidden bg-background text-foreground">

      {/* ── Top glass nav (same pattern as Tasks/Projects) ───── */}
      <div className="shrink-0 pt-6 flex justify-center z-50">
        <div className="flex items-center gap-2 p-2 bg-card/70 backdrop-blur-xl border border-border/50 rounded-full shadow-2xl">
          <button
            onClick={() => setActiveView("focus")}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-300",
              activeView === "focus"
                ? "bg-foreground text-background shadow-md scale-105"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <Target size={15} /> Focus
          </button>
          <button
            onClick={() => setActiveView("tracker")}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-300",
              activeView === "tracker"
                ? "bg-foreground text-background shadow-md scale-105"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <Clock size={15} /> Tracker
          </button>
        </div>
      </div>

      {/* ── Hero header ──────────────────────────────────────── */}
      <FocusHeroHeader
        stats={stats}
        todayTracked={todayTracked}
        streakDays={streakDays}
        activeView={activeView}
      />

      {/* ── Content area ─────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden px-4 pb-4 view-panel">

        {/* FOCUS VIEW */}
        {activeView === "focus" && (
          <div className="flex gap-4 h-full">

            {/* Center: timer */}
            <div className="flex-1 rounded-3xl border border-border/40 bg-card/50 backdrop-blur-md flex items-center justify-center overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
              <RingTimer
                secondsLeft={dispSecs}
                totalSeconds={totalSecs}
                state={state}
                goal={activeSession?.goal ?? pendingGoal}
                onGoalChange={setGoal}
                onStart={() => void startFocus({
                  taskId: selTask || undefined,
                  config: { focusMinutes: focusMins, shortBreakMinutes: 5, longBreakMinutes: 15, sessionsBeforeLongBreak: sessionsBeforeLong }
                })}
                onPause={() => pause()}
                onResume={resume}
                onCancel={() => void cancel()}
                onInterrupt={() => incrementInterrupt?.()}
                onSkipBreak={skipBreak}
                interruptCount={activeSession?.interruptCount ?? 0}
                tasks={openTasks}
                selTask={selTask}
                onTaskChange={setSelTask}
                focusMins={focusMins}
                onFocusMinsChange={setFocusMins}
                doneCount={completedFocusCount}
                sessionsBeforeLong={sessionsBeforeLong}
              />
            </div>

            {/* Right: session history */}
            <div className="hidden lg:block w-[280px] shrink-0 rounded-3xl border border-border/40 bg-card/30 backdrop-blur-md overflow-hidden">
              <SessionPanel sessions={sessions} />
            </div>

          </div>
        )}

        {/* TRACKER VIEW */}
        {activeView === "tracker" && (
          <div className="flex flex-col rounded-3xl border border-border/40 bg-card/50 backdrop-blur-md overflow-hidden h-full">

            <QuickTrackBar
              tasks={openTasks}
              activeEntry={activeEntry ?? null}
              liveDur={liveDur}
              onStart={(desc, tid) => void startTimer({ description: desc || undefined, taskId: tid })}
              onStop={() => void stopTimer()}
            />

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {groupedEntries.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground/30 gap-4">
                  <Clock size={48} />
                  <p className="text-lg font-semibold">No time entries yet.</p>
                  <p className="text-sm">Start a timer above to begin tracking.</p>
                </div>
              ) : (
                groupedEntries.map(([date, dayEntries]) => {
                  const dayTotal = dayEntries.reduce((a, e) => a + (e.durationMinutes ?? 0), 0);
                  return (
                    <div key={date} className="space-y-3">
                      <div className="flex items-center justify-between px-1">
                        <h3 className="text-xs font-black tracking-[0.15em] uppercase text-muted-foreground">
                          {dayLabel(date)}
                        </h3>
                        <span className="text-xs font-bold text-foreground tabular-nums">
                          {fmtMins(dayTotal)}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {dayEntries.map(e => (
                          <TimeEntryCard
                            key={e.id}
                            entry={e}
                            isActive={e.id === activeEntryId}
                            liveDur={liveDur}
                            projects={projects}
                            tasks={tasks}
                            onDelete={() => void deleteEntry(e.id)}
                            onStop={() => void stopTimer()}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        )}

      </div>
    </main>
  );
}
