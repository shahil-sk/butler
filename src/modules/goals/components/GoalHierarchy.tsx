import React from "react";
import { useGoalsStore } from "../store";
import { ChevronRight, ChevronDown, Target, CornerDownRight } from "lucide-react";
import { cn } from "@/shared/utils";
import type { Goal } from "@/shared/types";

function GoalTreeNode({ goal, allGoals, level = 0 }: { goal: Goal; allGoals: Goal[]; level?: number }) {
  const { openGoal } = useGoalsStore();
  const children = allGoals.filter(g => g.parentGoalId === goal.id);
  const [expanded, setExpanded] = React.useState(true);

  return (
    <div className="flex flex-col">
      <div 
        className={cn(
          "flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/50 cursor-pointer group transition-colors",
          level === 0 ? "bg-muted/20 border border-border" : ""
        )}
        style={{ marginLeft: level > 0 ? `${level * 1.5}rem` : 0 }}
        onClick={() => openGoal(goal.id)}
      >
        {children.length > 0 ? (
          <button 
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="p-0.5 rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <div className="w-[18px] flex justify-center">
            {level > 0 && <CornerDownRight size={14} className="text-muted-foreground/30" />}
          </div>
        )}
        
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {goal.icon ? <span>{goal.icon}</span> : <Target size={14} className="text-muted-foreground" />}
          <span className="font-medium text-sm truncate">{goal.title}</span>
          <span className="text-[9px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded ml-2">
            {goal.horizon}
          </span>
          <span className={cn(
            "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
            goal.status === "active" ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground"
          )}>
            {goal.status}
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all"
              style={{ width: `${goal.progressPercent}%` }}
            />
          </div>
          <span className="text-xs font-bold w-8 text-right">{Math.round(goal.progressPercent)}%</span>
        </div>
      </div>

      {expanded && children.length > 0 && (
        <div className="flex flex-col mt-1 gap-1">
          {children.map(child => (
            <GoalTreeNode key={child.id} goal={child} allGoals={allGoals} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function GoalHierarchy() {
  const { goals } = useGoalsStore();
  
  // Find top-level goals (no parent)
  const topLevelGoals = goals.filter(g => !g.parentGoalId);

  if (goals.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-xl p-12 text-center text-muted-foreground bg-muted/20">
        <p className="text-sm font-medium">No goals found.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {topLevelGoals.map(goal => (
        <GoalTreeNode key={goal.id} goal={goal} allGoals={goals} />
      ))}
      
      {/* Orphans (goals with a parent that doesn't exist) */}
      {goals.filter(g => g.parentGoalId && !goals.find(p => p.id === g.parentGoalId)).map(orphan => (
        <GoalTreeNode key={orphan.id} goal={orphan} allGoals={goals} />
      ))}
    </div>
  );
}
