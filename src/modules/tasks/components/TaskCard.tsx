import { useRef } from "react";
import { CheckCircle2, Circle, Calendar, ArrowRight, Repeat, Link as LinkIcon, Network, GitBranch, Clock, Sun, CalendarDays, CalendarRange, AlertCircle, Play } from "lucide-react";
import { format, isValid } from "date-fns";
import { cn } from "@/shared/utils";
import type { Task } from "@/shared/types";
import { useProjectStore } from "@/modules/projects/store";
import { useTaskStore } from "../store";
import { useFocusStore } from "@/modules/focus/store";

function formatTaskDate(dateString: string) {
  try {
    const d = new Date(dateString);
    if (!isValid(d)) return dateString;
    if (dateString.includes("T")) {
      return format(d, "MMM d, h:mm a");
    }
    return format(d, "MMM d");
  } catch {
    return dateString;
  }
}

interface Props {
  task: Task;
  onOpen: () => void;
  onToggleComplete: () => void;
  onPriorityClick?: (e: React.MouseEvent, priority: string) => void;
}

const priorityConfig: Record<string, { label: string; classes: string } | null> = {
  urgent: { label: "U", classes: "bg-red-500 text-white shadow-lg border border-red-400" },
  high: { label: "H", classes: "bg-orange-500/10 text-orange-500 border border-orange-500/30" },
  medium: { label: "M", classes: "bg-yellow-500/10 text-yellow-600 border border-yellow-500/30" },
  low: { label: "L", classes: "bg-blue-500/10 text-blue-500 border border-blue-500/30" },
  none: null
};

const statusConfig: Record<string, { label: string; classes: string }> = {
  todo: { label: "To Do", classes: "bg-muted text-muted-foreground" },
  in_progress: { label: "In Progress", classes: "bg-blue-500/10 text-blue-500" },
  done: { label: "Done", classes: "bg-emerald-500/10 text-emerald-500" },
  cancelled: { label: "Cancelled", classes: "bg-zinc-500/10 text-zinc-500 line-through" },
  archived: { label: "Archived", classes: "bg-zinc-800 text-zinc-400" },
};

