import { useTaskStore } from "../store";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef } from "react";
import { format } from "date-fns";
import { cn } from "@/shared/utils";
import type { Priority } from "@/shared/types";

const PRIORITY_CONFIG: Record<string, { label: string; dot: string; active: string; hover: string }> = {
  urgent: {
    label: "Urgent",
    dot: "bg-red-500",
    active: "bg-red-500/15 text-red-500 border border-red-500/40 shadow-red-500/20 shadow-lg",
    hover: "hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30",
  },
  high: {
    label: "High",
    dot: "bg-orange-400",
    active: "bg-orange-400/15 text-orange-400 border border-orange-400/40 shadow-orange-400/20 shadow-lg",
    hover: "hover:bg-orange-400/10 hover:text-orange-400 hover:border-orange-400/30",
  },
  medium: {
    label: "Medium",
    dot: "bg-yellow-400",
    active: "bg-yellow-400/15 text-yellow-400 border border-yellow-400/40 shadow-yellow-400/20 shadow-lg",
    hover: "hover:bg-yellow-400/10 hover:text-yellow-400 hover:border-yellow-400/30",
  },
  low: {
    label: "Low",
    dot: "bg-blue-400",
    active: "bg-blue-400/15 text-blue-400 border border-blue-400/40 shadow-blue-400/20 shadow-lg",
    hover: "hover:bg-blue-400/10 hover:text-blue-400 hover:border-blue-400/30",
  },
};

interface HeroHeaderProps {
  priorityFilter: Priority | null;
  onPriorityFilter: (p: Priority) => void;
  dueFilter: "overdue" | "today" | "tomorrow" | null;
  onDueFilter: (d: "overdue" | "today" | "tomorrow") => void;
}

