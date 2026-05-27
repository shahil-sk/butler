import React, { useState } from "react";
import { DatabaseColumn, ColumnType } from "../types";
import { Settings, Plus, Trash2 } from "lucide-react";

interface SchemaManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  columns: DatabaseColumn[];
  onSave: (columns: DatabaseColumn[]) => void;
}

export const SchemaManagerModal: React.FC<SchemaManagerModalProps> = ({
  isOpen,
  onClose,
  columns,
  onSave,
}) => {
  const [editingCols, setEditingCols] = useState<DatabaseColumn[]>(columns);

  if (!isOpen) return null;

  const handleAddColumn = () => {
    const id = `col-${Date.now()}`;
    setEditingCols([...editingCols, { id, name: `New Column`, type: "text", options: [] }]);
  };

  const handleRemoveColumn = (colId: string) => {
    setEditingCols(editingCols.filter((c) => c.id !== colId));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-lg w-full p-6 space-y-4 shadow-xl flex flex-col max-h-[85vh] text-zinc-100">
        <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2 shrink-0">
          <Settings className="h-4 w-4 text-amber-500" /> Database Schema Manager
        </h3>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
          {editingCols.map((col, idx) => (
            <div key={col.id} className="flex items-center gap-2 bg-zinc-950/40 p-2.5 rounded border border-zinc-850">
              <input
                type="text"
                value={col.name}
                onChange={(e) => {
                  const next = [...editingCols];
                  next[idx].name = e.target.value;
                  setEditingCols(next);
                }}
                className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-200 w-1/3"
                placeholder="Field Name"
              />

              <select
                value={col.type}
                onChange={(e) => {
                  const next = [...editingCols];
                  next[idx].type = e.target.value as ColumnType;
                  if (next[idx].type === "select" && !next[idx].options) {
                    next[idx].options = ["Option 1"];
                  }
                  setEditingCols(next);
                }}
                className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-200 w-1/4"
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
                <option value="select">Select (Dropdown)</option>
                <option value="relation">Project Relation</option>
              </select>

              {col.type === "select" && (
                <input
                  type="text"
                  value={(col.options || []).join(", ")}
                  onChange={(e) => {
                    const next = [...editingCols];
                    next[idx].options = e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter((s) => s.length > 0);
                    setEditingCols(next);
                  }}
                  className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-300 flex-1 min-w-0"
                  placeholder="e.g. Active, Pending"
                />
              )}

              {editingCols.length > 1 && (
                <button
                  onClick={() => handleRemoveColumn(col.id)}
                  className="text-zinc-600 hover:text-red-400 p-1 cursor-pointer shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}

          <button
            onClick={handleAddColumn}
            className="w-full bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 text-zinc-300 rounded py-2 font-medium flex items-center justify-center gap-1 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" /> Add Property Column
          </button>
        </div>

        <div className="flex justify-end gap-2 text-xs pt-2 border-t border-zinc-800 shrink-0">
          <button
            onClick={onClose}
            className="bg-zinc-850 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 rounded px-3 py-1.5 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(editingCols)}
            className="bg-amber-600 hover:bg-amber-500 text-zinc-950 rounded px-4 py-1.5 font-semibold cursor-pointer"
          >
            Save Properties
          </button>
        </div>
      </div>
    </div>
  );
};