export function TaskCard({ task, onOpen, onToggleComplete, onPriorityClick }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  
  // Zustand fetches
  const projects = useProjectStore(s => s.projects);
  const project = task.projectId ? projects.find(p => p.id === task.projectId) : null;
  const allTasks = useTaskStore(s => s.tasks);
  const startFocus = useFocusStore(s => s.startFocus);
  
  const subtasks = allTasks.filter(t => t.parentTaskId === task.id);
  const doneSubtasks = subtasks.filter(t => t.status === "done");
  
  // Decide span based on priority / size
  const isLarge = task.priority === "urgent" || task.priority === "high" || task.size === "l" || task.size === "xl";
  const isWide = task.title.length > 50;

  const prio = task.priority ? priorityConfig[task.priority] : null;

  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  let dueStatus: { label: string; class: string; icon: React.ReactNode } | null = null;
  const targetDateStr = task.dueDate || task.scheduledDate;

  if (targetDateStr && task.status !== "done") {
    const d = new Date(targetDateStr);
    d.setHours(0, 0, 0, 0);
    const diffDays = Math.round((d.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      dueStatus = { label: "Overdue", class: "bg-red-500/10 text-red-500 border-red-500/30", icon: <AlertCircle size={12} /> };
    } else if (diffDays === 0) {
      dueStatus = { label: "Due Today", class: "bg-orange-500/10 text-orange-500 border-orange-500/30", icon: <Clock size={12} /> };
    } else if (diffDays === 1) {
      dueStatus = { label: "Due Tomorrow", class: "bg-amber-500/10 text-amber-500 border-amber-500/30", icon: <Calendar size={12} /> };
    } else if (diffDays <= 3) {
      dueStatus = { label: `Due in ${diffDays}d`, class: "bg-blue-500/10 text-blue-500 border-blue-500/30", icon: <Calendar size={12} /> };
    }
  }
  
  return (
    <div
      ref={cardRef}
      onClick={onOpen}
      className={cn(
        "task-card group relative flex flex-col justify-between overflow-hidden cursor-pointer",
        "bg-card/50 backdrop-blur-md border border-border hover:border-primary/50",
        "p-6 transition-all duration-700 ease-out h-full min-h-0", // min-h-0 prevents flex children from pushing bounds
        "hover:shadow-2xl hover:-translate-y-1",
        isLarge && isWide ? "col-span-1 md:col-span-2 row-span-2 min-h-[300px]" : 
        isWide ? "col-span-1 md:col-span-2 row-span-1 min-h-[220px]" :
        isLarge ? "col-span-1 row-span-2 min-h-[380px]" : "col-span-1 row-span-1 min-h-[220px]",
        task.status === "done" && "opacity-50 grayscale hover:grayscale-0"
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
      
      <div className="relative z-10 flex items-start justify-between gap-3 mb-4">
        <button
          onClick={(e) => { 
            e.stopPropagation(); 
            const hasIncompleteBlocker = task.dependencies?.some(depId => {
              const depTask = allTasks.find(t => t.id === depId);
              return depTask && depTask.status !== "done";
            });
            if (hasIncompleteBlocker && task.status !== "done") {
              import("gsap").then((gsap) => {
                gsap.default.fromTo(cardRef.current, 
                  { x: -8 }, 
                  { x: 8, duration: 0.05, yoyo: true, repeat: 5, clearProps: "x", ease: "power1.inOut" }
                );
              });
            }
            onToggleComplete(); 
          }}
          className="shrink-0 p-1 -ml-1 text-muted-foreground hover:text-emerald-500 transition-colors"
        >
          {task.status === "done" ? <CheckCircle2 size={24} className="text-emerald-500" /> : <Circle size={24} />}
        </button>
        <div className="flex flex-wrap items-center gap-2 justify-end flex-1">
          <span className={cn("px-2 py-1 rounded-full text-[10px] font-semibold uppercase tracking-[0.08em]", statusConfig[task.status]?.classes || statusConfig.todo.classes)}>
            {statusConfig[task.status]?.label || "To Do"}
          </span>
          {prio && (
            <span 
              onClick={onPriorityClick ? (e) => onPriorityClick(e, task.priority!) : undefined}
              className={cn("w-6 h-6 flex items-center justify-center rounded-full text-[10px] font-semibold uppercase shrink-0", prio.classes, onPriorityClick && "cursor-pointer hover:scale-105 transition-transform")}
            >
              {prio.label}
            </span>
          )}
          {project && (
            <span className="px-2 py-1 rounded-full bg-muted/40 text-muted-foreground text-[10px] font-semibold uppercase tracking-[0.08em] truncate max-w-[110px]">
              {project.name}
            </span>
          )}
          {(dueStatus || targetDateStr) && (
            <span className={cn("flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold tracking-[0.08em]", dueStatus ? dueStatus.class : "bg-primary/10 text-primary")}> 
              {dueStatus ? dueStatus.icon : <Calendar size={12} />}
              {dueStatus ? dueStatus.label : targetDateStr ? formatTaskDate(targetDateStr) : ""}
            </span>
          )}
        </div>
      </div>

      <div className="relative z-10 mt-auto flex-1 flex flex-col justify-center pb-10 min-h-0">
        <h3 className={cn(
          "font-bold leading-tight tracking-tight text-foreground transition-all duration-500 group-hover:translate-x-2",
          isLarge ? "text-2xl md:text-3xl line-clamp-4" : "text-lg md:text-xl line-clamp-3",
          task.status === "done" && "line-through text-muted-foreground"
        )}>
          {task.title}
        </h3>
        
        {task.description && (
          <p className="mt-3 text-sm text-muted-foreground line-clamp-2 leading-relaxed max-w-[90%] flex-shrink-0">
            {task.description}
          </p>
        )}
      </div>

      {/* Integration Meta Bar - smaller and less crowded */}
      <div className="relative z-10 flex flex-wrap items-center gap-3 text-xs text-muted-foreground/70 pr-10 shrink-0">
        {subtasks.length > 0 && (
          <div className="flex items-center gap-1.5">
            <GitBranch size={14} />
            <span>{doneSubtasks.length}/{subtasks.length}</span>
          </div>
        )}
        {task.dependencies && task.dependencies.length > 0 && (
          <div 
            className="flex items-center gap-1.5 text-orange-500/80 cursor-help"
            title={`Blocked by:\n${task.dependencies.map(id => allTasks.find(t => t.id === id)?.title || "Unknown Task").join("\n")}`}
          >
            <Network size={14} />
            <span>{task.dependencies.length}</span>
          </div>
        )}
        {task.recurrence && (
          <div className="flex items-center gap-1.5 text-blue-500/80" title={`Repeats ${task.recurrence.frequency}`}>
            {task.recurrence.frequency === 'daily' ? <Sun size={14} /> : 
             task.recurrence.frequency === 'weekly' ? <CalendarDays size={14} /> : 
             task.recurrence.frequency === 'monthly' ? <CalendarRange size={14} /> : 
             <Repeat size={14} />}
          </div>
        )}
        {task.linkedNoteIds && task.linkedNoteIds.length > 0 && (
          <div className="flex items-center gap-1.5">
            <LinkIcon size={14} />
            <span>{task.linkedNoteIds.length}</span>
          </div>
        )}
        {task.estimateMinutes && (
          <div className="flex items-center gap-1.5">
            <Clock size={14} />
            <span>{task.estimateMinutes}m</span>
          </div>
        )}
      </div>
      
      <div className="absolute bottom-6 right-6 opacity-0 translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-500 ease-out z-20 flex items-center gap-2">
        <button 
          onClick={(e) => { e.stopPropagation(); startFocus(task.id); }}
          className="w-10 h-10 rounded-full bg-background border border-primary text-primary flex items-center justify-center shadow-lg hover:bg-primary hover:text-primary-foreground transition-colors"
          title="Start Flow"
        >
          <Play size={18} className="ml-0.5" fill="currentColor" />
        </button>
        <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg">
          <ArrowRight size={18} />
        </div>
      </div>
    </div>
  );
}
