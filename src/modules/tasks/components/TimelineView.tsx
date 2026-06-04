import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import type { Task } from "@/shared/types";
import { cn, formatDate } from "@/shared/utils";

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
    
    // Animate vertical timeline items sliding in from sides
    const nodes = gsap.utils.toArray<HTMLElement>(".timeline-node");
    nodes.forEach((node, i) => {
      const isLeft = i % 2 === 0;
      gsap.fromTo(node, 
        { opacity: 0, x: isLeft ? -50 : 50, y: 20 },
        { opacity: 1, x: 0, y: 0, duration: 0.6, ease: "power3.out", delay: i * 0.1 }
      );
    });
  }, { scope: containerRef, dependencies: [timelineTasks.length] });

  if (timelineTasks.length === 0) {
    return (
      <div className="py-32 text-center">
        <p className="text-xl text-muted-foreground font-medium">No scheduled tasks.</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full mx-auto py-24 px-4 md:px-8">
      {/* Center Vertical Line */}
      <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-[2px] bg-gradient-to-b from-transparent via-border to-transparent md:-translate-x-1/2" />

      <div className="flex flex-col gap-8 md:gap-16">
        {timelineTasks.map((task, i) => {
          const isLeft = i % 2 === 0;
          const dateLabel = formatDate(task.scheduledDate || task.dueDate);

          return (
            <div 
              key={task.id} 
              className={cn(
                "timeline-node relative flex items-center w-full",
                isLeft ? "md:justify-start" : "md:justify-end"
              )}
            >
              {/* Timeline Dot */}
              <div className="absolute left-4 md:left-1/2 w-4 h-4 rounded-full border-4 border-background bg-primary z-10 -translate-x-1/2 shadow-[0_0_0_4px_rgba(var(--background),1)] transition-transform duration-300 hover:scale-150" />

              {/* Task Card */}
              <div 
                onClick={() => onOpenTask(task.id)}
                className={cn(
                  "w-[calc(100%-3rem)] md:w-[calc(50%-3rem)] p-5 cursor-pointer ml-12 md:ml-0 flex flex-col gap-3",
                  "bg-card/80 backdrop-blur-md border border-border/50 rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-primary/50 group"
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
                    "font-semibold text-lg leading-tight line-clamp-2 transition-colors group-hover:text-primary",
                    task.status === "done" && "line-through text-muted-foreground"
                  )}>
                    {task.title}
                  </h4>
                  {task.description && (
                    <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">{task.description}</p>
                  )}
                </div>
                
                {(task.estimateMinutes || (task.dependencies && task.dependencies.length > 0)) && (
                  <div className="flex items-center gap-4 pt-3 mt-1 border-t border-border/30 text-xs font-medium text-muted-foreground">
                    {task.estimateMinutes && <span>{task.estimateMinutes} mins</span>}
                    {task.dependencies && task.dependencies.length > 0 && <span className="text-orange-500/80">{task.dependencies.length} Blockers</span>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
