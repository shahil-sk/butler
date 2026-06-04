import { useState } from "react";
import { useTaskStore } from "../store";
import { TaskCard } from "./TaskCard";
import type { Task } from "@/shared/types";
import { cn } from "@/shared/utils";

interface Props {
  tasks: Task[];
  onOpenTask: (id: string) => void;
  onToggleComplete: (id: string) => void;
}

const COLUMNS = [
  { id: "todo", label: "To Do", bg: "bg-muted/30" },
  { id: "in_progress", label: "In Progress", bg: "bg-blue-500/5" },
  { id: "done", label: "Completed", bg: "bg-emerald-500/5" }
] as const;

export function KanbanView({ tasks, onOpenTask, onToggleComplete }: Props) {
  const updateTask = useTaskStore(s => s.updateTask);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("taskId", id);
    setDraggedId(id);
  };

  const handleDrop = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("taskId");
    if (id) {
      void updateTask(id, { status: status as any });
    }
    setDraggedId(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div className="w-full h-[calc(100vh-140px)] mt-24 px-4 md:px-8 pb-8 flex gap-4 md:gap-8 overflow-x-auto">
      {COLUMNS.map(col => {
        const colTasks = tasks.filter(t => 
          t.status === col.id || 
          (col.id === "todo" && !["todo", "in_progress", "done"].includes(t.status))
        ).sort((a,b) => b.priority === "urgent" ? 1 : b.priority === "high" ? 0 : -1);

        return (
          <div 
            key={col.id}
            onDrop={(e) => handleDrop(e, col.id)}
            onDragOver={handleDragOver}
            className={cn(
              "flex flex-col flex-1 min-w-[320px] rounded-3xl border border-border/50",
              "transition-colors duration-300 backdrop-blur-sm",
              col.bg
            )}
          >
            <div className="p-6 border-b border-border/30 flex items-center justify-between">
              <h2 className="text-xl font-bold tracking-tight">{col.label}</h2>
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-background border border-border">
                {colTasks.length}
              </span>
            </div>
            
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
              {colTasks.map(task => (
                <div 
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task.id)}
                  onDragEnd={() => setDraggedId(null)}
                  className={cn(
                    "cursor-grab active:cursor-grabbing transform transition-transform",
                    draggedId === task.id && "opacity-50 scale-95"
                  )}
                >
                  <TaskCard 
                    task={task} 
                    onOpen={() => onOpenTask(task.id)} 
                    onToggleComplete={() => onToggleComplete(task.id)} 
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
