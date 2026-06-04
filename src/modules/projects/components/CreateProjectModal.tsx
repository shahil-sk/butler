import { useState } from "react";
import { X, Folder, Calendar } from "lucide-react";
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
    <div className="fixed inset-0 z-[100] flex justify-end">
      <div className="absolute inset-0 bg-background/40 backdrop-blur-sm transition-opacity animate-fade-in" onClick={closeCreateModal} />

      <div className="relative w-full md:w-[500px] h-full bg-card border-l border-border/50 flex flex-col shadow-2xl animate-slide-in-right">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border/50 bg-card/80 backdrop-blur-md">
          <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-muted-foreground uppercase">
            <Folder size={14} /> New Project
          </div>
          <button onClick={closeCreateModal} className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8">
          
          <div className="space-y-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void submit()}
              placeholder="Project Name"
              autoFocus
              className="w-full bg-transparent text-3xl font-bold tracking-tight text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add project details, goals, or scope..."
              className="w-full min-h-[100px] bg-transparent text-[15px] text-foreground/80 placeholder:text-muted-foreground/50 focus:outline-none resize-none leading-relaxed"
            />
          </div>

          <div className="space-y-6">
            <div className="flex flex-col rounded-xl border border-border/60 bg-muted/20 overflow-hidden divide-y divide-border/60">
              
              {/* Due Date */}
              <div className="flex items-center justify-between p-4 bg-card/50">
                <div className="flex items-center gap-3 text-sm font-medium">
                  <div className="w-6 h-6 rounded-md bg-blue-500/10 text-blue-500 flex items-center justify-center"><Calendar size={14} /></div>
                  Target Date
                </div>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="bg-transparent text-sm text-right font-medium focus:outline-none text-muted-foreground hover:text-foreground cursor-pointer"
                />
              </div>

              {/* Color Picker */}
              <div className="flex items-center justify-between p-4 bg-card/50">
                <div className="flex items-center gap-3 text-sm font-medium">
                  <div className="w-6 h-6 rounded-md bg-transparent border-2 flex items-center justify-center transition-colors" style={{borderColor: color}}>
                    <div className="w-3 h-3 rounded-full" style={{backgroundColor: color}} />
                  </div>
                  Accent Color
                </div>
                <div className="flex items-center gap-1.5">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={cn(
                        "w-5 h-5 rounded-full transition-fast",
                        color === c && "ring-2 ring-offset-2 ring-offset-card ring-foreground"
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border/50 bg-card/80 backdrop-blur-md">
          <button
            onClick={() => void submit()}
            disabled={!name.trim()}
            className="w-full h-12 bg-foreground text-background font-semibold text-sm rounded-xl flex items-center justify-center shadow-md hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create Project
          </button>
        </div>
        
      </div>
    </div>
  );
}
