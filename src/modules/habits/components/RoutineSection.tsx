import React, { useState } from "react";
import { Plus, Play, MoreHorizontal, Sun, Moon, Clock, X, Check } from "lucide-react";
import { useHabitsStore } from "../store";
import { cn } from "@/shared/utils";

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export function RoutineSection() {
  const { routines, habits, createRoutine, deleteRoutine } = useHabitsStore();
  const [isCreating, setIsCreating] = useState(false);

  const [name, setName] = useState("");
  const [type, setType] = useState<"morning" | "evening" | "custom">("morning");
  const [selectedHabits, setSelectedHabits] = useState<string[]>([]);
  const [selectedDays, setSelectedDays] = useState<number[]>(ALL_DAYS);

  const handleSave = async () => {
    if (!name.trim()) return;
    await createRoutine({
      name: name.trim(),
      type,
      habitIds: selectedHabits,
      days: selectedDays,
      active: true,
    });
    setIsCreating(false);
    resetForm();
  };

  const resetForm = () => {
    setName("");
    setType("morning");
    setSelectedHabits([]);
    setSelectedDays(ALL_DAYS);
  };

  const toggleDay = (day: number) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter((d) => d !== day));
    } else {
      setSelectedDays([...selectedDays, day].sort());
    }
  };

  const toggleHabit = (id: string) => {
    if (selectedHabits.includes(id)) {
      setSelectedHabits(selectedHabits.filter((h) => h !== id));
    } else {
      setSelectedHabits([...selectedHabits, id]);
    }
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Play size={18} className="text-primary" /> Routines
        </h2>
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="btn btn-ghost btn-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5"
          >
            <Plus size={14} /> New Routine
          </button>
        )}
      </div>

      {isCreating && (
        <div className="dashboard-card p-5 border-primary/40 mb-4 animate-fade-in space-y-4">
          <div className="flex items-center gap-3">
            <input
              autoFocus
              type="text"
              placeholder="Routine name (e.g. Morning Wake-up)"
              className="flex-1 bg-transparent border-none outline-none font-medium text-lg"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            {(["morning", "evening", "custom"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium uppercase tracking-wider transition-colors",
                  type === t
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Habits in Routine</p>
            {habits.length === 0 ? (
              <p className="text-sm text-muted-foreground">No habits created yet. Create some habits first!</p>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-[150px] overflow-y-auto pr-2">
                {habits.map((habit) => {
                  const isSelected = selectedHabits.includes(habit.id);
                  return (
                    <div
                      key={habit.id}
                      onClick={() => toggleHabit(habit.id)}
                      className={cn(
                        "flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-colors",
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border bg-background hover:bg-muted/30"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors",
                            isSelected ? "bg-primary border-primary text-primary-foreground" : "border-border"
                          )}
                        >
                          {isSelected && <Check size={10} />}
                        </div>
                        <span className="text-sm font-medium">{habit.name}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Days</p>
            <div className="flex gap-1.5">
              {ALL_DAYS.map((day) => {
                const isSelected = selectedDays.includes(day);
                return (
                  <button
                    key={day}
                    onClick={() => toggleDay(day)}
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors",
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {DAY_LABELS[day]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setIsCreating(false);
                resetForm();
              }}
            >
              Cancel
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={!name.trim()}>
              Save Routine
            </button>
          </div>
        </div>
      )}

      {routines.length === 0 && !isCreating ? (
        <div className="border border-dashed border-border rounded-xl p-8 text-center text-muted-foreground bg-muted/20">
          <p className="text-sm">No routines yet. Group your habits into Morning or Evening flows.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {routines.map((routine) => {
            const Icon = routine.type === "morning" ? Sun : routine.type === "evening" ? Moon : Clock;
            const routineHabits = routine.habitIds
              .map((id) => habits.find((h) => h.id === id))
              .filter(Boolean);

            return (
              <div key={routine.id} className="dashboard-card p-4 hover:border-border/80 transition-colors group">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                      <Icon size={14} />
                    </div>
                    <h3 className="font-medium text-sm">{routine.name}</h3>
                  </div>
                  <button
                    onClick={() => deleteRoutine(routine.id)}
                    className="p-1 rounded text-muted-foreground hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete routine"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="flex gap-1 mb-4">
                  {ALL_DAYS.map((day) => (
                    <div
                      key={day}
                      className={cn(
                        "w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold",
                        routine.days.includes(day)
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground/30"
                      )}
                    >
                      {DAY_LABELS[day]}
                    </div>
                  ))}
                </div>

                {routineHabits.length > 0 ? (
                  <div className="space-y-2">
                    {routineHabits.map((h, idx) => (
                      <div key={h!.id} className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 p-2 rounded-md">
                        <span className="text-[10px] bg-background px-1.5 rounded text-muted-foreground border border-border/50">
                          {idx + 1}
                        </span>
                        <span className="truncate">{h!.name}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No habits attached.</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
