import { useEffect, useState, useRef, useMemo } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  Play, Pause, Square, AlertCircle,
  Target, Clock, Flame, Activity, Timer, ZapOff, Sparkles, Brain, Compass, ArrowRight
} from "lucide-react";

import { focusManifest }               from "./manifest";
import { useFocusStore }               from "./store";
import { TIME_MANIFEST }               from "../time-tracking/manifest";
import { setupTimeEventListeners }     from "../time-tracking/events";
import { useTaskStore }                from "../tasks/store";
import { registry }                    from "@/kernel/router";
import { cn }                          from "@/shared/utils";
import { format, parseISO, subDays }   from "date-fns";

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

// ─────────────────────────────────────────────────────────────
// RING TIMER
// ─────────────────────────────────────────────────────────────
function RingTimer({
  secondsLeft, totalSeconds, state, goal, onGoalChange,
  onStart, onPause, onResume, onCancel, onInterrupt, onSkipBreak,
  interruptCount, tasks, selTask, onTaskChange, focusMins, onFocusMinsChange,
  doneCount, sessionsBeforeLong
}: any) {
  const r = 160;
  const circ = 2 * Math.PI * r;
  const progress = totalSeconds > 0 ? (totalSeconds - secondsLeft) / totalSeconds : 0;
  const offset = circ * (1 - progress);

  const isIdle = state === "idle";
  const isFocusing = state === "focusing";
  const isPaused = state === "paused";
  const isBreak = state === "break";

  const ringColor = isFocusing ? "hsl(var(--primary))" : isBreak ? "#10b981" : isPaused ? "#f59e0b" : "hsl(var(--border))";
  const stateLabel = isIdle ? "READY FOR DEEP WORK" : isFocusing ? "FLOW STATE ACTIVE" : isPaused ? "SESSION PAUSED" : "RESTING";

  return (
    <div className="flex flex-col items-center justify-center gap-6 w-full h-full relative z-10">
      {/* Decorative ambient glow */}
      {(isFocusing || isBreak) && (
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full blur-[100px] opacity-20 pointer-events-none -z-10 transition-colors duration-1000"
          style={{ backgroundColor: ringColor }}
        />
      )}

      {/* The Ring */}
      <div className="relative flex flex-col items-center justify-center" style={{ width: 360, height: 360 }}>
        <svg className="absolute inset-0 -rotate-90 drop-shadow-2xl" viewBox="0 0 360 360">
          <circle cx="180" cy="180" r={r} fill="none" strokeWidth="4" stroke="hsl(var(--border))" strokeOpacity="0.2" />
          <circle
            cx="180" cy="180" r={r} fill="none" strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            stroke={ringColor}
            style={{ transition: "stroke-dashoffset 1s linear, stroke 0.5s ease" }}
            className="drop-shadow-[0_0_12px_rgba(var(--primary)/0.5)]"
          />
        </svg>

        <div className="flex flex-col items-center select-none z-10 w-full px-12 text-center">
          <span className="text-[12px] font-bold tracking-[0.3em] uppercase text-muted-foreground mb-4 opacity-70">
            {stateLabel}
          </span>
          <span className="text-7xl lg:text-[6.5rem] font-mono font-black tabular-nums tracking-tighter leading-none text-foreground drop-shadow-md">
            {formatSecs(secondsLeft)}
          </span>
          
          {/* Goal display when active */}
          {(isFocusing || isPaused) && goal && (
            <p className="mt-6 text-sm font-medium text-muted-foreground max-w-[220px] leading-snug line-clamp-2">
              "{goal}"
            </p>
          )}

          {/* Pomodoro Session Dots */}
          <div className="flex gap-2.5 mt-8 items-center justify-center">
            {Array.from({ length: sessionsBeforeLong }).map((_, i) => (
              <div key={i} className={cn(
                "w-2 h-2 rounded-full transition-all duration-500",
                i < (doneCount % sessionsBeforeLong) ? "bg-primary scale-125 shadow-[0_0_8px_hsl(var(--primary)/0.8)]" : "bg-border/60"
              )} />
            ))}
          </div>
        </div>
      </div>

      {/* Idle Configuration (Task, Goal, Duration) */}
      {isIdle && (
        <div className="flex flex-col items-center gap-4 w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 duration-700 mt-2">
          <div className="w-full bg-background/40 backdrop-blur-3xl border border-border/50 rounded-3xl p-4 shadow-xl flex flex-col gap-4 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
            
            <input
              value={goal}
              onChange={(e) => onGoalChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onStart()}
              placeholder="Set a deep intention..."
              className="w-full text-center bg-transparent text-lg font-medium text-foreground focus:outline-none placeholder:text-muted-foreground/40 transition-colors relative z-10"
            />
            
            <div className="w-full h-px bg-border/40 relative z-10" />

            <div className="flex items-center gap-2 w-full relative z-10">
              <div className="flex-1 bg-background/50 border border-border/40 rounded-xl relative group hover:border-primary/30 transition-colors">
                <Compass className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 group-hover:text-primary transition-colors" />
                <select
                  value={selTask}
                  onChange={(e) => onTaskChange(e.target.value)}
                  className="w-full bg-transparent pl-9 pr-4 py-2 text-xs focus:outline-none appearance-none cursor-pointer font-medium text-foreground"
                >
                  <option value="">No specific task</option>
                  {tasks.map((t: any) => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 w-4 h-4 pointer-events-none" />
              </div>

              <div className="flex bg-background/50 border border-border/40 rounded-xl p-1 shrink-0">
                {[25, 45, 60].map(m => (
                  <button
                    key={m}
                    onClick={() => onFocusMinsChange(m)}
                    className={cn(
                      "px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all duration-300",
                      focusMins === m ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                  >{m}m</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-5 z-20 shrink-0">
        {isIdle && (
          <button
            onClick={onStart}
            className="group relative flex items-center gap-3 px-10 py-4 rounded-full bg-foreground text-background font-black tracking-wider uppercase overflow-hidden hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            <Play fill="currentColor" size={16} />
            <span className="text-xs relative z-10">Engage Focus</span>
          </button>
        )}

        {isFocusing && (
          <>
            <button
              onClick={onPause}
              className="flex items-center justify-center w-16 h-16 rounded-full bg-background/80 backdrop-blur-xl border border-border/60 hover:bg-muted text-foreground transition-all hover:scale-110 shadow-xl"
            >
              <Pause fill="currentColor" size={22} />
            </button>
            <button
              onClick={onInterrupt}
              title="Log Distraction"
              className="relative flex items-center justify-center w-16 h-16 rounded-full bg-background/80 backdrop-blur-xl border border-amber-500/40 text-amber-500 hover:bg-amber-500/10 transition-all hover:scale-110 shadow-xl"
            >
              <AlertCircle size={22} />
              {interruptCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber-500 text-background text-[11px] font-black w-6 h-6 flex items-center justify-center rounded-full border-2 border-background">
                  {interruptCount}
                </span>
              )}
            </button>
            <button
              onClick={onCancel}
              className="flex items-center justify-center w-16 h-16 rounded-full bg-background/80 backdrop-blur-xl border border-red-500/40 text-red-500 hover:bg-red-500/10 transition-all hover:scale-110 shadow-xl"
            >
              <Square fill="currentColor" size={20} />
            </button>
          </>
        )}

        {isPaused && (
          <>
            <button
              onClick={onResume}
              className="flex items-center gap-3 px-10 py-5 rounded-full bg-primary text-primary-foreground font-black tracking-wider uppercase hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_8px_32px_-8px_hsl(var(--primary)/0.6)]"
            >
              <Play fill="currentColor" size={18} />
              <span className="text-[13px]">Resume</span>
            </button>
            <button
              onClick={onCancel}
              className="flex items-center justify-center w-16 h-16 rounded-full bg-background/80 backdrop-blur-xl border border-red-500/40 text-red-500 hover:bg-red-500/10 transition-all hover:scale-110 shadow-xl"
            >
              <Square fill="currentColor" size={20} />
            </button>
          </>
        )}

        {isBreak && (
          <button
            onClick={onSkipBreak}
            className="flex items-center gap-2 px-8 py-4 rounded-full bg-background/60 backdrop-blur-xl border border-border/60 hover:bg-muted text-foreground font-bold tracking-wide transition-all hover:scale-[1.02]"
          >
            Skip Break <ArrowRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

function ChevronDown(props: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m6 9 6 6 6-6"/></svg>;
}

// ─────────────────────────────────────────────────────────────
// MAIN MODULE
// ─────────────────────────────────────────────────────────────
export default function FocusModule() {
  const fStore = useFocusStore();
  const tasks  = useTaskStore(s => s.tasks.filter(t => t.status !== "done" && t.status !== "archived"));
  
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fStore.load();
    setupTimeEventListeners();
  }, []);

  // GSAP Entrance
  useGSAP(() => {
    gsap.from(".reveal-item", {
      y: 30, opacity: 0, duration: 1, stagger: 0.1, ease: "power4.out", clearProps: "all"
    });
  }, { scope: containerRef });

  const { stats, secondsLeft, activeSession, sessions, config, pendingGoal } = fStore;
  
  const [selTask, setSelTask] = useState("");
  // Fallback to defaults if config isn't loaded yet
  const defaultFocusMins = config?.pomodoroWorkMin ?? 25;
  const sessionsBeforeLong = config?.pomodoroSetCount ?? 4;
  
  const [fMins, setFMins] = useState(defaultFocusMins);

  useEffect(() => {
    if (config && fMins !== config.pomodoroWorkMin && !activeSession) {
      fStore.saveConfig({ ...config, pomodoroWorkMin: fMins });
    }
  }, [fMins, config, activeSession]);

  useEffect(() => {
    if (config && fMins !== config.pomodoroWorkMin) setFMins(config.pomodoroWorkMin);
  }, [config?.pomodoroWorkMin]);

  // Derived state that was previously hardcoded
  const state = activeSession ? activeSession.state : "idle";
  const totalSeconds = (activeSession?.plannedMinutes || fMins) * 60;
  const goal = activeSession?.goal || pendingGoal;
  const interruptCount = activeSession?.interruptCount || 0;

  // Compute 14-day streak for dots
  const streakDays = useMemo(() => {
    const days = [];
    const completedFocus = sessions.filter(s => s.type === "focus" && s.completedAt);
    const daySet = new Set(completedFocus.map(s => s.startedAt?.slice(0, 10)).filter(Boolean));
    for (let i = 13; i >= 0; i--) {
      const d = subDays(new Date(), i).toISOString().slice(0, 10);
      days.push({ d, has: daySet.has(d) });
    }
    return days;
  }, [sessions]);

  // Recent focus history
  const recentSessions = useMemo(() => {
    return sessions
      .filter(s => s.type === "focus" && s.completedAt)
      .sort((a, b) => (b.startedAt ?? b.createdAt).localeCompare(a.startedAt ?? a.createdAt))
      .slice(0, 5);
  }, [sessions]);

  return (
    <main ref={containerRef} className="relative w-full h-full overflow-hidden bg-background flex flex-col p-6 lg:p-8 gap-4">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none -z-10 bg-[radial-gradient(ellipse_at_top_right,rgba(var(--primary)/0.03),transparent_50%)]" />

      {/* Cinematic Hero AIDA Attention */}
      <section className="reveal-item w-full flex flex-col items-center text-center shrink-0">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-[10px] font-black tracking-[0.2em] uppercase mb-2 shadow-[0_0_20px_rgba(var(--primary)/0.15)]">
          <Brain size={12} /> Cognitive Engine
        </div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-foreground leading-[1.05]">
          Engineer Your <span className="text-transparent bg-clip-text bg-gradient-to-br from-primary to-primary/60 inline-block align-bottom pb-1">Focus.</span>
        </h1>
      </section>

      {/* Primary Timer Engine (Interest) */}
      <section className="reveal-item flex-1 min-h-0 w-full max-w-5xl mx-auto flex justify-center items-center">
        <RingTimer
          secondsLeft={secondsLeft} totalSeconds={totalSeconds} state={state}
          goal={goal} onGoalChange={fStore.setGoal}
          onStart={() => fStore.startFocus({ taskId: selTask || undefined, config: { focusMinutes: fMins } })}
          onPause={fStore.pause} onResume={fStore.resume}
          onCancel={fStore.cancel} onInterrupt={fStore.incrementInterrupt}
          onSkipBreak={fStore.skipBreak}
          interruptCount={interruptCount}
          tasks={tasks} selTask={selTask} onTaskChange={setSelTask}
          focusMins={fMins} onFocusMinsChange={setFMins}
          doneCount={fStore.completedFocusCount}
          sessionsBeforeLong={sessionsBeforeLong}
        />
      </section>

      {/* Gapless Bento Grid (Desire) */}
      <section className="w-full max-w-5xl mx-auto shrink-0 h-[220px] lg:h-[260px]">
        <div className="grid grid-cols-1 lg:grid-cols-12 h-full gap-4 grid-flow-dense">
          
          {/* Main Stat Block */}
          <div className="reveal-item lg:col-span-7 bg-surface-1/40 backdrop-blur-2xl border border-border/40 rounded-3xl p-6 flex flex-col justify-between group overflow-hidden relative shadow-xl hover:shadow-2xl transition-all duration-700">
            <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full blur-[60px] group-hover:bg-primary/10 transition-colors duration-700 pointer-events-none" />
            
            <div className="flex items-center gap-2 mb-4 relative z-10">
              <div className="p-2 bg-primary/10 rounded-xl text-primary"><Flame size={20} strokeWidth={2.5} /></div>
              <h3 className="text-sm font-black tracking-wide uppercase text-foreground">Performance</h3>
            </div>
            
            <div className="grid grid-cols-4 gap-4 w-full mt-auto relative z-10">
              <div>
                <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-0.5">Today</p>
                <p className="text-2xl font-black tabular-nums text-foreground">{fmtMins(stats.todayMinutes)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-0.5">Sessions</p>
                <p className="text-2xl font-black tabular-nums text-foreground">{stats.todaySessions}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-0.5">Week</p>
                <p className="text-2xl font-black tabular-nums text-foreground">{fmtMins(stats.weekMinutes)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-0.5">Streak</p>
                <div className="flex items-baseline gap-1">
                  <p className="text-2xl font-black tabular-nums text-primary">{stats.currentStreak}d</p>
                  {stats.currentStreak > 2 && <Sparkles size={12} className="text-primary animate-pulse" />}
                </div>
              </div>
            </div>

            {/* Streak Tracker */}
            <div className="w-full mt-6 p-3 bg-background/50 rounded-xl border border-border/50 flex items-center justify-between gap-1 relative z-10">
              {streakDays.map((d, i) => (
                <div key={i} title={d.d} className="flex-1 flex justify-center">
                  <div className={cn(
                    "w-full max-w-[16px] h-1.5 rounded-full transition-all duration-500",
                    d.has ? "bg-primary shadow-[0_0_8px_rgba(var(--primary)/0.5)]" : "bg-border/40"
                  )} />
                </div>
              ))}
            </div>
          </div>

          {/* History / Log Block */}
          <div className="reveal-item lg:col-span-5 bg-surface-1/40 backdrop-blur-2xl border border-border/40 rounded-3xl p-6 flex flex-col shadow-xl hover:shadow-2xl transition-all duration-700 relative z-10 overflow-hidden">
            <div className="flex items-center gap-2 mb-4 shrink-0">
              <div className="p-2 bg-muted rounded-xl text-foreground"><Activity size={20} strokeWidth={2.5} /></div>
              <h3 className="text-sm font-black tracking-wide uppercase text-foreground">Recent Flow</h3>
            </div>
            
            <div className="flex flex-col gap-2 flex-1 overflow-y-auto pr-2 scrollbar-hide">
              {recentSessions.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50 h-full min-h-[100px]">
                  <Target size={24} className="mb-2 text-muted-foreground" />
                  <p className="text-xs font-medium">No sessions recorded yet.</p>
                </div>
              ) : (
                recentSessions.map(s => (
                  <div key={s.id} className="group relative flex items-start gap-3 p-3 rounded-xl bg-background/40 hover:bg-background/80 border border-transparent hover:border-border/50 transition-all shrink-0">
                    <div className="mt-1 w-2 h-2 rounded-full bg-primary shrink-0 shadow-[0_0_8px_rgba(var(--primary)/0.6)]" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{s.goal || "Deep Work"}</p>
                      <div className="flex items-center gap-3 mt-1 opacity-70 group-hover:opacity-100 transition-opacity">
                        <span className="text-[10px] font-semibold flex items-center gap-1"><Clock size={10} /> {s.actualMinutes}m</span>
                        <span className="text-[10px] font-medium flex items-center gap-1"><Timer size={10} /> {format(parseISO(s.startedAt!), "h:mm")}</span>
                        {(s.interruptCount ?? 0) > 0 && (
                          <span className="text-[10px] font-bold text-amber-500 flex items-center gap-1 bg-amber-500/10 px-1.5 py-0.5 rounded"><ZapOff size={10} /> {s.interruptCount}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </section>
    </main>
  );
}
