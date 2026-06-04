import React, { useState } from "react";
import { useGoalsStore } from "../store";
import { ChevronLeft, Target, Calendar as CalendarIcon, CheckCircle2, TrendingUp, Plus, Target as TargetIcon, Trash2 } from "lucide-react";
import { cn, formatDate } from "@/shared/utils";
import { useProjectStore } from "@/modules/projects/store";
import { useTaskStore } from "@/modules/tasks/store";
import { useHabitsStore } from "@/modules/habits/store";
import { bus } from "@/kernel/event-bus";

export function GoalDetail({ goalId }: { goalId: string }) {
  const { goals, keyResults, closeGoal, createKeyResult, updateKeyResult, deleteKeyResult, deleteGoal, updateGoal } = useGoalsStore();
  const goal = goals.find(g => g.id === goalId);
  const goalKeyResults = keyResults.filter(kr => kr.goalId === goalId).sort((a, b) => a.position - b.position);

  const [showNewKR, setShowNewKR] = useState(false);
  const [newKRTitle, setNewKRTitle] = useState("");
  const [newKRTarget, setNewKRTarget] = useState("");

  const { projects, updateProject } = useProjectStore();
  const { tasks, updateTask } = useTaskStore();
  const { habits, logs: habitLogs, updateHabit } = useHabitsStore();

  const linkedProjects = projects.filter(p => p.goalId === goalId);
  const projectIds = new Set(linkedProjects.map(p => p.id));
  const alignedTasks = tasks.filter(t => t.goalId === goalId || (t.projectId && projectIds.has(t.projectId)));
  const activeAlignedTasks = alignedTasks.filter(t => t.status !== "done" && t.status !== "archived");
  const linkedHabits = habits.filter(h => h.linkedGoalId === goalId);

  if (!goal) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Goal not found.</p>
        <button className="btn btn-ghost ml-4" onClick={closeGoal}>Go back</button>
      </div>
    );
  }

  const handleCreateKR = async () => {
    if (!newKRTitle.trim() || !newKRTarget.trim() || isNaN(Number(newKRTarget))) return;
    await createKeyResult(goal.id, {
      title: newKRTitle.trim(),
      metricType: "numeric",
      targetValue: Number(newKRTarget),
      currentValue: 0,
    });
    setNewKRTitle("");
    setNewKRTarget("");
    setShowNewKR(false);
  };

  const calculateProgress = () => {
    if (goalKeyResults.length === 0) return goal.progressPercent;
    if (goal.progressType !== "key_result_based") return goal.progressPercent;
    
    // Auto-calculate progress based on KRs
    const totalProgress = goalKeyResults.reduce((acc, kr) => {
      const start = kr.startValue || 0;
      const target = kr.targetValue;
      const current = kr.currentValue;
      if (target === start) return acc;
      
      const percent = Math.max(0, Math.min(100, ((current - start) / (target - start)) * 100));
      return acc + percent;
    }, 0);
    
    return totalProgress / goalKeyResults.length;
  };

  const progress = calculateProgress();

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      <div className="flex items-center h-12 px-4 border-b border-border/50 shrink-0 gap-3">
        <button 
          onClick={closeGoal}
          className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-md transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {goal.horizon}
          </span>
          {goal.area && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {goal.area}
            </span>
          )}
        </div>
        <button
          onClick={() => {
            if (confirm("Are you sure you want to delete this goal?")) {
              deleteGoal(goal.id);
              closeGoal();
            }
          }}
          className="p-1.5 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 rounded-md transition-colors"
          title="Delete Goal"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto w-full">
        <div className="p-6 lg:p-10 max-w-4xl mx-auto w-full space-y-10">
        
        {/* Header */}
        <div className="flex items-start gap-6">
          <div className="relative shrink-0 w-24 h-24 flex items-center justify-center">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              <path
                className="text-muted/30"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              />
              <path
                className="text-primary transition-all duration-1000 ease-out"
                strokeDasharray={`${progress}, 100`}
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <span className="text-xl font-bold text-foreground">{Math.round(progress)}%</span>
            </div>
          </div>
          <div className="flex-1 pt-2">
            <h1 className="text-3xl font-bold tracking-tight mb-2">{goal.title}</h1>
            {goal.description && <p className="text-muted-foreground text-sm mb-4">{goal.description}</p>}
            
            <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Target size={14} /> Status: <span className="text-foreground capitalize">{goal.status}</span>
              </div>
              {goal.targetDate && (
                <div className="flex items-center gap-1.5">
                  <CalendarIcon size={14} /> Target: <span className="text-foreground">{formatDate(goal.targetDate)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Key Results */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <TargetIcon size={18} className="text-primary" /> Key Results
            </h2>
            {!showNewKR && (
              <button 
                onClick={() => setShowNewKR(true)}
                className="btn btn-ghost btn-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5"
              >
                <Plus size={14} /> Add KR
              </button>
            )}
          </div>

          <div className="space-y-3">
            {goalKeyResults.length === 0 && !showNewKR ? (
              <div className="border border-dashed border-border rounded-xl p-8 text-center text-muted-foreground bg-muted/20">
                <p className="text-sm">No key results defined. How will you measure success?</p>
              </div>
            ) : (
              goalKeyResults.map((kr) => {
                const start = kr.startValue || 0;
                const percent = Math.max(0, Math.min(100, ((kr.currentValue - start) / (kr.targetValue - start)) * 100));
                
                return (
                  <div key={kr.id} className="dashboard-card p-4 flex flex-col gap-3 group transition-colors hover:border-border/80">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-sm pr-4">{kr.title}</h3>
                      <div className="flex items-center gap-3 text-xs font-medium shrink-0">
                        <span className="text-muted-foreground">{kr.currentValue} / {kr.targetValue} {kr.unit}</span>
                        <span className="text-foreground w-8 text-right">{Math.round(percent)}%</span>
                      </div>
                    </div>
                    
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full transition-all duration-500",
                          percent >= 100 ? "bg-green-500" : "bg-primary"
                        )}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    
                    {/* Quick update current value slider/input */}
                    <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <input 
                        type="range" 
                        min={Math.min(start, kr.targetValue)} 
                        max={Math.max(start, kr.targetValue)} 
                        value={kr.currentValue}
                        onChange={(e) => updateKeyResult(kr.id, { currentValue: Number(e.target.value) })}
                        className="flex-1 accent-primary h-1 cursor-pointer"
                      />
                      <button
                        onClick={() => confirm("Delete this Key Result?") && deleteKeyResult(kr.id)}
                        className="p-1 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 rounded transition-colors"
                        title="Delete Key Result"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}

            {showNewKR && (
              <div className="dashboard-card p-4 border-primary/40 animate-fade-in flex flex-col gap-3">
                <input 
                  autoFocus
                  type="text"
                  placeholder="Key Result title (e.g. Gain 1,000 new users)"
                  className="bg-transparent border-none outline-none font-medium text-sm"
                  value={newKRTitle}
                  onChange={(e) => setNewKRTitle(e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Target Value:</span>
                  <input 
                    type="number"
                    placeholder="e.g. 1000"
                    className="w-24 bg-muted border-none outline-none text-xs p-1 rounded"
                    value={newKRTarget}
                    onChange={(e) => setNewKRTarget(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateKR()}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-border mt-1">
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowNewKR(false)}>Cancel</button>
                  <button className="btn btn-primary btn-sm" onClick={handleCreateKR}>Save KR</button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Linked Entities */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Linked Projects</h2>
              <select
                className="bg-transparent border-none outline-none text-xs font-medium text-primary cursor-pointer max-w-[120px]"
                value=""
                onChange={(e) => {
                  if (e.target.value) updateProject(e.target.value, { goalId: goalId });
                }}
              >
                <option value="" disabled>+ Link Project</option>
                {projects.filter(p => p.goalId !== goalId && p.status === "active").map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              {linkedProjects.length === 0 ? (
                <div className="border border-dashed border-border rounded-xl p-6 text-center bg-muted/10 text-xs text-muted-foreground">
                  No projects linked. Link a project to track its milestones here.
                </div>
              ) : (
                linkedProjects.map(p => (
                  <div key={p.id} className="p-3 dashboard-card flex items-center justify-between group cursor-pointer hover:border-primary/50" onClick={() => {
                    bus.emit("navigate:to", { path: `/projects` });
                    setTimeout(() => bus.emit("project:open", { projectId: p.id }), 50);
                  }}>
                    <div className="flex items-center gap-2">
                      <span style={{ color: p.color }}>{p.icon || "📁"}</span>
                      <span className="font-medium text-sm">{p.name}</span>
                    </div>
                    <div className="text-xs font-bold">{p.progressPercent}%</div>
                  </div>
                ))
              )}
            </div>
          </section>
          
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Aligned Tasks</h2>
              <select
                className="bg-transparent border-none outline-none text-xs font-medium text-primary cursor-pointer max-w-[120px]"
                value=""
                onChange={(e) => {
                  if (e.target.value) updateTask(e.target.value, { goalId: goalId });
                }}
              >
                <option value="" disabled>+ Link Task</option>
                {tasks.filter(t => t.goalId !== goalId && t.status !== "done" && t.status !== "archived").map(t => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              {activeAlignedTasks.length === 0 ? (
                <div className="border border-dashed border-border rounded-xl p-6 text-center bg-muted/10 text-xs text-muted-foreground">
                  No open tasks aligned with this goal.
                </div>
              ) : (
                activeAlignedTasks.slice(0, 5).map(t => (
                  <div key={t.id} className="p-3 dashboard-card flex flex-col gap-1 cursor-pointer hover:border-primary/50" onClick={() => {
                    bus.emit("task:open", { taskId: t.id });
                  }}>
                    <div className="flex items-center gap-2">
                      <div className={cn("w-3 h-3 rounded-sm border shrink-0", t.status === "done" ? "bg-primary border-primary" : "border-muted-foreground")} />
                      <span className="font-medium text-sm truncate">{t.title}</span>
                    </div>
                    {t.dueDate && <div className="text-[10px] text-muted-foreground ml-5">{formatDate(t.dueDate)}</div>}
                  </div>
                ))
              )}
              {activeAlignedTasks.length > 5 && (
                <div className="text-xs text-center text-muted-foreground mt-2">
                  + {activeAlignedTasks.length - 5} more active tasks
                </div>
              )}
            </div>
          </section>

          <section className="md:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Supporting Habits</h2>
              <select
                className="bg-transparent border-none outline-none text-xs font-medium text-primary cursor-pointer max-w-[120px]"
                value=""
                onChange={(e) => {
                  if (e.target.value) updateHabit(e.target.value, { linkedGoalId: goalId });
                }}
              >
                <option value="" disabled>+ Link Habit</option>
                {habits.filter(h => h.linkedGoalId !== goalId && !h.archivedAt).map(h => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {linkedHabits.length === 0 ? (
                <div className="col-span-full border border-dashed border-border rounded-xl p-6 text-center bg-muted/10 text-xs text-muted-foreground">
                  No habits linked. Link habits that build the foundation for this goal.
                </div>
              ) : (
                linkedHabits.map(h => {
                  const logs = habitLogs.filter(l => l.habitId === h.id && l.status === "done");
                  // Calculate simple consistency over last 30 days
                  const today = new Date();
                  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
                  const recentLogs = logs.filter(l => new Date(l.date) >= thirtyDaysAgo);
                  
                  return (
                    <div key={h.id} className="p-3 dashboard-card flex flex-col gap-2 cursor-pointer hover:border-primary/50" onClick={() => {
                      bus.emit("navigate:to", { path: `/habits` });
                    }}>
                      <div className="flex items-center gap-2">
                        <span style={{ color: h.color }}>{h.icon || "🔄"}</span>
                        <span className="font-medium text-sm truncate">{h.name}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>30-day consistency</span>
                        <span className="font-bold">{recentLogs.length} days</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
        </div>
      </div>
    </div>
  );
}
