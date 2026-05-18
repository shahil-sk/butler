// ============================================================
// TASKS MODULE — QuickAdd  (clean modal redesign)
// ============================================================

import { useRef, useEffect, useState, type KeyboardEvent } from "react";
import { X, Calendar, Flag, FolderKanban, AlignLeft } from "lucide-react";
import { cn } from "@/shared/utils";
import { ProjectDot } from "@/shared/ui";
import { useTaskStore } from "../store";
import { useProjectStore } from "@/modules/projects/store";
import type { Priority } from "@/shared/types";
import { createPortal } from "react-dom";

const PRIORITIES: { value: Priority; label: string; dot: string; text: string }[] = [
  { value: "urgent", label: "Urgent", dot: "bg-red-500",    text: "text-red-500" },
  { value: "high",   label: "High",   dot: "bg-orange-400", text: "text-orange-500" },
  { value: "medium", label: "Medium", dot: "bg-yellow-400", text: "text-yellow-500" },
  { value: "low",    label: "Low",    dot: "bg-blue-400",   text: "text-blue-400" },
  { value: "none",   label: "None",   dot: "bg-muted-foreground", text: "text-muted-foreground" },
];

export function QuickAdd() {
  const { quickAddOpen, quickAddPrefill, closeQuickAdd, createTask } = useTaskStore();

  // Always subscribe to full projects array — do NOT filter before load
  const { projects: allProjects, loadProjects } = useProjectStore(
    (s) => ({ projects: s.projects, loadProjects: s.loadProjects })
  );

  // Ensure projects are loaded whenever QuickAdd mounts (handles cross-module race)
  useEffect(() => {
    if (allProjects.length === 0) {
      void loadProjects();
    }
  }, []);

  // Filter to active projects only after load
  const projects = allProjects.filter((p) => p.status === "active");

  const titleRef = useRef<HTMLInputElement>(null);
  const descRef  = useRef<HTMLTextAreaElement>(null);
  const priorityAnchor = useRef<HTMLButtonElement>(null);
  const projectAnchor  = useRef<HTMLButtonElement>(null);

  const [title,    setTitle]    = useState("");
  const [desc,     setDesc]     = useState("");
  const [dueDate,  setDueDate]  = useState("");
  const [priority, setPriority] = useState<Priority>("none");
  const [projectId, setProjectId] = useState("");
  const [showPriority, setShowPriority] = useState(false);
  const [showProject,  setShowProject]  = useState(false);
  const [priorityPos,  setPriorityPos]  = useState<React.CSSProperties>({});
  const [projectPos,   setProjectPos]   = useState<React.CSSProperties>({});

  useEffect(() => {
    if (quickAddOpen) {
      setTitle(quickAddPrefill.title ?? "");
      setDesc("");
      setDueDate(quickAddPrefill.dueDate ?? "");
      setPriority((quickAddPrefill.priority as Priority) ?? "none");
      setProjectId(quickAddPrefill.projectId ?? "");
      setShowPriority(false);
      setShowProject(false);
      setTimeout(() => titleRef.current?.focus(), 40);
    }
  }, [quickAddOpen, quickAddPrefill]);

  // Lock body scroll
  useEffect(() => {
    if (!quickAddOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [quickAddOpen]);

  // ESC closes
  useEffect(() => {
    if (!quickAddOpen) return;
    const handler = (e: KeyboardEvent) => { if ((e as unknown as globalThis.KeyboardEvent).key === "Escape") closeQuickAdd(); };
    document.addEventListener("keydown", handler as EventListener);
    return () => document.removeEventListener("keydown", handler as EventListener);
  }, [quickAddOpen, closeQuickAdd]);

  if (!quickAddOpen) return null;

  const submit = async () => {
    if (!title.trim()) { titleRef.current?.focus(); return; }
    await createTask({
      ...quickAddPrefill,
      title:       title.trim(),
      description: desc.trim() || undefined,
      dueDate:     dueDate || undefined,
      priority,
      projectId:   projectId || undefined,
    });
    closeQuickAdd();
  };

  const onTitleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submit(); }
  };

  const openPriority = () => {
    if (!priorityAnchor.current) return;
    const r = priorityAnchor.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    setShowProject(false);
    if (spaceBelow < 200) {
      setPriorityPos({ bottom: window.innerHeight - r.top + 6, left: r.left });
    } else {
      setPriorityPos({ top: r.bottom + 6, left: r.left });
    }
    setShowPriority((v) => !v);
  };

  const openProject = () => {
    if (!projectAnchor.current) return;
    const r = projectAnchor.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    setShowPriority(false);
    if (spaceBelow < 220) {
      setProjectPos({ bottom: window.innerHeight - r.top + 6, left: r.left });
    } else {
      setProjectPos({ top: r.bottom + 6, left: r.left });
    }
    setShowProject((v) => !v);
  };

  const activePriority = PRIORITIES.find((p) => p.value === priority)!;
  const activeProject  = projects.find((p) => p.id === projectId);

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[3px] animate-fade-in"
        onClick={closeQuickAdd}
      />

      {/* Modal */}
      <div className={cn(
        "relative z-10 w-full max-w-[480px]",
        "bg-background border border-border rounded-2xl shadow-2xl",
        "animate-modal-in flex flex-col overflow-hidden"
      )}>

        {/* ─ Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <h2 className="text-[14px] font-semibold tracking-tight">New Task</h2>
          <button
            onClick={closeQuickAdd}
            className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-muted/60 transition-fast"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        {/* ─ Body */}
        <div className="px-5 pb-4 flex flex-col gap-3">

          {/* Title input */}
          <input
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={onTitleKeyDown}
            placeholder="Task title"
            className={cn(
              "w-full text-[15px] font-[450] bg-transparent outline-none",
              "placeholder:text-muted-foreground/30",
              "border-b border-border/60 pb-2.5 focus:border-primary/50 transition-colors duration-150"
            )}
          />

          {/* Description — optional, grows with content */}
          <div className="flex gap-2.5 items-start">
            <AlignLeft size={13} className="mt-[3px] text-muted-foreground/30 shrink-0" />
            <textarea
              ref={descRef}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Add description…"
              rows={2}
              className={cn(
                "flex-1 text-[13px] text-muted-foreground bg-transparent outline-none resize-none",
                "placeholder:text-muted-foreground/30 leading-relaxed"
              )}
            />
          </div>

          {/* Divider */}
          <div className="h-px bg-border/50" />

          {/* Attribute chips row */}
          <div className="flex flex-wrap items-center gap-2">

            {/* Due date */}
            <label className={cn(
              "relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] cursor-pointer",
              "border transition-fast select-none font-medium",
              dueDate
                ? "text-primary border-primary/30 bg-primary/6"
                : "text-muted-foreground/55 border-border/60 hover:border-border hover:text-foreground hover:bg-muted/40"
            )}>
              <Calendar size={12} strokeWidth={1.75} />
              <span>{dueDate || "Due date"}</span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full"
              />
            </label>

            {/* Priority */}
            <button
              ref={priorityAnchor}
              onClick={openPriority}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] border transition-fast font-medium",
                priority !== "none"
                  ? cn(activePriority.text, "border-current/25 bg-current/5")
                  : "text-muted-foreground/55 border-border/60 hover:border-border hover:text-foreground hover:bg-muted/40"
              )}
            >
              <Flag size={12} strokeWidth={1.75} />
              {activePriority.label}
            </button>

            {/* Project — always render, shows loading state while store hydrates */}
            <button
              ref={projectAnchor}
              onClick={openProject}
              disabled={allProjects.length === 0}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] border transition-fast font-medium",
                activeProject
                  ? "text-foreground border-border/80 hover:bg-muted/40"
                  : "text-muted-foreground/55 border-border/60 hover:border-border hover:text-foreground hover:bg-muted/40",
                allProjects.length === 0 && "opacity-40 cursor-not-allowed"
              )}
            >
              {activeProject
                ? <><ProjectDot color={activeProject.color} size={7} />{activeProject.name}</>
                : <><FolderKanban size={12} strokeWidth={1.75} />Project</>}
            </button>
          </div>
        </div>

        {/* ─ Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-border/50 bg-muted/20">
          <span className="text-[11px] text-muted-foreground/30 hidden sm:flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">Enter</kbd>
            to save
            <span className="mx-0.5">·</span>
            <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">Esc</kbd>
            to cancel
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={closeQuickAdd}
              className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-fast"
            >
              Cancel
            </button>
            <button
              onClick={() => void submit()}
              disabled={!title.trim()}
              className={cn(
                "px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-fast",
                "bg-primary text-primary-foreground hover:bg-primary/90",
                "disabled:opacity-40 disabled:cursor-not-allowed"
              )}
            >
              Add Task
            </button>
          </div>
        </div>
      </div>

      {/* ── Priority popover ────────────────────────────────── */}
      {showPriority && createPortal(
        <div
          className="fixed z-[300] min-w-[140px] bg-popover border border-border rounded-xl shadow-xl py-1 animate-fade-in"
          style={priorityPos}
        >
          {PRIORITIES.map((p) => (
            <button
              key={p.value}
              onClick={() => { setPriority(p.value); setShowPriority(false); }}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 text-[12px] font-medium hover:bg-muted/60 transition-fast text-left",
                priority === p.value && "bg-muted/40"
              )}
            >
              <span className={cn("w-2 h-2 rounded-full shrink-0", p.dot)} />
              {p.label}
            </button>
          ))}
        </div>,
        document.body
      )}

      {/* ── Project popover ─────────────────────────────────── */}
      {showProject && createPortal(
        <div
          className="fixed z-[300] min-w-[180px] max-h-[240px] overflow-y-auto bg-popover border border-border rounded-xl shadow-xl py-1 animate-fade-in"
          style={projectPos}
        >
          {/* Clear selection */}
          <button
            onClick={() => { setProjectId(""); setShowProject(false); }}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 text-[12px] font-medium hover:bg-muted/60 transition-fast text-left",
              !projectId && "bg-muted/40"
            )}
          >
            <FolderKanban size={12} className="text-muted-foreground" />
            No project
          </button>
          <div className="h-px bg-border/50 mx-2 my-1" />
          {projects.length === 0 ? (
            <p className="px-3 py-2 text-[11px] text-muted-foreground/50">No active projects</p>
          ) : (
            projects.map((p) => (
              <button
                key={p.id}
                onClick={() => { setProjectId(p.id); setShowProject(false); }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 text-[12px] font-medium hover:bg-muted/60 transition-fast text-left",
                  projectId === p.id && "bg-muted/40"
                )}
              >
                <ProjectDot color={p.color} size={7} />
                {p.name}
              </button>
            ))
          )}
        </div>,
        document.body
      )}
    </div>,
    document.body
  );
}
