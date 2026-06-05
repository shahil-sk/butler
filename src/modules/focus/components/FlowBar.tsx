import { useFocusStore } from "../store";
import { useTaskStore } from "@/modules/tasks/store";
import { Play, Square, CheckCircle2, X } from "lucide-react";
import { cn } from "@/shared/utils";

export function FlowBar() {
  const { activeSession, stopFocus, cancelFocus, _tick } = useFocusStore();
  const tasks = useTaskStore(s => s.tasks);
  const completeTask = useTaskStore(s => s.completeTask);

  if (!activeSession) return null;

  const task = tasks.find(t => t.id === activeSession.taskId);
  
  // calculate elapsed time
  const startMs = new Date(activeSession.startedAt).getTime();
  const elapsedSecs = Math.floor((Date.now() - startMs) / 1000);
  const m = Math.floor(elapsedSecs / 60).toString().padStart(2, "0");
  const s = (elapsedSecs % 60).toString().padStart(2, "0");

  const handleComplete = async () => {
    if (task) await completeTask(task.id);
    await stopFocus();
  };

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[1000] animate-in slide-in-from-bottom-10 fade-in duration-500">
      <div className="flex items-center gap-4 bg-background/80 backdrop-blur-2xl border border-primary/30 p-2 pr-4 rounded-full shadow-[0_20px_50px_rgba(var(--primary)/0.15)]">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center relative">
          <div className="absolute inset-0 rounded-full border border-primary/50 animate-ping" />
          <div className="w-3 h-3 rounded-full bg-primary shadow-[0_0_10px_rgba(var(--primary)/1)]" />
        </div>
        
        <div className="flex flex-col min-w-[150px] max-w-[300px]">
          <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Flow Engaged</span>
          <span className="text-sm font-semibold truncate text-foreground leading-tight">{task?.title || "Deep Work"}</span>
        </div>

        <div className="text-2xl font-mono font-black tracking-tighter text-foreground px-4 tabular-nums w-[80px] text-center">
          {m}:{s}
        </div>

        <div className="flex items-center gap-2 border-l border-border/50 pl-4">
          <button 
            onClick={stopFocus}
            className="p-2.5 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-all hover:scale-110"
            title="Stop Timer"
          >
            <Square size={16} fill="currentColor" />
          </button>
          
          <button 
            onClick={handleComplete}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all hover:scale-105 text-[11px] font-black uppercase tracking-wider shadow-sm"
            title="Complete Task"
          >
            <CheckCircle2 size={16} /> Done
          </button>

          <button 
            onClick={cancelFocus}
            className="p-2.5 rounded-full text-muted-foreground hover:bg-red-500/20 hover:text-red-500 transition-all hover:scale-110 ml-1"
            title="Cancel Focus Session"
          >
            <X strokeWidth={3} size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
