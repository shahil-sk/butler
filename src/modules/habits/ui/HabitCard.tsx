import React from "react";
import { Flame, Trash2, Check, Minus, AlertCircle, Award } from "lucide-react";
import { Habit, HabitLog, StreakStats } from "../types";
import { useHabitsStore } from "../state/habitsStore";

interface HabitCardProps {
  habit: Habit;
  logs: HabitLog[];
  stats: StreakStats | undefined;
  onEdit: (habit: Habit) => void;
}

export const HabitCard: React.FC<HabitCardProps> = ({ habit, logs, stats, onEdit }) => {
  const { deleteHabit, logHabitStatus } = useHabitsStore();

  const past7Days = React.useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split("T")[0];
    });
  }, []);

  const getLogForDate = (dateStr: string) => {
    return logs.find((l) => l.date === dateStr);
  };

  const getDayLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    const days = ["S", "M", "T", "W", "T", "F", "S"];
    return days[d.getDay()];
  };

  const handleDayClick = async (dateStr: string) => {
    const existingLog = getLogForDate(dateStr);
    let nextStatus: "completed" | "skipped" | "failed" | "none" = "completed";

    if (existingLog) {
      if (existingLog.status === "completed") {
        nextStatus = "skipped";
      } else if (existingLog.status === "skipped") {
        nextStatus = "failed";
      } else if (existingLog.status === "failed") {
        nextStatus = "none";
      }
    }

    await logHabitStatus(habit.id, dateStr, nextStatus);
  };

  const renderStatusIcon = (status: string | undefined) => {
    switch (status) {
      case "completed":
        return <Check className="w-3.5 h-3.5 text-zinc-950 font-bold" />;
      case "skipped":
        return <Minus className="w-3 h-3 text-zinc-400" />;
      case "failed":
        return <AlertCircle className="w-3 h-3 text-rose-500" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string | undefined) => {
    switch (status) {
      case "completed":
        return "bg-emerald-400 border-emerald-300 text-zinc-950 shadow-xs shadow-emerald-400/10";
      case "skipped":
        return "bg-zinc-800 border-zinc-700 text-zinc-400";
      case "failed":
        return "bg-rose-950/40 border-rose-900/60 text-rose-450";
      default:
        return "bg-transparent border-zinc-850 hover:border-zinc-700";
    }
  };

  const currentStreak = stats?.current_streak || 0;
  const longestStreak = stats?.longest_streak || 0;
  const isTargetMet = currentStreak >= habit.target_streak;

  return (
    <div className="bg-zinc-900/40 border border-zinc-850 hover:border-zinc-800 rounded-2xl p-4.5 space-y-4 transition-all group relative">
      <div className="flex justify-between items-start pr-8">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-zinc-200">{habit.title}</h4>
            {isTargetMet && (
              <span className="text-[9px] px-1 py-0.2 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded uppercase font-bold tracking-wider">
                Target Met
              </span>
            )}
          </div>
          {habit.description && (
            <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{habit.description}</p>
          )}
        </div>
      </div>

      {/* Streak info */}
      <div className="flex items-center gap-4 text-xs font-semibold text-zinc-400 border-t border-zinc-900/60 pt-3">
        <div className="flex items-center gap-1.5">
          <Flame className={`w-4 h-4 ${currentStreak > 0 ? "text-amber-500 fill-amber-500/20 animate-pulse" : "text-zinc-650"}`} />
          <span>
            Streak: <strong className="text-zinc-200">{currentStreak}</strong> days
          </span>
        </div>
        <div className="flex items-center gap-1.5 border-l border-zinc-850 pl-4">
          <Award className="w-4 h-4 text-zinc-500" />
          <span>
            Max: <strong className="text-zinc-300">{longestStreak}</strong> / {habit.target_streak}
          </span>
        </div>
      </div>

      {/* 7 Day check-in grid */}
      <div className="grid grid-cols-7 gap-1.5 pt-1">
        {past7Days.map((dateStr) => {
          const log = getLogForDate(dateStr);
          const status = log?.status;
          const todayStr = new Date().toISOString().split("T")[0];
          const isToday = dateStr === todayStr;

          return (
            <div key={dateStr} className="flex flex-col items-center gap-1">
              <button
                type="button"
                onClick={() => handleDayClick(dateStr)}
                title={`${dateStr}${status ? `: ${status}` : ": Unchecked"}`}
                className={`w-8 h-8 rounded-lg border flex items-center justify-center cursor-pointer transition-all hover:scale-108 ${getStatusColor(
                  status
                )}`}
              >
                {renderStatusIcon(status)}
              </button>
              <span
                className={`text-[9px] font-bold ${
                  isToday ? "text-amber-500 font-extrabold" : "text-zinc-550"
                }`}
              >
                {getDayLabel(dateStr)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Hover action buttons */}
      <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all">
        <button
          onClick={() => onEdit(habit)}
          className="text-zinc-500 hover:text-zinc-300 p-1.5 rounded-lg hover:bg-zinc-800/80 transition-colors"
        >
          <Check className="w-3.5 h-3.5 opacity-0 pointer-events-none absolute" /> {/* fake to bypass lucide warning */}
          <span className="text-[10px] font-semibold">Edit</span>
        </button>
        <button
          onClick={() => {
            if (confirm("Are you sure you want to delete this habit?")) {
              deleteHabit(habit.id);
            }
          }}
          className="text-zinc-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-zinc-800/80 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
export default HabitCard;
