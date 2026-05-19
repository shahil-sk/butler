import { useState, useEffect, useRef } from "react";
import {
  X, Flag, Calendar, Clock, Plus, Trash2,
  CheckSquare, Circle, ChevronDown, FolderKanban,
  FileText, ExternalLink, CalendarClock,
} from "lucide-react";
import { cn, formatDate, PRIORITY_LABELS, today } from "@/shared/utils";
import {
  Modal, Popover, PopoverItem, PopoverDivider,
  ProjectDot, SectionLabel,
} from "@/shared/ui";
import { useTaskStore } from "../store";
import { useProjectStore } from "@/modules/projects/store";
import { useNoteStore } from "@/modules/notes/store";
import { useCalendarStore } from "@/modules/calendar/store";
import { bus } from "@/kernel/event-bus";
import type { Task, Priority, TaskStatus } from "@/shared/types";

// ─── constants ───────────────────────────────────────────────

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "todo",        label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done",        label: "Done" },
  { value: "cancelled",   label: "Cancelled" },
];

// ─── helper: metadata pill button ────────────────────────────

function MetaPill({
  icon,
  label,
  btnRef,
  onClick,
  active,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  btnRef?: React.RefObject<HTMLButtonElement>;
  onClick?: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      ref={onClick ? btnRef as React.RefObject<HTMLButtonElement> : undefined}
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-fast min-w-0",
        onClick && "cursor-pointer",
        active
          ? "border-primary/40 bg-primary/6 text-foreground"
          : "border-border bg-muted/30 text-muted-foreground hover:border-border hover:bg-accent hover:text-foreground",
      )}
    >
      <span className="shrink-0 opacity-60">{icon}</span>
      <span className="truncate">{children}</span>
      {onClick && <ChevronDown size={10} className="shrink-0 opacity-40 ml-auto" />}
    </Tag>
  );
}

// ─── status chip ─────────────────────────────────────────────

function StatusChip({
  status,
  btnRef,
  onClick,
}: {
  status: TaskStatus;
  btnRef: React.RefObject<HTMLButtonElement>;
  onClick: () => void;
}) {
  return (
    <button
      ref={btnRef}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-semibold transition-fast",
        status === "done"        && "border-emerald-500/30 bg-emerald-500/8  text-emerald-600 dark:text-emerald-400",
        status === "in_progress" && "border-blue-500/30   bg-blue-500/8     text-blue-600    dark:text-blue-400",
        status === "cancelled"   && "border-border        bg-muted/30       text-muted-foreground/50 line-through",
        status === "todo"        && "border-border        bg-muted/30       text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full shrink-0",
          status === "done"        && "bg-emerald-500",
          status === "in_progress" && "bg-blue-500",
          status === "cancelled"   && "bg-muted-foreground/30",
          status === "todo"        && "bg-muted-foreground/50",
        )}
      />
      {STATUS_OPTIONS.find((o) => o.value === status)?.label ?? "To do"}
      <ChevronDown size={9} className="opacity-40" />
    </button>
  );
}

// ─── schedule panel ───────────────────────────────────────────

