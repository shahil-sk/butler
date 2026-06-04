import React from "react";
import { useFocusStore } from "../store";
import { FastForward, Play } from "lucide-react";

function formatSecs(s: number) {
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return `${m}:${rs < 10 ? "0" : ""}${rs}`;
}

export function BreakScreen() {
  const activeSession = useFocusStore((s) => s.activeSession);
  const secondsLeft = useFocusStore((s) => s.secondsLeft);
  const skipBreak = useFocusStore((s) => s.skipBreak);

  if (!activeSession || activeSession.state !== "break") return null;

  const totalSeconds = (activeSession.plannedDuration ?? 5) * 60;
  const progress = totalSeconds > 0 ? (totalSeconds - secondsLeft) / totalSeconds : 0;
  
  const r = 160;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - progress);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/95 backdrop-blur-md animate-in fade-in duration-500">
      <div className="relative flex items-center justify-center w-[400px] h-[400px]">
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 400 400">
          <circle cx="200" cy="200" r={r} fill="none" strokeWidth="8" stroke="hsl(var(--border))" />
          <circle cx="200" cy="200" r={r} fill="none" strokeWidth="12"
            stroke="hsl(142 65% 44%)" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1s linear, stroke 0.4s ease" }}
          />
        </svg>
        <div className="flex flex-col items-center z-10">
          <span className="text-muted-foreground font-semibold tracking-[0.2em] uppercase text-sm mb-4">
            {activeSession.type === "long_break" ? "Long Break" : "Short Break"}
          </span>
          <span className="text-8xl font-mono font-bold tracking-tighter tabular-nums text-foreground">
            {formatSecs(secondsLeft)}
          </span>
          <span className="text-muted-foreground mt-4 max-w-[250px] text-center text-sm">
            Step away, stretch, hydrate. Let your mind rest.
          </span>
        </div>
      </div>
      
      <div className="mt-12 flex gap-4">
        <button 
          onClick={() => skipBreak()} 
          className="flex items-center gap-2 px-6 py-3 rounded-full bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-all font-medium"
        >
          <FastForward size={16} /> Skip Break
        </button>
      </div>
    </div>
  );
}
