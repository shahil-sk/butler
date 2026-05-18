// ============================================================
// PROJECTS MODULE — ProjectDetail
// Right-side detail panel. Clean, spacious, readable.
// ============================================================

import { useState, useEffect } from "react";
import {
  X, Plus, Flag, Calendar, Trash2, ExternalLink,
  CheckCircle2, Circle, FileText, ChevronDown,
} from "lucide-react";
import { cn, formatDate, now } from "@/shared/utils";
import { SectionLabel } from "@/shared/ui";
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

// ── Meta row helper ────────────────────────────────────────────

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 px-4 py-2.5">
      <span className="text-[12px] text-muted-foreground w-20 shrink-0 font-medium">{label}</span>
      <div className="flex-1 text-[13px]">{children}</div>
    </div>
  );
}

// ── Task line in project detail ───────────────────────────────

function TaskLine({
  task,
  onOpen,
}: {
  task: import("@/shared/types").Task;
  onOpen: () => void;
}) {
  const { updateTask } = useTaskStore();
  const isDone    = task.status === "done";
  const today     = new Date().toISOString().slice(0, 10);
  const isOverdue = !isDone && task.dueDate != null && task.dueDate < today;

  return (
    <div
      role="button"
      tabIndex={0}
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
          : <Circle size={15} className="text-muted-foreground/50 group-hover:text-muted-foreground transition-fast" />
        }
      </button>

      <span className={cn(
        "flex-1 text-[13px] truncate",
        isDone && "line-through text-muted-foreground/50"
      )}>
        {task.title}
      </span>

      {task.dueDate && (
        <span className={cn(
          "text-[11px] tabular-nums shrink-0",
          isOverdue ? "text-red-500 font-medium" : "text-muted-foreground/60"
        )}>
          {formatDate(task.dueDate)}
        </span>
      )}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────

export function ProjectDetail() {
  const {
    openProjectId, closeProject, getProjectById,
    updateProject, deleteProject,
    addMilestone, completeMilestone, deleteMilestone, updateMilestone,
  } = useProjectStore();

  const { tasks: allTasks, loadTasks, openQuickAdd, openTaskId } = useTaskStore();
  const openTaskInPanel = (id: string) => useTaskStore.setState({ openTaskId: id });
  const allNotes = useNoteStore((s) => s.notes);
  const { openNote } = useNoteStore();

  const project = openProjectId ? getProjectById(openProjectId) : null;
  const tasks   = allTasks.filter((t) => t.projectId === openProjectId && t.status !== "archived");

  const [tab,             setTab]             = useState<"overview" | "tasks" | "milestones">("overview");
  const [name,            setName]            = useState(project?.name ?? "");
  const [description,     setDescription]     = useState(project?.description ?? "");
  const [newMilestone,    setNewMilestone]    = useState("");
  const [milestoneDue,    setMilestoneDue]    = useState("");
  const [showColorPicker, setShowColorPicker] = useState(false);

  useEffect(() => {
    if (project) { setName(project.name); setDescription(project.description ?? ""); }
  }, [project?.id]);

  useEffect(() => {
    if (allTasks.length === 0) void loadTasks();
  }, []);

  if (!project) return null;

  const done     = tasks.filter((t) => t.status === "done").length;
  const total    = tasks.length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;
  const doneMilestones = project.milestones.filter((m) => m.completedAt).length;

  const save = (patch: Parameters<typeof updateProject>[1]) =>
    void updateProject(project.id, patch);

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/25 backdrop-blur-[2px]" onClick={closeProject} />

      {/* Panel */}
      <div className="relative z-10 flex flex-col h-full w-full max-w-[540px] bg-background border-l border-border shadow-2xl animate-slide-in-right overflow-hidden">

        {/* ── Header ────────────────────────────────────── */}
        <div
          className="flex items-center gap-3 px-4 py-3.5 shrink-0 border-b"
          style={{
            borderBottomColor: project.color + "40",
            background: project.color + "08",
          }}
        >
          {/* Color dot / picker */}
          <div className="relative">
            <button
              onClick={() => setShowColorPicker((v) => !v)}
              className="w-5 h-5 rounded-full border-2 shrink-0 transition-transform hover:scale-110 focus:scale-110"
              style={{ backgroundColor: project.color, borderColor: project.color + "60" }}
              title="Change colour"
              aria-label="Change project colour"
            />
            {showColorPicker && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowColorPicker(false)} />
                <div className="absolute top-8 left-0 z-20 p-2.5 rounded-xl border border-border bg-popover shadow-2xl flex flex-wrap gap-2 w-40 animate-fade-in">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => { save({ color: c }); setShowColorPicker(false); }}
                      className={cn(
                        "w-7 h-7 rounded-full transition-fast border-2",
                        project.color === c ? "border-foreground scale-110" : "border-transparent hover:scale-105"
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Editable name */}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => { if (name.trim() && name !== project.name) save({ name: name.trim() }); }}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
            className="flex-1 text-[15px] font-semibold bg-transparent outline-none min-w-0"
            placeholder="Project name"
          />

          {/* Header actions */}
          <button
            onClick={() => { void deleteProject(project.id); closeProject(); }}
            className="p-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/8 transition-fast"
            title="Delete project"
            aria-label="Delete project"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={closeProject}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-fast"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        {/* ── Tabs ────────────────────────────────────────── */}
        <div className="flex border-b border-border shrink-0 px-2 gap-1">
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
                <span className="ml-1.5 text-[11px] text-muted-foreground tabular-nums">{total}</span>
              )}
              {t === "milestones" && project.milestones.length > 0 && (
                <span className="ml-1.5 text-[11px] text-muted-foreground tabular-nums">{project.milestones.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Body ────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* OVERVIEW */}
          {tab === "overview" && (
            <div className="p-5 space-y-6">

              {/* Description */}
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

              {/* Progress */}
              {total > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-medium text-muted-foreground">Progress</span>
                    <span className="text-[13px] font-bold tabular-nums" style={{ color: project.color }}>
                      {progress}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${progress}%`, backgroundColor: project.color }}
                    />
                  </div>
                  <p className="text-[12px] text-muted-foreground">
                    {done} of {total} tasks done
                    {project.milestones.length > 0 && (
                      <> &middot; {doneMilestones}/{project.milestones.length} milestones</>
                    )}
                  </p>
                </div>
              )}

              {/* Meta fields */}
              <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
                <MetaRow label="Status">
                  <select
                    value={project.status}
                    onChange={(e) => save({ status: e.target.value as ProjectStatus })}
                    className="bg-transparent outline-none text-[13px] cursor-pointer"
                  >
                    <option value="active">Active</option>
                    <option value="on_hold">On hold</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </MetaRow>
                <MetaRow label="Start date">
                  <input
                    type="date"
                    value={project.startDate ?? ""}
                    onChange={(e) => save({ startDate: e.target.value || undefined })}
                    className="bg-transparent outline-none text-[13px] cursor-pointer"
                  />
                </MetaRow>
                <MetaRow label="Due date">
                  <input
                    type="date"
                    value={project.dueDate ?? ""}
                    onChange={(e) => save({ dueDate: e.target.value || undefined })}
                    className="bg-transparent outline-none text-[13px] cursor-pointer"
                  />
                </MetaRow>
              </div>

              {/* Linked notes */}
              <div>
                <SectionLabel>Notes</SectionLabel>
                <div className="space-y-1 mt-2">
                  {project.linkedNoteIds.map((noteId) => {
                    const note = allNotes.find((n) => n.id === noteId);
                    if (!note) return null;
                    return (
                      <button
                        key={noteId}
                        onClick={() => { openNote(noteId); bus.emit("navigate:to", { path: "/notes" }); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] hover:bg-accent transition-fast text-left"
                      >
                        <FileText size={13} className="text-muted-foreground/60 shrink-0" />
                        <span className="truncate flex-1">{note.title}</span>
                        <span className="text-[11px] text-muted-foreground/50 tabular-nums shrink-0">
                          {formatDate(note.updatedAt)}
                        </span>
                      </button>
                    );
                  })}
                  <button
                    onClick={() => {
                      void useNoteStore.getState().createNote({
                        title: `${project.name} — Note`,
                        linkedProjectIds: [project.id],
                      }).then((note) => { openNote(note.id); bus.emit("navigate:to", { path: "/notes" }); });
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg border border-dashed border-border transition-fast mt-1"
                  >
                    <Plus size={12} />
                    {project.linkedNoteIds.length === 0 ? "Create a note for this project" : "New note"}
                  </button>
                </div>
              </div>

              {/* Footer */}
              <p className="text-[11px] text-muted-foreground/40">
                Created {formatDate(project.createdAt)} · {project.id.slice(0, 8)}
              </p>
            </div>
          )}

          {/* TASKS */}
          {tab === "tasks" && (
            <div className="flex flex-col h-full">
              {tasks.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 py-20 text-center px-6">
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mb-1">
                    <CheckCircle2 size={18} className="text-muted-foreground/50" />
                  </div>
                  <p className="text-[14px] font-semibold">No tasks yet</p>
                  <p className="text-[12px] text-muted-foreground max-w-[28ch]">
                    Add tasks to track work in this project.
                  </p>
                  <button
                    onClick={() => openQuickAdd({ projectId: project.id })}
                    className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-[13px] hover:bg-accent transition-fast"
                  >
                    <Plus size={13} />
                    Add first task
                  </button>
                </div>
              ) : (
                <div className="p-3 space-y-4">
                  {tasks.filter((t) => t.status !== "done" && t.status !== "cancelled").length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-3 mb-1">Active</p>
                      {tasks
                        .filter((t) => t.status !== "done" && t.status !== "cancelled")
                        .map((task) => (
                          <TaskLine key={task.id} task={task} onOpen={() => openTaskInPanel(task.id)} />
                        ))}
                    </div>
                  )}
                  {tasks.filter((t) => t.status === "done").length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-3 mb-1">Completed</p>
                      {tasks
                        .filter((t) => t.status === "done")
                        .map((task) => (
                          <TaskLine key={task.id} task={task} onOpen={() => openTaskInPanel(task.id)} />
                        ))}
                    </div>
                  )}
                </div>
              )}

              {/* Sticky add task footer */}
              <div className="border-t border-border p-3 shrink-0 mt-auto">
                <button
                  onClick={() => openQuickAdd({ projectId: project.id })}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-[13px] text-muted-foreground hover:text-foreground hover:bg-accent transition-fast"
                >
                  <Plus size={14} />
                  Add task to {project.name}
                </button>
              </div>
            </div>
          )}

          {/* MILESTONES */}
          {tab === "milestones" && (
            <div className="p-5">
              {project.milestones.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mb-1">
                    <Flag size={18} className="text-muted-foreground/50" />
                  </div>
                  <p className="text-[13px] font-medium">No milestones</p>
                  <p className="text-[12px] text-muted-foreground">Add key checkpoints below.</p>
                </div>
              )}

              <div className="space-y-1 mb-5">
                {project.milestones.map((m) => {
                  const today = new Date().toISOString().slice(0, 10);
                  const isOverdue = !m.completedAt && m.dueDate && m.dueDate < today;
                  return (
                    <div key={m.id} className="group flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-accent/50 transition-fast">
                      <button
                        onClick={() =>
                          m.completedAt
                            ? void updateMilestone(project.id, m.id, { completedAt: undefined })
                            : void completeMilestone(project.id, m.id)
                        }
                        className="shrink-0 transition-fast"
                        aria-label={m.completedAt ? "Mark incomplete" : "Mark complete"}
                      >
                        {m.completedAt
                          ? <CheckCircle2 size={16} className="text-emerald-500" />
                          : <Circle size={16} className="text-muted-foreground/50" />
                        }
                      </button>

                      <span className={cn(
                        "flex-1 text-[13px] leading-snug",
                        m.completedAt && "line-through text-muted-foreground/50"
                      )}>
                        {m.title}
                      </span>

                      {m.dueDate && (
                        <span className={cn(
                          "text-[11px] tabular-nums shrink-0",
                          isOverdue ? "text-red-500 font-medium" : "text-muted-foreground/60"
                        )}>
                          {formatDate(m.dueDate)}
                        </span>
                      )}

                      <button
                        onClick={() => void deleteMilestone(project.id, m.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-red-500 transition-fast"
                        aria-label="Delete milestone"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Add milestone form */}
              <div className="rounded-xl border border-border p-4 space-y-3">
                <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide">New milestone</p>
                <input
                  value={newMilestone}
                  onChange={(e) => setNewMilestone(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newMilestone.trim()) {
                      void addMilestone(project.id, newMilestone.trim(), milestoneDue || undefined);
                      setNewMilestone(""); setMilestoneDue("");
                    }
                  }}
                  placeholder="Milestone title…"
                  className="w-full text-[13px] bg-transparent outline-none placeholder:text-muted-foreground/40"
                />
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Calendar size={12} />
                    <input
                      type="date"
                      value={milestoneDue}
                      onChange={(e) => setMilestoneDue(e.target.value)}
                      className="text-[12px] bg-transparent outline-none cursor-pointer"
                    />
                  </div>
                  <div className="flex-1" />
                  <button
                    onClick={() => {
                      if (!newMilestone.trim()) return;
                      void addMilestone(project.id, newMilestone.trim(), milestoneDue || undefined);
                      setNewMilestone(""); setMilestoneDue("");
                    }}
                    disabled={!newMilestone.trim()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[12px] font-medium disabled:opacity-40 transition-fast hover:opacity-90"
                  >
                    <Plus size={12} />
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {openTaskId && <TaskDetail />}
      </div>
    </div>
  );
}
