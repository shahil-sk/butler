import React from "react";
import { Task, TaskStatus } from "../types";
import { Tag, Sparkles, Trash2 } from "lucide-react";

interface TaskRowProps {
  task: Task;
  subtasks: Task[];
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  generatingId: string | null;
  onAIBreakdown: (task: Task) => void;
  priorityColorHelper: (p: string) => string;
}

export const TaskRow: React.FC<TaskRowProps> = ({
  task,
  subtasks,
  onDelete,
  onStatusChange,
  generatingId,
  onAIBreakdown,
  priorityColorHelper,
}) => {
  return (
    <div className="space-y-1.5 text-zinc-150">
      {/* Root Task Row */}
      <div className="flex items-center justify-between p-3.5 bg-zinc-900/10 border border-zinc-850/60 rounded-xl hover:border-zinc-800 transition-colors group">
        <div className="flex items-center gap-3">
          <select
            className="bg-zinc-950 border border-zinc-800 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-zinc-400 focus:outline-none cursor-pointer"
            value={task.status}
            onChange={(e) => onStatusChange(task.id, e.target.value as TaskStatus)}
          >
            <option value="todo">Todo</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
          </select>
          <div>
            <span className={`text-sm font-medium ${
              task.status === "done" ? "line-through text-zinc-650" : "text-zinc-200"
            }`}>
              {task.title}
            </span>
            <div className="flex items-center gap-2.5 mt-1.5">
              <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-sm border ${priorityColorHelper(task.priority)}`}>
                {task.priority}
              </span>
              {task.tags.map((t) => (
                <span key={t} className="text-[9px] text-zinc-550 flex items-center gap-0.5">
                  <Tag className="w-2.5 h-2.5" />
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
          <button
            onClick={() => onAIBreakdown(task)}
            disabled={generatingId === task.id}
            className={`p-1.5 hover:bg-amber-500/10 hover:text-amber-400 text-zinc-600 rounded-lg cursor-pointer ${
              generatingId === task.id ? "animate-pulse text-amber-500" : ""
            }`}
            title="AI Subtask Breakdown"
          >
            <Sparkles className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(task.id)}
            className="p-1.5 hover:bg-red-500/10 hover:text-red-400 text-zinc-600 rounded-lg cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Subtasks rendering */}
      {subtasks.map((sub) => (
        <div
          key={sub.id}
          className="ml-8 flex items-center justify-between p-2.5 bg-zinc-900/5 border border-zinc-850/30 rounded-lg hover:border-zinc-800 transition-colors group text-xs"
        >
          <div className="flex items-center gap-2">
            <select
              className="bg-zinc-950 border border-zinc-800 rounded px-1 py-0.5 text-[9px] font-semibold text-zinc-550 focus:outline-none cursor-pointer"
              value={sub.status}
              onChange={(e) => onStatusChange(sub.id, e.target.value as TaskStatus)}
            >
              <option value="todo">Todo</option>
              <option value="in_progress">In Progress</option>
              <option value="done">Done</option>
            </select>
            <span className={`font-medium ${sub.status === "done" ? "line-through text-zinc-650" : "text-zinc-300"}`}>
              {sub.title}
            </span>
          </div>
          <button
            onClick={() => onDelete(sub.id)}
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/10 hover:text-red-400 text-zinc-700 rounded-md transition-all cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
