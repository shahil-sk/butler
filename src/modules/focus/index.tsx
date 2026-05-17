// ============================================================
// FOCUS — MODULE ROOT
// Lazy-loaded. Registers manifest on first mount.
//
// New in v2:
//   - Goal/intention input before starting
//   - Session notes textarea during active session
//   - Post-session mood rating (1–5)
//   - Stats panel: today mins, sessions, streak, week total
//   - Task display: shows priority + due date in selector
//   - History: grouped by date, shows goal + interrupts + mood
//   - Listens to _pendingTaskId from events.ts for deep-link
//   - "Focus this task" accepts focus:start-requested via events
// ============================================================

import { useEffect, useState, useRef } from "react";
import { RichEditor } from "@/shared/RichEditor";
import { registry } from "@/kernel/router";
import { focusManifest } from "./manifest";
import { useFocusStore } from "./store";
import { useFocusEventListeners } from "./events";
import { useTaskStore } from "@/modules/tasks/store";
import { useProjectStore } from "@/modules/projects/store";
import { useShellStore } from "@/shell/store";
import { PageHeader, EmptyState, PriorityDot, ProjectDot } from "@/shared/ui";
import { cn, formatDate } from "@/shared/utils";
import type { FocusSession, Task } from "@/shared/types";

registry.register(focusManifest);

// ── Constants ─────────────────────────────────────────────────────────────────

const MOOD_LABELS: Record<number, string> = {
  1: "😩", 2: "😕", 3: "😐", 4: "🙂", 5: "😄",
};

