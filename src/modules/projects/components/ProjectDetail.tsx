// ============================================================
// PROJECTS MODULE — ProjectDetail
// Centered modal popup (replaces right-side slide panel).
// ============================================================

import { useState, useEffect, useRef } from "react";
import {
  X, Plus, Trash2,
  CheckCircle2, Circle, FileText, ChevronDown,
} from "lucide-react";
import { cn, formatDate } from "@/shared/utils";
import { Modal, Popover, PopoverItem, PopoverDivider, ProjectDot } from "@/shared/ui";
import { useProjectStore } from "../store";
import { useTaskStore } from "@/modules/tasks/store";
import { useNoteStore } from "@/modules/notes/store";
import { bus } from "@/kernel/event-bus";
import type { ProjectStatus } from "@/shared/types";
import { TaskDetail } from "@/modules/tasks/components/TaskDetail";

const PRESET_COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#6b7280",
];

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "active",    label: "Active" },
  { value: "on_hold",   label: "On hold" },
  { value: "completed", label: "Completed" },
  { value: "archived",  label: "Archived" },
];

// ── Meta row ──────────────────────────────────────────────────

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 px-5 py-2.5">
      <span className="text-[12px] text-muted-foreground w-20 shrink-0 font-medium">{label}</span>
      <div className="flex-1 text-[13px]">{children}</div>
    </div>
  );
}

// ── Task line ─────────────────────────────────────────────────

