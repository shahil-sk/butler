import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { CheckCircle2, Circle, Calendar, Clock, ArrowRight } from "lucide-react";
import type { Task } from "@/shared/types";
import { cn, formatDate } from "@/shared/utils";

interface Props {
  tasks: Task[];
  onOpenTask: (id: string) => void;
  onToggleComplete: (id: string) => void;
}

export function ListView({ tasks, onOpenTask, onToggleComplete }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!containerRef.current) return;
    gsap.fromTo(".list-item-row",
      { x: -20, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.4, stagger: 0.05, ease: "power2.out" }
    );
  }, { scope: containerRef });
  if (tasks.length === 0) {
    return (
      <div className="py-32 text-center">
        <p className="text-xl text-muted-foreground font-medium">No tasks found.</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full max-w-5xl mx-auto px-4 md:px-8 pt-32 pb-32 flex flex-col gap-2">
      {tasks.map(task => (
        <div 
          key={task.id}
          onClick={() => onOpenTask(task.id)}
          className={cn(
            "list-item-row group flex items-center justify-between p-4 rounded-2xl cursor-pointer",
            "bg-card/30 hover:bg-card/80 border border-transparent hover:border-border/50",
            "transition-all duration-300",
            task.status === "done" && "opacity-50 grayscale"
          )}
        >
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <button
              onClick={(e) => { e.stopPropagation(); onToggleComplete(task.id); }}
              className="shrink-0 p-1 text-muted-foreground hover:text-emerald-500 transition-colors"
            >
              {task.status === "done" ? <CheckCircle2 size={24} className="text-emerald-500" /> : <Circle size={24} />}
            </button>
            <div className="flex flex-col min-w-0 gap-1 flex-1">
              <h3 className={cn(
                "text-lg font-semibold truncate",
                task.status === "done" && "line-through text-muted-foreground"
              )}>
                {task.title}
              </h3>
              {task.description && (
                <p className="text-xs text-muted-foreground truncate">{task.description}</p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-4 shrink-0 pl-6">
            <div className="flex items-center gap-2">
              {task.priority && task.priority !== "none" && (
                <span className={cn(
                  "w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-bold uppercase",
                  task.priority === "urgent" ? "bg-red-500 text-white" :
                  task.priority === "high" ? "bg-orange-500/10 text-orange-500" :
                  task.priority === "medium" ? "bg-yellow-500/10 text-yellow-600" :
                  "bg-blue-500/10 text-blue-500"
                )}>
                  {task.priority.charAt(0)}
                </span>
              )}
              {task.projectId && (
                <span className="px-3 py-1 rounded-full bg-muted/50 text-muted-foreground text-[10px] font-bold uppercase tracking-widest truncate max-w-[120px]">
                  Project
                </span>
              )}
            </div>
            {task.scheduledDate && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-primary/5 px-2 py-1 rounded-md">
                <Calendar size={14} />
                {formatDate(task.scheduledDate)}
              </span>
            )}
            <div className="w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 group-hover:bg-primary/10 transition-all text-primary">
              <ArrowRight size={16} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
