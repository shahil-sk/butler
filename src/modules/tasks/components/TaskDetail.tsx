import { useState, useEffect } from "react";
import {
  X, Flag, Calendar, Clock, Plus, Trash2,
  CheckSquare, Circle, ChevronDown, FolderKanban,
  FileText, ExternalLink,
} from "lucide-react";
import { cn, formatDate, formatTime, PRIORITY_COLORS, PRIORITY_LABELS, today, now } from "@/shared/utils";
import { ProjectDot, SectionLabel } from "@/shared/ui";
import { useTaskStore } from "../store";
import { useProjectStore } from "@/modules/projects/store";
import { useNoteStore } from "@/modules/notes/store";
import { useCalendarStore } from "@/modules/calendar/store";
import { bus } from "@/kernel/event-bus";
import type { Task, Priority, TaskStatus } from "@/shared/types";

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "todo",        label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done",        label: "Done" },
  { value: "cancelled",   label: "Cancelled" },
];

export function TaskDetail() {
  const {
    openTaskId, closeTask, getTaskById, updateTask,
    addChecklistItem, toggleChecklistItem, deleteChecklistItem, deleteTask,
  } = useTaskStore();

  const activeProjects = useProjectStore((s) => s.projects.filter((p) => p.status === "active"));
  const allProjects    = useProjectStore((s) => s.projects);
  const allNotes       = useNoteStore((s) => s.notes);
  const allEvents      = useCalendarStore((s) => s.events);

  const task = openTaskId ? getTaskById(openTaskId) : null;
  const project = task?.projectId ? allProjects.find((p) => p.id === task.projectId) : undefined;
  const linkedNotes  = allNotes.filter((n)  => task?.linkedNoteIds.includes(n.id));
  const linkedEvents = allEvents.filter((e) => task?.linkedEventIds.includes(e.id));

  const [title,         setTitle]         = useState("");
  const [description,   setDescription]   = useState("");
  const [newCheckItem,  setNewCheckItem]   = useState("");
  const [scheduleOpen,  setScheduleOpen]   = useState(false);
  const [scheduleDate,  setScheduleDate]   = useState(today());
  const [scheduleTime,  setScheduleTime]   = useState("09:00");
  const [linkNoteOpen,  setLinkNoteOpen]   = useState(false);
  const [noteSearch,    setNoteSearch]     = useState("");

  useEffect(() => {
    if (task) { setTitle(task.title); setDescription(task.description ?? ""); }
  }, [task?.id]);

  if (!task) return null;

  const save = (patch: Partial<Task>) => void updateTask(task.id, patch);
  const completedChecklist = task.checklistItems.filter((i) => i.checked).length;

  const handleScheduleToCalendar = async () => {
    const startAt = `${scheduleDate}T${scheduleTime}:00`;
    const endMinutes = (task.estimateMinutes ?? 60);
    const [h, m] = scheduleTime.split(":").map(Number);
    const totalEnd = h * 60 + m + endMinutes;
    const endAt = `${scheduleDate}T${String(Math.floor(totalEnd / 60)).padStart(2,"0")}:${String(totalEnd % 60).padStart(2,"0")}:00`;
    await useCalendarStore.getState().createEvent({
      title: task.title, startAt, endAt,
      linkedTaskIds: [task.id],
    });
    save({ scheduledDate: scheduleDate });
    setScheduleOpen(false);
    bus.emit("ui:notification", {
      id: task.id + "-sched",
      type: "success",
      message: `"${task.title}" added to calendar`,
      durationMs: 2500,
    });
  };

  const handleLinkNote = (noteId: string) => {
    if (task.linkedNoteIds.includes(noteId)) return;
    save({ linkedNoteIds: [...task.linkedNoteIds, noteId] });
    bus.emit("note:link-to-task", { noteId, taskId: task.id });
    setLinkNoteOpen(false);
  };

  const filteredNotes = allNotes
    .filter((n) => n.title.toLowerCase().includes(noteSearch.toLowerCase()))
    .slice(0, 8);

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={closeTask} />

      <div className="relative z-10 flex flex-col h-full w-full max-w-[460px] bg-background border-l border-border shadow-2xl animate-slide-in-right overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-2 px-4 h-11 border-b border-border shrink-0">
          <StatusBadge value={task.status} onChange={(status) => save({ status })} />
          <span className="flex-1 text-xs text-muted-foreground tabular-nums">
            Updated {formatDate(task.updatedAt)}
          </span>
          <button
            onClick={() => { void deleteTask(task.id); closeTask(); }}
            className="p-1.5 rounded text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-fast"
            title="Delete task"
          >
            <Trash2 size={13} />
          </button>
          <button
            onClick={closeTask}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-fast"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto">

          {/* Title */}
          <div className="px-4 pt-4 pb-1">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => { if (title.trim() && title !== task.title) save({ title: title.trim() }); }}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
              className="w-full text-base font-semibold bg-transparent outline-none leading-snug"
              placeholder="Task title"
            />
          </div>

          {/* Description */}
          <div className="px-4 pb-4">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => { if (description !== (task.description ?? "")) save({ description: description || undefined }); }}
              className="w-full text-sm text-muted-foreground bg-transparent outline-none resize-none leading-relaxed"
              placeholder="Add description…"
              rows={3}
            />
          </div>

          {/* Metadata */}
          <div className="border-y border-border divide-y divide-border/50">
            {/* Project */}
            <MetaRow label="Project" icon={<FolderKanban size={13} />}>
              <div className="flex items-center gap-2 flex-1">
                <select
                  value={task.projectId ?? ""}
                  onChange={(e) => save({ projectId: e.target.value || undefined })}
                  className="flex-1 text-sm bg-transparent outline-none text-foreground max-w-[160px]"
                >
                  <option value="">No project</option>
                  {activeProjects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {project && (
                  <button
                    onClick={() => {
                      closeTask();
                      bus.emit("navigate:to", { path: "/projects" });
                      setTimeout(() => bus.emit("project:open", { projectId: project.id }), 80);
                    }}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-fast shrink-0"
                    title={`Open ${project.name}`}
                  >
                    <ProjectDot color={project.color} size={8} />
                    <span className="max-w-[80px] truncate">{project.name} ↗</span>
                  </button>
                )}
              </div>
            </MetaRow>

            {/* Priority */}
            <MetaRow label="Priority" icon={<Flag size={13} />}>
              <PriorityPicker value={task.priority} onChange={(priority) => save({ priority })} />
            </MetaRow>

            {/* Status */}
            <MetaRow label="Status" icon={<CheckSquare size={13} />}>
              <select
                value={task.status}
                onChange={(e) => save({ status: e.target.value as TaskStatus })}
                className="text-sm bg-transparent outline-none text-foreground"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </MetaRow>

            {/* Due date */}
            <MetaRow label="Due date" icon={<Calendar size={13} />}>
              <input
                type="date"
                value={task.dueDate ?? ""}
                onChange={(e) => save({ dueDate: e.target.value || undefined })}
                className="text-sm bg-transparent outline-none text-foreground"
              />
            </MetaRow>

            {/* Estimate */}
            <MetaRow label="Estimate" icon={<Clock size={13} />}>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={task.estimateMinutes ?? ""}
                  onChange={(e) => save({ estimateMinutes: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-14 text-sm bg-transparent outline-none text-foreground"
                  placeholder="—"
                  min={0}
                  step={5}
                />
                <span className="text-xs text-muted-foreground">min</span>
                {task.estimateMinutes && (
                  <span className="text-xs text-muted-foreground/60">
                    ({Math.round(task.estimateMinutes / 60 * 10) / 10}h)
                  </span>
                )}
              </div>
            </MetaRow>
          </div>

          {/* Checklist */}
          <div className="px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
                Checklist
              </span>
              {task.checklistItems.length > 0 && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {completedChecklist}/{task.checklistItems.length}
                </span>
              )}
            </div>

            {task.checklistItems.length > 0 && (
              <div className="h-1 rounded-full bg-muted mb-4 overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-300"
                  style={{ width: `${(completedChecklist / task.checklistItems.length) * 100}%` }}
                />
              </div>
            )}

            <div className="space-y-1.5">
              {task.checklistItems.map((item) => (
                <div key={item.id} className="flex items-center gap-2 group">
                  <button
                    onClick={() => void toggleChecklistItem(task.id, item.id)}
                    className="shrink-0 text-muted-foreground hover:text-primary transition-fast"
                  >
                    {item.checked
                      ? <CheckSquare size={14} className="text-green-500" />
                      : <Circle size={14} />
                    }
                  </button>
                  <span className={cn(
                    "flex-1 text-sm leading-snug",
                    item.checked && "line-through text-muted-foreground/50"
                  )}>
                    {item.text}
                  </span>
                  <button
                    onClick={() => void deleteChecklistItem(task.id, item.id)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground hover:text-red-500 transition-fast"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>

            {/* New item input */}
            <div className="flex items-center gap-2 mt-3">
              <Plus size={12} className="text-muted-foreground/50 shrink-0" />
              <input
                value={newCheckItem}
                onChange={(e) => setNewCheckItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newCheckItem.trim()) {
                    void addChecklistItem(task.id, newCheckItem.trim());
                    setNewCheckItem("");
                  }
                  if (e.key === "Escape") setNewCheckItem("");
                }}
                placeholder="Add checklist item…"
                className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/40"
              />
            </div>
          </div>

          {/* Activity / metadata footer */}
          <div className="px-4 pb-4">

            {/* Linked notes */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <SectionLabel>Linked Notes</SectionLabel>
                <button
                  onClick={() => { setLinkNoteOpen((v) => !v); setNoteSearch(""); }}
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-fast"
                  title="Link a note"
                >
                  <Plus size={12} />
                </button>
              </div>

              {/* Link note search */}
              {linkNoteOpen && (
                <div className="mb-2 border border-border rounded-lg overflow-hidden">
                  <input
                    value={noteSearch}
                    onChange={(e) => setNoteSearch(e.target.value)}
                    placeholder="Search notes…"
                    autoFocus
                    className="w-full px-2.5 py-1.5 text-xs bg-transparent outline-none border-b border-border"
                  />
                  <div className="max-h-36 overflow-y-auto">
                    {filteredNotes.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => handleLinkNote(n.id)}
                        className={cn(
                          "w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-left hover:bg-accent transition-fast",
                          task.linkedNoteIds.includes(n.id) && "opacity-40 pointer-events-none"
                        )}
                      >
                        <FileText size={11} className="text-muted-foreground shrink-0" />
                        <span className="truncate flex-1">{n.title}</span>
                        {task.linkedNoteIds.includes(n.id) && (
                          <span className="text-[10px] text-muted-foreground">linked</span>
                        )}
                      </button>
                    ))}
                    {filteredNotes.length === 0 && (
                      <p className="px-3 py-2 text-xs text-muted-foreground/50">No notes found</p>
                    )}
                  </div>
                </div>
              )}

              {linkedNotes.length > 0 ? (
                <div className="space-y-1">
                  {linkedNotes.map((n) => (
                    <div key={n.id} className="flex items-center gap-2 group px-1">
                      <FileText size={11} className="text-muted-foreground/50 shrink-0" />
                      <button
                        onClick={() => {
                          useNoteStore.getState().openNote(n.id);
                          bus.emit("navigate:to", { path: "/notes" });
                          closeTask();
                        }}
                        className="flex-1 text-xs text-left truncate hover:text-primary transition-fast"
                      >
                        {n.title}
                      </button>
                      <button
                        onClick={() => save({ linkedNoteIds: task.linkedNoteIds.filter((id) => id !== n.id) })}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground hover:text-red-500 transition-fast"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/40 px-1">No linked notes</p>
              )}
            </div>

            {/* Calendar events */}
            {linkedEvents.length > 0 && (
              <div className="mb-4">
                <SectionLabel>Calendar Events</SectionLabel>
                <div className="space-y-1 mt-1">
                  {linkedEvents.map((e) => (
                    <div key={e.id} className="flex items-center gap-2 group px-1">
                      <Calendar size={11} className="text-muted-foreground/50 shrink-0" />
                      <button
                        onClick={() => {
                          bus.emit("navigate:to", { path: "/calendar" });
                          closeTask();
                        }}
                        className="flex-1 text-xs text-left truncate hover:text-primary transition-fast"
                      >
                        {e.title}
                      </button>
                      <span className="text-[10px] text-muted-foreground/50 tabular-nums shrink-0">
                        {e.startAt.slice(0, 10)} {e.startAt.slice(11, 16)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Schedule to calendar */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <SectionLabel>Schedule</SectionLabel>
                <button
                  onClick={() => setScheduleOpen((v) => !v)}
                  className={cn(
                    "p-1 rounded transition-fast text-xs flex items-center gap-1",
                    scheduleOpen
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  <Calendar size={12} />
                  {task.scheduledDate ? formatDate(task.scheduledDate) : "Add to calendar"}
                </button>
              </div>

              {scheduleOpen && (
                <div className="border border-border rounded-lg p-3 space-y-2 bg-surface-1">
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      className="flex-1 text-xs bg-background border border-border rounded px-2 py-1.5 outline-none"
                    />
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      className="w-24 text-xs bg-background border border-border rounded px-2 py-1.5 outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => save({ scheduledDate: scheduleDate })}
                      className="flex-1 px-2 py-1.5 text-xs border border-border rounded hover:bg-accent transition-fast"
                    >
                      Set date only
                    </button>
                    <button
                      onClick={() => void handleScheduleToCalendar()}
                      className="flex-1 px-2 py-1.5 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-fast"
                    >
                      Add to calendar
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer metadata */}
            <div className="text-xs text-muted-foreground/40 space-y-0.5 pt-2 border-t border-border/50">
              <p>Created {formatDate(task.createdAt)}</p>
              <p>ID: {task.id.slice(0, 8)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────

function MetaRow({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <div className="flex items-center gap-2 w-24 shrink-0 text-muted-foreground text-xs">
        {icon}
        <span>{label}</span>
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function StatusBadge({ value, onChange }: { value: TaskStatus; onChange: (s: TaskStatus) => void }) {
  const [open, setOpen] = useState(false);
  const labels: Record<TaskStatus, string> = {
    todo: "To do", in_progress: "In progress", done: "Done", cancelled: "Cancelled", archived: "Archived",
  };
  const colors: Record<TaskStatus, string> = {
    todo:        "bg-muted text-muted-foreground",
    in_progress: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    done:        "bg-green-500/10 text-green-600 dark:text-green-400",
    cancelled:   "bg-muted text-muted-foreground/60",
    archived:    "bg-muted text-muted-foreground/40",
  };
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn("flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-fast", colors[value])}
      >
        {labels[value]}
        <ChevronDown size={10} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-8 left-0 z-20 w-36 rounded-lg border border-border bg-popover shadow-xl py-1 animate-fade-in">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s.value}
                onClick={() => { onChange(s.value); setOpen(false); }}
                className={cn(
                  "w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-fast",
                  value === s.value && "text-primary font-medium"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function PriorityPicker({ value, onChange }: { value: Priority; onChange: (p: Priority) => void }) {
  const [open, setOpen] = useState(false);
  const priorities: Priority[] = ["urgent", "high", "medium", "low", "none"];
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn("flex items-center gap-1.5 text-sm transition-fast", PRIORITY_COLORS[value])}
      >
        <Flag size={13} />
        {PRIORITY_LABELS[value]}
        <ChevronDown size={10} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-7 left-0 z-20 w-36 rounded-lg border border-border bg-popover shadow-xl py-1 animate-fade-in">
            {priorities.map((p) => (
              <button
                key={p}
                onClick={() => { onChange(p); setOpen(false); }}
                className={cn("w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent transition-fast", PRIORITY_COLORS[p])}
              >
                <Flag size={11} />
                {PRIORITY_LABELS[p]}
                {value === p && <span className="ml-auto text-primary">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
