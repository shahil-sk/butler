import React from "react";
import { Heart } from "lucide-react";
import { JournalEntry } from "../types";

interface GratitudeWallProps {
  entries: JournalEntry[];
}

export const GratitudeWall: React.FC<GratitudeWallProps> = ({ entries }) => {
  const gratitudeEntries = entries.filter(
    (e) => e.gratitude && e.gratitude.some((item) => item && item.trim() !== "")
  );

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-bold text-zinc-300">Gratitude Wall</h3>
        <p className="text-[11px] text-zinc-500">A collection of moments and thoughts you've expressed gratitude for.</p>
      </div>

      {gratitudeEntries.length === 0 ? (
        <div className="text-center py-8 text-zinc-650 text-xs border border-dashed border-zinc-850 rounded-2xl">
          Start logging daily gratitude items to fill this wall!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {gratitudeEntries.map((entry) => (
            <div
              key={entry.id}
              className="bg-zinc-900/40 border border-zinc-850 rounded-2xl p-4 space-y-3 hover:border-zinc-800 transition-colors"
            >
              <div className="flex justify-between items-center border-b border-zinc-900 pb-2">
                <span className="text-[11px] font-semibold text-zinc-400">
                  {formatDate(entry.date)}
                </span>
                <Heart className="w-3.5 h-3.5 text-rose-500/80 fill-rose-500/20" />
              </div>

              <ul className="space-y-1.5">
                {entry.gratitude
                  .filter((item) => item && item.trim() !== "")
                  .map((item, idx) => (
                    <li key={idx} className="text-xs text-zinc-350 flex items-start gap-2 leading-relaxed">
                      <span className="text-amber-500 font-bold shrink-0 mt-0.5">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
export default GratitudeWall;
