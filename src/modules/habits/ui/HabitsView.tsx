import React, { useState, useEffect, useMemo } from "react";
import { Plus, Flame, Sparkles, Sun, Moon, Zap, ClipboardList, X } from "lucide-react";
import { useHabitsStore } from "../state/habitsStore";
import { Habit } from "../types";
import { HabitCard } from "./HabitCard";

export const HabitsView: React.FC = () => {
  const { habits, habitLogs, streakStats, loadHabits, createHabit, updateHabit } = useHabitsStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);

  // Form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "custom">("daily");
  const [targetStreak, setTargetStreak] = useState(30);
  const [routineGroup, setRoutineGroup] = useState<"morning" | "evening" | "none">("none");

  useEffect(() => {
    loadHabits();
  }, [loadHabits]);

  const openCreateModal = () => {
    setEditingHabit(null);
    setTitle("");
    setDescription("");
    setFrequency("daily");
    setTargetStreak(30);
    setRoutineGroup("none");
    setModalOpen(true);
  };

  const openEditModal = (habit: Habit) => {
    setEditingHabit(habit);
    setTitle(habit.title);
    setDescription(habit.description || "");
    setFrequency(habit.frequency as any);
    setTargetStreak(habit.target_streak);
    setRoutineGroup((habit.routine_group as any) || "none");
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = {
      title,
      description: description.trim() ? description : null,
      frequency,
      frequency_spec: "{}",
      target_streak: targetStreak,
      routine_group: routineGroup === "none" ? null : routineGroup,
    };

    try {
      if (editingHabit) {
        await updateHabit(editingHabit.id, input);
      } else {
        await createHabit(input);
      }
      setModalOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  // Split habits by routine group
  const morningRoutines = useMemo(() => habits.filter(h => h.routine_group === "morning"), [habits]);
  const eveningRoutines = useMemo(() => habits.filter(h => h.routine_group === "evening"), [habits]);
  const standaloneHabits = useMemo(() => habits.filter(h => !h.routine_group || h.routine_group === "none"), [habits]);

  // Statistics
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const statsSummary = useMemo(() => {
    const total = habits.length;
    let activeStreaks = 0;
    let completedToday = 0;

    habits.forEach(h => {
      const stats = streakStats[h.id];
      if (stats && stats.current_streak > 0) activeStreaks++;

      const logs = habitLogs[h.id] || [];
      const todayLog = logs.find(l => l.date === todayStr);
      if (todayLog && todayLog.status === "completed") completedToday++;
    });

    return { total, activeStreaks, completedToday };
  }, [habits, streakStats, habitLogs, todayStr]);

  return (
    <div className="flex-1 flex flex-col p-6 overflow-hidden h-full">
      {/* Header */}
      <div className="mb-6 flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <Flame className="w-6 h-6 text-amber-500 fill-amber-500/10" />
            Habits & Routines
          </h1>
          <p className="text-sm text-zinc-400">Build consistency and complete routine checklists.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold px-4 py-2 rounded-xl flex items-center gap-2 text-sm transition-all cursor-pointer shadow-lg shadow-amber-500/10"
        >
          <Plus className="w-4 h-4" /> New Habit
        </button>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 shrink-0">
        <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-850 text-amber-500">
            <Flame className="w-5 h-5 fill-amber-500/10 animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Active Streaks</span>
            <h3 className="text-lg font-extrabold text-zinc-100">{statsSummary.activeStreaks} habits</h3>
          </div>
        </div>

        <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-850 text-emerald-500">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Done Today</span>
            <h3 className="text-lg font-extrabold text-zinc-100">{statsSummary.completedToday} / {statsSummary.total}</h3>
          </div>
        </div>

        <div className="bg-zinc-900/20 border border-zinc-850 rounded-2xl p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-850 text-sky-500">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Success Rate</span>
            <h3 className="text-lg font-extrabold text-zinc-100">
              {statsSummary.total > 0 ? Math.round((statsSummary.completedToday / statsSummary.total) * 100) : 0}%
            </h3>
          </div>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="flex-1 overflow-y-auto space-y-6 min-h-0 pr-1">
        {/* Morning Routines */}
        {morningRoutines.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-zinc-900 pb-2">
              <Sun className="w-4 h-4 text-amber-500" /> Morning Routine
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {morningRoutines.map(habit => (
                <HabitCard key={habit.id} habit={habit} logs={habitLogs[habit.id] || []} stats={streakStats[habit.id]} onEdit={openEditModal} />
              ))}
            </div>
          </div>
        )}

        {/* Evening Routines */}
        {eveningRoutines.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-zinc-900 pb-2">
              <Moon className="w-4 h-4 text-indigo-400" /> Evening Routine
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {eveningRoutines.map(habit => (
                <HabitCard key={habit.id} habit={habit} logs={habitLogs[habit.id] || []} stats={streakStats[habit.id]} onEdit={openEditModal} />
              ))}
            </div>
          </div>
        )}

        {/* Standalone Habits */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-zinc-900 pb-2">
            <Zap className="w-4 h-4 text-sky-400" /> Standalone Habits
          </h3>
          {standaloneHabits.length === 0 && morningRoutines.length === 0 && eveningRoutines.length === 0 ? (
            <div className="text-center py-12 text-zinc-550 text-xs border border-dashed border-zinc-850 rounded-2xl">
              No habits created yet. Click "New Habit" to start building consistency!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {standaloneHabits.map(habit => (
                <HabitCard key={habit.id} habit={habit} logs={habitLogs[habit.id] || []} stats={streakStats[habit.id]} onEdit={openEditModal} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit Modal Dialog */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 relative shadow-2xl">
            <button onClick={() => setModalOpen(false)} className="absolute right-4 top-4 text-zinc-500 hover:text-zinc-300">
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-base font-bold text-zinc-100 mb-4">
              {editingHabit ? "Edit Habit" : "Create New Habit"}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-500 font-bold uppercase">Habit Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Read 30 mins, Exercise"
                  className="bg-zinc-950 border border-zinc-850 rounded-xl p-3 text-xs w-full text-zinc-300 placeholder-zinc-700 focus:outline-hidden focus:border-zinc-700"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-zinc-500 font-bold uppercase">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="e.g. In the bedroom before bed"
                  className="bg-zinc-950 border border-zinc-850 rounded-xl p-3 text-xs w-full text-zinc-300 placeholder-zinc-700 focus:outline-hidden focus:border-zinc-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 font-bold uppercase">Routine Group</label>
                  <select
                    value={routineGroup}
                    onChange={e => setRoutineGroup(e.target.value as any)}
                    className="bg-zinc-950 border border-zinc-850 rounded-xl p-3 text-xs w-full text-zinc-300 focus:outline-hidden focus:border-zinc-700"
                  >
                    <option value="none">Standalone</option>
                    <option value="morning">Morning Routine</option>
                    <option value="evening">Evening Routine</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500 font-bold uppercase">Target Streak</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={targetStreak}
                    onChange={e => setTargetStreak(parseInt(e.target.value))}
                    className="bg-zinc-950 border border-zinc-850 rounded-xl p-3 text-xs w-full text-zinc-300 focus:outline-hidden focus:border-zinc-700"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold py-3 rounded-xl text-xs transition-all cursor-pointer shadow-lg shadow-amber-500/10 mt-6"
              >
                {editingHabit ? "Save Changes" : "Create Habit"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HabitsView;
