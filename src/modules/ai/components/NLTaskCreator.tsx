// ============================================================
// AI ASSISTANT — NATURAL LANGUAGE TASK CREATOR
// Parse plain English into a structured task proposal.
// ============================================================

import React, { useState } from "react";
import { Wand2, Loader2, Check, X, AlertCircle } from "lucide-react";
import { cn } from "@/shared/utils";
import { useAIStore } from "../store";
import type { ParsedTask } from "@/shared/types";

interface NLTaskCreatorProps {
  onAccept: (task: ParsedTask) => void;
  onDismiss?: () => void;
  placeholder?: string;
}

const PRIORITY_COLOR: Record<string, string> = {
  urgent: "text-red-500",
  high: "text-orange-500",
  medium: "text-yellow-500",
  low: "text-blue-400",
  none: "text-muted-foreground",
};

export function NLTaskCreator({ onAccept, onDismiss, placeholder }: NLTaskCreatorProps) {
  const { parseTaskFromNL, isGenerating, lastError, clearError } = useAIStore();
  const [input, setInput] = useState("");
  const [parsed, setParsed] = useState<ParsedTask | null>(null);

  const handleParse = async () => {
    if (!input.trim() || isGenerating) return;
    clearError();
    try {
      const result = await parseTaskFromNL(input);
      setParsed(result);
    } catch {
      // error in store
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") void handleParse();
  };

  const handleAccept = () => {
    if (parsed) {
      onAccept(parsed);
      setParsed(null);
      setInput("");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => { setInput(e.target.value); setParsed(null); }}
          onKeyDown={handleKey}
          placeholder={placeholder || "e.g. call John tomorrow 2pm re Q4 proposal — high priority"}
          className="flex-1 h-9 px-3 text-sm bg-surface-1 border border-border rounded-lg text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/60 transition-colors"
        />
        <button
          onClick={() => void handleParse()}
          disabled={!input.trim() || isGenerating}
          className={cn(
            "h-9 px-3 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-all",
            input.trim() && !isGenerating
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
        >
          {isGenerating
            ? <Loader2 size={13} className="animate-spin" />
            : <Wand2 size={13} />
          }
          <span>Parse</span>
        </button>
      </div>

      {lastError && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/8 border border-red-500/20 rounded-lg px-3 py-2">
          <AlertCircle size={12} />
          <span className="flex-1">{lastError}</span>
          <button onClick={clearError}><X size={11} /></button>
        </div>
      )}

      {parsed && (
        <div className="dashboard-card p-3 flex flex-col gap-2 animate-fade-in">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">Parsed Task</p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleAccept}
                className="h-6 px-2.5 rounded-md bg-primary/10 text-primary text-xs font-medium flex items-center gap-1 hover:bg-primary/20 transition-colors"
              >
                <Check size={11} /> Accept
              </button>
              <button
                onClick={() => { setParsed(null); onDismiss?.(); }}
                className="h-6 px-2 rounded-md hover:bg-accent text-muted-foreground text-xs flex items-center transition-colors"
              >
                <X size={11} />
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-medium text-foreground">{parsed.title}</p>
            <div className="flex flex-wrap gap-2">
              {parsed.dueDate && (
                <Chip label={parsed.dueDate} color="blue" />
              )}
              {parsed.dueTime && (
                <Chip label={parsed.dueTime} color="blue" />
              )}
              {parsed.priority && parsed.priority !== "none" && (
                <span className={cn("text-[11px] font-semibold capitalize", PRIORITY_COLOR[parsed.priority])}>
                  ↑ {parsed.priority}
                </span>
              )}
              {parsed.projectName && (
                <Chip label={parsed.projectName} color="purple" />
              )}
              {parsed.estimateMinutes && (
                <Chip label={`~${parsed.estimateMinutes}m`} color="default" />
              )}
              {parsed.tags?.map((t) => <Chip key={t} label={`#${t}`} color="default" />)}
            </div>
            {parsed.description && (
              <p className="text-xs text-muted-foreground leading-relaxed">{parsed.description}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ label, color }: { label: string; color: "blue" | "purple" | "default" }) {
  const cls = {
    blue: "bg-blue-500/10 text-blue-400",
    purple: "bg-purple-500/10 text-purple-400",
    default: "bg-muted text-muted-foreground",
  }[color];
  return (
    <span className={cn("text-[11px] px-1.5 py-0.5 rounded font-medium", cls)}>{label}</span>
  );
}
