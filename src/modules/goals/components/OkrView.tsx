import React from "react";
import { useGoalsStore } from "../store";
import { Target, TrendingUp } from "lucide-react";
import { cn } from "@/shared/utils";

export function OkrView() {
  const { goals, keyResults, openGoal } = useGoalsStore();

  // OKR view typically shows "work" goals or quarterly goals, but for now we'll show active goals
  // that have key results associated with them (or all active goals).
  const okrGoals = goals.filter(g => g.status === "active" || g.status === "draft");

  if (okrGoals.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-xl p-12 text-center text-muted-foreground bg-muted/20">
        <p className="text-sm font-medium">No objectives found for OKR view.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {okrGoals.map(goal => {
        const goalKrs = keyResults.filter(kr => kr.goalId === goal.id).sort((a, b) => a.position - b.position);
        
        return (
          <div key={goal.id} className="dashboard-card overflow-hidden">
            <div 
              className="bg-muted/30 px-5 py-4 border-b border-border/50 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => openGoal(goal.id)}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Target size={16} />
                </div>
                <div>
                  <h3 className="font-semibold">{goal.title}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-background border border-border px-1.5 py-0.5 rounded">
                      {goal.horizon}
                    </span>
                    <span className="text-xs text-muted-foreground">Objective</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-xs font-bold">{Math.round(goal.progressPercent)}%</span>
                  <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                    <div 
                      className="h-full bg-primary transition-all"
                      style={{ width: `${goal.progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-0">
              {goalKrs.length === 0 ? (
                <div className="px-5 py-3 text-xs text-muted-foreground italic bg-background">
                  No key results defined.
                </div>
              ) : (
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/10">
                    <tr>
                      <th className="px-5 py-2 font-medium">Key Result</th>
                      <th className="px-5 py-2 font-medium w-24">Current</th>
                      <th className="px-5 py-2 font-medium w-24">Target</th>
                      <th className="px-5 py-2 font-medium w-32">Progress</th>
                      <th className="px-5 py-2 font-medium w-24">Confidence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {goalKrs.map((kr) => {
                      const start = kr.startValue || 0;
                      const percent = Math.max(0, Math.min(100, ((kr.currentValue - start) / (kr.targetValue - start)) * 100));

                      return (
                        <tr key={kr.id} className="bg-background hover:bg-muted/10 transition-colors">
                          <td className="px-5 py-3 font-medium flex items-center gap-2">
                            <TrendingUp size={14} className="text-muted-foreground" />
                            {kr.title}
                          </td>
                          <td className="px-5 py-3 text-muted-foreground">
                            {kr.currentValue} {kr.unit}
                          </td>
                          <td className="px-5 py-3 text-muted-foreground">
                            {kr.targetValue} {kr.unit}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className={cn(
                                    "h-full transition-all",
                                    percent >= 100 ? "bg-green-500" : "bg-primary"
                                  )}
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium w-8 text-right">{Math.round(percent)}%</span>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <span className={cn(
                              "text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                              !kr.confidence ? "bg-muted text-muted-foreground" :
                              kr.confidence === "high" ? "bg-green-500/10 text-green-500" :
                              kr.confidence === "medium" ? "bg-amber-500/10 text-amber-500" :
                              "bg-red-500/10 text-red-500"
                            )}>
                              {kr.confidence || "—"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
