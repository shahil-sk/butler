import { useEffect, useState, useRef, useMemo } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  Play, Pause, Square, AlertCircle, Plus,
  Target, Clock, Activity, Volume2, FileText,
  DollarSign, Check, X
} from "lucide-react";

import { focusManifest } from "./manifest";
import { useFocusStore } from "./store";
import { TIME_MANIFEST } from "../time-tracking/manifest";
import { useTimeStore } from "../time-tracking/store";
import { useTaskStore } from "../tasks/store";
import { useProjectStore } from "../projects/store";
import { registry } from "@/kernel/router";
import { cn, today } from "@/shared/utils";
import type { TimeEntry, Task } from "@/shared/types";

registry.register(focusManifest);
registry.register(TIME_MANIFEST);

// ─────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// AMBIENT SOUNDS STUB
// ─────────────────────────────────────────────────────────────
const SOUNDS = [
  { id: "none", label: "None", emoji: "🔇" },
  { id: "rain", label: "Rain", emoji: "🌧" },
  { id: "lofi", label: "Lo-fi", emoji: "🎵" }
] as const;

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

// ─────────────────────────────────────────────────────────────
// MAIN MODULE
// ─────────────────────────────────────────────────────────────
export default function FocusModule() {
  const containerRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);
  
  // Stores
  const { load: loadFocus, activeSession, secondsLeft, startFocus, pause, resume, cancel, startBreak, incrementInterrupt, pendingGoal, setGoal } = useFocusStore();
  const { load: loadTime, entries, activeEntryId, startTimer, stopTimer, createEntry } = useTimeStore();
  const { loadTasks, tasks } = useTaskStore();
  const { loadProjects, projects } = useProjectStore();

  const [sound, setSound] = useState("none");
  const [selTask, setSelTask] = useState("");
  const [quickDesc, setQuickDesc] = useState("");
  
  useEffect(() => {
    void loadFocus(); void loadTime(); void loadTasks(); void loadProjects();
  }, [loadFocus, loadTime, loadTasks, loadProjects]);

  // Spacebar play/pause
  useEffect(() => {
    const state = activeSession?.state;
    if (!state || state === "break") return;
    const handler = (e: KeyboardEvent) => {
      if (e.code === "Space" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        if (state === "focusing") pause();
        else if (state === "paused") resume();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeSession?.state, pause, resume]);

  // Data
  const state = activeSession?.state ?? "idle";
  const isIdle = state === "idle";
  const isFocusing = state === "focusing";
  const isPaused = state === "paused";
  const isBreak = state === "break";
  
  const focusMins = 25;
  const totalSecs = activeSession ? (activeSession.plannedMinutes ?? focusMins) * 60 : focusMins * 60;
  const dispSecs = isIdle ? totalSecs : secondsLeft;
  const progress = totalSecs > 0 ? (totalSecs - dispSecs) / totalSecs : 0;
  
  const activeTimeEntry = entries.find(e => e.id === activeEntryId);
  const liveDur = useLiveDuration(activeTimeEntry?.startAt, !activeTimeEntry);

  const todayEntries = entries.filter(e => e.startAt.startsWith(today())).sort((a,b) => b.startAt.localeCompare(a.startAt));
  
  // GSAP Animations
  useGSAP(() => {
    gsap.from(".reveal-stagger", {
      y: 40,
      opacity: 0,
      duration: 1,
      stagger: 0.1,
      ease: "power4.out",
      clearProps: "all"
    });
  }, []);

  useGSAP(() => {
    if (ringRef.current) {
      const circ = 2 * Math.PI * 180;
      const offset = circ * (1 - progress);
      gsap.to(ringRef.current, {
        strokeDashoffset: offset,
        duration: 1,
        ease: "linear"
      });
    }
  }, [progress]);

  function handleStartFocus() {
    void startFocus({
      taskId: selTask || undefined,
      config: { focusMinutes: focusMins, shortBreakMinutes: 5, longBreakMinutes: 15, sessionsBeforeLongBreak: 4 }
    });
  }

  function handleQuickStart() {
    if (activeTimeEntry) return;
    void startTimer({
      description: quickDesc || undefined,
      taskId: selTask || undefined,
    });
    setQuickDesc("");
  }

  return (
    <main ref={containerRef} className="w-full h-full bg-[#030303] text-zinc-100 overflow-hidden flex flex-col xl:flex-row p-4 gap-4 font-sans relative">
      
      {/* Background ambient glow based on state */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none transition-opacity duration-1000 opacity-60">
        <div className={cn(
          "absolute top-1/2 left-1/4 -translate-y-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full blur-[120px] transition-colors duration-1000",
          isFocusing ? "bg-primary/20" : isBreak ? "bg-emerald-500/20" : isPaused ? "bg-amber-500/20" : "bg-transparent"
        )} />
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* LEFT PANEL: THE MASSIVE TIMER (Span 2/3)                      */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="relative z-10 flex-1 rounded-3xl border border-white/5 bg-white/[0.02] backdrop-blur-3xl overflow-hidden flex flex-col reveal-stagger shadow-2xl">
        <div className="absolute top-8 left-8 flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs font-semibold tracking-widest uppercase text-white/70">
          {isIdle ? (
            <><Target size={14} className="text-primary"/> Ready to focus</>
          ) : isBreak ? (
            <><Clock size={14} className="text-emerald-400"/> On Break</>
          ) : isPaused ? (
            <><Pause size={14} className="text-amber-400"/> Paused</>
          ) : (
            <><Activity size={14} className="text-primary animate-pulse"/> Deep Work</>
          )}
        </div>

        <div className="flex-1 flex flex-col items-center justify-center relative">
          
          {/* Ring & Timer Typography */}
          <div className="relative flex items-center justify-center w-[500px] h-[500px]">
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 400 400">
              <circle cx="200" cy="200" r="180" fill="none" strokeWidth="4" stroke="rgba(255,255,255,0.05)" />
              <circle 
                ref={ringRef}
                cx="200" cy="200" r="180" fill="none" strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 180}
                strokeDashoffset={2 * Math.PI * 180}
                className={cn(
                  "transition-colors duration-500",
                  isFocusing ? "stroke-primary" : isBreak ? "stroke-emerald-500" : isPaused ? "stroke-amber-500" : "stroke-white/20"
                )}
              />
            </svg>
            
            <div className="flex flex-col items-center select-none z-10 text-center">
              <span 
                className="font-semibold tabular-nums tracking-tighter"
                style={{ fontSize: "clamp(6rem, 10vw, 9rem)", lineHeight: 1 }}
              >
                {formatSecs(dispSecs)}
              </span>
              <div className="mt-6 flex flex-col gap-2 items-center">
                {activeSession?.goal ? (
                  <p className="text-lg text-white/60 italic max-w-sm truncate px-4">"{activeSession.goal}"</p>
                ) : (
                  <input 
                    value={pendingGoal ?? ""}
                    onChange={e => setGoal(e.target.value)}
                    placeholder="Set an intention..."
                    className="bg-transparent border-b border-white/20 text-center px-4 py-2 text-white/60 focus:outline-none focus:border-primary transition-colors text-lg max-w-[250px] placeholder:text-white/30"
                    disabled={!isIdle}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="absolute bottom-16 flex items-center gap-6">
            {isIdle && (
              <button onClick={handleStartFocus} className="group relative flex items-center justify-center w-20 h-20 rounded-full bg-primary text-primary-foreground hover:scale-105 transition-all duration-500 shadow-[0_0_40px_rgba(var(--primary),0.4)]">
                <Play fill="currentColor" size={28} className="translate-x-1" />
              </button>
            )}
            
            {isFocusing && (
              <>
                <button onClick={() => pause()} className="flex items-center justify-center w-16 h-16 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all hover:scale-105">
                  <Pause fill="currentColor" size={24} />
                </button>
                <button onClick={() => incrementInterrupt?.()} className="flex items-center justify-center w-16 h-16 rounded-full border border-amber-500/30 text-amber-500 hover:bg-amber-500/10 transition-all hover:scale-105 relative">
                  <AlertCircle size={24} />
                  {(activeSession?.interruptCount ?? 0) > 0 && (
                    <span className="absolute -top-2 -right-2 bg-amber-500 text-black text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full">
                      {activeSession?.interruptCount}
                    </span>
                  )}
                </button>
                <button onClick={() => void cancel()} className="flex items-center justify-center w-16 h-16 rounded-full bg-destructive/20 text-destructive hover:bg-destructive/40 transition-all hover:scale-105">
                  <Square fill="currentColor" size={20} />
                </button>
              </>
            )}

            {isPaused && (
              <>
                <button onClick={resume} className="flex items-center justify-center w-20 h-20 rounded-full bg-primary text-primary-foreground hover:scale-105 transition-all shadow-[0_0_40px_rgba(var(--primary),0.4)]">
                  <Play fill="currentColor" size={28} className="translate-x-1" />
                </button>
                <button onClick={() => void cancel()} className="flex items-center justify-center w-16 h-16 rounded-full bg-destructive/20 text-destructive hover:bg-destructive/40 transition-all hover:scale-105">
                  <Square fill="currentColor" size={20} />
                </button>
              </>
            )}

            {isBreak && (
              <button onClick={() => startFocus({})} className="px-8 py-4 rounded-full bg-white text-black font-bold text-lg hover:scale-105 transition-transform">
                Skip Break
              </button>
            )}
          </div>

        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* RIGHT PANEL: BENTO GRID (Span 1/3)                            */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="z-10 xl:w-[450px] shrink-0 flex flex-col gap-4 reveal-stagger h-full">
        
        {/* Top: Active Time Tracker Status */}
        <div className="rounded-3xl border border-white/5 bg-white/[0.02] backdrop-blur-xl p-6 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold tracking-wider uppercase text-white/50 flex items-center gap-2">
              <Clock size={14} className="text-emerald-400" /> Time Tracker
            </h3>
            {activeTimeEntry && (
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </div>
          
          <div className="flex flex-col gap-4">
            <div className="flex items-end justify-between">
              <span className="text-4xl font-light tabular-nums tracking-tight">
                {activeTimeEntry ? liveDur : "00:00"}
              </span>
              <span className="text-sm text-white/40 pb-1">
                {activeTimeEntry ? "Currently tracking..." : "Idle"}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <input 
                value={quickDesc} onChange={e => setQuickDesc(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleQuickStart()}
                placeholder="What are you working on?"
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors disabled:opacity-50"
                disabled={!!activeTimeEntry}
              />
              {!activeTimeEntry ? (
                <button onClick={handleQuickStart} className="w-12 h-12 flex items-center justify-center rounded-xl bg-emerald-500 text-emerald-950 hover:bg-emerald-400 transition-colors shrink-0">
                  <Play fill="currentColor" size={16} className="translate-x-0.5" />
                </button>
              ) : (
                <button onClick={() => void stopTimer()} className="w-12 h-12 flex items-center justify-center rounded-xl bg-destructive/20 text-destructive hover:bg-destructive/40 transition-colors shrink-0">
                  <Square fill="currentColor" size={16} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Middle: Live Feed of Today's Entries */}
        <div className="flex-1 rounded-3xl border border-white/5 bg-white/[0.02] backdrop-blur-xl p-6 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-6 shrink-0">
            <h3 className="text-sm font-semibold tracking-wider uppercase text-white/50">Today's Log</h3>
            <span className="text-xs font-medium text-white/30">{todayEntries.length} entries</span>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
            {todayEntries.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-white/20">
                <FileText size={32} className="mb-2 opacity-50" />
                <p className="text-sm">No entries yet today.</p>
              </div>
            ) : (
              todayEntries.map(entry => (
                <div key={entry.id} className="group flex items-start justify-between p-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all cursor-default">
                  <div className="flex flex-col gap-1 min-w-0 pr-4">
                    <span className="text-sm font-medium text-white/90 truncate leading-tight">
                      {entry.description || <span className="italic text-white/30">No description</span>}
                    </span>
                    <span className="text-xs text-white/40 font-mono">
                      {fmtTime(entry.startAt)} {entry.endAt ? `– ${fmtTime(entry.endAt)}` : "– ..."}
                    </span>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-white/80 shrink-0">
                    {entry.durationMinutes ? fmtDuration(entry.durationMinutes) : liveDur}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </main>
  );
}
