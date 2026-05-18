import { useRef, useEffect, useState, type KeyboardEvent } from "react";
import { X, Calendar, Flag, FolderKanban } from "lucide-react";
import { cn } from "@/shared/utils";
import { ProjectDot } from "@/shared/ui";
import { useTaskStore } from "../store";
import { useProjectStore } from "@/modules/projects/store";
import type { Priority } from "@/shared/types";

const PRIORITIES: { value: Priority; label: string; cls: string }[] = [
  { value: "urgent", label: "Urgent", cls: "text-red-500" },
  { value: "high",   label: "High",   cls: "text-orange-500" },
  { value: "medium", label: "Medium", cls: "text-yellow-500" },
  { value: "low",    label: "Low",    cls: "text-blue-400" },
  { value: "none",   label: "None",   cls: "text-muted-foreground" },
];

export function QuickAdd() {
  const { quickAddOpen, quickAddPrefill, closeQuickAdd, createTask } = useTaskStore();
  const projects = useProjectStore((s) => s.projects.filter((p) => p.status === "active"));

  const inputRef = useRef<HTMLInputElement>(null);
  const [title,            setTitle]            = useState("");
  const [dueDate,          setDueDate]          = useState("");
  const [priority,         setPriority]         = useState<Priority>("none");
  const [projectId,        setProjectId]        = useState<string>("");
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const [showProjectMenu,  setShowProjectMenu]  = useState(false);

  useEffect(() => {
    if (quickAddOpen) {
      setTitle(quickAddPrefill.title ?? "");
      setDueDate(quickAddPrefill.dueDate ?? "");
      setPriority((quickAddPrefill.priority as Priority) ?? "none");
      setProjectId(quickAddPrefill.projectId ?? "");
      setShowPriorityMenu(false);
      setShowProjectMenu(false);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [quickAddOpen, quickAddPrefill]);

  if (!quickAddOpen) return null;

  const submit = async () => {
    if (!title.trim()) return;
    await createTask({
      ...quickAddPrefill,
      title:     title.trim(),
      dueDate:   dueDate || undefined,
      priority,
      projectId: projectId || undefined,
    });
    closeQuickAdd();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submit(); }
    if (e.key === "Escape") closeQuickAdd();
  };

  const activePriority = PRIORITIES.find((p) => p.value === priority)!;
  const activeProject  = projects.find((p) => p.id === projectId);

  const priorityAccentBar: Record<string, string> = {
    urgent: "bg-red-500",
    high:   "bg-orange-400",
    medium: "bg-yellow-400",
    low:    "bg-blue-400",
    none:   "bg-transparent",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={closeQuickAdd}
      />

      <div className="relative z-10 w-full max-w-[520px] rounded-2xl border border-border bg-popover shadow-xl animate-fade-in overflow-visible">
        {/* Priority accent strip */}
        <div
          className={cn(
            "absolute left-0 top-3 bottom-3 w-[3px] rounded-full transition-colors duration-200",
            priorityAccentBar[priority]
          )}
        />

        {/* Input row */}
        <div className="flex items-center gap-3 px-5 pt-4 pb-3">
          <input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="What needs to be done?"
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/35 font-[440]"
          />
          <button
            onClick={closeQuickAdd}
            className="shrink-0 p-1.5 rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-muted/70 transition-fast"
          >
            <X size={14} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-1.5 px-4 pb-4 pt-2 border-t border-border/50 flex-wrap">

          {/* Due date */}
          <label className={cn(
            "relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer",
            "border transition-fast select-none",
            dueDate
              ? "text-blue-500 border-blue-500/35 bg-blue-500/6"
              : "text-muted-foreground/60 border-border/70 hover:border-border hover:text-foreground hover:bg-muted/40"
          )}>
            <Calendar size={12} strokeWidth={1.75} />
            {dueDate || "Due date"}
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full"
            />
          </label>

          {/* Priority */}
          <div className="relative">
            <button
              onClick={() => { setShowPriorityMenu((v) => !v); setShowProjectMenu(false); }}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-fast",
                priority !== "none"
                  ? cn(activePriority.cls, "border-current/25 bg-current/5")
                  : "text-muted-foreground/60 border-border/70 hover:border-border hover:text-foreground hover:bg-muted/40"
              )}
            >
              <Flag size={12} strokeWidth={1.75} />
              {activePriority.label}
            </button>
            {showPriorityMenu && (
              <>
                <div className="fixed inset-0 z-[60]" onClick={() => setShowPriorityMenu(false)} />
                <div className="absolute bottom-full left-0 mb-1.5 z-[70] w-36 rounded-xl border border-border bg-popover shadow-popover py-1.5 animate-fade-in">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => { setPriority(p.value); setShowPriorityMenu(false); }}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-[7px] text-xs hover:bg-accent transition-fast",
                        p.cls
                      )}
                    >
                      <Flag size={11} strokeWidth={1.75} />
                      {p.label}
                      {priority === p.value && <span className="ml-auto text-current opacity-60">✓</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Project */}
          {projects.length > 0 && (
            <div className="relative">
              <button
                onClick={() => { setShowProjectMenu((v) => !v); setShowPriorityMenu(false); }}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-fast",
                  activeProject
                    ? "text-foreground border-border hover:bg-muted/40"
                    : "text-muted-foreground/60 border-border/70 hover:border-border hover:text-foreground hover:bg-muted/40"
                )}
              >
                {activeProject
                  ? <><ProjectDot color={activeProject.color} size={7} />{activeProject.name}</>
                  : <><FolderKanban size={12} strokeWidth={1.75} />Project</>}
              </button>
              {showProjectMenu && (
                <>
                  <div className="fixed inset-0 z-[60]" onClick={() => setShowProjectMenu(false)} />
                  <div className="absolute bottom-full left-0 mb-1.5 z-[70] w-52 rounded-xl border border-border bg-popover shadow-popover py-1.5 animate-fade-in">
                    <button
                      onClick={() => { setProjectId(""); setShowProjectMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-[7px] text-xs text-muted-foreground hover:bg-accent transition-fast"
                    >
                      No project
                      {!projectId && <span className="ml-auto opacity-60">✓</span>}
                    </button>
                    <div className="my-1 mx-3 border-t border-border/50" />
                    {projects.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => { setProjectId(p.id); setShowProjectMenu(false); }}
                        className="w-full flex items-center gap-2 px-3 py-[7px] text-xs hover:bg-accent transition-fast"
                      >
                        <ProjectDot color={p.color} size={7} />
                        <span className="flex-1 text-left truncate">{p.name}</span>
                        {projectId === p.id && <span className="text-primary opacity-60">✓</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="flex-1" />

          {/* Keyboard hint */}
          <span className="text-[10px] text-muted-foreground/30 hidden sm:flex items-center gap-1">
            <kbd className="kbd">↵</kbd> save · <kbd className="kbd">ESC</kbd> cancel
          </span>

          {/* Submit */}
          <button
            onClick={() => void submit()}
            disabled={!title.trim()}
            className={cn(
              "px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold",
              "hover:bg-primary/90 disabled:opacity-35 disabled:cursor-not-allowed transition-fast"
            )}
          >
            Add task
          </button>
        </div>
      </div>
    </div>
  );
}
