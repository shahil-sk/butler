import React, { useEffect, useState } from "react";
import { useGoalsStore } from "../state/goalsStore";
import { useProjectsStore } from "../../projects/state/projectsStore";
import { useHabitsStore } from "../../habits/state/habitsStore";
import { useTasksStore } from "../../tasks/state/tasksStore";
import { GoalHorizon, GoalStatus, KeyResultType } from "../types";
import { 
  Target, Plus, Trash2, CheckSquare, 
  Trash, Link2, Unlink, Layers, Flame
} from "lucide-react";

export const GoalsView: React.FC = () => {
  const { 
    goals, activeGoalId, keyResults, goalLinks, loadGoals, createGoal, 
    updateGoal, deleteGoal, setActiveGoalId, createKeyResult, 
    updateKeyResultValue, deleteKeyResult, linkEntity, unlinkEntity 
  } = useGoalsStore();

  const { projects, loadProjects } = useProjectsStore();
  const { habits, loadHabits } = useHabitsStore();
  const { tasks, loadTasks } = useTasksStore();

  const [horizonFilter, setHorizonFilter] = useState<GoalHorizon | "all">("all");
  const [activeTab, setActiveTab] = useState<"key_results" | "alignment">("key_results");
  const [modalOpen, setModalOpen] = useState(false);

  // New goal state
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [horizon, setHorizon] = useState<GoalHorizon>("quarterly");
  const [targetDate, setTargetDate] = useState("");
  const [initialKrs, setInitialKrs] = useState<Array<{ title: string; targetValue: number; unit: string; keyResultType: KeyResultType }>>([
    { title: "", targetValue: 100, unit: "%", keyResultType: "numeric" }
  ]);

  // Inline inputs
  const [newKrTitle, setNewKrTitle] = useState("");
  const [newKrTarget, setNewKrTarget] = useState(100);
  const [newKrUnit, setNewKrUnit] = useState("%");
  const [newKrType, setNewKrType] = useState<KeyResultType>("numeric");

  // Linking dropdown selection
  const [linkEntityType, setLinkEntityType] = useState<"project" | "habit" | "task">("project");
  const [selectedEntityId, setSelectedEntityId] = useState("");

  useEffect(() => {
    loadGoals();
    loadProjects();
    loadHabits();
    loadTasks();
  }, []);

  const activeGoal = goals.find(g => g.id === activeGoalId) || null;

  // Calculate goal progress based on key results
  const calculateGoalProgress = () => {
    if (keyResults.length === 0) return 0;
    const total = keyResults.reduce((acc, kr) => {
      if (kr.key_result_type === "binary") {
        return acc + (kr.current_value >= 1.0 ? 100 : 0);
      }
      const progress = (kr.current_value / kr.target_value) * 100;
      return acc + Math.min(100, Math.max(0, progress));
    }, 0);
    return Math.round(total / keyResults.length);
  };

  const currentProgress = calculateGoalProgress();

  const filteredGoals = goals.filter(g => {
    if (horizonFilter === "all") return true;
    return g.horizon === horizonFilter;
  });

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const targetTs = targetDate ? new Date(targetDate).getTime() : null;
    const validKrs = initialKrs.filter(kr => kr.title.trim().length > 0);
    await createGoal(title, desc || null, horizon, "active", targetTs, [], validKrs);
    setTitle("");
    setDesc("");
    setHorizon("quarterly");
    setTargetDate("");
    setInitialKrs([{ title: "", targetValue: 100, unit: "%", keyResultType: "numeric" }]);
    setModalOpen(false);
  };

  const handleCreateKeyResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKrTitle.trim() || !activeGoalId) return;
    await createKeyResult(activeGoalId, newKrTitle, newKrTarget, 0, newKrUnit, newKrType);
    setNewKrTitle("");
    setNewKrTarget(100);
    setNewKrUnit("%");
    setNewKrType("numeric");
  };

  const handleLinkEntity = async () => {
    if (!selectedEntityId || !activeGoalId) return;
    await linkEntity(activeGoalId, selectedEntityId, linkEntityType);
    setSelectedEntityId("");
  };

  return (
    <div className="flex-1 flex overflow-hidden h-full">
      {/* Left Sidebar */}
      <div className="w-64 border-r border-zinc-850 bg-zinc-950/40 flex flex-col shrink-0">
        <div className="p-4 border-b border-zinc-850 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold tracking-wider uppercase text-zinc-400 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-zinc-400" /> Objectives (OKRs)
            </span>
            <button onClick={() => setModalOpen(true)} className="p-1 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-zinc-200 cursor-pointer">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <select
            value={horizonFilter}
            onChange={(e) => setHorizonFilter(e.target.value as any)}
            className="w-full bg-zinc-950 border border-zinc-850 rounded-lg px-2 py-1.5 text-xs text-zinc-400 cursor-pointer focus:outline-hidden"
          >
            <option value="all">All Horizons</option>
            <option value="weekly">Weekly Goals</option>
            <option value="quarterly">Quarterly OKRs</option>
            <option value="annual">Annual Focus</option>
            <option value="life">Life Vision</option>
          </select>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredGoals.map(g => {
            const isActive = g.id === activeGoalId;
            return (
              <button
                key={g.id}
                onClick={() => setActiveGoalId(g.id)}
                className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                  isActive ? "bg-zinc-900 border-zinc-800 text-zinc-150" : "border-transparent text-zinc-500 hover:bg-zinc-900/40 hover:text-zinc-300"
                }`}
              >
                <div className="text-xs font-semibold truncate">{g.title}</div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[8px] uppercase tracking-wider bg-zinc-950 border border-zinc-800 text-zinc-400 px-1 py-0.2 rounded">{g.horizon}</span>
                  <span className="text-[9px] text-zinc-550 font-mono ml-auto capitalize">{g.status}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main panel */}
      {activeGoal ? (
        <div className="flex-1 flex flex-col overflow-hidden bg-zinc-950/10">
          {/* Header */}
          <div className="p-6 border-b border-zinc-850 shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-lg font-bold text-zinc-100 flex items-center gap-2">{activeGoal.title}</h1>
                <p className="text-xs text-zinc-400 mt-1">{activeGoal.description || "No description provided."}</p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={activeGoal.status}
                  onChange={(e) => updateGoal(activeGoal.id, activeGoal.title, activeGoal.description || null, activeGoal.horizon, e.target.value as GoalStatus, activeGoal.target_date ?? null, activeGoal.tags)}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-full border cursor-pointer ${
                    activeGoal.status === "active" ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" :
                    activeGoal.status === "completed" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                    "bg-zinc-800 text-zinc-450 border-zinc-700"
                  }`}
                >
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="abandoned">Abandoned</option>
                </select>
                <button onClick={() => deleteGoal(activeGoal.id)} className="p-1.5 hover:bg-red-500/10 hover:text-red-400 text-zinc-650 rounded-lg cursor-pointer">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Progress indicator */}
            <div className="mt-6 bg-zinc-900/40 border border-zinc-850 rounded-xl p-4 flex items-center gap-4">
              <div className="flex-1">
                <div className="flex justify-between text-xs font-semibold text-zinc-350 mb-2">
                  <span>Current Progress</span>
                  <span>{currentProgress}%</span>
                </div>
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${currentProgress}%` }} />
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 mt-6">
              {(["key_results", "alignment"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`text-xs font-semibold pb-2 border-b-2 transition-all cursor-pointer capitalize ${
                    activeTab === tab ? "border-zinc-200 text-zinc-100" : "border-transparent text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {tab === "key_results" ? "Key Results" : "Alignment Matrix"}
                </button>
              ))}
            </div>
          </div>

          {/* Contents */}
          <div className="flex-1 overflow-y-auto p-6 min-h-0">
            {activeTab === "key_results" && (
              <div className="space-y-6">
                {/* Key Results list */}
                <div className="space-y-3">
                  {keyResults.map(kr => {
                    const isDone = kr.key_result_type === "binary" ? kr.current_value >= 1.0 : kr.current_value >= kr.target_value;
                    return (
                      <div key={kr.id} className="bg-zinc-900/10 border border-zinc-850 p-3.5 rounded-xl flex items-center justify-between gap-4">
                        <div className="flex-1">
                          <span className={`text-xs font-medium ${isDone ? "line-through text-zinc-650" : "text-zinc-250"}`}>{kr.title}</span>
                          <div className="mt-2.5 flex items-center gap-3">
                            <span className="text-[10px] text-zinc-500 font-mono">
                              {kr.current_value} / {kr.target_value} {kr.unit}
                            </span>
                            <div className="flex-1 max-w-[200px] h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, (kr.current_value / kr.target_value) * 100)}%` }} />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {kr.key_result_type === "binary" ? (
                            <input
                              type="checkbox"
                              checked={kr.current_value >= 1.0}
                              onChange={(e) => updateKeyResultValue(kr.id, e.target.checked ? 1.0 : 0.0)}
                              className="w-4 h-4 rounded border-zinc-800 bg-zinc-950 text-emerald-500 focus:ring-0 cursor-pointer"
                            />
                          ) : (
                            <input
                              type="number"
                              value={kr.current_value}
                              onChange={(e) => updateKeyResultValue(kr.id, Number(e.target.value))}
                              className="w-16 bg-zinc-950 border border-zinc-800 rounded-lg p-1.5 text-center text-xs text-zinc-350 focus:outline-hidden"
                            />
                          )}
                          <button onClick={() => deleteKeyResult(kr.id)} className="p-1 hover:bg-zinc-850 hover:text-red-400 text-zinc-600 rounded-md cursor-pointer">
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Key result creator */}
                <form onSubmit={handleCreateKeyResult} className="bg-zinc-900/30 border border-zinc-850 p-3.5 rounded-xl flex flex-wrap items-center gap-3">
                  <input
                    type="text"
                    placeholder="New Key Result Title..."
                    value={newKrTitle}
                    onChange={(e) => setNewKrTitle(e.target.value)}
                    className="flex-1 min-w-[200px] bg-transparent border-0 outline-hidden text-xs text-zinc-200 placeholder-zinc-600 focus:ring-0"
                  />
                  <select
                    value={newKrType}
                    onChange={(e) => setNewKrType(e.target.value as KeyResultType)}
                    className="bg-zinc-950 border border-zinc-850 rounded-lg px-2.5 py-1 text-xs text-zinc-400 focus:outline-hidden cursor-pointer"
                  >
                    <option value="numeric">Numeric Metric</option>
                    <option value="binary">Yes/No Completion</option>
                  </select>
                  {newKrType === "numeric" && (
                    <>
                      <input
                        type="number"
                        placeholder="Target"
                        value={newKrTarget}
                        onChange={(e) => setNewKrTarget(Number(e.target.value))}
                        className="w-16 bg-zinc-950 border border-zinc-850 rounded-lg p-1 text-center text-xs text-zinc-350 focus:outline-hidden"
                      />
                      <input
                        type="text"
                        placeholder="Unit (%)"
                        value={newKrUnit}
                        onChange={(e) => setNewKrUnit(e.target.value)}
                        className="w-12 bg-zinc-950 border border-zinc-850 rounded-lg p-1 text-center text-xs text-zinc-350 focus:outline-hidden"
                      />
                    </>
                  )}
                  <button type="submit" className="p-1 hover:bg-zinc-850 rounded-lg text-zinc-250 cursor-pointer">
                    <Plus className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}

            {activeTab === "alignment" && (
              <div className="space-y-6">
                {/* Entity Linker Panel */}
                <div className="bg-zinc-900/30 border border-zinc-850 p-3.5 rounded-xl flex items-center gap-3">
                  <select
                    value={linkEntityType}
                    onChange={(e) => {
                      setLinkEntityType(e.target.value as any);
                      setSelectedEntityId("");
                    }}
                    className="bg-zinc-950 border border-zinc-850 rounded-lg px-2.5 py-1.5 text-xs text-zinc-400 focus:outline-hidden cursor-pointer"
                  >
                    <option value="project">Link Project</option>
                    <option value="habit">Link Habit</option>
                    <option value="task">Link Task</option>
                  </select>

                  <select
                    value={selectedEntityId}
                    onChange={(e) => setSelectedEntityId(e.target.value)}
                    className="flex-1 bg-zinc-950 border border-zinc-850 rounded-lg px-2.5 py-1.5 text-xs text-zinc-400 focus:outline-hidden cursor-pointer"
                  >
                    <option value="">Select entity...</option>
                    {linkEntityType === "project" && projects.filter(p => !goalLinks.some(l => l.entity_id === p.id)).map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                    {linkEntityType === "habit" && habits.filter(h => !goalLinks.some(l => l.entity_id === h.id)).map(h => (
                      <option key={h.id} value={h.id}>{h.title}</option>
                    ))}
                    {linkEntityType === "task" && tasks.filter(t => !goalLinks.some(l => l.entity_id === t.id)).map(t => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </select>

                  <button onClick={handleLinkEntity} className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-zinc-100 rounded-lg font-semibold cursor-pointer">
                    Link
                  </button>
                </div>

                {/* Linked Matrix */}
                <div className="space-y-4">
                  {goalLinks.map(link => {
                    let title = "Unknown Entity";
                    let icon = <Link2 className="w-3.5 h-3.5 text-zinc-500" />;
                    if (link.entity_type === "project") {
                      const p = projects.find(p => p.id === link.entity_id);
                      title = p ? p.name : title;
                      icon = <Layers className="w-3.5 h-3.5 text-indigo-400" />;
                    } else if (link.entity_type === "habit") {
                      const h = habits.find(h => h.id === link.entity_id);
                      title = h ? h.title : title;
                      icon = <Flame className="w-3.5 h-3.5 text-amber-400" />;
                    } else if (link.entity_type === "task") {
                      const t = tasks.find(t => t.id === link.entity_id);
                      title = t ? t.title : title;
                      icon = <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />;
                    }
                    return (
                      <div key={link.id} className="flex items-center justify-between p-3.5 bg-zinc-900/10 border border-zinc-850 rounded-xl">
                        <div className="flex items-center gap-3">
                          {icon}
                          <span className="text-xs font-semibold text-zinc-350">{title}</span>
                          <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border border-zinc-800 bg-zinc-950 text-zinc-550">{link.entity_type}</span>
                        </div>
                        <button onClick={() => unlinkEntity(activeGoal.id, link.entity_id, link.entity_type)} className="p-1 hover:bg-zinc-850 hover:text-red-400 text-zinc-600 rounded-md cursor-pointer">
                          <Unlink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-zinc-950/10">
          <Target className="w-8 h-8 text-zinc-650 mb-2" />
          <span className="text-xs text-zinc-500 font-medium">Select or create an objective to get started.</span>
        </div>
      )}

      {/* Creation Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <form onSubmit={handleCreateGoal} className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-2xl space-y-4">
            <h2 className="text-sm font-bold text-zinc-250">Create Objective (OKR)</h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Objective Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-zinc-200 outline-hidden focus:border-zinc-700"
              />
              <textarea
                placeholder="Description / Context (optional)"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-zinc-200 outline-hidden focus:border-zinc-700 h-16 resize-none"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={horizon}
                  onChange={(e) => setHorizon(e.target.value as GoalHorizon)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-zinc-400 focus:outline-hidden cursor-pointer"
                >
                  <option value="weekly">Weekly Horizon</option>
                  <option value="quarterly">Quarterly Horizon</option>
                  <option value="annual">Annual Horizon</option>
                  <option value="life">Life Horizon</option>
                </select>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs text-zinc-400 outline-hidden focus:border-zinc-700 cursor-pointer"
                />
              </div>

              {/* Initial Key Results List Creator */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-zinc-550 flex items-center justify-between">
                  Initial Key Results 
                  <button
                    type="button"
                    onClick={() => setInitialKrs([...initialKrs, { title: "", targetValue: 100, unit: "%", keyResultType: "numeric" }])}
                    className="text-zinc-400 hover:text-zinc-200 font-semibold"
                  >
                    + Add
                  </button>
                </span>
                <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                  {initialKrs.map((kr, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="KR Title"
                        value={kr.title}
                        onChange={(e) => {
                          const next = [...initialKrs];
                          next[idx].title = e.target.value;
                          setInitialKrs(next);
                        }}
                        className="flex-1 bg-zinc-950 border border-zinc-850 rounded-lg p-1.5 text-xs text-zinc-350 outline-hidden"
                      />
                      <select
                        value={kr.keyResultType}
                        onChange={(e) => {
                          const next = [...initialKrs];
                          next[idx].keyResultType = e.target.value as KeyResultType;
                          setInitialKrs(next);
                        }}
                        className="bg-zinc-950 border border-zinc-850 rounded-lg p-1 text-[10px] text-zinc-450 cursor-pointer"
                      >
                        <option value="numeric">Metric</option>
                        <option value="binary">Yes/No</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModalOpen(false)} className="px-3.5 py-2 text-xs text-zinc-450 hover:bg-zinc-800 rounded-lg cursor-pointer">Cancel</button>
              <button type="submit" className="px-3.5 py-2 text-xs bg-indigo-600 hover:bg-indigo-500 text-zinc-100 rounded-lg cursor-pointer font-semibold">Create</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
export default GoalsView;
