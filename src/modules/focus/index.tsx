import { useEffect, useState, useRef, useMemo } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  Play, Pause, Square, AlertCircle,
  Target, Clock, Flame, Activity, Timer, ZapOff, Sparkles, Brain, Compass, ArrowRight, X
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

  // GSAP HUD Entrance
  useGSAP(() => {
    gsap.from(".hud-panel", {
      scale: 0.95, opacity: 0, duration: 0.8, stagger: 0.1, ease: "power3.out", clearProps: "all"
    });
    gsap.from(".hud-ring", {
      scale: 0.8, opacity: 0, duration: 1.2, ease: "expo.out", delay: 0.2, clearProps: "all"
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

  const state = activeSession ? activeSession.state : "idle";
  const totalSeconds = (activeSession?.plannedMinutes || fMins) * 60;
  const goal = activeSession?.goal || pendingGoal;
  const interruptCount = activeSession?.interruptCount || 0;
  const doneCount = fStore.completedFocusCount;

  const isIdle = state === "idle";
  const isFocusing = state === "focusing";
  const isPaused = state === "paused";
  const isBreak = state === "break";

  const ringColor = isFocusing ? "hsl(var(--primary))" : isBreak ? "#10b981" : isPaused ? "#f59e0b" : "hsl(var(--border))";
  const stateLabel = isIdle ? "SYSTEM STANDBY" : isFocusing ? "FLOW ENGAGED" : isPaused ? "SYSTEM PAUSED" : "REST PERIOD";

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

  const recentSessions = useMemo(() => {
    return sessions
      .filter(s => s.type === "focus" && s.completedAt)
      .sort((a, b) => (b.startedAt ?? b.createdAt).localeCompare(a.startedAt ?? a.createdAt))
      .slice(0, 8);
  }, [sessions]);

  const r = 160;
  const circ = 2 * Math.PI * r;
  const progress = totalSeconds > 0 ? (totalSeconds - secondsLeft) / totalSeconds : 0;
  const offset = circ * (1 - progress);

  return (
    <main ref={containerRef} className="relative w-full h-full overflow-hidden bg-background p-4 lg:p-6 text-foreground font-sans">
      {/* HUD Background Ambience */}
      <div className="fixed inset-0 pointer-events-none -z-10 bg-[radial-gradient(circle_at_center,rgba(var(--primary)/0.03)_0%,transparent_70%)]" />
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none -z-10 bg-[linear-gradient(to_bottom,transparent_0%,rgba(0,0,0,0.1)_100%)] opacity-20" />

      {/* Jarvis HUD Layout: 3 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 h-full gap-6">

        {/* ── LEFT PANEL: CONFIG & LOG ── */}
        <section className="hud-panel hidden lg:flex lg:col-span-3 flex-col gap-6 h-full">
          {/* Header Branding */}
          <div className="bg-surface-1/40 backdrop-blur-md border border-border/40 rounded-3xl p-6 shadow-lg shrink-0">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-[10px] font-black tracking-[0.2em] uppercase mb-3 shadow-[0_0_15px_rgba(var(--primary)/0.15)]">
              <Brain size={12} /> J.A.R.V.I.S. Core
            </div>
            <h1 className="text-2xl font-black tracking-tighter text-foreground leading-[1.1]">
              Engineer Your <br/><span className="text-transparent bg-clip-text bg-gradient-to-br from-primary to-primary/60">Focus.</span>
            </h1>
          </div>

          {/* Configuration (Only when idle) */}
          <div className={cn(
            "bg-surface-1/40 backdrop-blur-md border border-border/40 rounded-3xl p-5 shadow-lg shrink-0 transition-all duration-500",
            isIdle ? "opacity-100 h-auto" : "opacity-50 h-[80px] overflow-hidden grayscale pointer-events-none"
          )}>
            <div className="flex items-center gap-2 mb-4">
              <Compass className="text-primary w-4 h-4" />
              <h3 className="text-xs font-black tracking-widest uppercase">Target Vector</h3>
            </div>
            <input
              value={goal}
              onChange={(e) => fStore.setGoal(e.target.value)}
              placeholder="Set operational intent..."
              className="w-full bg-background/50 border border-border/40 rounded-xl px-4 py-2.5 text-sm font-medium text-foreground focus:outline-none focus:border-primary/50 transition-colors mb-3"
            />
            <div className="relative mb-3">
              <select
                value={selTask}
                onChange={(e) => setSelTask(e.target.value)}
                className="w-full bg-background/50 border border-border/40 rounded-xl pl-4 pr-10 py-2.5 text-xs focus:outline-none appearance-none cursor-pointer font-medium text-foreground hover:border-primary/30 transition-colors"
              >
                <option value="">No linked task</option>
                {tasks.map((t: any) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 w-4 h-4 pointer-events-none" />
            </div>
            <div className="flex gap-2 bg-background/50 border border-border/40 rounded-xl p-1">
              {[25, 45, 60].map(m => (
                <button
                  key={m}
                  onClick={() => setFMins(m)}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all duration-300",
                    fMins === m ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >{m}m</button>
              ))}
            </div>
          </div>

          {/* Recent Flow (Log) */}
          <div className="bg-surface-1/40 backdrop-blur-md border border-border/40 rounded-3xl p-5 shadow-lg flex-1 min-h-0 flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-[40px] pointer-events-none" />
            <div className="flex items-center gap-2 mb-4 shrink-0 relative z-10">
              <Activity className="text-foreground w-4 h-4" />
              <h3 className="text-xs font-black tracking-widest uppercase">Telemetry Log</h3>
            </div>
            
            <div className="flex flex-col gap-2 flex-1 overflow-y-auto pr-2 scrollbar-hide relative z-10">
              {recentSessions.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40">
                  <Target size={20} className="mb-2" />
                  <p className="text-[10px] font-bold uppercase tracking-widest">No telemetry data</p>
                </div>
              ) : (
                recentSessions.map(s => (
                  <div key={s.id} className="group flex items-center justify-between p-3 rounded-xl bg-background/40 border border-border/30 hover:border-border/60 transition-colors shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_5px_rgba(var(--primary)/0.8)] shrink-0" />
                      <p className="text-[11px] font-bold truncate pr-2">{s.goal || "Deep Work"}</p>
                    </div>
                    <div className="flex items-center gap-2 opacity-60 text-[9px] font-mono tracking-wider shrink-0">
                      <span className="flex items-center gap-1"><Clock size={9} /> {s.actualMinutes}m</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* ── CENTER PANEL: THE ENGINE ── */}
        <section className="col-span-1 lg:col-span-6 flex flex-col items-center justify-center relative h-full min-h-0">
          
          {/* Ambient Engine Glow */}
          {(isFocusing || isBreak) && (
            <div 
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] md:w-[450px] md:h-[450px] rounded-full blur-[100px] opacity-15 pointer-events-none -z-10 transition-colors duration-1000"
              style={{ backgroundColor: ringColor }}
            />
          )}

          {/* Central Ring */}
          <div className="hud-ring relative flex flex-col items-center justify-center w-full max-w-[360px] aspect-square shrink-0 mb-8">
            <svg className="absolute inset-0 w-full h-full -rotate-90 drop-shadow-2xl" viewBox="0 0 360 360">
              {/* Outer decorative track */}
              <circle cx="180" cy="180" r={r + 12} fill="none" strokeWidth="1" stroke="hsl(var(--border))" strokeOpacity="0.3" strokeDasharray="4 4" />
              {/* Inner track */}
              <circle cx="180" cy="180" r={r} fill="none" strokeWidth="2" stroke="hsl(var(--border))" strokeOpacity="0.2" />
              {/* Main active ring */}
              <circle
                cx="180" cy="180" r={r} fill="none" strokeWidth="10"
                strokeLinecap="butt"
                strokeDasharray={circ}
                strokeDashoffset={offset}
                stroke={ringColor}
                style={{ transition: "stroke-dashoffset 1s linear, stroke 0.5s ease" }}
                className="drop-shadow-[0_0_15px_rgba(var(--primary)/0.6)]"
              />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center select-none text-center px-4">
              <span className="text-[10px] md:text-[11px] font-bold tracking-[0.4em] uppercase mb-2 opacity-60" style={{ color: ringColor }}>
                {stateLabel}
              </span>
              <span className="text-6xl md:text-7xl lg:text-[7rem] font-mono font-black tabular-nums tracking-tighter leading-none text-foreground drop-shadow-lg">
                {formatSecs(secondsLeft)}
              </span>

              {/* Target Display for Central HUD */}
              {(isFocusing || isPaused) && goal && (
                <div className="mt-6 bg-background/60 backdrop-blur-md border border-border/50 px-4 py-1.5 rounded-full">
                  <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase line-clamp-1 max-w-[180px]">
                    TGT: {goal}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Command Controls */}
          <div className="hud-ring flex items-center justify-center gap-4 z-20 shrink-0">
            {isIdle && (
              <button
                onClick={() => fStore.startFocus({ taskId: selTask || undefined, config: { pomodoroWorkMin: fMins } as any })}
                className="group relative flex items-center gap-3 px-10 py-3.5 rounded-full bg-foreground text-background font-black tracking-[0.2em] uppercase overflow-hidden hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_30px_rgba(255,255,255,0.1)]"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                <Play fill="currentColor" size={14} />
                <span className="text-[11px] relative z-10">Initialize</span>
              </button>
            )}

            {isFocusing && (
              <>
                <button
                  onClick={() => fStore.pause()}
                  className="flex items-center justify-center w-14 h-14 rounded-full bg-background/80 backdrop-blur-xl border border-border/60 hover:bg-muted text-foreground transition-all hover:scale-110 shadow-lg"
                >
                  <Pause fill="currentColor" size={20} />
                </button>
                <button
                  onClick={() => fStore.incrementInterrupt()}
                  title="Log Anomaly"
                  className="relative flex items-center justify-center w-14 h-14 rounded-full bg-background/80 backdrop-blur-xl border border-amber-500/40 text-amber-500 hover:bg-amber-500/10 transition-all hover:scale-110 shadow-lg"
                >
                  <AlertCircle size={20} />
                  {interruptCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-amber-500 text-background text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border border-background">
                      {interruptCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => fStore.cancel()}
                  className="flex items-center justify-center w-14 h-14 rounded-full bg-background/80 backdrop-blur-xl border border-red-500/40 text-red-500 hover:bg-red-500/10 transition-all hover:scale-110 shadow-lg"
                >
                  <X strokeWidth={3} size={20} />
                </button>
              </>
            )}

            {isPaused && (
              <>
                <button
                  onClick={() => fStore.resume()}
                  className="flex items-center gap-3 px-8 py-3.5 rounded-full bg-primary text-primary-foreground font-black tracking-[0.2em] uppercase hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_20px_hsl(var(--primary)/0.5)]"
                >
                  <Play fill="currentColor" size={14} />
                  <span className="text-[11px]">Resume</span>
                </button>
                <button
                  onClick={() => fStore.cancel()}
                  className="flex items-center justify-center w-14 h-14 rounded-full bg-background/80 backdrop-blur-xl border border-red-500/40 text-red-500 hover:bg-red-500/10 transition-all hover:scale-110 shadow-lg"
                >
                  <X strokeWidth={3} size={20} />
                </button>
              </>
            )}

            {isBreak && (
              <button
                onClick={() => fStore.skipBreak()}
                className="flex items-center gap-2 px-8 py-3.5 rounded-full bg-background/60 backdrop-blur-xl border border-border/60 hover:bg-muted text-foreground font-bold tracking-[0.1em] text-[11px] transition-all hover:scale-[1.02]"
              >
                OVERRIDE REST <ArrowRight size={14} />
              </button>
            )}
          </div>

          {/* Mobile Settings Fallback (only visible on small screens) */}
          {isIdle && (
            <div className="mt-8 w-full max-w-sm lg:hidden bg-surface-1/40 backdrop-blur-md border border-border/40 rounded-3xl p-5 shadow-lg">
               <input
                value={goal}
                onChange={(e) => fStore.setGoal(e.target.value)}
                placeholder="Target Vector..."
                className="w-full bg-background/50 border border-border/40 rounded-xl px-4 py-2 text-sm text-center font-medium text-foreground focus:outline-none mb-3"
              />
              <div className="flex gap-2">
                 <select
                  value={selTask}
                  onChange={(e) => setSelTask(e.target.value)}
                  className="flex-1 bg-background/50 border border-border/40 rounded-xl px-3 py-2 text-xs focus:outline-none appearance-none"
                >
                  <option value="">No task</option>
                  {tasks.map((t: any) => <option key={t.id} value={t.id}>{t.title}</option>)}
                </select>
                <select
                  value={fMins}
                  onChange={(e) => setFMins(Number(e.target.value))}
                  className="w-20 bg-background/50 border border-border/40 rounded-xl px-2 py-2 text-xs font-bold text-center focus:outline-none appearance-none"
                >
                  <option value={25}>25m</option>
                  <option value={45}>45m</option>
                  <option value={60}>60m</option>
                </select>
              </div>
            </div>
          )}
        </section>

        {/* ── RIGHT PANEL: SYSTEM DIAGNOSTICS ── */}
        <section className="hud-panel hidden lg:flex lg:col-span-3 flex-col gap-6 h-full">
          {/* Main Diagnostics */}
          <div className="bg-surface-1/40 backdrop-blur-md border border-border/40 rounded-3xl p-6 shadow-lg flex flex-col relative overflow-hidden shrink-0">
            <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full blur-[50px] pointer-events-none" />
            
            <div className="flex items-center gap-2 mb-6 relative z-10">
              <Flame className="text-primary w-4 h-4" />
              <h3 className="text-xs font-black tracking-widest uppercase">System Diagnostics</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-y-6 gap-x-4 w-full relative z-10">
              <div>
                <p className="text-[9px] font-bold tracking-[0.2em] uppercase text-muted-foreground mb-1">Today Output</p>
                <p className="text-2xl font-mono font-black tabular-nums text-foreground">{fmtMins(stats.todayMinutes)}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold tracking-[0.2em] uppercase text-muted-foreground mb-1">Cycles</p>
                <p className="text-2xl font-mono font-black tabular-nums text-foreground">{stats.todaySessions}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold tracking-[0.2em] uppercase text-muted-foreground mb-1">Weekly Load</p>
                <p className="text-2xl font-mono font-black tabular-nums text-foreground">{fmtMins(stats.weekMinutes)}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold tracking-[0.2em] uppercase text-muted-foreground mb-1">Flow Streak</p>
                <div className="flex items-baseline gap-1">
                  <p className="text-2xl font-mono font-black tabular-nums text-primary">{stats.currentStreak}d</p>
                  {stats.currentStreak > 2 && <Sparkles size={12} className="text-primary animate-pulse" />}
                </div>
              </div>
            </div>
          </div>

          {/* Pomodoro Tracker */}
          <div className="bg-surface-1/40 backdrop-blur-md border border-border/40 rounded-3xl p-6 shadow-lg shrink-0">
             <div className="flex items-center gap-2 mb-4">
              <Timer className="text-foreground w-4 h-4" />
              <h3 className="text-xs font-black tracking-widest uppercase">Cycle Progress</h3>
            </div>
            <div className="flex gap-2 items-center justify-between">
              {Array.from({ length: sessionsBeforeLong }).map((_, i) => (
                <div key={i} className={cn(
                  "flex-1 h-1.5 rounded-full transition-all duration-500",
                  i < (doneCount % sessionsBeforeLong) ? "bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.8)]" : "bg-border/40"
                )} />
              ))}
            </div>
            <p className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground mt-3 text-right">
              {doneCount % sessionsBeforeLong} / {sessionsBeforeLong} to full purge
            </p>
          </div>

          {/* 14-Day Status Array */}
          <div className="bg-surface-1/40 backdrop-blur-md border border-border/40 rounded-3xl p-6 shadow-lg flex-1 min-h-0 flex flex-col justify-end">
            <h3 className="text-[9px] font-black tracking-widest uppercase text-muted-foreground mb-4">Array Status</h3>
            <div className="grid grid-cols-7 gap-2">
              {streakDays.map((d, i) => (
                <div key={i} title={d.d} className="flex justify-center">
                  <div className={cn(
                    "w-full aspect-square rounded-sm transition-all duration-500",
                    d.has ? "bg-primary shadow-[0_0_8px_rgba(var(--primary)/0.5)]" : "bg-border/30"
                  )} />
                </div>
              ))}
            </div>
          </div>

        </section>

      </div>
    </main>
  );
}
