import { useState, useEffect, useRef } from "react";
import {
  X, Plus, Trash2,
  CheckCircle2, Circle, Copy, Tag,
} from "lucide-react";
import { cn, formatDate, now } from "@/shared/utils";
import { SectionLabel } from "@/shared/ui";
import { useProjectStore } from "../store";
import { useTaskStore } from "@/modules/tasks/store";
import { bus } from "@/kernel/event-bus";
import type { ProjectStatus } from "@/shared/types";

const PRESET_COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#6b7280",
];

const MAX_TAGS    = 8;
const MAX_TAG_LEN = 24;

export function ProjectDetail() {
  const {
    openProjectId, closeProject, getProjectById,
    updateProject, deleteProject, duplicateProject,
    addMilestone, completeMilestone, deleteMilestone, updateMilestone,
  } = useProjectStore();

  const { tasks: allTasks, loadTasks, openTask, openQuickAdd } = useTaskStore();

  const project = openProjectId ? getProjectById(openProjectId) : null;
  const tasks   = allTasks.filter(
    (t) => t.projectId === openProjectId && t.status !== "archived"
  );

  const [tab,             setTab]             = useState<"overview" | "tasks" | "milestones">("overview");
  const [name,            setName]            = useState(project?.name ?? "");
  const [description,     setDescription]     = useState(project?.description ?? "");
  const [newMilestone,    setNewMilestone]     = useState("");
  const [milestoneDue,    setMilestoneDue]     = useState("");
  const [showColorPicker, setShowColorPicker]  = useState(false);
  const [savedBadge,      setSavedBadge]       = useState(false);

  // Tags editing state
  const [tagInput,    setTagInput]    = useState("");
  const tagInputRef                   = useRef<HTMLInputElement>(null);

  // Sync local state when project changes
  useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description ?? "");
      setTagInput("");
    }
  }, [project?.id]);

  // Load tasks if Tasks module hasn't been visited
  useEffect(() => {
    if (allTasks.length === 0) void loadTasks();
  }, []);

  // FIX: Escape listener was registered unconditionally before.
  // Now only active when the panel is actually open (openProjectId truthy).
  // Also uses closeProject stable ref — no dep-array churn.
  useEffect(() => {
    if (!openProjectId) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeProject();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [openProjectId, closeProject]);

  if (!project) return null;

  const tags            = project.tags ?? [];
  const doneTasks       = tasks.filter((t) => t.status === "done").length;
  const totalTasks      = tasks.length;
  const progress        = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const doneMilestones  = project.milestones.filter((m) => m.completedAt).length;
  const today           = new Date().toISOString().slice(0, 10);
  const isOverdue       = project.status === "active" && !!project.dueDate && project.dueDate < today;

  const save = (patch: Parameters<typeof updateProject>[1]) => {
    void updateProject(project.id, patch);
    setSavedBadge(true);
    setTimeout(() => setSavedBadge(false), 1500);
  };

  const handleDuplicate = async () => {
    await duplicateProject(project.id);
    closeProject();
  };

  // ── Tag helpers ───────────────────────────────────────────

  const commitTag = (raw: string) => {
    const val = raw.trim().toLowerCase().replace(/\s+/g, "-");
    if (!val || val.length > MAX_TAG_LEN) return;
    if (tags.includes(val) || tags.length >= MAX_TAGS) return;
    save({ tags: [...tags, val] });
    setTagInput("");
  };

  const removeTag = (tag: string) => save({ tags: tags.filter((t) => t !== tag) });

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," || e.key === " ") {
      e.preventDefault();
      commitTag(tagInput);
    } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      save({ tags: tags.slice(0, -1) });
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={closeProject} />

      <div className="relative z-10 flex flex-col h-full w-full max-w-[520px] bg-background border-l border-border shadow-2xl animate-slide-in-right overflow-hidden">

        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 h-12 shrink-0"
          style={{
            borderBottom: `2px solid ${project.color}30`,
            background:   `${project.color}0a`,
          }}
        >
          {/* Color swatch / picker */}
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
            onBlur={() => {
              if (name.trim() && name !== project.name) save({ name: name.trim() });
            }}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
            className="flex-1 text-sm font-semibold bg-transparent outline-none"
            placeholder="Project name"
          />

          {savedBadge && (
            <span className="text-[10px] text-muted-foreground animate-fade-in px-1">
              Saved
            </span>
          )}

          {/* Duplicate */}
          <button
            onClick={() => void handleDuplicate()}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-fast"
            title="Duplicate project"
          >
            <Copy size={13} />
          </button>

          {/* Delete */}
          <button
            onClick={() => {
              if (confirm(`Delete "${project.name}"? This cannot be undone.`)) {
                void deleteProject(project.id);
                closeProject();
              }
            }}
            className="p-1.5 rounded text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-fast"
            title="Delete project"
          >
            <Trash2 size={13} />
          </button>

          <button
            onClick={closeProject}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-fast"
            aria-label="Close"
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
                <span className="ml-1.5 text-muted-foreground tabular-nums">
                  {doneTasks}/{totalTasks}
                </span>
              )}
              {t === "milestones" && project.milestones.length > 0 && (
                <span className="ml-1.5 text-muted-foreground tabular-nums">
                  {doneMilestones}/{project.milestones.length}
                </span>
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

              {/* Date timeline bar */}
              {(project.startDate || project.dueDate) && (
                <DateTimeline
                  startDate={project.startDate}
                  dueDate={project.dueDate}
                  color={project.color}
                />
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

                <MetaRow label="Start date">
                  <input
                    type="date"
                    value={project.startDate ?? ""}
                    onChange={(e) => save({ startDate: e.target.value || undefined })}
                    className="text-sm bg-transparent outline-none text-foreground"
                  />
                </MetaRow>

                <MetaRow label="Due date">
                  <input
                    type="date"
                    value={project.dueDate ?? ""}
                    onChange={(e) => save({ dueDate: e.target.value || undefined })}
                    className={cn(
                      "text-sm bg-transparent outline-none",
                      isOverdue ? "text-red-500 font-medium" : "text-foreground"
                    )}
                  />
                  {isOverdue && (
                    <span className="ml-2 text-[10px] text-red-500">Overdue</span>
                  )}
                </MetaRow>
              </div>

              {/* Tags inline editor */}
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Tags</p>
                <div
                  className="flex flex-wrap items-center gap-1.5 min-h-[34px] px-2.5 py-1.5 rounded-lg border border-border cursor-text"
                  onClick={() => tagInputRef.current?.focus()}
                >
                  <Tag size={10} className="text-muted-foreground/40 shrink-0" />
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-xs text-foreground"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label={`Remove tag ${tag}`}
                      >
                        <X size={9} />
                      </button>
                    </span>
                  ))}
                  {tags.length < MAX_TAGS && (
                    <input
                      ref={tagInputRef}
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleTagKeyDown}
                      onBlur={() => commitTag(tagInput)}
                      placeholder={tags.length === 0 ? "Add tags…" : ""}
                      className="flex-1 min-w-[80px] text-xs bg-transparent outline-none text-foreground placeholder:text-muted-foreground/40"
                    />
                  )}
                </div>
              </div>

              {/* Footer info */}
              <p className="text-xs text-muted-foreground/40">
                Created {formatDate(project.createdAt)} · ID: {project.id.slice(0, 8)}
              </p>
            </div>
          )}

          {/* ── TASKS ────────────────────────────────────── */}
          {tab === "tasks" && (
            <div className="flex flex-col h-full">
              {tasks.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 py-16 text-center">
                  <p className="text-sm font-medium text-foreground">No tasks yet</p>
                  <p className="text-xs text-muted-foreground">
                    Add tasks to track work in this project.
                  </p>
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
                  {tasks.filter((t) => t.status !== "done" && t.status !== "cancelled").length > 0 && (
                    <>
                      <SectionLabel>Active</SectionLabel>
                      {tasks
                        .filter((t) => t.status !== "done" && t.status !== "cancelled")
                        .map((task) => (
                          <TaskLine key={task.id} task={task} onOpen={() => openTask(task.id)} />
                        ))}
                    </>
                  )}
                  {tasks.filter((t) => t.status === "done").length > 0 && (
                    <>
                      <SectionLabel>Completed</SectionLabel>
                      {tasks
                        .filter((t) => t.status === "done")
                        .map((task) => (
                          <TaskLine key={task.id} task={task} onOpen={() => openTask(task.id)} />
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
                  const milestoneOverdue = !m.completedAt && m.dueDate && m.dueDate < today;
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
                          milestoneOverdue ? "text-red-500" : "text-muted-foreground/60"
                        )}>
                          {formatDate(m.dueDate)}
                        </span>
                      )}

                      <button
                        onClick={() => void deleteMilestone(project.id, m.id)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground hover:text-red-500 transition-fast"
                        aria-label="Delete milestone"
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
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────

function TaskLine({
  task,
  onOpen,
}: {
  task: import("@/shared/types").Task;
  onOpen: () => void;
}) {
  const isDone    = task.status === "done";
  const today     = new Date().toISOString().slice(0, 10);
  const isOverdue = !isDone && task.dueDate && task.dueDate < today;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }}
      className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-accent cursor-pointer transition-fast group"
    >
      {isDone
        ? <CheckCircle2 size={14} className="text-green-500 shrink-0" />
        : <Circle size={14} className="text-muted-foreground/50 shrink-0" />
      }
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
      <div className="flex-1 flex items-center">{children}</div>
    </div>
  );
}

function DateTimeline({
  startDate,
  dueDate,
  color,
}: {
  startDate?: string;
  dueDate?: string;
  color: string;
}) {
  if (!startDate && !dueDate) return null;

  const today   = new Date().toISOString().slice(0, 10);
  const start   = startDate ?? today;
  const end     = dueDate   ?? today;
  const startMs = new Date(start).getTime();
  const endMs   = new Date(end).getTime();
  const nowMs   = Date.now();
  const total   = endMs - startMs;
  const elapsed = nowMs - startMs;
  const pct     = total > 0 ? Math.min(100, Math.max(0, (elapsed / total) * 100)) : 0;
  const isOver  = today > end;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground/60">
        <span>{startDate ? formatDate(startDate) : "Start"}</span>
        <span className={cn(isOver && "text-red-500")}>
          {dueDate ? formatDate(dueDate) : "Due"}
        </span>
      </div>
      <div className="relative h-1.5 rounded-full bg-muted overflow-visible">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, backgroundColor: isOver ? "#ef4444" : color }}
        />
        {!isOver && pct > 0 && pct < 100 && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-background shadow"
            style={{
              left:            `calc(${pct}% - 5px)`,
              backgroundColor: color,
            }}
          />
        )}
      </div>
      {total > 0 && (
        <p className="text-[10px] text-muted-foreground/50 tabular-nums">
          {isOver
            ? `${Math.round((nowMs - endMs) / 86_400_000)} days overdue`
            : `${Math.round((endMs - nowMs) / 86_400_000)} days remaining`}
        </p>
      )}
    </div>
  );
}
