import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/shared/utils";
import { useProjectStore } from "../store";

const PRESET_COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#6b7280",
];

export function CreateProjectModal() {
  const { createModalOpen, closeCreateModal, createProject } = useProjectStore();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [dueDate, setDueDate] = useState("");

  if (!createModalOpen) return null;

  const submit = async () => {
    if (!name.trim()) return;
    await createProject({ name: name.trim(), description, color, dueDate: dueDate || undefined });
    setName(""); setDescription(""); setColor("#3b82f6"); setDueDate("");
    closeCreateModal();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeCreateModal} />

      <div className="relative z-10 w-full max-w-[440px] mx-4 rounded-xl border border-border bg-popover shadow-2xl animate-fade-in">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold flex-1">New Project</h2>
          <button onClick={closeCreateModal} className="text-muted-foreground hover:text-foreground transition-fast">
            <X size={15} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Color + Name */}
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg shrink-0 cursor-pointer border-2 border-white/20"
              style={{ backgroundColor: color }}
            />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void submit()}
              placeholder="Project name"
              autoFocus
              className="flex-1 text-sm bg-transparent outline-none"
            />
          </div>

          {/* Color picker */}
          <div className="flex items-center gap-2 flex-wrap">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={cn(
                  "w-6 h-6 rounded-full transition-fast",
                  color === c && "ring-2 ring-offset-2 ring-offset-popover ring-primary"
                )}
                style={{ backgroundColor: c }}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-6 h-6 rounded-full cursor-pointer border-0 bg-transparent"
              title="Custom color"
            />
          </div>

          {/* Description */}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="w-full text-sm bg-transparent outline-none resize-none text-muted-foreground placeholder:text-muted-foreground/50"
            rows={2}
          />

          {/* Due date */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-16">Due date</span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="text-sm bg-transparent outline-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
          <button
            onClick={closeCreateModal}
            className="px-3 py-1.5 text-xs rounded-md border border-border hover:bg-accent transition-fast"
          >
            Cancel
          </button>
          <button
            onClick={() => void submit()}
            disabled={!name.trim()}
            className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-fast"
          >
            Create project
          </button>
        </div>
      </div>
    </div>
  );
}
