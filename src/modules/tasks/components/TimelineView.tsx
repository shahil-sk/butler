import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { Task } from "@/shared/types";
import { cn, formatDate } from "@/shared/utils";

gsap.registerPlugin(ScrollTrigger);

interface Props {
  tasks: Task[];
  onOpenTask: (id: string) => void;
}

export function TimelineView({ tasks, onOpenTask }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter only tasks that have dates
  const timelineTasks = tasks
    .filter(t => t.scheduledDate || t.dueDate)
    .sort((a,b) => {
      const dateA = a.scheduledDate || a.dueDate || "";
      const dateB = b.scheduledDate || b.dueDate || "";
      return dateA.localeCompare(dateB);
    });

  useGSAP(() => {
    if (!containerRef.current) return;
    
    // We can animate timeline items staggering in
    gsap.fromTo(".timeline-node", 
      { opacity: 0, scale: 0.5, y: 50 },
      { opacity: 1, scale: 1, y: 0, stagger: 0.1, duration: 0.6, ease: "back.out(1.5)" }
    );
  }, { scope: containerRef, dependencies: [timelineTasks.length] });

  if (timelineTasks.length === 0) {
    return (
      <div className="py-32 text-center">
        <p className="text-xl text-muted-foreground font-medium">No scheduled tasks.</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-[80vh] flex flex-col justify-center px-8 md:px-16 pt-24 overflow-x-auto">
      <div className="flex items-center min-w-max pb-32">
        <div className="w-8 h-1 bg-gradient-to-r from-transparent to-border/50 shrink-0" />
        
        {timelineTasks.map((task, i) => {
          const isTop = i % 2 === 0;
          const dateLabel = formatDate(task.scheduledDate || task.dueDate);
          
          return (
            <div key={task.id} className="relative flex items-center shrink-0 w-80 timeline-node group">
              <div className="w-full h-1 bg-border/50 relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-4 border-background bg-primary z-10 transition-transform duration-300 group-hover:scale-150" />
              </div>
              
              <div 
                onClick={() => onOpenTask(task.id)}
                className={cn(
                  "absolute left-1/2 -translate-x-1/2 w-72 p-5 cursor-pointer flex flex-col gap-3",
                  "bg-card/80 backdrop-blur-md border border-border/50 rounded-2xl transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:border-primary/50",
                  isTop ? "bottom-8" : "top-8"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-primary px-2 py-1 bg-primary/10 rounded-md block w-fit">{dateLabel}</span>
                  {task.priority && task.priority !== "none" && (
                    <span className={cn(
                      "w-5 h-5 flex items-center justify-center rounded-full text-[9px] font-bold uppercase",
                      task.priority === "urgent" ? "bg-red-500 text-white" :
                      task.priority === "high" ? "bg-orange-500/10 text-orange-500" :
                      task.priority === "medium" ? "bg-yellow-500/10 text-yellow-600" :
                      "bg-blue-500/10 text-blue-500"
                    )}>
                      {task.priority.charAt(0)}
                    </span>
                  )}
                </div>
                
                <div>
                  <h4 className={cn(
                    "font-semibold text-base leading-tight line-clamp-2",
                    task.status === "done" && "line-through text-muted-foreground"
                  )}>
                    {task.title}
                  </h4>
                  {task.description && (
                    <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">{task.description}</p>
                  )}
                </div>
                
                {(task.estimateMinutes || (task.dependencies && task.dependencies.length > 0)) && (
                  <div className="flex items-center gap-3 pt-2 border-t border-border/30 text-xs text-muted-foreground">
                    {task.estimateMinutes && <span>{task.estimateMinutes}m</span>}
                    {task.dependencies && task.dependencies.length > 0 && <span className="text-orange-500/70">{task.dependencies.length} Blockers</span>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        
        <div className="w-24 h-1 bg-gradient-to-l from-transparent to-border/50 shrink-0" />
      </div>
    </div>
  );
}
