import React from "react";
import { DatabaseColumn } from "../types";
import { Project } from "../../projects/types";
import { Trash2 } from "lucide-react";

interface DatabaseBoardProps {
  columns: DatabaseColumn[];
  records: Array<{ id: string; vals: Record<string, any> }>;
  projects: Project[];
  groupByColId: string;
  onDeleteRecord: (id: string) => void;
}

export const DatabaseBoard: React.FC<DatabaseBoardProps> = ({
  columns,
  records,
  projects,
  groupByColId,
  onDeleteRecord,
}) => {
  const groupColumn = columns.find((c) => c.id === groupByColId);
  const options = groupColumn?.options || [];

  return (
    <div className="flex gap-4 h-full items-start overflow-x-auto pb-4">
      {options.map((groupVal) => {
        const groupRecs = records.filter(
          (r) => r.vals[groupByColId] === groupVal
        );
        return (
          <div key={groupVal} className="w-64 bg-zinc-900/40 border border-zinc-850 rounded-lg p-3 flex flex-col max-h-full shrink-0">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">{groupVal}</span>
              <span className="bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded text-[10px]">{groupRecs.length}</span>
            </div>
            <div className="space-y-2 overflow-y-auto flex-1">
              {groupRecs.map((rec) => (
                <div key={rec.id} className="bg-zinc-950/60 border border-zinc-800 hover:border-zinc-700 rounded-md p-3 space-y-2 text-xs">
                  {columns.slice(0, 3).map((col) => (
                    <div key={col.id} className="truncate">
                      <span className="text-[10px] text-zinc-500 font-bold mr-1.5">{col.name}:</span>
                      <span className="text-zinc-300">
                        {col.type === "relation"
                          ? projects.find((p) => p.id === rec.vals[col.id])?.name || "(None)"
                          : rec.vals[col.id] || "—"}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => onDeleteRecord(rec.id)}
                      className="text-zinc-650 hover:text-red-400 cursor-pointer transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
