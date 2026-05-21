import { useEffect, useState } from "react";
import {
  Target, ChevronDown, ChevronUp, Pause, Play, Moon,
} from "lucide-react";
import { cn } from "@/shared/utils";
import { formatSeconds, formatDuration, stripHtml } from "@/shared/formatters";
import { RichEditor } from "@/shared/ui/RichEditor";
import { useFocusStore } from "@/modules/focus/store";
import { useFocusEventListeners } from "@/modules/focus/events";
import { useTaskStore } from "@/modules/tasks/store";
import { useProjectStore } from "@/modules/projects/store";
import { useShellStore } from "@/shell/store";
import { StreakHeatmap } from "./StreakHeatmap";
import { FocusHistorySidebar } from "./FocusHistorySidebar";
import type { FocusSession } from "@/shared/types";

// ── Internal helpers (focus-tab-only) ────────────────────────────────────────
const MOOD = { 1: "😩", 2: "😕", 3: "😐", 4: "🙂", 5: "😄" } as Record<number, string>;
const MOOD_DESC = { 1: "Terrible", 2: "Rough", 3: "Okay", 4: "Good", 5: "Great" } as Record<number, string>;

function isOverdue(t: { dueDate?: string | null }): boolean {
  return !!t.dueDate && t.dueDate < new Date().toISOString().slice(0, 10);
}

