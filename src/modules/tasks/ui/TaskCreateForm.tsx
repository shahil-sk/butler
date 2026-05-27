import React, { useState } from "react";
import { Plus } from "lucide-react";
import { TaskPriority } from "../types";

interface TaskCreateFormProps {
  onCreate: (title: string, priority: TaskPriority, tags: string[]) => Promise<void>;
}

export const TaskCreateForm: React.FC<TaskCreateFormProps> = ({ onCreate }) => {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [tags, setTags] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const tagList = tags
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    await onCreate(title.trim(), priority, tagList);
    setTitle("");
    setTags("");
  };

  return (
    <form onSubmit={handleSubmit} className="bg-zinc-900/25 border border-zinc-850 rounded-xl p-4 mt-4 shrink-0 flex flex-col gap-3">
      <input
        type="text"
        className="bg-zinc-950 border border-zinc-850 rounded-lg px-4 py-2 text-xs text-zinc-200 placeholder-zinc-650 focus:outline-none focus:border-zinc-750"
        placeholder="Type new task title here..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-zinc-500 font-semibold uppercase">Priority:</span>
            <select
              className="bg-zinc-950 border border-zinc-850 rounded-lg px-2 py-0.8 text-[10px] text-zinc-400 focus:outline-none cursor-pointer"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-zinc-500 font-semibold uppercase">Tags:</span>
            <input
              type="text"
              className="bg-zinc-950 border border-zinc-850 rounded-lg px-2 py-0.8 text-[10px] text-zinc-400 placeholder-zinc-700 focus:outline-none"
              placeholder="work, personal"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </div>
        </div>

        <button
          type="submit"
          className="bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-bold px-4 py-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Create
        </button>
      </div>
    </form>
  );
};
