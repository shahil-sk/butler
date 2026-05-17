import { useRef, useEffect, useState, type KeyboardEvent } from "react";
import { X, Calendar, Flag, FolderKanban } from "lucide-react";
import { cn } from "@/shared/utils";
import { ProjectDot } from "@/shared/ui";
import { useTaskStore } from "../store";
import { useProjectStore } from "@/modules/projects/store";
import type { Priority } from "@/shared/types";

const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: "urgent", label: "Urgent", color: "text-red-500" },
  { value: "high",   label: "High",   color: "text-orange-500" },
  { value: "medium", label: "Medium", color: "text-yellow-500" },
  { value: "low",    label: "Low",    color: "text-blue-400" },
  { value: "none",   label: "None",   color: "text-muted-foreground" },
];

export function QuickAdd() {
  const { quickAddOpen, quickAddPrefill, closeQuickAdd, createTask } = useTaskStore();
  const projects = useProjectStore((s) => s.projects.filter((p) => p.status === "active"));

  const inputRef = useRef<HTMLInputElement>(null);
  const [title,     setTitle]     = useState("");
  const [dueDate,   setDueDate]   = useState("");
  const [priority,  setPriority]  = useState<Priority>("none");
  const [projectId, setProjectId] = useState<string>("");
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
      title: title.trim(),
      dueDate: dueDate || undefined,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[3px]"
        onClick={closeQuickAdd}
      />

      <div className="relative z-10 w-full max-w-[540px] rounded-xl border border-border bg-popover shadow-2xl animate-fade-in overflow-visible">
        {/* Input row */}
        <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
          {/* Subtle priority color strip on left edge */}
          <div
            className={cn(
              "absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl transition-colors duration-200",
              priority === "urgent" && "bg-red-500",
              priority === "high"   && "bg-orange-500",
              priority === "medium" && "bg-yellow-400",
              priority === "low"    && "bg-blue-400",
              priority === "none"   && "bg-transparent",
            )}
          />
          <input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="What needs to be done?"
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/40"
          />
          <button
            onClick={closeQuickAdd}
            className="shrink-0 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-fast"
          >
            <X size={14} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-1.5 px-3 pb-3 border-t border-border/50 pt-3 flex-wrap">

          {/* Due date */}
          <label className={cn(
            "relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs cursor-pointer",
            "border border-border hover:bg-accent transition-fast",
            dueDate ? "text-blue-500 border-blue-500/40 bg-blue-500/5" : "text-muted-foreground"
          )}>
            <Calendar size={12} />
            {dueDate || "Due date"}
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full"
            />
          </label>

          {/* Priority — FIXED: opens upward with bottom-full */}
          <div className="relative">
            <button
              onClick={() => { setShowPriorityMenu((v) => !v); setShowProjectMenu(false); }}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs",
                "border border-border hover:bg-accent transition-fast",
                priority !== "none"
                  ? activePriority.color + " border-current/30 bg-current/5"
                  : "text-muted-foreground"
              )}
            >
              <Flag size={12} />
              {activePriority.label}
            </button>
            {showPriorityMenu && (
              <>
                {/* Click-away backdrop — no fixed inset, just catches clicks outside */}
                <div
                  className="fixed inset-0 z-[60]"
                  onClick={() => setShowPriorityMenu(false)}
                />
                {/* Menu opens UPWARD: bottom-full mb-1 */}
                <div className="absolute bottom-full left-0 mb-1 z-[70] w-36 rounded-lg border border-border bg-popover shadow-xl py-1 animate-fade-in">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => { setPriority(p.value); setShowPriorityMenu(false); }}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent transition-fast",
                        p.color
                      )}
                    >
                      <Flag size={11} />
                      {p.label}
                      {priority === p.value && <span className="ml-auto opacity-70">✓</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Project — also opens upward */}
          {projects.length > 0 && (
            <div className="relative">
              <button
                onClick={() => { setShowProjectMenu((v) => !v); setShowPriorityMenu(false); }}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs",
                  "border border-border hover:bg-accent transition-fast",
                  activeProject ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {activeProject
                  ? <><ProjectDot color={activeProject.color} size={8} />{activeProject.name}</>
                  : <><FolderKanban size={12} />Project</>
                }
              </button>
              {showProjectMenu && (
                <>
                  <div
                    className="fixed inset-0 z-[60]"
                    onClick={() => setShowProjectMenu(false)}
                  />
                  {/* Opens upward */}
                  <div className="absolute bottom-full left-0 mb-1 z-[70] w-48 rounded-lg border border-border bg-popover shadow-xl py-1 animate-fade-in">
                    <button
                      onClick={() => { setProjectId(""); setShowProjectMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent transition-fast"
                    >
                      No project
                      {!projectId && <span className="ml-auto opacity-70">✓</span>}
                    </button>
                    <div className="my-1 border-t border-border/50" />
                    {projects.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => { setProjectId(p.id); setShowProjectMenu(false); }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent transition-fast"
                      >
                        <ProjectDot color={p.color} size={8} />
                        <span className="flex-1 text-left truncate">{p.name}</span>
                        {projectId === p.id && <span className="text-primary opacity-70">✓</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="flex-1" />

          {/* Keyboard hint */}
          <span className="text-[10px] text-muted-foreground/40 hidden sm:flex items-center gap-1">
            <kbd className="kbd">↵</kbd> create
            <span className="mx-0.5">·</span>
            <kbd className="kbd">ESC</kbd> cancel
          </span>

          {/* Submit */}
          <button
            onClick={() => void submit()}
            disabled={!title.trim()}
            className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-fast"
          >
            Add task
          </button>
        </div>
      </div>
    </div>
  );
}
