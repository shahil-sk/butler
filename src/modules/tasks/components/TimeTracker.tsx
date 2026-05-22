import { useEffect, useState } from "react";
import { Square } from "lucide-react";
import { useTaskStore } from "../store";
import { cn } from "@/shared/utils";

export function TimeTracker() {
  const { activeTimerTaskId, activeTimerStartAt, stopTimer, tasks } = useTaskStore();
  const [elapsed, setElapsed] = useState(0);

  const activeTask = tasks.find((t) => t.id === activeTimerTaskId);

  useEffect(() => {
    if (!activeTimerStartAt) {
      setElapsed(0);
      return;
    }
    
    // Initial sync
    setElapsed(Math.floor((Date.now() - activeTimerStartAt) / 1000));
    
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - activeTimerStartAt) / 1000));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [activeTimerStartAt]);

  if (!activeTimerTaskId || !activeTask) return null;

  const totalActualSecs = (activeTask.actualMinutes || 0) * 60 + elapsed;
  const mins = Math.floor(totalActualSecs / 60);
  const secs = totalActualSecs % 60;
  const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  return (
    <div className="fixed bottom-6 right-6 bg-card border border-border shadow-lg rounded-full px-5 py-2.5 flex items-center gap-4 z-50 animate-in slide-in-from-bottom-5">
      <div className="flex flex-col max-w-[200px]">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </span>
          Tracking
        </span>
        <span className="text-[13px] font-medium text-foreground truncate">{activeTask.title}</span>
      </div>
      
      <div className="text-[16px] font-mono font-bold text-foreground tabular-nums tracking-tight">
        {timeStr}
      </div>
      
      <div className="w-px h-6 bg-border mx-1"></div>
      
      <button 
        onClick={() => void stopTimer()} 
        className="h-8 w-8 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-center transition-colors"
        title="Stop Timer"
      >
        <Square size={13} fill="currentColor" />
      </button>
    </div>
  );
}
