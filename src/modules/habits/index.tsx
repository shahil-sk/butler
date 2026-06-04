import { useEffect, useState, useMemo } from "react";
import { useHabitsStore } from "./store";
import { Activity, Plus, CheckCircle2, Circle, XCircle, Flame, Calendar, Info, Play } from "lucide-react";
import { today, formatDate } from "@/shared/utils";
import { cn } from "@/shared/utils";
import { RoutineSection } from "./components/RoutineSection";
import { registry } from "@/kernel/router";
import { HABITS_MANIFEST } from "./manifest";

registry.register(HABITS_MANIFEST);

export default function HabitsModule() {
  const { habits, logs, loadHabits, logHabit, createHabit } = useHabitsStore();
  const [isLoaded, setIsLoaded] = useState(false);
  const [showNewHabit, setShowNewHabit] = useState(false);
  const [newHabitName, setNewHabitName] = useState("");

  useEffect(() => {
    loadHabits().then(() => setIsLoaded(true));
  }, [loadHabits]);

  const activeHabits = useMemo(() => habits.filter(h => !h.archivedAt), [habits]);
  const todayStr = today();

  const handleCreate = async () => {
    if (!newHabitName.trim()) return;
    await createHabit({
      name: newHabitName.trim(),
      color: "#10b981",
      frequencyType: "daily",
      timesPerPeriod: 1,
      reminderEnabled: false,
      startDate: todayStr
    });
    setNewHabitName("");
    setShowNewHabit(false);
  };

  const toggleHabit = async (habitId: string) => {
    const log = logs.find(l => l.habitId === habitId && l.date === todayStr);
    if (!log || log.status !== "done") {
      await logHabit(habitId, todayStr, "done");
    } else {
      await logHabit(habitId, todayStr, "skipped");
    }
  };

  if (!isLoaded) return <div className="p-8">Loading habits...</div>;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
            <Activity size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Habits & Routines</h1>
            <p className="text-sm text-muted-foreground">Build consistency day by day.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            className="btn btn-primary gap-2"
            onClick={() => setShowNewHabit(true)}
          >
            <Plus size={16} /> New Habit
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        
        {/* Today's Check-in */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Calendar size={18} className="text-primary" /> Today's Check-in
            </h2>
            <div className="text-sm text-muted-foreground font-medium">
              {formatDate(todayStr)}
            </div>
          </div>
          
          {activeHabits.length === 0 ? (
            <div className="border border-dashed border-border rounded-xl p-8 text-center text-muted-foreground bg-muted/20">
              <Activity size={32} className="mx-auto mb-3 opacity-20" />
              <p className="mb-4">No habits set up yet.</p>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowNewHabit(true)}>
                Create your first habit
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeHabits.map(habit => {
                const log = logs.find(l => l.habitId === habit.id && l.date === todayStr);
                const isDone = log?.status === "done";
                const isSkipped = log?.status === "skipped";
                
                return (
                  <div 
                    key={habit.id}
                    className={cn(
                      "group dashboard-card p-4 flex items-center justify-between cursor-pointer transition-all hover:border-primary/40",
                      isDone ? "bg-emerald-500/5 border-emerald-500/20" : "",
                      isSkipped ? "bg-muted/30 border-dashed" : ""
                    )}
                    onClick={() => toggleHabit(habit.id)}
                  >
                    <div className="flex items-center gap-4">
                      <button 
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center transition-colors shrink-0",
                          isDone ? "text-emerald-500" : isSkipped ? "text-muted-foreground" : "text-border hover:text-primary"
                        )}
                      >
                        {isDone ? <CheckCircle2 size={24} /> : isSkipped ? <XCircle size={24} /> : <Circle size={24} />}
                      </button>
                      <div className="flex flex-col">
                        <span className={cn(
                          "font-medium transition-colors",
                          isDone ? "text-emerald-500" : isSkipped ? "text-muted-foreground line-through opacity-70" : "text-foreground"
                        )}>
                          {habit.name}
                        </span>
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">{habit.frequencyType}</span>
                      </div>
                    </div>
                    
                    {/* Placeholder Streak */}
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-orange-500/10 text-orange-500 text-xs font-bold">
                      <Flame size={12} className={isDone ? "animate-pulse" : ""} /> 0
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {showNewHabit && (
          <div className="dashboard-card p-4 border-primary/40 flex items-center gap-3">
            <input 
              autoFocus
              type="text"
              placeholder="Habit name (e.g. Read 10 pages)"
              className="flex-1 bg-transparent border-none outline-none font-medium"
              value={newHabitName}
              onChange={e => setNewHabitName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCreate()}
            />
            <button className="btn btn-secondary btn-sm" onClick={() => setShowNewHabit(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleCreate}>Save</button>
          </div>
        )}

        <RoutineSection />

      </div>
    </div>
  );
}