function SchedulePanel({
  isCreating,
  scheduleDate, scheduleTime,
  scheduledDate, scheduledTime,
  taskScheduledDate,
  onDateChange, onTimeChange,
  onClose, onConfirm, onClearExisting,
}: {
  isCreating: boolean;
  scheduleDate: string; scheduleTime: string;
  scheduledDate?: string; scheduledTime?: string;
  taskScheduledDate?: string;
  onDateChange: (v: string) => void;
  onTimeChange: (v: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  onClearExisting: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="relative z-10 bg-popover border border-border rounded-2xl shadow-2xl p-5 w-80 animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold">
            {isCreating ? "Schedule task" : "Schedule to calendar"}
          </p>
          <button
            onClick={onClose}
            className="p-1 rounded text-muted-foreground hover:text-foreground transition-fast"
          >
            <X size={13} />
          </button>
        </div>

        {/* existing badge */}
        {!isCreating && taskScheduledDate && (
          <div className="flex items-center gap-2 mb-3 px-2.5 py-2 rounded-lg bg-primary/8 text-primary text-xs font-medium">
            <CalendarClock size={12} />
            <span className="flex-1">Scheduled: {taskScheduledDate}</span>
            <button onClick={onClearExisting} className="text-muted-foreground hover:text-red-500 transition-fast">
              <X size={11} />
            </button>
          </div>
        )}
        {isCreating && scheduledDate && (
          <div className="flex items-center gap-2 mb-3 px-2.5 py-2 rounded-lg bg-primary/8 text-primary text-xs font-medium">
            <CalendarClock size={12} />
            <span className="flex-1">{scheduledDate} · {scheduledTime ?? "09:00"}</span>
            <button onClick={onClearExisting} className="text-muted-foreground hover:text-red-500 transition-fast">
              <X size={11} />
            </button>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-[11px] text-muted-foreground mb-1">Date</label>
            <input
              type="date"
              value={scheduleDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="w-full text-sm bg-muted/40 rounded-lg px-3 py-2 outline-none border border-border focus:border-primary/50"
            />
          </div>
          <div>
            <label className="block text-[11px] text-muted-foreground mb-1">Time</label>
            <input
              type="time"
              value={scheduleTime}
              onChange={(e) => onTimeChange(e.target.value)}
              className="w-full text-sm bg-muted/40 rounded-lg px-3 py-2 outline-none border border-border focus:border-primary/50"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={onClose}
            className="flex-1 px-3 py-2 rounded-lg text-xs border border-border text-muted-foreground hover:bg-accent transition-fast"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-3 py-2 rounded-lg text-xs bg-primary text-primary-foreground hover:bg-primary/90 font-semibold transition-fast"
          >
            {isCreating ? "Set schedule" : "Add to calendar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────

export function TaskDetail() {
  const {
    openTaskId, closeTask, getTaskById, updateTask,
    addChecklistItem, toggleChecklistItem, deleteChecklistItem, deleteTask,
    quickAddOpen, quickAddPrefill, closeQuickAdd, createTask,
  } = useTaskStore();

  const activeProjects = useProjectStore((s) => s.projects.filter((p) => p.status === "active"));
  const allProjects    = useProjectStore((s) => s.projects);
  const allNotes       = useNoteStore((s) => s.notes);
  const allEvents      = useCalendarStore((s) => s.events);

  const isCreating = quickAddOpen && !openTaskId;
  const task       = openTaskId ? getTaskById(openTaskId) : null;
  const isOpen     = isCreating || (openTaskId != null && task != null);

  const project      = task?.projectId ? allProjects.find((p) => p.id === task.projectId) : undefined;
  const linkedNotes  = allNotes.filter((n) => task?.linkedNoteIds.includes(n.id));

  // ── local state ───────────────────────────────────────────
  const [title,          setTitle]          = useState("");
  const [description,    setDescription]    = useState("");
  const [dueDate,        setDueDate]        = useState("");
  const [priority,       setPriority]       = useState<Priority>("none");
  const [projectId,      setProjectId]      = useState("");
  const [status,         setStatus]         = useState<TaskStatus>("todo");
  const [estimateMins,   setEstimateMins]   = useState<number | "">("");
  const [newCheckItem,   setNewCheckItem]   = useState("");
  const [checklistItems, setChecklistItems] = useState<{ id: string; text: string; checked: boolean }[]>([]);

  const [linkNoteOpen, setLinkNoteOpen] = useState(false);
  const [noteSearch,   setNoteSearch]   = useState("");

  const [scheduleOpen,  setScheduleOpen]  = useState(false);
  const [scheduleDate,  setScheduleDate]  = useState(today());
  const [scheduleTime,  setScheduleTime]  = useState("09:00");
  const [scheduledDate, setScheduledDate] = useState<string | undefined>(undefined);
  const [scheduledTime, setScheduledTime] = useState<string | undefined>(undefined);

  const statusAnchor   = useRef<HTMLButtonElement>(null);
  const priorityAnchor = useRef<HTMLButtonElement>(null);
  const projectAnchor  = useRef<HTMLButtonElement>(null);
  const [statusOpen,   setStatusOpen]   = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [projectOpen,  setProjectOpen]  = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  // ── sync ──────────────────────────────────────────────────
  useEffect(() => {
    if (isCreating) {
      setTitle(quickAddPrefill.title ?? "");
      setDescription("");
      setDueDate(quickAddPrefill.dueDate ?? "");
      setPriority((quickAddPrefill.priority as Priority) ?? "none");
      setProjectId(quickAddPrefill.projectId ?? "");
      setStatus("todo");
      setEstimateMins("");
      setChecklistItems([]);
      setNewCheckItem("");
      setScheduledDate(undefined);
      setScheduledTime(undefined);
      setScheduleDate(today());
      setScheduleTime("09:00");
      setLinkNoteOpen(false);
      setNoteSearch("");
      setTimeout(() => titleRef.current?.focus(), 40);
    }
  }, [isCreating, quickAddOpen]);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setDueDate(task.dueDate ?? "");
      setPriority(task.priority);
      setProjectId(task.projectId ?? "");
      setStatus(task.status);
      setEstimateMins(task.estimateMinutes ?? "");
      setScheduleDate(task.scheduledDate ?? today());
      setScheduleTime("09:00");
    }
  }, [task?.id]);

  useEffect(() => {
    if (!isCreating) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") closeQuickAdd(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [isCreating, closeQuickAdd]);

  if (!isOpen) return null;

  // ── actions ───────────────────────────────────────────────
  const save = (patch: Partial<Task>) => {
    if (task) void updateTask(task.id, patch);
  };

  const handleCreate = async () => {
    if (!title.trim()) { titleRef.current?.focus(); return; }
    await createTask({
      ...quickAddPrefill,
      title:           title.trim(),
      description:     description.trim() || undefined,
      dueDate:         dueDate || undefined,
      priority, projectId: projectId || undefined,
      status,
      estimateMinutes: estimateMins !== "" ? Number(estimateMins) : undefined,
      checklistItems:  checklistItems.map((item, i) => ({ ...item, order: i })),
      scheduledDate:   scheduledDate || undefined,
      scheduledTime:   scheduledTime || undefined,
    });
    if (scheduledDate) {
      const time    = scheduledTime ?? "09:00";
      const startAt = `${scheduledDate}T${time}:00`;
      const dur     = estimateMins ? Number(estimateMins) : 60;
      const [h, m]  = time.split(":").map(Number);
      const end     = h * 60 + m + dur;
      const endAt   = `${scheduledDate}T${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}:00`;
      await useCalendarStore.getState().createEvent({ title: title.trim(), startAt, endAt, linkedTaskIds: [] });
    }
    closeQuickAdd();
  };

  const handleScheduleToCalendar = async () => {
    if (!task) return;
    const startAt = `${scheduleDate}T${scheduleTime}:00`;
    const dur     = task.estimateMinutes ?? 60;
    const [h, m]  = scheduleTime.split(":").map(Number);
    const end     = h * 60 + m + dur;
    const endAt   = `${scheduleDate}T${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}:00`;
    await useCalendarStore.getState().createEvent({ title: task.title, startAt, endAt, linkedTaskIds: [task.id] });
    save({ scheduledDate: scheduleDate });
    setScheduleOpen(false);
    bus.emit("ui:notification", {
      id: task.id + "-sched", type: "success",
      message: `"${task.title}" added to calendar`, durationMs: 2500,
    });
  };

  const handleLinkNote = (noteId: string) => {
    if (!task || task.linkedNoteIds.includes(noteId)) return;
    save({ linkedNoteIds: [...task.linkedNoteIds, noteId] });
    bus.emit("note:link-to-task", { noteId, taskId: task.id });
    setLinkNoteOpen(false);
  };

  const addCheckItem = () => {
    if (!newCheckItem.trim()) return;
    if (isCreating) {
      setChecklistItems((prev) => [
        ...prev,
        { id: crypto.randomUUID(), text: newCheckItem.trim(), checked: false },
      ]);
    } else {
      void addChecklistItem(task!.id, newCheckItem.trim());
    }
    setNewCheckItem("");
  };

  const handleClose  = isCreating ? closeQuickAdd : closeTask;
  const currentStatus   = isCreating ? status   : (task?.status   ?? "todo");
  const currentPriority = isCreating ? priority : (task?.priority ?? "none");
  const currentProject  = isCreating
    ? activeProjects.find((p) => p.id === projectId)
    : project;

  const checkItems     = isCreating ? checklistItems : (task?.checklistItems ?? []);
  const completedCount = checkItems.filter((i) => i.checked).length;

  const filteredNotes = allNotes
    .filter((n) => n.title.toLowerCase().includes(noteSearch.toLowerCase()))
    .slice(0, 8);

  // ─── render ───────────────────────────────────────────────
  return (
    <>
      <Modal open={isOpen} onClose={handleClose} maxWidth="max-w-[560px]" maxHeight="max-h-[92dvh]">

        {/* ── header ──────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-4 h-10 border-b border-border shrink-0">
          <StatusChip
            status={currentStatus}
            btnRef={statusAnchor}
            onClick={() => setStatusOpen((v) => !v)}
          />

          <span className="flex-1 text-[11px] text-muted-foreground/40 tabular-nums truncate">
            {isCreating ? "New task" : `Edited ${formatDate(task!.updatedAt)}`}
          </span>

          {!isCreating && (
            <button
              onClick={() => { void deleteTask(task!.id); closeTask(); }}
              className="p-1.5 rounded text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/8 transition-fast"
              title="Delete task"
            >
              <Trash2 size={13} />
            </button>
          )}
          <button
            onClick={handleClose}
            className="p-1.5 rounded text-muted-foreground/40 hover:text-foreground hover:bg-accent transition-fast"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        {/* ── scrollable body ─────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* title */}
          <div className="px-5 pt-5">
            <input
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => {
                if (!isCreating && title.trim() && title !== task?.title)
                  save({ title: title.trim() });
              }}
              onKeyDown={(e) => {
                if (isCreating && e.key === "Enter") { e.preventDefault(); void handleCreate(); }
                else if (!isCreating && e.key === "Enter") e.currentTarget.blur();
              }}
              className="w-full text-[17px] font-semibold bg-transparent outline-none leading-snug tracking-tight placeholder:text-muted-foreground/25"
              placeholder="Task title…"
            />
          </div>

          {/* description */}
          <div className="px-5 pt-2 pb-4">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => {
                if (!isCreating && description !== (task?.description ?? ""))
                  save({ description: description || undefined });
              }}
              className="w-full text-sm text-muted-foreground bg-transparent outline-none resize-none leading-relaxed placeholder:text-muted-foreground/25"
              placeholder="Add notes…"
              rows={2}
            />
          </div>

          {/* ── metadata pills row ──────────────────────── */}
          <div className="px-5 pb-4 flex flex-wrap gap-2">

            {/* project */}
            <MetaPill
              icon={<FolderKanban size={12} />}
              label="Project"
              btnRef={projectAnchor}
              onClick={() => setProjectOpen((v) => !v)}
              active={!!currentProject}
            >
              {currentProject ? (
                <span className="flex items-center gap-1.5">
                  <ProjectDot color={currentProject.color} size={7} />
                  {currentProject.name}
                </span>
              ) : "Project"}
            </MetaPill>

            {/* priority */}
            <MetaPill
              icon={<Flag size={12} />}
              label="Priority"
              btnRef={priorityAnchor}
              onClick={() => setPriorityOpen((v) => !v)}
              active={currentPriority !== "none"}
            >
              <span className={cn(
                currentPriority === "urgent" && "text-red-500",
                currentPriority === "high"   && "text-orange-500",
                currentPriority === "medium" && "text-yellow-500",
                currentPriority === "low"    && "text-blue-400",
              )}>
                {currentPriority !== "none" ? PRIORITY_LABELS[currentPriority] : "Priority"}
              </span>
            </MetaPill>

            {/* due date */}
            <label className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-fast cursor-pointer",
              (isCreating ? dueDate : task?.dueDate)
                ? "border-primary/40 bg-primary/6 text-foreground"
                : "border-border bg-muted/30 text-muted-foreground hover:bg-accent hover:text-foreground",
            )}>
              <Calendar size={12} className="opacity-60 shrink-0" />
              {(isCreating ? dueDate : task?.dueDate) || "Due date"}
              <input
                type="date"
                value={isCreating ? dueDate : (task?.dueDate ?? "")}
                onChange={(e) => {
                  if (isCreating) setDueDate(e.target.value);
                  else save({ dueDate: e.target.value || undefined });
                }}
                className="sr-only"
              />
            </label>

            {/* schedule */}
            <button
              onClick={() => setScheduleOpen(true)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-fast",
                (isCreating ? scheduledDate : task?.scheduledDate)
                  ? "border-primary/40 bg-primary/6 text-primary"
                  : "border-border bg-muted/30 text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <CalendarClock size={12} className="opacity-60 shrink-0" />
              {isCreating
                ? (scheduledDate ? `${scheduledDate}${scheduledTime ? " · " + scheduledTime : ""}` : "Schedule")
                : (task?.scheduledDate ? `${task.scheduledDate}` : "Schedule")
              }
            </button>

            {/* estimate */}
            <label className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-fast cursor-pointer",
              (isCreating ? estimateMins : task?.estimateMinutes)
                ? "border-border bg-muted/30 text-foreground"
                : "border-border bg-muted/30 text-muted-foreground hover:bg-accent hover:text-foreground",
            )}>
              <Clock size={12} className="opacity-60 shrink-0" />
              <input
                type="number"
                value={isCreating ? estimateMins : (task?.estimateMinutes ?? "")}
                onChange={(e) => {
                  if (isCreating) setEstimateMins(e.target.value ? Number(e.target.value) : "");
                  else save({ estimateMinutes: e.target.value ? Number(e.target.value) : undefined });
                }}
                className="w-10 bg-transparent outline-none text-xs tabular-nums"
                placeholder="Est."
                min={0}
                step={5}
              />
              <span className="text-muted-foreground/50">min</span>
            </label>
          </div>

          {/* ── checklist ───────────────────────────────── */}
          <div className="border-t border-border/60 px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
                Checklist
                {checkItems.length > 0 && (
                  <span className="ml-1.5 normal-case font-normal tabular-nums">
                    {completedCount}/{checkItems.length}
                  </span>
                )}
              </span>
            </div>

            {/* progress bar */}
            {checkItems.length > 0 && (
              <div className="h-[3px] rounded-full bg-border mb-3 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${(completedCount / checkItems.length) * 100}%` }}
                />
              </div>
            )}

            {/* items */}
            <div className="space-y-0.5 mb-2">
              {checkItems.map((item) => (
                <div
                  key={item.id}
                  className="group flex items-center gap-2.5 py-1.5 px-2 -mx-2 rounded-lg hover:bg-accent/40 transition-colors"
                >
                  <button
                    onClick={() => {
                      if (isCreating) {
                        setChecklistItems((prev) =>
                          prev.map((i) => i.id === item.id ? { ...i, checked: !i.checked } : i)
                        );
                      } else {
                        void toggleChecklistItem(task!.id, item.id);
                      }
                    }}
                    className={cn(
                      "shrink-0 transition-fast",
                      item.checked ? "text-emerald-500" : "text-muted-foreground/25 hover:text-primary",
                    )}
                  >
                    {item.checked ? <CheckSquare size={14} /> : <Circle size={14} />}
                  </button>
                  <span className={cn(
                    "flex-1 text-sm leading-snug",
                    item.checked && "line-through text-muted-foreground/35",
                  )}>
                    {item.text}
                  </span>
                  <button
                    onClick={() => {
                      if (isCreating) {
                        setChecklistItems((prev) => prev.filter((i) => i.id !== item.id));
                      } else {
                        void deleteChecklistItem(task!.id, item.id);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground/30 hover:text-red-500 transition-fast"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>

            {/* add item */}
            <div className="flex items-center gap-2 py-1.5 px-2 -mx-2 rounded-lg hover:bg-accent/30 transition-colors">
              <Plus size={12} className="text-muted-foreground/30 shrink-0" />
              <input
                value={newCheckItem}
                onChange={(e) => setNewCheckItem(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addCheckItem(); }}
                placeholder="Add item…"
                className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/25"
              />
              {newCheckItem.trim() && (
                <button
                  onClick={addCheckItem}
                  className="text-[11px] text-primary font-medium shrink-0 hover:opacity-75 transition-fast"
                >
                  Add
                </button>
              )}
            </div>
          </div>

          {/* ── linked notes — view mode only ───────────── */}
          {!isCreating && (
            <div className="border-t border-border/60 px-5 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-2">
                Notes
              </p>
              {linkedNotes.map((n) => (
                <button
                  key={n.id}
                  onClick={() => useNoteStore.getState().openNote(n.id)}
                  className="flex items-center gap-2 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-fast w-full text-left"
                >
                  <FileText size={13} className="shrink-0" />
                  <span className="flex-1 truncate">{n.title || "Untitled"}</span>
                  <ExternalLink size={11} className="shrink-0 opacity-30" />
                </button>
              ))}
              {linkNoteOpen && (
                <div className="mt-2 space-y-1">
                  <input
                    autoFocus
                    value={noteSearch}
                    onChange={(e) => setNoteSearch(e.target.value)}
                    placeholder="Search notes…"
                    className="w-full text-sm bg-muted/40 rounded-lg px-3 py-2 outline-none border border-border focus:border-primary/50"
                  />
                  {filteredNotes.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => handleLinkNote(n.id)}
                      className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-sm hover:bg-accent transition-fast text-left"
                    >
                      <FileText size={12} className="shrink-0 text-muted-foreground/50" />
                      {n.title || "Untitled"}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── footer ──────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-t border-border shrink-0">
          {isCreating ? (
            <>
              {scheduledDate && (
                <span className="flex items-center gap-1.5 text-[11px] text-primary font-medium">
                  <CalendarClock size={11} />
                  {scheduledDate} · {scheduledTime ?? "09:00"}
                </span>
              )}
              <span className="hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground/25">
                <kbd className="px-1 py-0.5 rounded bg-muted text-[9px] font-mono">↵</kbd> save
                <span className="mx-0.5">·</span>
                <kbd className="px-1 py-0.5 rounded bg-muted text-[9px] font-mono">Esc</kbd> cancel
              </span>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={closeQuickAdd}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-fast"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleCreate()}
                  disabled={!title.trim()}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-semibold transition-fast",
                    "bg-primary text-primary-foreground hover:bg-primary/90",
                    "disabled:opacity-40 disabled:cursor-not-allowed",
                  )}
                >
                  {scheduledDate ? "Add & Schedule" : "Add Task"}
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                onClick={() => setLinkNoteOpen((v) => !v)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent border border-transparent hover:border-border/50 transition-fast"
              >
                <FileText size={12} /> Link note
              </button>
              <button
                onClick={() => setScheduleOpen((v) => !v)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-fast",
                  task?.scheduledDate
                    ? "text-primary border-primary/30 bg-primary/8 hover:bg-primary/12"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent border-transparent hover:border-border/50",
                )}
              >
                <CalendarClock size={12} />
                {task?.scheduledDate ? `Scheduled · ${task.scheduledDate}` : "Schedule"}
              </button>
              <div className="flex-1" />
              <span className="text-[10px] text-muted-foreground/25 font-mono select-all">
                {task?.id.slice(0, 8)}
              </span>
            </>
          )}
        </div>
      </Modal>

      {/* schedule panel */}
      {scheduleOpen && (
        <SchedulePanel
          isCreating={isCreating}
          scheduleDate={scheduleDate}
          scheduleTime={scheduleTime}
          scheduledDate={scheduledDate}
          scheduledTime={scheduledTime}
          taskScheduledDate={task?.scheduledDate}
          onDateChange={setScheduleDate}
          onTimeChange={setScheduleTime}
          onClose={() => setScheduleOpen(false)}
          onConfirm={() => {
            if (isCreating) {
              setScheduledDate(scheduleDate);
              setScheduledTime(scheduleTime);
              setScheduleOpen(false);
            } else {
              void handleScheduleToCalendar();
            }
          }}
          onClearExisting={() => {
            if (isCreating) { setScheduledDate(undefined); setScheduledTime(undefined); }
            else { save({ scheduledDate: undefined }); setScheduleOpen(false); }
          }}
        />
      )}

      {/* status popover */}
      <Popover anchor={statusAnchor} open={statusOpen} onClose={() => setStatusOpen(false)} className="w-44">
        {STATUS_OPTIONS.map((s) => (
          <PopoverItem
            key={s.value}
            active={currentStatus === s.value}
            onClick={() => {
              if (isCreating) setStatus(s.value);
              else save({ status: s.value });
              setStatusOpen(false);
            }}
          >
            {s.label}
          </PopoverItem>
        ))}
      </Popover>

      {/* priority popover */}
      <Popover anchor={priorityAnchor} open={priorityOpen} onClose={() => setPriorityOpen(false)} className="w-44">
        {(["urgent", "high", "medium", "low", "none"] as const).map((p) => (
          <PopoverItem
            key={p}
            active={currentPriority === p}
            onClick={() => {
              if (isCreating) setPriority(p);
              else save({ priority: p });
              setPriorityOpen(false);
            }}
          >
            <span className={cn(
              p === "urgent" && "text-red-500",
              p === "high"   && "text-orange-500",
              p === "medium" && "text-yellow-500",
              p === "low"    && "text-blue-400",
            )}>
              {PRIORITY_LABELS[p]}
            </span>
          </PopoverItem>
        ))}
      </Popover>

      {/* project popover */}
      <Popover anchor={projectAnchor} open={projectOpen} onClose={() => setProjectOpen(false)} className="w-52">
        <PopoverItem
          active={isCreating ? !projectId : !task?.projectId}
          onClick={() => {
            if (isCreating) setProjectId("");
            else save({ projectId: undefined });
            setProjectOpen(false);
          }}
        >
          No project
        </PopoverItem>
        <PopoverDivider />
        {activeProjects.map((p) => (
          <PopoverItem
            key={p.id}
            active={(isCreating ? projectId : task?.projectId) === p.id}
            onClick={() => {
              if (isCreating) setProjectId(p.id);
              else save({ projectId: p.id });
              setProjectOpen(false);
            }}
          >
            <span className="flex items-center gap-2">
              <ProjectDot color={p.color} size={7} />
              {p.name}
            </span>
          </PopoverItem>
        ))}
      </Popover>
    </>
  );
}