function TaskLine({
  task,
  onOpen,
}: {
  task: import("@/shared/types").Task;
  onOpen: () => void;
}) {
  const { updateTask } = useTaskStore();
  const isDone    = task.status === "done";
  const isOverdue = !isDone && task.dueDate != null &&
    task.dueDate < new Date().toISOString().slice(0, 10);

  return (
    <div
      role="button" tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }}
      className="group flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent cursor-pointer transition-fast"
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          void updateTask(task.id, { status: isDone ? "todo" : "done" });
        }}
        className="shrink-0 transition-fast"
        aria-label={isDone ? "Mark incomplete" : "Mark complete"}
      >
        {isDone
          ? <CheckCircle2 size={15} className="text-emerald-500" />
          : <Circle size={15} className="text-muted-foreground/50 group-hover:text-muted-foreground" />}
      </button>
      <span className={cn("flex-1 text-[13px] truncate", isDone && "line-through text-muted-foreground/50")}>
        {task.title}
      </span>
      {task.dueDate && (
        <span className={cn(
          "text-[11px] tabular-nums shrink-0",
          isOverdue ? "text-red-500 font-medium" : "text-muted-foreground/50"
        )}>
          {formatDate(task.dueDate)}
        </span>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

export function ProjectDetail() {
  const {
    openProjectId, closeProject, getProjectById,
    updateProject, deleteProject,
    addMilestone, completeMilestone, deleteMilestone, updateMilestone,
  } = useProjectStore();

  const { tasks: allTasks, loadTasks, openQuickAdd } = useTaskStore();
  const openTaskInPanel = (id: string) => useTaskStore.setState({ openTaskId: id });
  const allNotes = useNoteStore((s) => s.notes);

  const project = openProjectId ? getProjectById(openProjectId) : null;
  const tasks   = allTasks.filter((t) => t.projectId === openProjectId && t.status !== "archived");

  const [tab,             setTab]             = useState<"overview" | "tasks" | "milestones">("overview");
  const [name,            setName]            = useState(project?.name ?? "");
  const [description,     setDescription]     = useState(project?.description ?? "");
  const [newMilestone,    setNewMilestone]     = useState("");
  const [milestoneDue,    setMilestoneDue]     = useState("");
  const [colorPickerOpen, setColorPickerOpen]  = useState(false);
  const [statusOpen,      setStatusOpen]       = useState(false);
  const colorAnchor  = useRef<HTMLButtonElement>(null);
  const statusAnchor = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (project) { setName(project.name); setDescription(project.description ?? ""); }
  }, [project?.id]);

  useEffect(() => {
    if (allTasks.length === 0) void loadTasks();
  }, []);

  const isOpen = openProjectId != null && project != null;
  if (!project) return null;

  const done     = tasks.filter((t) => t.status === "done").length;
  const total    = tasks.length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;
  const doneMilestones = project.milestones.filter((m) => m.completedAt).length;

  const save = (patch: Parameters<typeof updateProject>[1]) =>
    void updateProject(project.id, patch);

  return (
    <>
      <Modal open={isOpen} onClose={closeProject} maxWidth="max-w-[640px]" maxHeight="max-h-[90dvh]">

        {/* ── Header ──────────────────────────────────────── */}
        <div
          className="flex items-center gap-3 px-5 py-4 shrink-0 border-b"
          style={{
            borderBottomColor: project.color + "40",
            background:        project.color + "08",
          }}
        >
          {/* Color picker button */}
          <button
            ref={colorAnchor}
            onClick={() => setColorPickerOpen((v) => !v)}
            className="w-5 h-5 rounded-full border-2 shrink-0 transition-transform hover:scale-110"
            style={{ backgroundColor: project.color, borderColor: project.color + "70" }}
            title="Change colour"
          />

          {/* Editable name */}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => { if (name.trim() && name !== project.name) save({ name: name.trim() }); }}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
            className="flex-1 text-[15px] font-semibold bg-transparent outline-none min-w-0"
            placeholder="Project name"
          />

          {/* Status badge */}
          <button
            ref={statusAnchor}
            onClick={() => setStatusOpen((v) => !v)}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-fast",
              project.status === "active"    && "bg-green-500/10 text-green-600 dark:text-green-400",
              project.status === "on_hold"   && "bg-amber-500/10 text-amber-600",
              project.status === "completed" && "bg-blue-500/10 text-blue-600",
              project.status === "archived"  && "bg-muted text-muted-foreground",
            )}
          >
            <ChevronDown size={10} className="opacity-60" />
            {STATUS_OPTIONS.find((s) => s.value === project.status)?.label ?? project.status}
          </button>

          <button
            onClick={() => { void deleteProject(project.id); closeProject(); }}
            className="p-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/8 transition-fast"
            title="Delete project"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={closeProject}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-fast"
          >
            <X size={15} />
          </button>
        </div>

        {/* ── Tabs ───────────────────────────────────────── */}
        <div className="flex border-b border-border shrink-0 px-3 gap-0.5">
          {(["overview", "tasks", "milestones"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-3 py-3 text-[13px] capitalize font-medium transition-fast border-b-2 -mb-px",
                tab === t
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t}
              {t === "tasks" && total > 0 && (
                <span className="ml-1.5 text-[11px] text-muted-foreground/50 tabular-nums">{total}</span>
              )}
              {t === "milestones" && project.milestones.length > 0 && (
                <span className="ml-1.5 text-[11px] text-muted-foreground/50 tabular-nums">
                  {project.milestones.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Body ───────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* OVERVIEW */}
          {tab === "overview" && (
            <div className="p-5 space-y-5">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => {
                  if (description !== (project.description ?? ""))
                    save({ description: description || undefined });
                }}
                placeholder="Add a description…"
                rows={3}
                className="w-full text-[13px] text-muted-foreground bg-transparent outline-none resize-none leading-relaxed placeholder:text-muted-foreground/40"
              />

              {total > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="tabular-nums font-medium">{progress}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-border overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${progress}%`, backgroundColor: project.color }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground/50">
                    {done} of {total} tasks done
                  </p>
                </div>
              )}

              <div className="border-t border-border/50 pt-4 divide-y divide-border/40">
                <MetaRow label="Status">
                  <button
                    ref={statusAnchor}
                    onClick={() => setStatusOpen((v) => !v)}
                    className="text-sm text-muted-foreground hover:text-foreground transition-fast flex items-center gap-1"
                  >
                    {STATUS_OPTIONS.find((s) => s.value === project.status)?.label}
                    <ChevronDown size={11} className="opacity-40" />
                  </button>
                </MetaRow>
                {project.dueDate && (
                  <MetaRow label="Due">
                    <span className="text-sm">{formatDate(project.dueDate)}</span>
                  </MetaRow>
                )}
              </div>

              {/* Linked notes */}
              {allNotes.filter((n) => n.linkedProjectIds?.includes(project.id)).length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-2">
                    Notes
                  </p>
                  {allNotes
                    .filter((n) => n.linkedProjectIds?.includes(project.id))
                    .map((n) => (
                      <button
                        key={n.id}
                        onClick={() => useNoteStore.getState().openNote(n.id)}
                        className="flex items-center gap-2 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-fast w-full"
                      >
                        <FileText size={13} className="shrink-0" />
                        <span className="flex-1 truncate text-left">{n.title || "Untitled"}</span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* TASKS */}
          {tab === "tasks" && (
            <div className="p-3">
              {tasks.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-center">
                  <p className="text-sm text-muted-foreground/50 mb-3">No tasks yet</p>
                  <button
                    onClick={() => openQuickAdd({ projectId: project.id })}
                    className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-fast"
                  >
                    <Plus size={12} /> Add first task
                  </button>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {tasks.map((t) => (
                    <TaskLine key={t.id} task={t} onOpen={() => openTaskInPanel(t.id)} />
                  ))}
                </div>
              )}
              <button
                onClick={() => openQuickAdd({ projectId: project.id })}
                className="flex items-center gap-2 w-full mt-2 px-3 py-2 rounded-lg text-xs text-muted-foreground/40 hover:text-primary hover:bg-primary/5 border border-transparent hover:border-primary/15 transition-fast"
              >
                <Plus size={12} /> Add task
              </button>
            </div>
          )}

          {/* MILESTONES */}
          {tab === "milestones" && (
            <div className="p-5">
              {project.milestones.length === 0 ? (
                <p className="text-sm text-muted-foreground/50 text-center py-8">No milestones yet</p>
              ) : (
                <div className="space-y-2 mb-4">
                  {project.milestones.map((m) => (
                    <div
                      key={m.id}
                      className="group flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent transition-fast"
                    >
                      <button
                        onClick={() => void completeMilestone(project.id, m.id)}
                        className={cn(
                          "shrink-0 transition-fast",
                          m.completedAt ? "text-emerald-500" : "text-muted-foreground/30 hover:text-primary"
                        )}
                      >
                        {m.completedAt
                          ? <CheckCircle2 size={15} />
                          : <Circle size={15} />}
                      </button>
                      <span className={cn(
                        "flex-1 text-[13px]",
                        m.completedAt && "line-through text-muted-foreground/40"
                      )}>
                        {m.title}
                      </span>
                      {m.dueDate && (
                        <span className="text-[11px] text-muted-foreground/50 tabular-nums shrink-0">
                          {formatDate(m.dueDate)}
                        </span>
                      )}
                      <button
                        onClick={() => void deleteMilestone(project.id, m.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground/40 hover:text-red-500 transition-fast"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2 mt-2">
                <input
                  value={newMilestone}
                  onChange={(e) => setNewMilestone(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newMilestone.trim()) {
                      void addMilestone(project.id, { title: newMilestone.trim(), dueDate: milestoneDue || undefined });
                      setNewMilestone("");
                      setMilestoneDue("");
                    }
                  }}
                  placeholder="New milestone…"
                  className="flex-1 text-sm bg-muted/40 rounded-lg px-3 py-2 outline-none border border-border focus:border-primary/50"
                />
                <input
                  type="date"
                  value={milestoneDue}
                  onChange={(e) => setMilestoneDue(e.target.value)}
                  className="text-sm bg-muted/40 rounded-lg px-3 py-2 outline-none border border-border focus:border-primary/50"
                />
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Color picker popover */}
      <Popover anchor={colorAnchor} open={colorPickerOpen} onClose={() => setColorPickerOpen(false)} className="w-44">
        <div className="p-2.5 flex flex-wrap gap-2">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => { save({ color: c }); setColorPickerOpen(false); }}
              className={cn(
                "w-7 h-7 rounded-full border-2 transition-fast hover:scale-105",
                project.color === c ? "border-foreground scale-110" : "border-transparent"
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </Popover>

      {/* Status popover */}
      <Popover anchor={statusAnchor} open={statusOpen} onClose={() => setStatusOpen(false)} className="w-40">
        {STATUS_OPTIONS.map((s) => (
          <PopoverItem
            key={s.value}
            active={project.status === s.value}
            onClick={() => { save({ status: s.value }); setStatusOpen(false); }}
          >
            {s.label}
          </PopoverItem>
        ))}
      </Popover>

      {/* Task detail stacks on top */}
      <TaskDetail />
    </>
  );
}