// ── MoodCard ─────────────────────────────────────────────────────────────────
function MoodCard({ sessionId, mood }: { sessionId: string; mood?: number }) {
  const setMood = useFocusStore((s) => s.setSessionMood);
  const clearLast = useFocusStore((s) => s.clearLastCompleted);
  const [sel, setSel] = useState<number | null>(mood ?? null);

  function pick(m: number) {
    setSel(m);
    void setMood(sessionId, m as 1 | 2 | 3 | 4 | 5);
    setTimeout(clearLast, 800);
  }

  return (
    <div
      className="flex flex-col items-center gap-3 w-full max-w-xs p-4 rounded-xl border"
      style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
    >
      <p className="text-sm font-medium">How was that session?</p>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((m) => (
          <button
            key={m}
            onClick={() => pick(m)}
            title={MOOD_DESC[m]}
            className={cn(
              "text-xl w-9 h-9 rounded-lg transition-all hover:scale-110 flex items-center justify-center",
              sel === m ? "ring-2 ring-primary" : "hover:bg-muted"
            )}
            style={sel === m ? { background: "hsl(var(--primary) / 0.12)" } : {}}
          >
            {MOOD[m]}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        {sel && <p className="text-[11px] text-muted-foreground">{MOOD_DESC[sel]} · saved</p>}
        <button
          onClick={clearLast}
          className="text-[11px] text-muted-foreground/60 hover:text-foreground transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

// ── RingTimer ────────────────────────────────────────────────────────────────
function RingTimer({
  secondsLeft,
  totalSeconds,
  state,
}: {
  secondsLeft: number;
  totalSeconds: number;
  state: FocusSession["state"] | "idle";
}) {
  const r = 100, circ = 2 * Math.PI * r;
  const progress = totalSeconds > 0 ? (totalSeconds - secondsLeft) / totalSeconds : 0;
  const offset = circ * (1 - progress);
  const ringColor =
    state === "break" ? "hsl(142 65% 44%)" :
    state === "paused" ? "hsl(38 92% 52%)" :
    state === "focusing" ? "hsl(var(--primary))" :
    "hsl(var(--border))";
  const stateText =
    state === "idle" ? "ready" :
    state === "focusing" ? "focusing" :
    state === "paused" ? "paused" : "on break";

  return (
    <div className="relative flex items-center justify-center" style={{ width: 240, height: 240 }}>
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 240 240">
        <circle cx="120" cy="120" r={r} fill="none" strokeWidth="8" stroke="hsl(var(--border))" />
        <circle
          cx="120" cy="120" r={r} fill="none" strokeWidth="8"
          stroke={ringColor} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s linear, stroke 0.4s ease" }}
        />
      </svg>
      <div className="flex flex-col items-center select-none z-10">
        <span className="text-5xl font-mono font-semibold tabular-nums leading-none tracking-tight">
          {formatSeconds(secondsLeft)}
        </span>
        <span className="text-xs text-muted-foreground mt-2 tracking-widest uppercase">{stateText}</span>
      </div>
    </div>
  );
}

function PillButtons({
  label, value, options, onChange, disabled,
}: {
  label: string; value: number; options: number[]; onChange: (v: number) => void; disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="flex gap-1">
        {options.map((o) => (
          <button
            key={o} disabled={disabled} onClick={() => onChange(o)}
            className={cn(
              "px-2.5 py-1 rounded-md text-xs font-medium transition-all",
              value === o
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/70 disabled:opacity-40"
            )}
          >
            {o}m
          </button>
        ))}
      </div>
    </div>
  );
}

// ── FocusTab (exported) ───────────────────────────────────────────────────────
export function FocusTab() {
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
      config: {
        focusMinutes: focusMins,
        shortBreakMinutes: shortBreakMins,
        longBreakMinutes: longBreakMins,
        sessionsBeforeLongBreak: sessionsBeforeLong,
      },
    });
  }

  function handleBreakAfterFocus() {
    const isLong = doneCount > 0 && (doneCount % sessionsBeforeLong) === 0;
    if (isLong) startBreak("long_break", longBreakMins);
    else        startBreak("short_break", shortBreakMins);
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <FocusHistorySidebar sessions={sessions} />

      <div className="flex-1 flex flex-col items-center justify-start overflow-y-auto py-8 px-6 gap-5">
        <div className="flex items-center gap-5 flex-wrap justify-center">
          {[
            { label: "Today",    value: `${stats.todayMinutes}m`,                  chip: stats.todaySessions > 0 ? `${stats.todaySessions} sessions` : undefined },
            { label: "Week",     value: `${stats.weekMinutes}m`,                   chip: undefined },
            { label: "All time", value: `${Math.round(stats.totalMinutes / 60)}h`, chip: undefined },
          ].map(({ label, value, chip }) => (
            <div key={label} className="flex items-baseline gap-1.5">
              <span className="text-base font-semibold tabular-nums">{value}</span>
              <span className="text-xs text-muted-foreground">{label}</span>
              {chip && <span className="text-[10px] text-muted-foreground/60">({chip})</span>}
            </div>
          ))}
          <StreakHeatmap sessions={sessions} currentStreak={stats.currentStreak} />
        </div>

        <RingTimer secondsLeft={dispSecs} totalSeconds={totalSecs} state={state} />

        <div className="flex gap-2">
          {Array.from({ length: sessionsBeforeLong }).map((_, i) => (
            <div
              key={i}
              className={cn("w-2 h-2 rounded-full transition-colors",
                i < (doneCount % sessionsBeforeLong) ? "bg-primary" : "bg-border"
              )}
            />
          ))}
        </div>

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
              <select
                value={selTask}
                onChange={(e) => handleTaskChange(e.target.value)}
                className="bg-background border border-border rounded-lg px-2 py-2 text-sm focus:outline-none truncate"
              >
                <option value="">— No task —</option>
                {openTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {isOverdue(t) ? "⚠ " : ""}{t.title}
                  </option>
                ))}
              </select>
              <select
                value={selProject}
                onChange={(e) => setSelProject(e.target.value)}
                className="bg-background border border-border rounded-lg px-2 py-2 text-sm focus:outline-none truncate"
              >
                <option value="">— No project —</option>
                {projects.filter((p) => p.status === "active").map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => setShowConfig((v) => !v)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors self-start"
            >
              {showConfig ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              Timer settings
            </button>
            {showConfig && (
              <div
                className="flex flex-col gap-3 w-full p-3 rounded-xl border"
                style={{ background: "hsl(var(--muted) / 0.3)", borderColor: "hsl(var(--border))" }}
              >
                <PillButtons label="Focus"       value={focusMins}      options={[15,20,25,30,45,60]} onChange={setFocusMins}      disabled={false} />
                <PillButtons label="Short break" value={shortBreakMins} options={[3,5,10]}            onChange={setShortBreakMins} disabled={false} />
                <PillButtons label="Long break"  value={longBreakMins}  options={[10,15,20,30]}       onChange={setLongBreakMins}  disabled={false} />
              </div>
            )}
            <button
              onClick={handleStart}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              Start Focus
            </button>
          </div>
        )}

        {isFocusing && (
          <div className="flex flex-col items-center gap-4 w-full max-w-sm">
            {active?.goal && (
              <p className="text-sm text-muted-foreground italic text-center">"{active.goal}"</p>
            )}
            {(active?.interruptCount ?? 0) > 0 && (
              <p className="text-xs text-amber-500">
                {active!.interruptCount} interruption{(active!.interruptCount ?? 0) > 1 ? "s" : ""}
              </p>
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
              <button
                onClick={pause}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-border hover:bg-muted transition-colors text-sm font-medium"
              >
                <Pause size={13} /> Pause
              </button>
              <button
                onClick={() => void cancel()}
                className="flex-1 py-2.5 rounded-lg border text-sm font-medium hover:bg-destructive/10 transition-colors"
                style={{ borderColor: "hsl(var(--destructive) / 0.4)", color: "hsl(var(--destructive))" }}
              >
                Stop
              </button>
            </div>
          </div>
        )}

        {isPaused && (
          <div className="flex flex-col items-center gap-3 w-full max-w-sm">
            {active?.notes && stripHtml(active.notes) && (
              <div className="w-full rounded-lg p-3 text-xs" style={{ background: "hsl(var(--muted) / 0.5)" }}>
                <p className="text-muted-foreground mb-1 text-[10px] uppercase tracking-wider">Notes so far</p>
                <div dangerouslySetInnerHTML={{ __html: active.notes }} className="prose prose-xs max-w-none line-clamp-4" />
              </div>
            )}
            <div className="flex gap-2 w-full">
              <button
                onClick={resume}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <Play size={13} /> Resume
              </button>
              <button
                onClick={() => void cancel()}
                className="flex-1 py-2.5 rounded-xl border text-sm font-medium hover:bg-destructive/10 transition-colors"
                style={{ borderColor: "hsl(var(--destructive) / 0.4)", color: "hsl(var(--destructive))" }}
              >
                Stop
              </button>
            </div>
          </div>
        )}

        {isBreak && (
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-muted-foreground">
              {active?.type === "long_break" ? "☕ Long break — you earned it" : "🍃 Short break"}
            </p>
            <button
              onClick={skipBreak}
              className="px-6 py-2 rounded-lg border border-border hover:bg-muted transition-colors text-sm"
            >
              Skip break
            </button>
          </div>
        )}

        {showBreakOffer && (
          <div
            className="flex flex-col items-center gap-3 p-5 rounded-2xl border w-full max-w-xs text-center"
            style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}
          >
            <p className="font-semibold">Session complete 🎉</p>
            <p className="text-xs text-muted-foreground">
              {doneCount > 0 && (doneCount % sessionsBeforeLong) === 0
                ? "You've earned a long break"
                : "Take a short break"}
            </p>
            <div className="flex gap-2 w-full">
              <button
                onClick={handleBreakAfterFocus}
                className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Start break
              </button>
              <button
                onClick={clearLast}
                className="flex-1 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors"
              >
                Skip
              </button>
            </div>
          </div>
        )}

        {showMoodRater && lastDone && <MoodCard sessionId={lastDone.id} mood={lastDone.mood} />}
      </div>
    </div>
  );
}
