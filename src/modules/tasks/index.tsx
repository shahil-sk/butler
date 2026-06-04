import { useState, useCallback, useMemo, useEffect } from "react";
import { Plus, LayoutGrid, Kanban, List, Clock } from "lucide-react";
import { registry } from "@/kernel/router";
import { tasksManifest } from "./manifest";
import { useTaskStore } from "./store";
import { setupTaskEventListeners } from "./events";
import { HeroHeader } from "./components/HeroHeader";
import { BentoGrid } from "./components/BentoGrid";
import { TaskDetail } from "./components/TaskDetail";
import { KanbanView } from "./components/KanbanView";
import { ListView } from "./components/ListView";
import { TimelineView } from "./components/TimelineView";
import { cn } from "@/shared/utils";
import type { Priority } from "@/shared/types";

registry.register(tasksManifest);
setupTaskEventListeners();

export function TasksModule() {
  const { tasks, completeTask, updateTask, openTask, openQuickAdd, loadTasks } = useTaskStore();
  const [activeView, setActiveView] = useState<"bento" | "kanban" | "list" | "timeline">(() => {
    return (localStorage.getItem("tasks_view") as any) || "bento";
  });
  const [priorityFilter, setPriorityFilter] = useState<Priority | null>(() => {
    return (localStorage.getItem("tasks_priority_filter") as Priority) || null;
  });
  const [dueFilter, setDueFilter] = useState<"overdue" | "today" | "tomorrow" | null>(() => {
    return (localStorage.getItem("tasks_due_filter") as any) || null;
  });

  useEffect(() => { localStorage.setItem("tasks_view", activeView); }, [activeView]);
  useEffect(() => { if (priorityFilter) localStorage.setItem("tasks_priority_filter", priorityFilter); else localStorage.removeItem("tasks_priority_filter"); }, [priorityFilter]);
  useEffect(() => { if (dueFilter) localStorage.setItem("tasks_due_filter", dueFilter); else localStorage.removeItem("tasks_due_filter"); }, [dueFilter]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const activeTasks = useMemo(() => {
    const pWeight = { urgent: 4, high: 3, medium: 2, low: 1, none: 0 };
    const tDay = new Date().toISOString().slice(0, 10);
    return tasks
      .filter(t => {
        if (t.status === "archived" || t.status === "done") return false;
        const dateStr = t.scheduledDate || t.dueDate;
        
        if (dueFilter && dateStr) {
          const d = new Date(dateStr);
          d.setHours(0,0,0,0);
          const td = new Date();
          td.setHours(0,0,0,0);
          const diff = Math.round((d.getTime() - td.getTime()) / 86400000);
          
          if (dueFilter === "overdue" && diff >= 0) return false;
          if (dueFilter === "today" && diff !== 0) return false;
          if (dueFilter === "tomorrow" && diff !== 1) return false;
        } else if (dueFilter && !dateStr) {
          return false;
        }

        if (!dateStr) return true;
        return true;
      })
      .sort((a, b) => {
        const pA = a.priority ? pWeight[a.priority as keyof typeof pWeight] || 0 : 0;
        const pB = b.priority ? pWeight[b.priority as keyof typeof pWeight] || 0 : 0;
        if (pA !== pB) return pB - pA;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [tasks]);

  const handleToggleComplete = useCallback((id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    if (task.status === "done") {
      void updateTask(id, { status: "todo" });
    } else {
      void completeTask(id);
    }
  }, [tasks, completeTask, updateTask]);

  const handlePriorityFilter = useCallback((p: Priority) => {
    setPriorityFilter(prev => prev === p ? null : p);
  }, []);

  const handleDueFilter = useCallback((d: "overdue" | "today" | "tomorrow") => {
    setDueFilter(prev => prev === d ? null : d);
  }, []);

  return (
    <main className="w-full h-full overflow-y-auto overflow-x-hidden bg-background text-foreground pb-32">
      
      {/* Top Glass Navigation */}
      <div className="sticky top-6 mx-auto w-fit z-50 flex items-center gap-2 p-2 bg-card/70 backdrop-blur-xl border border-border/50 rounded-full shadow-2xl mb-8">
        <button
          onClick={() => setActiveView("bento")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all",
            activeView === "bento" ? "bg-foreground text-background shadow-md" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <LayoutGrid size={16} /> Bento
        </button>
        <button
          onClick={() => setActiveView("kanban")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all",
            activeView === "kanban" ? "bg-foreground text-background shadow-md" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Kanban size={16} /> Board
        </button>
        <button
          onClick={() => setActiveView("list")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all",
            activeView === "list" ? "bg-foreground text-background shadow-md" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <List size={16} /> List
        </button>
        <button
          onClick={() => setActiveView("timeline")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all",
            activeView === "timeline" ? "bg-foreground text-background shadow-md" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Clock size={16} /> Timeline
        </button>
      </div>

      {activeView === "bento" && (
        <HeroHeader 
          priorityFilter={priorityFilter} 
          onPriorityFilter={handlePriorityFilter} 
          dueFilter={dueFilter}
          onDueFilter={handleDueFilter}
        />
      )}

      {activeView === "bento" && (
        <BentoGrid 
          tasks={activeTasks} 
          onOpenTask={openTask} 
          onToggleComplete={handleToggleComplete}
          priorityFilter={priorityFilter}
          onPriorityFilter={handlePriorityFilter}
        />
      )}
      
      {activeView === "kanban" && (
        <KanbanView 
          tasks={tasks} 
          onOpenTask={openTask} 
          onToggleComplete={handleToggleComplete} 
        />
      )}

      {activeView === "list" && (
        <ListView 
          tasks={tasks} 
          onOpenTask={openTask} 
          onToggleComplete={handleToggleComplete} 
        />
      )}

      {activeView === "timeline" && (
        <TimelineView 
          tasks={tasks} 
          onOpenTask={openTask} 
        />
      )}

      {/* Floating Massive CTA */}
      <button
        onClick={() => openQuickAdd()}
        className="fixed bottom-10 right-10 z-50 w-20 h-20 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-2xl shadow-primary/30 hover:scale-110 hover:shadow-primary/50 transition-all duration-500 ease-out group"
      >
        <Plus size={36} className="group-hover:rotate-90 transition-transform duration-500" />
      </button>

      <TaskDetail />
    </main>
  );
}
