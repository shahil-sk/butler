import React from "react";
import { JournalEntry } from "../types";

interface MoodGridProps {
  entries: JournalEntry[];
  onSelectDate: (date: string) => void;
}

export const MoodGrid: React.FC<MoodGridProps> = ({ entries, onSelectDate }) => {
  // Generate last 90 days in ascending chronological order
  const days = Array.from({ length: 90 }, (_, idx) => {
    const d = new Date();
    d.setDate(d.getDate() - (89 - idx));
    return d.toISOString().split("T")[0];
  });

  const moodColors: Record<number, string> = {
    1: "bg-rose-500/80 border-rose-500 shadow-xs shadow-rose-500/10",
    2: "bg-amber-600/75 border-amber-600/50",
    3: "bg-zinc-800 border-zinc-700",
    4: "bg-emerald-600/60 border-emerald-600/30",
    5: "bg-emerald-400 text-zinc-950 border-emerald-300 shadow-sm shadow-emerald-500/20",
  };

  const moodLabels: Record<number, string> = {
    1: "Awful 😞",
    2: "Bad 😐",
    3: "Neutral 🙂",
    4: "Good 😀",
    5: "Excellent 🤩",
  };

  const getEntryForDate = (dateStr: string) => {
    return entries.find((e) => e.date === dateStr);
  };

  return (
    <div className="bg-zinc-900/10 border border-zinc-850 rounded-2xl p-5 space-y-4">
      <div>
        <h3 className="text-sm font-bold text-zinc-300">Mood Timeline (Last 90 Days)</h3>
        <p className="text-[11px] text-zinc-500">Visualize your emotional trends. Click any block to view or edit reflection.</p>
      </div>

      <div className="flex flex-wrap gap-2 max-w-full">
        {days.map((dateStr) => {
          const entry = getEntryForDate(dateStr);
          const mood = entry?.mood || 0;
          const colorClass = mood > 0 ? moodColors[mood] : "bg-zinc-950 border-zinc-900 hover:border-zinc-800";
          const tooltip = entry
            ? `${dateStr}: ${moodLabels[mood]} \n${entry.mood_notes || "No notes"}`
            : `${dateStr}: No entry`;

          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => onSelectDate(dateStr)}
              title={tooltip}
              className={`w-6 h-6 rounded-md border transition-all hover:scale-115 cursor-pointer flex items-center justify-center text-[10px] ${colorClass}`}
            >
              {entry && (mood === 5 ? "⭐" : mood === 1 ? "⚠️" : "")}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-4 text-[10px] text-zinc-500 border-t border-zinc-900 pt-3">
        <span className="font-semibold">Legend:</span>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-rose-500/80 border border-rose-500" />
          <span>Awful</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-amber-600/75 border border-amber-600/50" />
          <span>Bad</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-zinc-800 border border-zinc-700" />
          <span>Neutral</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-emerald-600/60 border border-emerald-600/30" />
          <span>Good</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-emerald-400 border border-emerald-300" />
          <span>Excellent</span>
        </div>
      </div>
    </div>
  );
};
export default MoodGrid;