const MOOD_DESCRIPTIONS: Record<number, string> = {
  1: "Terrible", 2: "Rough", 3: "Okay", 4: "Good", 5: "Great",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function sessionLabel(type: FocusSession["type"]): string {
  switch (type) {
    case "focus":       return "Focus";
    case "short_break": return "Short Break";
    case "long_break":  return "Long Break";
  }
}

function groupSessionsByDate(sessions: FocusSession[]): Array<{ date: string; sessions: FocusSession[] }> {
  const map = new Map<string, FocusSession[]>();
  for (const s of sessions) {
    const d = s.startedAt?.slice(0, 10) ?? s.createdAt.slice(0, 10);
    if (!map.has(d)) map.set(d, []);
    map.get(d)!.push(s);
  }
  return Array.from(map.entries()).map(([date, sessions]) => ({ date, sessions }));
}

function formatDateLabel(dateStr: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (dateStr === today) return "Today";
  if (dateStr === yesterday) return "Yesterday";
  return new Date(dateStr).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function isOverdue(task: Task): boolean {
  if (!task.dueDate) return false;
  return task.dueDate < new Date().toISOString().slice(0, 10);
}

// ── Ring SVG ─────────────────────────────────────────────────────────────────

function RingTimer({
  secondsLeft,
  totalSeconds,
  state,
}: {
  secondsLeft:  number;
  totalSeconds: number;
  state:        FocusSession["state"] | "idle";
}) {
  const radius        = 90;
  const circumference = 2 * Math.PI * radius;
  const progress      = totalSeconds > 0 ? (totalSeconds - secondsLeft) / totalSeconds : 0;
  const dashOffset    = circumference * (1 - progress);

  const ringColor =
    state === "break"    ? "stroke-emerald-500" :
    state === "paused"   ? "stroke-amber-500"   :
    state === "focusing" ? "stroke-primary"      :
    "stroke-border";

  return (
    <div className="relative flex items-center justify-center w-56 h-56">
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 220 220">
        {/* Track */}
        <circle
          cx="110" cy="110" r={radius}
          fill="none" strokeWidth="8"
          className="stroke-border"
        />
        {/* Progress */}
        <circle
          cx="110" cy="110" r={radius}
          fill="none" strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className={cn("transition-[stroke-dashoffset] duration-1000 ease-linear", ringColor)}
        />
      </svg>
      <div className="flex flex-col items-center select-none">
        <span className="text-5xl font-mono font-semibold tabular-nums leading-none">
          {formatTime(secondsLeft)}
        </span>
        <span className="text-xs text-muted-foreground mt-2 capitalize tracking-wide">
          {state === "idle" ? "ready" : state === "break" ? "break" : state}
        </span>
      </div>
    </div>
  );
}

// ── Stats bar ─────────────────────────────────────────────────────────────────

function StatsBar() {
  const stats = useFocusStore((s) => s.stats);

  return (
    <div className="flex gap-6">
      <StatPill label="Today" value={`${stats.todayMinutes}m`} sub={`${stats.todaySessions} session${stats.todaySessions !== 1 ? "s" : ""}`} />
      <StatPill label="This week" value={`${stats.weekMinutes}m`} />
      <StatPill label="Streak" value={`${stats.currentStreak}d`} highlight={stats.currentStreak >= 3} />
      <StatPill label="All time" value={`${Math.round(stats.totalMinutes / 60)}h`} sub={`${stats.totalSessions} sessions`} />
    </div>
  );
}

function StatPill({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <span className={cn("text-lg font-semibold tabular-nums", highlight && "text-primary")}>
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
      {sub && <span className="text-[10px] text-muted-foreground/70">{sub}</span>}
    </div>
  );
}

// ── Mood picker ───────────────────────────────────────────────────────────────

function MoodPicker({
  sessionId,
  currentMood,
}: {
  sessionId: string;
  currentMood?: number;
}) {
  const setSessionMood  = useFocusStore((s) => s.setSessionMood);
  const clearLast       = useFocusStore((s) => s.clearLastCompleted);
  const [selected, setSelected] = useState<number | null>(currentMood ?? null);

  function pick(m: number) {
    setSelected(m);
    void setSessionMood(sessionId, m as 1|2|3|4|5);
    setTimeout(clearLast, 800);
  }

  return (
    <div className="flex flex-col items-center gap-3 p-4 bg-accent/40 rounded-xl border border-border w-full max-w-xs">
      <p className="text-sm font-medium">How was that session?</p>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((m) => (
          <button
            key={m}
            onClick={() => pick(m)}
            title={MOOD_DESCRIPTIONS[m]}
            className={cn(
              "text-2xl w-10 h-10 rounded-lg transition-all hover:scale-110",
              selected === m
                ? "bg-primary/20 ring-2 ring-primary"
                : "hover:bg-accent"
            )}
          >
            {MOOD_LABELS[m]}
          </button>
        ))}
      </div>
      {selected && (
        <p className="text-xs text-muted-foreground">{MOOD_DESCRIPTIONS[selected]} · saved</p>
      )}
    </div>
  );
}

// ── Task selector ─────────────────────────────────────────────────────────────
// Richer than a plain <select>: shows priority dot + due date

function TaskSelector({
  value,
  tasks,
  disabled,
  onChange,
}: {
  value:    string;
  tasks:    Task[];
  disabled: boolean;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = tasks.find((t) => t.id === value);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm text-left",
          "bg-background hover:bg-accent transition-colors focus:outline-none focus:ring-1 focus:ring-primary",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
      >
        {selected ? (
          <>
            <PriorityDot priority={selected.priority} />
            <span className="flex-1 truncate">{selected.title}</span>
            {selected.dueDate && (
              <span className={cn(
                "text-xs shrink-0",
                isOverdue(selected) ? "text-destructive" : "text-muted-foreground"
              )}>
                {isOverdue(selected) ? "overdue" : selected.dueDate}
              </span>
            )}
          </>
        ) : (
          <span className="text-muted-foreground">— No task —</span>
        )}
      </button>

      {open && (
        <div className="absolute top-full mt-1 w-full z-50 bg-popover border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
          <button
            onClick={() => { onChange(""); setOpen(false); }}
            className="w-full px-3 py-2 text-sm text-left hover:bg-accent text-muted-foreground"
          >
            — No task —
          </button>
          {tasks.map((t) => (
            <button
              key={t.id}
              onClick={() => { onChange(t.id); setOpen(false); }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent transition-colors",
                t.id === value && "bg-accent"
              )}
            >
              <PriorityDot priority={t.priority} />
              <span className="flex-1 truncate">{t.title}</span>
              {t.dueDate && (
                <span className={cn(
                  "text-xs shrink-0",
                  isOverdue(t) ? "text-destructive font-medium" : "text-muted-foreground"
                )}>
                  {isOverdue(t) ? "overdue" : t.dueDate}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Session notes area ────────────────────────────────────────────────────────

function SessionNotesArea() {
  const active          = useFocusStore((s) => s.activeSession);
  const setSessionNotes = useFocusStore((s) => s.setSessionNotes);

  if (!active || active.type !== "focus") return null;

  return (
    <div className="w-full max-w-xs">
      <label className="block text-xs text-muted-foreground mb-1">Session notes</label>
      <RichEditor
        content={active.notes ?? ""}
        onChange={(json) => setSessionNotes(json)}
        placeholder="What are you working through?"
        resetKey={active.id}
        minHeight="min-h-[80px]"
        debounceMs={600}
        className="text-sm"
      />
    </div>
  );
}

// ── Duration selector ─────────────────────────────────────────────────────────

function DurationSelect({
  label, value, options, onChange, disabled,
}: {
  label:    string;
  value:    number;
  options:  number[];
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  return (
    <label className="flex flex-col items-center gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <select
        className="bg-background border border-border rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
      >
        {options.map((m) => (
          <option key={m} value={m}>{m}m</option>
        ))}
      </select>
    </label>
  );
}

// ── History row ───────────────────────────────────────────────────────────────

function HistoryRow({ session }: { session: FocusSession }) {
  const tasks    = useTaskStore((s) => s.tasks);
  const projects = useProjectStore((s) => s.projects);
  const task     = session.taskId    ? tasks.find((t) => t.id === session.taskId)       : null;
  const project  = session.projectId ? projects.find((p) => p.id === session.projectId) : null;

  const mins = session.actualMinutes ?? session.plannedMinutes;
  const done = !!session.completedAt && session.actualMinutes === session.plannedMinutes;

  const isBreak = session.type !== "focus";

  return (
    <div className={cn(
      "py-2 border-b border-border/50 text-xs",
      isBreak && "opacity-50"
    )}>
      <div className="flex items-center gap-2">
        <span className={cn(
          "w-2 h-2 rounded-full shrink-0",
          isBreak       ? "bg-emerald-400" :
          done          ? "bg-primary"      :
          "bg-muted-foreground/30"
        )} />
        <span className="flex-1 truncate font-medium">
          {isBreak ? sessionLabel(session.type) : (task?.title ?? "No task")}
        </span>
        <span className="text-muted-foreground shrink-0">{mins}m</span>
        {session.mood && (
          <span title={MOOD_DESCRIPTIONS[session.mood]}>{MOOD_LABELS[session.mood]}</span>
        )}
      </div>
      {project && !isBreak && (
        <div className="flex items-center gap-1.5 ml-4 mt-0.5">
          <ProjectDot color={project.color} />
          <span className="text-muted-foreground truncate">{project.name}</span>
        </div>
      )}
      {session.goal && !isBreak && (
        <p className="ml-4 mt-0.5 text-muted-foreground italic truncate">"{session.goal}"</p>
      )}
      {(session.interruptCount ?? 0) > 0 && !isBreak && (
        <p className="ml-4 mt-0.5 text-amber-500/80">
          {session.interruptCount} interrupt{(session.interruptCount ?? 0) > 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}

// ── History panel ─────────────────────────────────────────────────────────────

function HistoryPanel({ sessions }: { sessions: FocusSession[] }) {
  const grouped = groupSessionsByDate(sessions);

  return (
    <div className="w-72 border-l border-border flex flex-col shrink-0">
      <div className="px-4 py-3 border-b border-border">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          History
        </span>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {grouped.length === 0 ? (
          <EmptyState
            message="No sessions yet"
            description="Start your first focus session."
          />
        ) : (
          grouped.map(({ date, sessions: daySessions }) => (
            <div key={date} className="mb-4">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider py-1.5">
                {formatDateLabel(date)}
              </p>
              {daySessions.map((s) => <HistoryRow key={s.id} session={s} />)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function FocusModule() {
  useFocusEventListeners();

  const load         = useFocusStore((s) => s.load);
  const sessions     = useFocusStore((s) => s.sessions);
  const active       = useFocusStore((s) => s.activeSession);
  const secondsLeft  = useFocusStore((s) => s.secondsLeft);
  const completedFocusCount    = useFocusStore((s) => s.completedFocusCount);
  const lastCompletedSession   = useFocusStore((s) => s.lastCompletedSession);
  const pendingGoal  = useFocusStore((s) => s.pendingGoal);

  const startFocus   = useFocusStore((s) => s.startFocus);
  const pause        = useFocusStore((s) => s.pause);
  const resume       = useFocusStore((s) => s.resume);
  const cancel       = useFocusStore((s) => s.cancel);
  const startBreak   = useFocusStore((s) => s.startBreak);
  const skipBreak    = useFocusStore((s) => s.skipBreak);
  const setTaskId    = useFocusStore((s) => s.setTaskId);
  const setProjectId = useFocusStore((s) => s.setProjectId);
  const setGoal      = useFocusStore((s) => s.setGoal);

  const tasks        = useTaskStore((s) => s.tasks);
  const loadTasks    = useTaskStore((s) => s.loadTasks);
  const projects     = useProjectStore((s) => s.projects);
  const loadProjects = useProjectStore((s) => s.loadProjects);
  const settings     = useShellStore((s) => s.settings);

  // Duration config from AppSettings
  const [focusMins,      setFocusMins]      = useState(() => settings?.focusModePomodoroMinutes       ?? 25);
  const [shortBreakMins, setShortBreakMins] = useState(() => settings?.focusModeShortBreakMinutes     ?? 5);
  const [longBreakMins,  setLongBreakMins]  = useState(() => settings?.focusModeLongBreakMinutes      ?? 15);
  const sessionsBeforeLong = settings?.focusModeSessionsBeforeLongBreak ?? 4;

  const [selectedTaskId,    setSelectedTaskId]    = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");

  useEffect(() => { void load(); void loadTasks(); void loadProjects(); }, [load, loadTasks, loadProjects]);

  // Sync selectors with active session
  useEffect(() => {
    if (active?.taskId)    setSelectedTaskId(active.taskId);
    if (active?.projectId) setSelectedProjectId(active.projectId);
  }, [active?.taskId, active?.projectId]);

  // Pick up deep-link pre-selection from events.ts (_pendingTaskId)
  useEffect(() => {
    const unsub = useFocusStore.subscribe((state) => {
      const pending = (state as Record<string, unknown>)._pendingTaskId as string | undefined;
      if (pending && !state.activeSession) {
        setSelectedTaskId(pending);
        // Clear it
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
  const isActive   = !isIdle;

  const totalSecs   = active ? active.plannedMinutes * 60 : focusMins * 60;
  const displaySecs = isIdle ? focusMins * 60 : secondsLeft;

  // Filter lists
  const openTasks = tasks.filter(
    (t) => t.status !== "done" && t.status !== "archived" && t.status !== "cancelled"
  ).sort((a, b) => {
    // Sort: overdue first, then by priority weight
    const aOver = isOverdue(a) ? 0 : 1;
    const bOver = isOverdue(b) ? 0 : 1;
    if (aOver !== bOver) return aOver - bOver;
    const pWeight = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };
    return (pWeight[a.priority] ?? 4) - (pWeight[b.priority] ?? 4);
  });

  const activeProjects = projects.filter((p) => p.status === "active");

  // Auto-populate project from task
  function handleTaskChange(id: string) {
    setSelectedTaskId(id);
    if (active) setTaskId(id || undefined);
    // Always auto-select project from task; clear project if task has none
    const matchedTask = id ? tasks.find((t) => t.id === id) : null;
    const derivedProjectId = matchedTask?.projectId ?? "";
    setSelectedProjectId(derivedProjectId);
    if (active) setProjectId(derivedProjectId || undefined);
  }

  function handleProjectChange(id: string) {
    setSelectedProjectId(id);
    if (active) setProjectId(id || undefined);
  }

  function handleStart() {
    void startFocus({
      taskId:    selectedTaskId    || undefined,
      projectId: selectedProjectId || undefined,
      config: {
        focusMinutes:            focusMins,
        shortBreakMinutes:       shortBreakMins,
        longBreakMinutes:        longBreakMins,
        sessionsBeforeLongBreak: sessionsBeforeLong,
      },
    });
  }

  function handleBreakAfterFocus() {
    const isLong = (completedFocusCount % sessionsBeforeLong) === 0 && completedFocusCount > 0;
    if (isLong) startBreak("long_break", longBreakMins);
    else        startBreak("short_break", shortBreakMins);
  }

  // Show break offer / mood rater after completion
  const showMoodRater     = !isActive && !!lastCompletedSession;
  const showBreakOffer    = !isActive && !showMoodRater && completedFocusCount > 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader title="Focus" count={sessions.filter((s) => s.type === "focus").length} />

      <div className="flex flex-1 overflow-hidden">

        {/* ── Left: Timer + controls ─────────────────────────────────── */}
        <div className="flex flex-col items-center justify-start flex-1 gap-5 px-8 py-6 overflow-y-auto">

          {/* Stats bar */}
          <StatsBar />

          {/* Ring */}
          <RingTimer
            secondsLeft={displaySecs}
            totalSeconds={totalSecs}
            state={isIdle ? "idle" : state}
          />

          {/* Mood rater — shown immediately after completion */}
          {showMoodRater && lastCompletedSession && (
            <MoodPicker
              sessionId={lastCompletedSession.id}
              currentMood={lastCompletedSession.mood}
            />
          )}

          {/* Break offer */}
          {showBreakOffer && (
            <div className="flex gap-3 text-sm">
              <span className="text-muted-foreground self-center">Session done!</span>
              <button
                onClick={handleBreakAfterFocus}
                className="px-4 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors text-sm"
              >
                Take a Break
              </button>
              <button
                onClick={handleStart}
                className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity text-sm"
              >
                Start Another
              </button>
            </div>
          )}

          {/* Goal input — idle only */}
          {isIdle && !showBreakOffer && !showMoodRater && (
            <div className="w-full max-w-xs">
              <label className="block text-xs text-muted-foreground mb-1">
                What's your intention? <span className="opacity-50">(optional)</span>
              </label>
              <input
                type="text"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50"
                placeholder="e.g. finish the auth flow"
                value={pendingGoal}
                onChange={(e) => setGoal(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleStart()}
                maxLength={120}
              />
            </div>
          )}

          {/* Task / Project selectors */}
          <div className="flex flex-col gap-2 w-full max-w-xs">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Task <span className="opacity-50">(optional)</span>
              </label>
              <TaskSelector
                value={selectedTaskId}
                tasks={openTasks}
                disabled={isBreak}
                onChange={handleTaskChange}
              />
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Project <span className="opacity-50">(optional)</span>
              </label>
              <select
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                value={selectedProjectId}
                onChange={(e) => handleProjectChange(e.target.value)}
                disabled={isBreak}
              >
                <option value="">— No project —</option>
                {activeProjects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Session notes — active focus session only */}
          <SessionNotesArea />

          {/* Duration pickers — idle only */}
          {isIdle && !showBreakOffer && !showMoodRater && (
            <div className="flex gap-4">
              <DurationSelect label="Focus"       value={focusMins}      options={[15, 20, 25, 30, 45, 50, 60]} onChange={setFocusMins}      disabled={false} />
              <DurationSelect label="Short break" value={shortBreakMins} options={[3, 5, 10]}                   onChange={setShortBreakMins} disabled={false} />
              <DurationSelect label="Long break"  value={longBreakMins}  options={[10, 15, 20, 30]}             onChange={setLongBreakMins}  disabled={false} />
            </div>
          )}

          {/* Pomodoro dots */}
          <div className="flex gap-1.5">
            {Array.from({ length: sessionsBeforeLong }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "w-2 h-2 rounded-full transition-colors",
                  i < (completedFocusCount % sessionsBeforeLong)
                    ? "bg-primary"
                    : "bg-border"
                )}
              />
            ))}
          </div>

          {/* Control buttons */}
          <div className="flex gap-3">
            {isIdle && !showBreakOffer && !showMoodRater && (
              <button
                onClick={handleStart}
                className="px-7 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
              >
                Start Focus
              </button>
            )}

            {isFocusing && (
              <>
                <button
                  onClick={pause}
                  className="px-5 py-2.5 rounded-lg border border-border hover:bg-accent transition-colors text-sm"
                >
                  Pause
                </button>
                <button
                  onClick={() => void cancel()}
                  className="px-5 py-2.5 rounded-lg border border-destructive text-destructive hover:bg-destructive/10 transition-colors text-sm"
                >
                  Stop
                </button>
              </>
            )}

            {isPaused && (
              <>
                <button
                  onClick={resume}
                  className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity text-sm"
                >
                  Resume
                </button>
                <button
                  onClick={() => void cancel()}
                  className="px-5 py-2.5 rounded-lg border border-destructive text-destructive hover:bg-destructive/10 transition-colors text-sm"
                >
                  Stop
                </button>
              </>
            )}

            {isBreak && (
              <>
                <span className="text-sm text-muted-foreground self-center">
                  {active?.type === "long_break" ? "Long break" : "Short break"}
                </span>
                <button
                  onClick={skipBreak}
                  className="px-5 py-2.5 rounded-lg border border-border hover:bg-accent transition-colors text-sm"
                >
                  Skip
                </button>
              </>
            )}
          </div>

          {/* Active session label */}
          {isActive && active && (
            <div className="flex flex-col items-center gap-0.5">
              <p className="text-xs text-muted-foreground">
                {sessionLabel(active.type)} · {active.plannedMinutes}m planned
              </p>
              {active.goal && (
                <p className="text-xs text-muted-foreground italic">"{active.goal}"</p>
              )}
              {(active.interruptCount ?? 0) > 0 && (
                <p className="text-xs text-amber-500">
                  {active.interruptCount} interruption{(active.interruptCount ?? 0) > 1 ? "s" : ""} this session
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Right: History ─────────────────────────────────────────── */}
        <HistoryPanel sessions={sessions} />

      </div>
    </div>
  );
}
