import { useState, useEffect, useRef } from "react";
import {
  X, Flag, Calendar, Clock, Plus, Trash2,
  CheckSquare, Circle, ChevronDown, FolderKanban,
  FileText, ExternalLink, CalendarClock,
} from "lucide-react";
import { cn, formatDate, PRIORITY_COLORS, PRIORITY_LABELS, today, now } from "@/shared/utils";
import { Modal, Popover, PopoverItem, PopoverDivider, ProjectDot, SectionLabel } from "@/shared/ui";
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

// ── Shared component (view + create mode) ─────────────────────

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

  // Determine mode
  const isCreating = quickAddOpen && !openTaskId;
  const task       = openTaskId ? getTaskById(openTaskId) : null;

  const project       = task?.projectId ? allProjects.find((p) => p.id === task.projectId) : undefined;
  const linkedNotes   = allNotes.filter((n)  => task?.linkedNoteIds.includes(n.id));
  const linkedEvents  = allEvents.filter((e) => task?.linkedEventIds.includes(e.id));

  // ── local state ───────────────────────────────────────────
  const [title,         setTitle]         = useState("");
  const [description,   setDescription]   = useState("");
  const [dueDate,       setDueDate]       = useState("");
  const [priority,      setPriority]      = useState<Priority>("none");
  const [projectId,     setProjectId]     = useState("");
  const [status,        setStatus]        = useState<TaskStatus>("todo");
  const [estimateMins,  setEstimateMins]  = useState<number | "">("");
  const [newCheckItem,  setNewCheckItem]   = useState("");
  const [checklistItems, setChecklistItems] = useState<{ id: string; text: string; checked: boolean }[]>([]);

  // Schedule popover — shared between create & view mode
  const [scheduleOpen,  setScheduleOpen]   = useState(false);
  const [scheduleDate,  setScheduleDate]   = useState(today());
  const [scheduleTime,  setScheduleTime]   = useState("09:00");
  // Tracks whether user has picked a schedule (create mode only)
  const [scheduledDate, setScheduledDate]  = useState<string | undefined>(undefined);
  const [scheduledTime, setScheduledTime]  = useState<string | undefined>(undefined);

  const [linkNoteOpen,  setLinkNoteOpen]   = useState(false);
  const [noteSearch,    setNoteSearch]     = useState("");

  // Popover anchors
  const statusAnchor   = useRef<HTMLButtonElement>(null);
  const priorityAnchor = useRef<HTMLButtonElement>(null);
  const projectAnchor  = useRef<HTMLButtonElement>(null);
  const [statusOpen,   setStatusOpen]   = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [projectOpen,  setProjectOpen]  = useState(false);

  const titleRef = useRef<HTMLInputElement>(null);

  // Sync local state from task (view mode) or prefill (create mode)
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
      setLinkNoteOpen(false);
      setNoteSearch("");
      setScheduledDate(undefined);
      setScheduledTime(undefined);
      setScheduleDate(today());
      setScheduleTime("09:00");
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
      // Pre-fill schedule panel from existing scheduledDate if any
      if (task.scheduledDate) {
        setScheduleDate(task.scheduledDate);
      } else {
        setScheduleDate(today());
        setScheduleTime("09:00");
      }
    }
  }, [task?.id]);

  // ESC to close create mode
  useEffect(() => {
    if (!isCreating) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") closeQuickAdd(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isCreating, closeQuickAdd]);

  const isOpen = (isCreating) || (openTaskId != null && task != null);
  if (!isOpen) return null;

  // ── helpers ───────────────────────────────────────────────

  const save = (patch: Partial<Task>) => {
    if (task) void updateTask(task.id, patch);
  };

  const handleCreate = async () => {
    if (!title.trim()) { titleRef.current?.focus(); return; }
    await createTask({
      ...quickAddPrefill,
      title:          title.trim(),
      description:    description.trim() || undefined,
      dueDate:        dueDate || undefined,
      priority,
      projectId:      projectId || undefined,
      status,
      estimateMinutes: estimateMins !== "" ? Number(estimateMins) : undefined,
      checklistItems: checklistItems.map((item, i) => ({ ...item, order: i })),
      // Include scheduled date+time if user picked them
      scheduledDate:  scheduledDate || undefined,
      scheduledTime:  scheduledTime || undefined,
    });

    // If user pre-scheduled: also create a calendar event immediately
    if (scheduledDate) {
      const time = scheduledTime ?? "09:00";
      const startAt = `${scheduledDate}T${time}:00`;
      const durationMins = estimateMins ? Number(estimateMins) : 60;
      const [h, m] = time.split(":").map(Number);
      const totalEnd = h * 60 + m + durationMins;
      const endAt = `${scheduledDate}T${String(Math.floor(totalEnd / 60)).padStart(2, "0")}:${String(totalEnd % 60).padStart(2, "0")}:00`;
      await useCalendarStore.getState().createEvent({
        title: title.trim(),
        startAt,
        endAt,
        linkedTaskIds: [], // task id not known yet at create time — acceptable
      });
    }

    closeQuickAdd();
  };

  /**
   * VIEW MODE: schedule task → calendar.
   * Saves scheduledDate on the task AND creates a calendar event.
   */
  const handleScheduleToCalendar = async () => {
    if (!task) return;
    const startAt    = `${scheduleDate}T${scheduleTime}:00`;
    const endMinutes = task.estimateMinutes ?? 60;
    const [h, m]     = scheduleTime.split(":").map(Number);
    const totalEnd   = h * 60 + m + endMinutes;
    const endAt      = `${scheduleDate}T${String(Math.floor(totalEnd / 60)).padStart(2, "0")}:${String(totalEnd % 60).padStart(2, "0")}:00`;
    await useCalendarStore.getState().createEvent({
      title: task.title, startAt, endAt, linkedTaskIds: [task.id],
    });
    save({ scheduledDate: scheduleDate });
    setScheduleOpen(false);
    bus.emit("ui:notification", {
      id: task.id + "-sched", type: "success",
      message: `"${task.title}" added to calendar`, durationMs: 2500,
    });
  };

  /**
   * CREATE MODE: user confirms schedule selection.
   * Does NOT create the calendar event yet — that happens in handleCreate.
   */
  const handleConfirmCreateSchedule = () => {
    setScheduledDate(scheduleDate);
    setScheduledTime(scheduleTime);
    setScheduleOpen(false);
  };

  const handleClose = isCreating ? closeQuickAdd : closeTask;

  const activeProject = isCreating
    ? activeProjects.find((p) => p.id === projectId)
    : project;

  const completedChecklist = isCreating
    ? checklistItems.filter((i) => i.checked).length
    : (task?.checklistItems.filter((i) => i.checked).length ?? 0);

  const totalChecklist = isCreating
    ? checklistItems.length
    : (task?.checklistItems.length ?? 0);

  const statusLabel   = STATUS_OPTIONS.find((s) => s.value === (isCreating ? status : task?.status))?.label ?? "To do";
  const priorityLabel = PRIORITY_LABELS[isCreating ? priority : (task?.priority ?? "none")] ?? "None";

  const filteredNotes = allNotes
    .filter((n) => n.title.toLowerCase().includes(noteSearch.toLowerCase()))
    .slice(0, 8);

  const handleLinkNote = (noteId: string) => {
    if (!task) return;
    if (task.linkedNoteIds.includes(noteId)) return;
    save({ linkedNoteIds: [...task.linkedNoteIds, noteId] });
    bus.emit("note:link-to-task", { noteId, taskId: task.id });
    setLinkNoteOpen(false);
  };

  // ── Schedule popover (shared) ─────────────────────────────
  const SchedulePanel = (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => setScheduleOpen(false)} />
      <div className="relative z-10 bg-popover border border-border rounded-2xl shadow-xl p-5 w-72 animate-fade-in">
        <p className="text-sm font-semibold mb-3">
          {isCreating ? "Schedule for" : "Schedule to calendar"}
        </p>

        {/* Show existing scheduled date badge in view mode */}
        {!isCreating && task?.scheduledDate && (
          <div className="flex items-center gap-2 mb-3 px-2 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium">
            <CalendarClock size={12} />
            Currently: {task.scheduledDate}
            <button
              className="ml-auto text-muted-foreground hover:text-red-500 transition-fast"
              onClick={() => { save({ scheduledDate: undefined }); setScheduleOpen(false); }}
              title="Remove schedule"
            >
              <X size={11} />
            </button>
          </div>
        )}

        {/* Show selected badge in create mode */}
        {isCreating && scheduledDate && (
          <div className="flex items-center gap-2 mb-3 px-2 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium">
            <CalendarClock size={12} />
            Scheduled: {scheduledDate} at {scheduledTime ?? "09:00"}
            <button
              className="ml-auto text-muted-foreground hover:text-red-500 transition-fast"
              onClick={() => { setScheduledDate(undefined); setScheduledTime(undefined); }}
              title="Clear"
            >
              <X size={11} />
            </button>
          </div>
        )}

        <label className="block text-xs text-muted-foreground mb-1">Date</label>
        <input
          type="date"
          value={scheduleDate}
          onChange={(e) => setScheduleDate(e.target.value)}
          className="w-full text-sm bg-muted/50 rounded-lg px-3 py-2 outline-none border border-border focus:border-primary/50 mb-3"
        />
        <label className="block text-xs text-muted-foreground mb-1">Time</label>
        <input
          type="time"
          value={scheduleTime}
          onChange={(e) => setScheduleTime(e.target.value)}
          className="w-full text-sm bg-muted/50 rounded-lg px-3 py-2 outline-none border border-border focus:border-primary/50 mb-4"
        />
        <div className="flex gap-2">
          <button
            onClick={() => setScheduleOpen(false)}
            className="flex-1 px-3 py-2 rounded-lg text-xs border border-border text-muted-foreground hover:bg-accent transition-fast"
          >
            Cancel
          </button>
          <button
            onClick={() =>
              isCreating
                ? handleConfirmCreateSchedule()
                : void handleScheduleToCalendar()
            }
            className="flex-1 px-3 py-2 rounded-lg text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-fast font-medium"
          >
            {isCreating ? "Set schedule" : "Add to calendar"}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <Modal open={isOpen} onClose={handleClose} maxWidth="max-w-[580px]" maxHeight="max-h-[90dvh]">
        {/* ── Header ──────────────────────────────── */}
        <div className="flex items-center gap-2 px-4 h-11 border-b border-border shrink-0">
          {/* Status button */}
          <button
            ref={statusAnchor}
            onClick={() => setStatusOpen((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-fast",
              (isCreating ? status : task?.status) === "done"        && "bg-green-500/10 text-green-600 dark:text-green-400",
              (isCreating ? status : task?.status) === "in_progress" && "bg-blue-500/10 text-blue-600 dark:text-blue-400",
              (isCreating ? status : task?.status) === "cancelled"   && "bg-muted text-muted-foreground line-through",
              (isCreating ? status : task?.status) === "todo"        && "bg-muted text-muted-foreground",
            )}
          >
            <ChevronDown size={10} className="opacity-60" />
            {statusLabel}
          </button>

          <span className="flex-1 text-xs text-muted-foreground tabular-nums">
            {isCreating ? "New task" : `Updated ${formatDate(task!.updatedAt)}`}
          </span>

          {!isCreating && (
            <button
              onClick={() => { void deleteTask(task!.id); closeTask(); }}
              className="p-1.5 rounded text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-fast"
              title="Delete task"
            >
              <Trash2 size={13} />
            </button>
          )}
          <button
            onClick={handleClose}
            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-fast"
          >
            <X size={14} />
          </button>
        </div>

        {/* ── Body ────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* Title */}
          <div className="px-5 pt-5 pb-1">
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
              className="w-full text-base font-semibold bg-transparent outline-none leading-snug"
              placeholder="Task title"
            />
          </div>

          {/* Description */}
          <div className="px-5 pb-4">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => {
                if (!isCreating && description !== (task?.description ?? ""))
                  save({ description: description || undefined });
              }}
              className="w-full text-sm text-muted-foreground bg-transparent outline-none resize-none leading-relaxed"
              placeholder="Add description…"
              rows={3}
            />
          </div>

          {/* Metadata grid */}
          <div className="border-y border-border divide-y divide-border/50">

            {/* Project */}
            <MetaRow label="Project" icon={<FolderKanban size={13} />}>
              <button
                ref={projectAnchor}
                onClick={() => setProjectOpen((v) => !v)}
                className="flex items-center gap-2 text-sm hover:text-primary transition-fast"
              >
                {activeProject
                  ? <><ProjectDot color={activeProject.color} size={8} />{activeProject.name}</>
                  : <span className="text-muted-foreground/60 text-xs">No project</span>}
                <ChevronDown size={11} className="opacity-40" />
              </button>
            </MetaRow>

            {/* Priority */}
            <MetaRow label="Priority" icon={<Flag size={13} />}>
              <button
                ref={priorityAnchor}
                onClick={() => setPriorityOpen((v) => !v)}
                className={cn(
                  "flex items-center gap-1.5 text-sm transition-fast",
                  (isCreating ? priority : task?.priority) === "urgent" && "text-red-500",
                  (isCreating ? priority : task?.priority) === "high"   && "text-orange-500",
                  (isCreating ? priority : task?.priority) === "medium" && "text-yellow-500",
                  (isCreating ? priority : task?.priority) === "low"    && "text-blue-400",
                  (isCreating ? priority : task?.priority) === "none"   && "text-muted-foreground/60 text-xs",
                )}
              >
                <Flag size={12} strokeWidth={1.75} />
                {priorityLabel}
                <ChevronDown size={11} className="opacity-40" />
              </button>
            </MetaRow>

            {/* Due date */}
            <MetaRow label="Due date" icon={<Calendar size={13} />}>
              <input
                type="date"
                value={isCreating ? dueDate : (task?.dueDate ?? "")}
                onChange={(e) => {
                  if (isCreating) setDueDate(e.target.value);
                  else save({ dueDate: e.target.value || undefined });
                }}
                className="text-sm bg-transparent outline-none text-foreground"
              />
            </MetaRow>

            {/* Scheduled — shown in both modes */}
            <MetaRow label="Scheduled" icon={<CalendarClock size={13} />}>
              {isCreating ? (
                scheduledDate ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-primary font-medium">
                      {scheduledDate}{scheduledTime ? ` · ${scheduledTime}` : ""}
                    </span>
                    <button
                      onClick={() => setScheduleOpen(true)}
                      className="text-xs text-muted-foreground hover:text-foreground transition-fast underline underline-offset-2"
                    >
                      change
                    </button>
                    <button
                      onClick={() => { setScheduledDate(undefined); setScheduledTime(undefined); }}
                      className="text-muted-foreground/40 hover:text-red-500 transition-fast"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setScheduleOpen(true)}
                    className="text-xs text-muted-foreground/60 hover:text-foreground transition-fast"
                  >
                    — pick date &amp; time
                  </button>
                )
              ) : (
                task?.scheduledDate ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-primary font-medium">{task.scheduledDate}</span>
                    <button
                      onClick={() => setScheduleOpen(true)}
                      className="text-xs text-muted-foreground hover:text-foreground transition-fast underline underline-offset-2"
                    >
                      reschedule
                    </button>
                    <button
                      onClick={() => save({ scheduledDate: undefined })}
                      className="text-muted-foreground/40 hover:text-red-500 transition-fast"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setScheduleOpen(true)}
                    className="text-xs text-muted-foreground/60 hover:text-foreground transition-fast"
                  >
                    — not scheduled
                  </button>
                )
              )}
            </MetaRow>

            {/* Estimate */}
            <MetaRow label="Estimate" icon={<Clock size={13} />}>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={isCreating ? estimateMins : (task?.estimateMinutes ?? "")}
                  onChange={(e) => {
                    if (isCreating) setEstimateMins(e.target.value ? Number(e.target.value) : "");
                    else save({ estimateMinutes: e.target.value ? Number(e.target.value) : undefined });
                  }}
                  className="w-14 text-sm bg-transparent outline-none text-foreground"
                  placeholder="—"
                  min={0}
                  step={5}
                />
                <span className="text-xs text-muted-foreground">min</span>
                {(isCreating ? (estimateMins || 0) : (task?.estimateMinutes ?? 0)) > 0 && (
                  <span className="text-xs text-muted-foreground/50">
                    ({Math.round(Number(isCreating ? estimateMins : task?.estimateMinutes) / 60 * 10) / 10}h)
                  </span>
                )}
              </div>
            </MetaRow>
          </div>

          {/* Checklist */}
          <div className="px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                Checklist
                {totalChecklist > 0 && (
                  <span className="ml-1.5 normal-case font-normal text-muted-foreground/40">
                    {completedChecklist}/{totalChecklist}
                  </span>
                )}
              </span>
            </div>

            {totalChecklist > 0 && (
              <div className="mb-3 h-1 rounded-full bg-border overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-500"
                  style={{ width: `${(completedChecklist / totalChecklist) * 100}%` }}
                />
              </div>
            )}

            <div className="space-y-1 mb-2">
              {(isCreating ? checklistItems : (task?.checklistItems ?? [])).map((item) => (
                <div key={item.id} className="group flex items-center gap-2 py-1">
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
                      item.checked ? "text-green-500" : "text-muted-foreground/30 hover:text-primary"
                    )}
                  >
                    {item.checked ? <CheckSquare size={14} /> : <Circle size={14} />}
                  </button>
                  <span className={cn("flex-1 text-sm", item.checked && "line-through text-muted-foreground/40")}>
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
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground/40 hover:text-red-500 transition-fast"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Plus size={13} className="text-muted-foreground/40 shrink-0" />
              <input
                value={newCheckItem}
                onChange={(e) => setNewCheckItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newCheckItem.trim()) {
                    if (isCreating) {
                      setChecklistItems((prev) => [
                        ...prev,
                        { id: crypto.randomUUID(), text: newCheckItem.trim(), checked: false },
                      ]);
                    } else {
                      void addChecklistItem(task!.id, newCheckItem.trim());
                    }
                    setNewCheckItem("");
                  }
                }}
                placeholder="Add item…"
                className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/30"
              />
            </div>
          </div>

          {/* Linked notes — view mode only */}
          {!isCreating && (linkedNotes.length > 0 || linkNoteOpen) && (
            <div className="px-5 pb-4 border-t border-border/50 pt-4">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-2">
                Linked notes
              </p>
              {linkedNotes.map((n) => (
                <button
                  key={n.id}
                  onClick={() => useNoteStore.getState().openNote(n.id)}
                  className="flex items-center gap-2 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-fast w-full"
                >
                  <FileText size={13} className="shrink-0" />
                  <span className="flex-1 truncate text-left">{n.title || "Untitled"}</span>
                  <ExternalLink size={11} className="shrink-0 opacity-40" />
                </button>
              ))}
              {linkNoteOpen && (
                <div className="mt-2 space-y-1">
                  <input
                    autoFocus
                    value={noteSearch}
                    onChange={(e) => setNoteSearch(e.target.value)}
                    placeholder="Search notes…"
                    className="w-full text-sm bg-muted/50 rounded-lg px-3 py-2 outline-none border border-border focus:border-primary/50"
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

        {/* ── Footer ───────────────────────────────── */}
        <div className="flex items-center gap-2 px-5 py-3 border-t border-border shrink-0 bg-muted/20">
          {isCreating ? (
            // Create mode footer
            <>
              {/* Schedule badge in footer if set */}
              {scheduledDate && (
                <span className="flex items-center gap-1.5 text-[11px] text-primary font-medium">
                  <CalendarClock size={11} />
                  {scheduledDate} · {scheduledTime ?? "09:00"}
                </span>
              )}
              <span className="text-[11px] text-muted-foreground/30 hidden sm:flex items-center gap-1.5 ml-auto">
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
                  onClick={() => void handleCreate()}
                  disabled={!title.trim()}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-fast",
                    "bg-primary text-primary-foreground hover:bg-primary/90",
                    "disabled:opacity-40 disabled:cursor-not-allowed"
                  )}
                >
                  {scheduledDate ? "Add & Schedule" : "Add Task"}
                </button>
              </div>
            </>
          ) : (
            // View mode footer
            <>
              <button
                onClick={() => setLinkNoteOpen((v) => !v)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent border border-transparent hover:border-border/60 transition-fast"
              >
                <FileText size={12} /> Link note
              </button>
              <button
                onClick={() => setScheduleOpen((v) => !v)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-fast",
                  task?.scheduledDate
                    ? "text-primary border-primary/30 bg-primary/8 hover:bg-primary/15"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent border-transparent hover:border-border/60"
                )}
              >
                <CalendarClock size={12} />
                {task?.scheduledDate ? `Scheduled · ${task.scheduledDate}` : "Schedule"}
              </button>
              <div className="flex-1" />
              <span className="text-[10px] text-muted-foreground/40">ID: {task?.id.slice(0, 8)}</span>
            </>
          )}
        </div>
      </Modal>

      {/* Schedule panel — rendered outside Modal to avoid z-index stacking */}
      {scheduleOpen && SchedulePanel}

      {/* Status popover */}
      <Popover anchor={statusAnchor} open={statusOpen} onClose={() => setStatusOpen(false)} className="w-44">
        {STATUS_OPTIONS.map((s) => (
          <PopoverItem
            key={s.value}
            active={(isCreating ? status : task?.status) === s.value}
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

      {/* Priority popover */}
      <Popover anchor={priorityAnchor} open={priorityOpen} onClose={() => setPriorityOpen(false)} className="w-44">
        {(["urgent", "high", "medium", "low", "none"] as const).map((p) => (
          <PopoverItem
            key={p}
            active={(isCreating ? priority : task?.priority) === p}
            icon={Flag}
            onClick={() => {
              if (isCreating) setPriority(p);
              else save({ priority: p });
              setPriorityOpen(false);
            }}
          >
            {PRIORITY_LABELS[p]}
          </PopoverItem>
        ))}
      </Popover>

      {/* Project popover */}
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
              <ProjectDot color={p.color} size={7} />{p.name}
            </span>
          </PopoverItem>
        ))}
      </Popover>
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────────

function MetaRow({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-5 py-2.5">
      <span className="text-muted-foreground/50 shrink-0">{icon}</span>
      <span className="text-[12px] text-muted-foreground w-20 shrink-0 font-medium">{label}</span>
      <div className="flex-1 text-[13px]">{children}</div>
    </div>
  );
}
