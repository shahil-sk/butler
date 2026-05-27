import React from "react";
import { DatabaseColumn } from "../types";
import { Project } from "../../projects/types";
import { Trash2 } from "lucide-react";

interface DatabaseGridProps {
  columns: DatabaseColumn[];
  records: Array<{ id: string; vals: Record<string, any> }>;
  projects: Project[];
  onCellChange: (recordId: string, colId: string, value: any) => void;
  onDeleteRecord: (id: string) => void;
}

export const DatabaseGrid: React.FC<DatabaseGridProps> = ({
  columns,
  records,
  projects,
  onCellChange,
  onDeleteRecord,
}) => {
  return (
    <div className="min-w-full inline-block align-middle border border-zinc-800 rounded-lg overflow-x-auto bg-zinc-900/10 text-zinc-150">
      <table className="min-w-full divide-y divide-zinc-850 text-xs">
        <thead className="bg-zinc-900/60 font-semibold text-zinc-300">
          <tr>
            {columns.map((col) => (
              <th key={col.id} className="px-4 py-3 text-left tracking-wider min-w-[140px] border-r border-zinc-850">
                {col.name} <span className="text-[9px] text-zinc-500 uppercase">({col.type})</span>
              </th>
            ))}
            <th className="px-4 py-3 text-right w-16">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-900 bg-zinc-950/20">
          {records.map((rec) => (
            <tr key={rec.id} className="hover:bg-zinc-900/30">
              {columns.map((col) => (
                <td key={col.id} className="px-4 py-2 border-r border-zinc-900">
                  {col.type === "select" ? (
                    <select
                      value={rec.vals[col.id] || ""}
                      onChange={(e) => onCellChange(rec.id, col.id, e.target.value)}
                      className="bg-zinc-900 border border-zinc-800 text-zinc-300 rounded px-1.5 py-0.5 focus:outline-none w-full"
                    >
                      <option value="">None</option>
                      {(col.options || []).map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : col.type === "relation" ? (
                    <select
                      value={rec.vals[col.id] || ""}
                      onChange={(e) => onCellChange(rec.id, col.id, e.target.value)}
                      className="bg-zinc-900 border border-zinc-800 text-zinc-300 rounded px-1.5 py-0.5 focus:outline-none w-full"
                    >
                      <option value="">None</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={col.type === "number" ? "number" : col.type === "date" ? "date" : "text"}
                      value={rec.vals[col.id] ?? ""}
                      onChange={(e) => onCellChange(rec.id, col.id, e.target.value)}
                      className="bg-transparent border-none focus:outline-none text-zinc-200 w-full px-1 py-0.5 focus:bg-zinc-900/50 rounded"
                    />
                  )}
                </td>
              ))}
              <td className="px-4 py-2 text-right">
                <button
                  onClick={() => onDeleteRecord(rec.id)}
                  className="text-zinc-650 hover:text-red-400 p-1 cursor-pointer transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