export function HeroHeader({ priorityFilter, onPriorityFilter, dueFilter, onDueFilter }: HeroHeaderProps) {
  const container = useRef<HTMLDivElement>(null);
  const tasks = useTaskStore((s) => s.tasks);
  
  const tDay = new Date().toISOString().slice(0, 10);
  const activeTasks = tasks.filter(t => {
    if (t.status === "done" || t.status === "archived") return false;
    const date = t.scheduledDate || t.dueDate;
    if (!date) return true;
    return true;
  });
  
  const incomplete = activeTasks.length;
  // const overdueCount = tasks.filter(t => t.status !== "done" && t.status !== "archived" && t.dueDate && t.dueDate < tDay).length;
  // const completedTodayCount = tasks.filter(t => t.status === "done").length; // Note: for simplicity showing total completed or completed recently
  
  const counts: Record<string, number> = {
    urgent: activeTasks.filter(t => t.priority === "urgent").length,
    high:   activeTasks.filter(t => t.priority === "high").length,
    medium: activeTasks.filter(t => t.priority === "medium").length,
    low:    activeTasks.filter(t => t.priority === "low").length,
  };

  const dueCounts = {
    overdue: tasks.filter(t => {
      if (t.status === "done" || t.status === "archived") return false;
      const dStr = t.dueDate || t.scheduledDate;
      if (!dStr) return false;
      const d = new Date(dStr); d.setHours(0,0,0,0);
      const td = new Date(); td.setHours(0,0,0,0);
      return Math.round((d.getTime() - td.getTime()) / 86400000) < 0;
    }).length,
    today: tasks.filter(t => {
      if (t.status === "done" || t.status === "archived") return false;
      const dStr = t.dueDate || t.scheduledDate;
      if (!dStr) return false;
      const d = new Date(dStr); d.setHours(0,0,0,0);
      const td = new Date(); td.setHours(0,0,0,0);
      return Math.round((d.getTime() - td.getTime()) / 86400000) === 0;
    }).length,
    tomorrow: tasks.filter(t => {
      if (t.status === "done" || t.status === "archived") return false;
      const dStr = t.dueDate || t.scheduledDate;
      if (!dStr) return false;
      const d = new Date(dStr); d.setHours(0,0,0,0);
      const td = new Date(); td.setHours(0,0,0,0);
      return Math.round((d.getTime() - td.getTime()) / 86400000) === 1;
    }).length,
  };

  useGSAP(() => {
    const tl = gsap.timeline();
    tl.from(".hero-text", {
      y: 40,
      opacity: 0,
      duration: 1,
      stagger: 0.1,
      ease: "power4.out"
    });
  }, { scope: container });

  const hasPills = Object.values(counts).some(c => c > 0);

  return (
    <div ref={container} className="relative w-full px-4 md:px-8 mx-auto pt-6 pb-8 md:py-25 flex flex-col items-center text-center">
      {/* Background radial gradient */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/20 blur-[120px] rounded-full pointer-events-none -z-10" />
      

      
      <h1 className="hero-text text-5xl md:text-7xl lg:text-[5rem] font-black tracking-tighter leading-[0.9] text-foreground max-w-5xl mx-auto flex flex-wrap justify-center items-center gap-x-4 gap-y-2">
        <span>You have</span>
        <span className="relative inline-block px-6 py-2 bg-primary text-primary-foreground rounded-full -rotate-2 transform hover:rotate-0 transition-transform duration-500 shadow-2xl">
          {incomplete} tasks
        </span>
        <span>remaining today.</span>
      </h1>

      {/* <div className="hero-text mt-8 flex flex-wrap justify-center items-center gap-8 text-sm">
        <div className="flex flex-col items-center">
          <span className="text-3xl font-black text-emerald-500">{completedTodayCount}</span>
          <span className="text-muted-foreground uppercase tracking-widest font-semibold text-[10px]">Completed</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-3xl font-black text-red-500">{overdueCount}</span>
          <span className="text-muted-foreground uppercase tracking-widest font-semibold text-[10px]">Overdue</span>
        </div>
      </div> */}
      
      {hasPills && (
        <div className="hero-text mt-8 flex flex-wrap justify-center items-center gap-3">
          {(["urgent", "high", "medium", "low"] as const).map(p => {
            if (counts[p] === 0) return null;
            const cfg = PRIORITY_CONFIG[p];
            const isActive = priorityFilter === p;
            return (
              <button
                key={p}
                onClick={() => onPriorityFilter(p)}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold border border-transparent transition-all duration-200",
                  "text-muted-foreground bg-muted/30",
                  cfg.hover,
                  isActive && cfg.active,
                  isActive ? "scale-105" : "hover:scale-102"
                )}
              >
                <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", cfg.dot)} />
                <span className="tabular-nums font-bold">{counts[p]}</span>
                <span>{cfg.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Due Date Filters */}
      <div className="hero-text mt-4 flex flex-wrap justify-center items-center gap-3">
        {(["overdue", "today", "tomorrow"] as const).map(d => {
          if (dueCounts[d] === 0) return null;
          
          let cfg = { label: "", dot: "", active: "", hover: "" };
          if (d === "overdue") cfg = { label: "Overdue", dot: "bg-red-500", active: "bg-red-500/15 text-red-500 border border-red-500/40 shadow-red-500/20 shadow-lg", hover: "hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30" };
          if (d === "today") cfg = { label: "Today", dot: "bg-orange-500", active: "bg-orange-500/15 text-orange-500 border border-orange-500/40 shadow-orange-500/20 shadow-lg", hover: "hover:bg-orange-500/10 hover:text-orange-400 hover:border-orange-500/30" };
          if (d === "tomorrow") cfg = { label: "Tomorrow", dot: "bg-amber-500", active: "bg-amber-500/15 text-amber-500 border border-amber-500/40 shadow-amber-500/20 shadow-lg", hover: "hover:bg-amber-500/10 hover:text-amber-400 hover:border-amber-500/30" };
          
          const isActive = dueFilter === d;
          return (
            <button
              key={d}
              onClick={() => onDueFilter(d)}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold border border-transparent transition-all duration-200",
                "text-muted-foreground bg-muted/30",
                cfg.hover,
                isActive && cfg.active,
                isActive ? "scale-105" : "hover:scale-102"
              )}
            >
              <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", cfg.dot)} />
              <span className="tabular-nums font-bold">{dueCounts[d]}</span>
              <span>{cfg.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
