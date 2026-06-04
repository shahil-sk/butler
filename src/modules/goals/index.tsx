import React, { useEffect, useState } from "react";
import { useGoalsStore } from "./store";
import { Target, Plus, AlertCircle, CheckCircle2, Circle, List, Grid, Layers } from "lucide-react";
import { cn } from "@/shared/utils";
import { registry } from "@/kernel/router";
import { GOALS_MANIFEST } from "./manifest";
import { GoalDetail } from "./components/GoalDetail";
import { GoalHierarchy } from "./components/GoalHierarchy";
import { OkrView } from "./components/OkrView";

registry.register(GOALS_MANIFEST);

export default function GoalsModule() {
  const { goals, loadAll, createGoal, activeGoalId, openGoal } = useGoalsStore();
  const [view, setView] = useState<"grid" | "list" | "hierarchy" | "okr">("grid");
  const [showNewGoal, setShowNewGoal] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    await createGoal({
      title: newTitle.trim(),
      horizon: "quarterly",
      progressType: "manual",
      status: "draft",
    });
    setNewTitle("");
    setShowNewGoal(false);
  };

  const activeGoals = goals.filter(g => g.status === "active" || g.status === "draft");
  const achievedGoals = goals.filter(g => g.status === "achieved");

  if (activeGoalId) {
    return <GoalDetail goalId={activeGoalId} />;
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      <div className="flex-1 overflow-y-auto w-full">
        <div className="p-6 lg:p-10 space-y-8 max-w-7xl mx-auto w-full">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1 flex items-center gap-3">
              <Target size={28} className="text-primary" /> Goals
            </h1>
            <p className="text-muted-foreground text-sm">Define direction and measure progress.</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex bg-muted/50 p-1 rounded-lg border border-border">
              <button 
                onClick={() => setView("grid")}
                className={cn("p-1.5 rounded-md transition-colors", view === "grid" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
                title="Grid View"
              >
                <Grid size={16} />
              </button>
              <button 
                onClick={() => setView("list")}
                className={cn("p-1.5 rounded-md transition-colors", view === "list" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
                title="List View"
              >
                <List size={16} />
              </button>
              <button 
                onClick={() => setView("hierarchy")}
                className={cn("p-1.5 rounded-md transition-colors", view === "hierarchy" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
                title="Hierarchy View"
              >
                <Layers size={16} />
              </button>
              <button 
                onClick={() => setView("okr")}
                className={cn("p-1.5 rounded-md transition-colors text-xs font-bold", view === "okr" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                title="OKR View"
              >
                OKR
              </button>
            </div>
            <button
              onClick={() => setShowNewGoal(true)}
              className="btn btn-primary btn-sm flex items-center gap-2"
            >
              <Plus size={16} /> New Goal
            </button>
          </div>
        </header>

        {showNewGoal && (
          <div className="dashboard-card p-5 border-primary/40 flex flex-col gap-3 animate-fade-in">
            <input 
              autoFocus
              type="text"
              placeholder="What is your objective? (e.g. Launch Butler v1.0)"
              className="flex-1 bg-transparent border-none outline-none font-medium text-lg"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCreate()}
            />
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button className="btn btn-ghost btn-sm" onClick={() => setShowNewGoal(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleCreate}>Save Goal</button>
            </div>
          </div>
        )}

        <section>
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <AlertCircle size={18} className="text-amber-500" /> Active Goals
          </h2>
          
          {activeGoals.length === 0 && !showNewGoal ? (
            <div className="border border-dashed border-border rounded-xl p-12 text-center text-muted-foreground bg-muted/20">
              <Target size={32} className="mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-sm font-medium">No active goals found.</p>
              <p className="text-xs mt-1">Set a new goal to give your daily work clear direction.</p>
            </div>
          ) : view === "hierarchy" ? (
            <GoalHierarchy />
          ) : view === "okr" ? (
            <OkrView />
          ) : (
            <div className={cn(
              view === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "flex flex-col gap-3"
            )}>
              {activeGoals.map(goal => (
                <div 
                  key={goal.id} 
                  onClick={() => openGoal(goal.id)}
                  className="dashboard-card p-5 flex flex-col gap-4 group hover:border-primary/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        {goal.icon ? <span>{goal.icon}</span> : <Target size={16} className="text-muted-foreground" />}
                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                          {goal.horizon}
                        </span>
                        {goal.area && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {goal.area}
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-lg leading-tight">{goal.title}</h3>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-muted-foreground">Progress</span>
                      <span className="text-xs font-bold">{Math.round(goal.progressPercent)}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-500"
                        style={{ width: `${goal.progressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {achievedGoals.length > 0 && (
          <section className="opacity-70">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <CheckCircle2 size={18} className="text-green-500" /> Achieved Goals
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {achievedGoals.map(goal => (
                <div 
                  key={goal.id} 
                  onClick={() => openGoal(goal.id)}
                  className="dashboard-card p-4 flex items-center gap-3 cursor-pointer hover:border-border/80 transition-colors"
                >
                  <CheckCircle2 size={16} className="text-green-500" />
                  <span className="font-medium text-sm strike-through">{goal.title}</span>
                </div>
              ))}
            </div>
          </section>
        )}
        </div>
      </div>
    </div>
  );
}
