import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Maximize2, Pause, Play, Square } from "lucide-react";
import { useFocusStore } from "../store";
import { useTaskStore } from "@/modules/tasks/store";
import { cn } from "@/shared/utils";

function formatSecs(s: number) {
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return `${m}:${rs < 10 ? "0" : ""}${rs}`;
}

export function FocusHUD() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const activeSession = useFocusStore((s) => s.activeSession);
  const secondsLeft = useFocusStore((s) => s.secondsLeft);
  const completedFocusCount = useFocusStore((s) => s.completedFocusCount);
  const config = useFocusStore((s) => s.config);
  
  const pause = useFocusStore((s) => s.pause);
  const resume = useFocusStore((s) => s.resume);
  const cancel = useFocusStore((s) => s.cancel);

  // If we are on the Focus page, hide the HUD
  if (pathname.startsWith("/focus")) return null;
  if (!activeSession) return null;

  const totalSeconds = (activeSession.plannedDuration ?? 25) * 60;
  const progress = totalSeconds > 0 ? (totalSeconds - secondsLeft) / totalSeconds : 0;

  // We can get task title from the tasks store if we have a taskId
  const tasks = useTaskStore.getState().tasks;
  const task = activeSession.taskId ? tasks.find(t => t.id === activeSession.taskId) : null;
  const title = task ? task.title : activeSession.goal || "Deep Work";

  const isPaused = activeSession.status === "paused" || activeSession.state === "paused";
  const ringColor =
    activeSession.state === "break" ? "hsl(142 65% 44%)" :
    isPaused ? "hsl(38 92% 52%)" :
    "hsl(var(--primary))";

  // Pomodoro dots
  const setCount = config?.pomodoroSetCount ?? 4;
  const dots = [];
  const currentPomoIndex = completedFocusCount % setCount;
  for (let i = 0; i < setCount; i++) {
    dots.push(i < currentPomoIndex);
  }

  const r = 16;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - progress);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-4 bg-card/95 backdrop-blur shadow-lg border border-border/50 rounded-full px-2 py-2 pr-4 shadow-xl animate-in slide-in-from-bottom-5 fade-in duration-300">
      
      {/* Progress Ring & Timer */}
      <div className="relative flex items-center justify-center w-12 h-12 ml-1 cursor-pointer group" onClick={() => navigate("/focus")}>
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 40 40">
          <circle cx="20" cy="20" r={r} fill="none" strokeWidth="3" stroke="hsl(var(--border))" />
          <circle cx="20" cy="20" r={r} fill="none" strokeWidth="3"
            stroke={ringColor} strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1s linear, stroke 0.4s ease" }}
          />
        </svg>
        <span className="text-[11px] font-mono font-medium leading-none z-10 group-hover:hidden">
          {formatSecs(secondsLeft)}
        </span>
        <Maximize2 size={12} className="z-10 hidden group-hover:block text-muted-foreground" />
      </div>

      {/* Info & Controls */}
      <div className="flex flex-col justify-center">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium leading-tight max-w-[120px] truncate" title={title}>
            {title}
          </span>
          <div className="flex gap-0.5">
            {dots.map((filled, i) => (
              <div key={i} className={cn("w-1.5 h-1.5 rounded-full transition-colors", filled ? "bg-primary" : "bg-border")} />
            ))}
          </div>
        </div>
        
        <div className="flex items-center gap-3 mt-1.5">
          {isPaused ? (
            <button onClick={() => resume()} className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider">
              <Play size={10} /> Resume
            </button>
          ) : (
            <button onClick={() => pause()} className="text-muted-foreground hover:text-amber-500 transition-colors flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider">
              <Pause size={10} /> Pause
            </button>
          )}
          <button onClick={() => cancel()} className="text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider">
            <Square size={10} /> Stop
          </button>
        </div>
      </div>
      
    </div>
  );
}
