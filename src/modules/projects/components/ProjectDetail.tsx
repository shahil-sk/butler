import { useState, useEffect, useRef } from "react";
import {
  X, Plus, Flag, Calendar, Trash2,
  CheckCircle2, Circle, ChevronDown, FileText,
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
  "#3b82f6","#8b5cf6","#ec4899","#f97316",
  "#eab308","#22c55e","#14b8a6","#6b7280",
];

export function ProjectDetail() {
  const {
    openProjectId, closeProject, getProjectById,
    updateProject, deleteProject,
    addMilestone, completeMilestone, deleteMilestone, updateMilestone,
  } = useProjectStore();

  // Always call hooks at top level
  const { tasks: allTasks, loadTasks, openQuickAdd, openTaskId } = useTaskStore();
  const openTaskInPanel = (id: string) => useTaskStore.setState({ openTaskId: id });

  const allNotes = useNoteStore((s) => s.notes);
  const { openNote } = useNoteStore();

  const project = openProjectId ? getProjectById(openProjectId) : null;
  const tasks = allTasks.filter((t) => t.projectId === openProjectId && t.status !== "archived");

  const [tab,          setTab]          = useState<"overview" | "tasks" | "milestones">("overview");
  const [name,         setName]         = useState(project?.name ?? "");
  const [description,  setDescription]  = useState(project?.description ?? "");
  const [newMilestone, setNewMilestone] = useState("");
  const [milestoneDue, setMilestoneDue] = useState("");
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Sync local state when project changes
  useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description ?? "");
    }
  }, [project?.id]);

  // Load tasks if Tasks module hasn't been visited
  useEffect(() => {
    if (allTasks.length === 0) void loadTasks();
  }, []);

  if (!project) return null;

  const doneTasks   = tasks.filter((t) => t.status === "done").length;
  const totalTasks  = tasks.length;
  const progress    = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const doneMilestones = project.milestones.filter((m) => m.completedAt).length;

  const save = (patch: Parameters<typeof updateProject>[1]) =>
    void updateProject(project.id, patch);

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={closeProject} />

      <div className="relative z-10 flex flex-col h-full w-full max-w-[520px] bg-background border-l border-border shadow-2xl animate-slide-in-right overflow-hidden">

        {/* Header — colored accent */}
        <div
          className="flex items-center gap-3 px-4 h-12 shrink-0"
          style={{ borderBottom: `2px solid ${project.color}30`, background: `${project.color}0a` }}
        >
          {/* Color swatch / picker trigger */}
          <div className="relative">
            <button
              onClick={() => setShowColorPicker((v) => !v)}
              className="w-4 h-4 rounded-full border-2 border-white/20 shrink-0 transition-transform hover:scale-110"
              style={{ backgroundColor: project.color }}
              title="Change color"
            />
            {showColorPicker && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowColorPicker(false)} />
                <div className="absolute top-7 left-0 z-20 p-2 rounded-lg border border-border bg-popover shadow-xl flex flex-wrap gap-1.5 w-36 animate-fade-in">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => { save({ color: c }); setShowColorPicker(false); }}
                      className={cn(
                        "w-6 h-6 rounded-full transition-fast border-2",
                        project.color === c ? "border-foreground scale-110" : "border-transparent"
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
            className="flex-1 text-sm font-semibold bg-transparent outline-none"
            placeholder="Project name"
          />

          <button
            onClick={() => { void deleteProject(project.id); closeProject(); }}
            className="p-1.5 rounded text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-fast"
            title="Delete project"
          >
            <Trash2 size={13} />
          </button>

          <button
            onClick={closeProject}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-fast"
          >
            <X size={14} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border shrink-0 px-1">
          {(["overview", "tasks", "milestones"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-3 py-2.5 text-xs capitalize transition-fast border-b-2 -mb-px",
                tab === t
                  ? "border-primary text-primary font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t}
              {t === "tasks" && totalTasks > 0 && (
                <span className="ml-1.5 text-muted-foreground tabular-nums">{totalTasks}</span>
              )}
              {t === "milestones" && project.milestones.length > 0 && (
                <span className="ml-1.5 text-muted-foreground tabular-nums">{project.milestones.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── OVERVIEW ─────────────────────────────────── */}
          {tab === "overview" && (
            <div className="p-4 space-y-5">

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
                className="w-full text-sm text-muted-foreground bg-transparent outline-none resize-none leading-relaxed"
              />

              {/* Progress */}
              {totalTasks > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">Progress</span>
                    <span className="text-xs font-semibold tabular-nums">{progress}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${progress}%`, backgroundColor: project.color }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {doneTasks} of {totalTasks} tasks done
                    {project.milestones.length > 0 && (
                      <> · {doneMilestones}/{project.milestones.length} milestones</>
                    )}
                  </p>
                </div>
              )}

              {/* Meta fields */}
              <div className="space-y-0.5 border border-border rounded-lg overflow-hidden divide-y divide-border">
                <MetaRow label="Status">
                  <select
                    value={project.status}
                    onChange={(e) => save({ status: e.target.value as ProjectStatus })}
                    className="text-sm bg-transparent outline-none text-foreground"
                  >
                    <option value="active">Active</option>
                    <option value="on_hold">On hold</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </MetaRow>

                <MetaRow label="Due date">
                  <input
                    type="date"
                    value={project.dueDate ?? ""}
                    onChange={(e) => save({ dueDate: e.target.value || undefined })}
                    className="text-sm bg-transparent outline-none text-foreground"
                  />
                </MetaRow>

                <MetaRow label="Start date">
                  <input
                    type="date"
                    value={project.startDate ?? ""}
                    onChange={(e) => save({ startDate: e.target.value || undefined })}
                    className="text-sm bg-transparent outline-none text-foreground"
                  />
                </MetaRow>
              </div>

              {/* Footer info */}
              <p className="text-xs text-muted-foreground/40">
                Created {formatDate(project.createdAt)} · ID: {project.id.slice(0, 8)}
              </p>

              {/* Linked notes */}
              {project.linkedNoteIds.length > 0 && (
                <div>
                  <SectionLabel>Linked Notes</SectionLabel>
                  <div className="space-y-1 mt-1">
                    {project.linkedNoteIds.map((noteId) => {
                      const note = allNotes.find((n) => n.id === noteId);
                      if (!note) return null;
                      return (
                        <button
                          key={noteId}
                          onClick={() => {
                            openNote(noteId);
                            bus.emit("navigate:to", { path: "/notes" });
                          }}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs hover:bg-accent transition-fast text-left"
                        >
                          <FileText size={11} className="text-muted-foreground/50 shrink-0" />
                          <span className="truncate flex-1">{note.title}</span>
                          <span className="text-muted-foreground/40 text-[10px] tabular-nums shrink-0">
                            {formatDate(note.updatedAt)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => {
                      void useNoteStore.getState().createNote({
                        title: `${project.name} — Note`,
                        linkedProjectIds: [project.id],
                      }).then((note) => {
                        openNote(note.id);
                        bus.emit("navigate:to", { path: "/notes" });
                      });
                    }}
                    className="mt-1 w-full flex items-center gap-1.5 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-fast"
                  >
                    <Plus size={11} />
                    New note for this project
                  </button>
                </div>
              )}

              {project.linkedNoteIds.length === 0 && (
                <button
                  onClick={() => {
                    void useNoteStore.getState().createNote({
                      title: `${project.name} — Note`,
                      linkedProjectIds: [project.id],
                    }).then((note) => {
                      openNote(note.id);
                      bus.emit("navigate:to", { path: "/notes" });
                    });
                  }}
                  className="w-full flex items-center gap-1.5 px-2 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg border border-dashed border-border transition-fast"
                >
                  <FileText size={11} />
                  Create a note for this project
                </button>
              )}
            </div>
          )}

          {/* ── TASKS ────────────────────────────────────── */}
          {tab === "tasks" && (
            <div className="flex flex-col h-full">
              {tasks.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 py-16 text-center">
                  <p className="text-sm font-medium text-foreground">No tasks yet</p>
                  <p className="text-xs text-muted-foreground">Add tasks to track work in this project.</p>
                  <button
                    onClick={() => openQuickAdd({ projectId: project.id })}
                    className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs hover:bg-accent transition-fast"
                  >
                    <Plus size={12} />
                    Add first task
                  </button>
                </div>
              ) : (
                <div className="p-2 space-y-0.5">
                  {/* Group: active */}
                  {tasks.filter((t) => t.status !== "done" && t.status !== "cancelled").length > 0 && (
                    <>
                      <SectionLabel>Active</SectionLabel>
                      {tasks
                        .filter((t) => t.status !== "done" && t.status !== "cancelled")
                        .map((task) => (
                          <TaskLine key={task.id} task={task} onOpen={() => openTaskInPanel(task.id)} />
                        ))}
                    </>
                  )}

                  {/* Group: done */}
                  {tasks.filter((t) => t.status === "done").length > 0 && (
                    <>
                      <SectionLabel>Completed</SectionLabel>
                      {tasks
                        .filter((t) => t.status === "done")
                        .map((task) => (
                          <TaskLine key={task.id} task={task} onOpen={() => openTaskInPanel(task.id)} />
                        ))}
                    </>
                  )}
                </div>
              )}

              {/* Sticky add task */}
              <div className="border-t border-border p-2 shrink-0">
                <button
                  onClick={() => openQuickAdd({ projectId: project.id })}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-fast"
                >
                  <Plus size={12} />
                  Add task to {project.name}
                </button>
              </div>
            </div>
          )}

          {/* ── MILESTONES ───────────────────────────────── */}
          {tab === "milestones" && (
            <div className="p-4">
              {project.milestones.length === 0 && (
                <p className="text-xs text-muted-foreground mb-4 text-center py-6">
                  No milestones yet. Add key checkpoints below.
                </p>
              )}

              <div className="space-y-1.5 mb-4">
                {project.milestones.map((m) => {
                  const isOverdue = !m.completedAt && m.dueDate && m.dueDate < new Date().toISOString().slice(0, 10);
                  return (
                    <div key={m.id} className="flex items-center gap-2.5 group py-1">
                      <button
                        onClick={() =>
                          m.completedAt
                            ? void updateMilestone(project.id, m.id, { completedAt: undefined })
                            : void completeMilestone(project.id, m.id)
                        }
                        className="shrink-0 text-muted-foreground hover:text-primary transition-fast"
                      >
                        {m.completedAt
                          ? <CheckCircle2 size={15} className="text-green-500" />
                          : <Circle size={15} />
                        }
                      </button>

                      <span className={cn(
                        "flex-1 text-sm",
                        m.completedAt && "line-through text-muted-foreground/50"
                      )}>
                        {m.title}
                      </span>

                      {m.dueDate && (
                        <span className={cn(
                          "text-xs tabular-nums shrink-0",
                          isOverdue ? "text-red-500" : "text-muted-foreground/60"
                        )}>
                          {formatDate(m.dueDate)}
                        </span>
                      )}

                      <button
                        onClick={() => void deleteMilestone(project.id, m.id)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground hover:text-red-500 transition-fast"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Add milestone */}
              <div className="border border-border rounded-lg p-3 space-y-2">
                <input
                  value={newMilestone}
                  onChange={(e) => setNewMilestone(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newMilestone.trim()) {
                      void addMilestone(project.id, newMilestone.trim(), milestoneDue || undefined);
                      setNewMilestone("");
                      setMilestoneDue("");
                    }
                  }}
                  placeholder="Milestone title…"
                  className="w-full text-sm bg-transparent outline-none"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={milestoneDue}
                    onChange={(e) => setMilestoneDue(e.target.value)}
                    className="text-xs bg-transparent outline-none text-muted-foreground"
                  />
                  <div className="flex-1" />
                  <button
                    onClick={() => {
                      if (!newMilestone.trim()) return;
                      void addMilestone(project.id, newMilestone.trim(), milestoneDue || undefined);
                      setNewMilestone("");
                      setMilestoneDue("");
                    }}
                    disabled={!newMilestone.trim()}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary text-primary-foreground text-xs disabled:opacity-40 transition-fast"
                  >
                    <Plus size={11} />
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

// ── Sub-components ────────────────────────────────────────────

// Replace the entire TaskLine component:

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
  const isOverdue = !isDone && task.dueDate && task.dueDate < today;

  const toggleDone = (e: React.MouseEvent) => {
    e.stopPropagation();
    void updateTask(task.id, { status: isDone ? "todo" : "done" });
  };

  return (
    <div
    role="button"
    tabIndex={0}
    onClick={onOpen}
    onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }}
    className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-accent cursor-pointer transition-fast group"
    >
    {/* ← clickable zone, stops propagation */}
    <button
    onClick={toggleDone}
    className="shrink-0 text-muted-foreground hover:text-green-500 transition-fast"
    aria-label={isDone ? "Mark incomplete" : "Mark complete"}
    >
    {isDone
      ? <CheckCircle2 size={14} className="text-green-500" />
      : <Circle size={14} className="text-muted-foreground/50" />
    }
    </button>

    <span className={cn("flex-1 text-sm truncate", isDone && "line-through text-muted-foreground/50")}>
    {task.title}
    </span>
    {task.dueDate && (
      <span className={cn(
        "text-xs tabular-nums shrink-0",
        isOverdue ? "text-red-500" : "text-muted-foreground/50"
      )}>
      {formatDate(task.dueDate)}
      </span>
    )}
    </div>
  );
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <span className="text-xs text-muted-foreground w-20 shrink-0">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}
