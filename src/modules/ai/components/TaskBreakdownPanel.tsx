// ============================================================
// AI ASSISTANT — TASK BREAKDOWN PANEL
// Generate subtask proposals from a task title/description.
// ============================================================

import React, { useState } from "react";
import { Layers, Loader2, Check, X, Plus } from "lucide-react";
import { cn } from "@/shared/utils";
import { useAIStore } from "../store";
import type { TaskBreakdown } from "@/shared/types";

interface TaskBreakdownPanelProps {
  taskTitle: string;
  taskDescription?: string;
  projectName?: string;
  onAccept: (subtasks: TaskBreakdown["subtasks"]) => void;
  onDismiss?: () => void;
}

export function TaskBreakdownPanel({
  taskTitle, taskDescription, projectName, onAccept, onDismiss,
}: TaskBreakdownPanelProps) {
  const { breakdownTask, isGenerating } = useAIStore();
  const [subtasks, setSubtasks] = useState<TaskBreakdown["subtasks"] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [generated, setGenerated] = useState(false);

  const handleGenerate = async () => {
    const result = await breakdownTask(taskTitle, taskDescription, projectName);
    setSubtasks(result);
    setSelected(new Set(result.map((_, i) => i)));
    setGenerated(true);
  };

  const toggleSelect = (i: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  const handleAcceptSelected = () => {
    if (!subtasks) return;
    onAccept(subtasks.filter((_, i) => selected.has(i)));
  };

  if (!generated) {
    return (
      <button
        onClick={() => void handleGenerate()}
        disabled={isGenerating}
        className={cn(
          "flex items-center gap-2 text-xs font-medium px-3 h-7 rounded-md border transition-all",
          isGenerating
            ? "border-border text-muted-foreground cursor-wait"
            : "border-primary/40 text-primary hover:bg-primary/5"
        )}
      >
        {isGenerating
          ? <Loader2 size={12} className="animate-spin" />
          : <Layers size={12} />
        }
        {isGenerating ? "Breaking down..." : "Break into subtasks"}
      </button>
    );
  }

  return (
    <div className="dashboard-card p-3 flex flex-col gap-2.5 animate-fade-in">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Layers size={12} className="text-primary" />
          <span className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">Subtask Proposal</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setSelected(new Set(subtasks!.map((_, i) => i)))}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            All
          </button>
          <span className="text-[10px] text-muted-foreground/40">/</span>
          <button
            onClick={() => setSelected(new Set())}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            None
          </button>
        </div>
      </div>

      <div className="space-y-1">
        {subtasks?.map((st, i) => (
          <button
            key={i}
            onClick={() => toggleSelect(i)}
            className={cn(
              "w-full flex items-start gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors",
              selected.has(i) ? "bg-primary/8 border border-primary/20" : "hover:bg-accent border border-transparent"
            )}
          >
            <div className={cn(
              "w-4 h-4 rounded border shrink-0 mt-0.5 flex items-center justify-center transition-all",
              selected.has(i) ? "bg-primary border-primary" : "border-border"
            )}>
              {selected.has(i) && <Check size={9} className="text-primary-foreground" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground leading-snug">{st.title}</p>
              {st.description && (
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{st.description}</p>
              )}
              {st.estimateMinutes && (
                <span className="text-[10px] text-muted-foreground/60">~{st.estimateMinutes}m</span>
              )}
            </div>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleAcceptSelected}
          disabled={selected.size === 0}
          className={cn(
            "flex-1 h-7 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-all",
            selected.size > 0
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
        >
          <Plus size={11} /> Add {selected.size} subtask{selected.size !== 1 ? "s" : ""}
        </button>
        <button
          onClick={() => { setGenerated(false); setSubtasks(null); onDismiss?.(); }}
          className="h-7 px-2 rounded-md hover:bg-accent text-muted-foreground text-xs flex items-center transition-colors"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}
