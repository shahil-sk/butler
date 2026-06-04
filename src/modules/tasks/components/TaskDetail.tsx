import { useState, useEffect, useRef, useMemo } from "react";
import {
  X, Flag, Calendar, Clock, Plus, Trash2, Sparkles,
  CheckSquare, Circle, ChevronDown, FolderKanban,
  FileText, ExternalLink, CalendarClock, Play, Lock, RefreshCw, Target
} from "lucide-react";
import { cn, formatDate, PRIORITY_COLORS, PRIORITY_LABELS, today, now } from "@/shared/utils";
import { Modal, Popover, PopoverItem, PopoverDivider, ProjectDot, SectionLabel } from "@/shared/ui";
import { useTaskStore } from "../store";
import { useProjectStore } from "@/modules/projects/store";
import { useNoteStore } from "@/modules/notes/store";
import { useCalendarStore } from "@/modules/calendar/store";
import { useGoalsStore } from "@/modules/goals/store";
import { bus } from "@/kernel/event-bus";
import type { Task, Priority, TaskStatus, RecurrenceRule } from "@/shared/types";
import { EntityBadge } from "@/shared/EntityBadge";
import { NoteEditor } from "@/modules/notes/components/NoteEditor";

function parseDurationToMinutes(val: string): number | undefined {
  const clean = val.trim().toLowerCase();
  if (!clean) return undefined;

  // Check if raw number
  if (/^\d+$/.test(clean)) {
    return parseInt(clean, 10);
  }

  let totalMinutes = 0;
  let matched = false;

  // Match hours: e.g. "1.5h" or "1 h" or "2hours"
  const hrMatch = clean.match(/(\d+(?:\.\d+)?)\s*h/);
  if (hrMatch) {
    totalMinutes += parseFloat(hrMatch[1]) * 60;
    matched = true;
  }

  // Match minutes: e.g. "30m" or "45 m" or "15mins"
  const minMatch = clean.match(/(\d+)\s*m/);
  if (minMatch) {
    totalMinutes += parseInt(minMatch[1], 10);
    matched = true;
  }

  // If no h/m matches but it has a dot (e.g. "1.5" representing hours)
  if (!matched && /^\d+\.\d+$/.test(clean)) {
    return parseFloat(clean) * 60;
  }

  return matched ? Math.round(totalMinutes) : undefined;
}

function formatMinutesToDurationString(mins: number): string {
  if (!mins) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

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
  const activeGoals    = useGoalsStore((s) => s.goals.filter((g) => g.status === "active" || g.status === "draft"));
  const allGoals       = useGoalsStore((s) => s.goals);
  const allNotes       = useNoteStore((s) => s.notes);
  const allEvents      = useCalendarStore((s) => s.events);

  // Determine mode
  const isCreating = quickAddOpen && !openTaskId;
  const task       = openTaskId ? getTaskById(openTaskId) : null;

  const project       = task?.projectId ? allProjects.find((p) => p.id === task.projectId) : undefined;
  const goal          = task?.goalId ? allGoals.find((g) => g.id === task.goalId) : undefined;
  const linkedNotes   = allNotes.filter((n)  => task?.linkedNoteIds.includes(n.id));
  const linkedEvents  = allEvents.filter((e) => task?.linkedEventIds.includes(e.id));

  // ── local state ───────────────────────────────────────────
  const [title,         setTitle]         = useState("");
  const [description,   setDescription]   = useState("");
  const [dueDate,       setDueDate]       = useState("");
  const [priority,      setPriority]      = useState<Priority>("none");
  const [projectId,     setProjectId]     = useState("");
  const [goalId,        setGoalId]        = useState("");
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
  const [estimateInputStr, setEstimateInputStr] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dependencies states
  const depAnchor = useRef<HTMLButtonElement>(null);
  const [depOpen, setDepOpen] = useState(false);
  const [depSearch, setDepSearch] = useState("");
  const [tempDependencies, setTempDependencies] = useState<string[]>([]);

  // Recurrence state
  type RecurFreq = "none" | "daily" | "weekly" | "monthly" | "yearly" | "custom";
  const [recurFreq,      setRecurFreq]      = useState<RecurFreq>("none");
  const [recurInterval,  setRecurInterval]  = useState(1);
  const [recurDays,      setRecurDays]      = useState<number[]>([]); // 0=Sun,6=Sat
  const [recurEndDate,   setRecurEndDate]   = useState("");

  const buildRecurrence = (): RecurrenceRule | undefined => {
    if (recurFreq === "none") return undefined;
    const rule: RecurrenceRule = {
      frequency: recurFreq === "custom" ? "custom" : recurFreq,
      interval:  recurInterval,
    };
    if (recurFreq === "weekly" && recurDays.length > 0) rule.daysOfWeek = recurDays;
    if (recurEndDate) rule.endDate = recurEndDate;
    return rule;
  };

  // Popover anchors
  const statusAnchor   = useRef<HTMLButtonElement>(null);
  const priorityAnchor = useRef<HTMLButtonElement>(null);
  const projectAnchor  = useRef<HTMLButtonElement>(null);
  const goalAnchor     = useRef<HTMLButtonElement>(null);
  const [statusOpen,   setStatusOpen]   = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [projectOpen,  setProjectOpen]  = useState(false);
  const [goalOpen,     setGoalOpen]     = useState(false);

  const titleRef = useRef<HTMLInputElement>(null);

  const allTasksForDeps = useTaskStore((s) => s.tasks);
  const currentDeps = isCreating ? tempDependencies : (task?.dependencies ?? []);

  const candidateBlockers = useMemo(() => {
    return allTasksForDeps.filter((t) => {
      if (t.status === "done" || t.status === "archived") return false;
      if (task && t.id === task.id) return false;
      if (currentDeps.includes(t.id)) return false;
      if (depSearch.trim() && !t.title.toLowerCase().includes(depSearch.toLowerCase())) return false;
      if (task) {
        const dependsOnRecursive = (startId: string, targetId: string, visited = new Set<string>()): boolean => {
          if (startId === targetId) return true;
          if (visited.has(startId)) return false;
          visited.add(startId);
          const startTask = allTasksForDeps.find(x => x.id === startId);
          if (!startTask || !startTask.dependencies) return false;
          return startTask.dependencies.some(depId => dependsOnRecursive(depId, targetId, visited));
        };
        if (dependsOnRecursive(t.id, task.id)) return false;
      }
      return true;
    }).slice(0, 10);
  }, [allTasksForDeps, task, currentDeps, depSearch]);

  const handleAddDependency = (depId: string) => {
    if (isCreating) {
      setTempDependencies((prev) => [...prev, depId]);
    } else if (task) {
      save({ dependencies: [...(task.dependencies ?? []), depId] });
    }
    setDepOpen(false);
    setDepSearch("");
  };

  const handleRemoveDependency = (depId: string) => {
    if (isCreating) {
      setTempDependencies((prev) => prev.filter((id) => id !== depId));
    } else if (task) {
      save({ dependencies: (task.dependencies ?? []).filter((id) => id !== depId) });
    }
  };

  // Sync local state from task (view mode) or prefill (create mode)
  useEffect(() => {
    if (isCreating) {
      setTitle(quickAddPrefill.title ?? "");
      setDescription("");
      setDueDate(quickAddPrefill.dueDate ?? "");
      setPriority((quickAddPrefill.priority as Priority) ?? "none");
      setProjectId(quickAddPrefill.projectId ?? "");
      setGoalId(quickAddPrefill.goalId ?? "");
      setStatus("todo");
      setEstimateMins("");
      setEstimateInputStr("");
      setTempDependencies([]);
      setDepOpen(false);
      setDepSearch("");
      setChecklistItems([]);
      setNewCheckItem("");
      setLinkNoteOpen(false);
      setNoteSearch("");
      setScheduledDate(undefined);
      setScheduledTime(undefined);
      setScheduleDate(today());
      setScheduleTime("09:00");
      setRecurFreq("none");
      setRecurInterval(1);
      setRecurDays([]);
      setRecurEndDate("");
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
      setGoalId(task.goalId ?? "");
      setStatus(task.status);
      setEstimateMins(task.estimateMinutes ?? "");
      setEstimateInputStr(task.estimateMinutes ? formatMinutesToDurationString(task.estimateMinutes) : "");
      setDepOpen(false);
      setDepSearch("");
      // Pre-fill schedule panel from existing scheduledDate if any
      if (task.scheduledDate) {
        setScheduleDate(task.scheduledDate);
      } else {
        setScheduleDate(today());
        setScheduleTime("09:00");
      }
      // Pre-fill recurrence
      if (task.recurrence) {
        setRecurFreq(task.recurrence.frequency as RecurFreq);
        setRecurInterval(task.recurrence.interval || 1);
        setRecurDays(task.recurrence.daysOfWeek ?? []);
        setRecurEndDate(task.recurrence.endDate ?? "");
      } else {
        setRecurFreq("none");
        setRecurInterval(1);
        setRecurDays([]);
        setRecurEndDate("");
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
    if (isSubmitting) return;
    if (!title.trim()) { titleRef.current?.focus(); return; }
    setIsSubmitting(true);
    try {
      await createTask({
      ...quickAddPrefill,
      title:          title.trim(),
      description:    description.trim() || undefined,
      dueDate:        dueDate || undefined,
      priority,
      projectId:      projectId || undefined,
      goalId:         goalId || undefined,
      status,
      estimateMinutes: estimateMins !== "" ? Number(estimateMins) : undefined,
      checklistItems: checklistItems.map((item, i) => ({ ...item, order: i })),
      // Include scheduled date if user picked it
      scheduledDate:  scheduledDate || undefined,
      dependencies:   tempDependencies,
      recurrence:     buildRecurrence(),
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
    } finally {
      setIsSubmitting(false);
      closeQuickAdd();
    }
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
            <>
              {/* Start Focus Session */}
              {task?.status !== "done" && (
                <button
                  onClick={() => {
                    bus.emit("focus:start-requested", { taskId: task!.id });
                    closeTask();
                  }}
                  className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-fast"
                  title="Start Focus Session"
                >
                  <Play size={13} className="fill-current" />
                </button>
              )}

              {/* Schedule in Planner */}
              {!task?.scheduledDate && task?.status !== "done" && (
                <button
                  onClick={() => {
                    bus.emit("task:schedule-in-planner", { task: task! });
                  }}
                  className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-fast"
                  title="Schedule in Planner"
                >
                  <Calendar size={13} />
                </button>
              )}

              <button
                onClick={() => { void deleteTask(task!.id); closeTask(); }}
                className="p-1.5 rounded text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-fast"
                title="Delete task"
              >
                <Trash2 size={13} />
              </button>
            </>
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

          {!projectId && !goalId && (
            <div className="mx-5 mb-4 p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs text-amber-600 dark:text-amber-400 flex items-start gap-2 animate-fade-in">
              <Target size={14} className="shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-0.5">Missing alignment</p>
                <p className="opacity-90 leading-relaxed">This task isn't aligned with any project or goal. Is that intentional? Pure inbox capture is fine, but consider assigning it to a larger objective.</p>
              </div>
            </div>
          )}

          {/* Metadata grid */}
          <div className="border-y border-border divide-y divide-border/50">

            {/* Project */}
            <MetaRow label="Project" icon={<FolderKanban size={13} />}>
              <button
                ref={projectAnchor}
                onClick={() => setProjectOpen((v) => !v)}
                className="flex items-center gap-2 text-sm hover:text-primary transition-fast"
              >
                {project
                  ? <><ProjectDot color={project.color} size={8} />{project.name}</>
                  : <span className="text-muted-foreground/60 text-xs">No project</span>}
                <ChevronDown size={11} className="opacity-40" />
              </button>
            </MetaRow>

            {/* Goal */}
            <MetaRow label="Goal" icon={<Target size={13} />}>
              <button
                ref={goalAnchor}
                onClick={() => setGoalOpen((v) => !v)}
                className="flex items-center gap-2 text-sm hover:text-primary transition-fast"
              >
                {goal
                  ? <><span className="text-muted-foreground" style={{ color: goal.color }}>{goal.icon || "🎯"}</span> {goal.title}</>
                  : <span className="text-muted-foreground/60 text-xs">No goal aligned</span>}
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

            {/* Recurrence */}
            <MetaRow label="Repeat" icon={<RefreshCw size={13} />}>
              <div className="flex flex-col gap-2 w-full">
                {/* Frequency pills */}
                <div className="flex flex-wrap gap-1">
                  {(["none", "daily", "weekly", "monthly", "yearly"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => {
                        setRecurFreq(f);
                        if (!isCreating) save({ recurrence: f === "none" ? undefined : { frequency: f, interval: recurInterval, daysOfWeek: recurDays.length ? recurDays : undefined, endDate: recurEndDate || undefined } });
                      }}
                      className={cn(
                        "px-2 py-0.5 rounded-md text-[11px] font-medium border transition-all duration-150",
                        recurFreq === f
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border/50 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                      )}
                    >
                      {f === "none" ? "None" : f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>

                {/* Weekly day picker */}
                {recurFreq === "weekly" && (
                  <div className="flex gap-1">
                    {["S","M","T","W","T","F","S"].map((day, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          const next = recurDays.includes(i)
                            ? recurDays.filter((d) => d !== i)
                            : [...recurDays, i];
                          setRecurDays(next);
                          if (!isCreating) save({ recurrence: { frequency: "weekly", interval: recurInterval, daysOfWeek: next, endDate: recurEndDate || undefined } });
                        }}
                        className={cn(
                          "w-6 h-6 rounded-full text-[10px] font-bold border transition-all duration-150",
                          recurDays.includes(i)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border/50 text-muted-foreground hover:border-primary/50"
                        )}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                )}

                {/* Interval + end date for non-none */}
                {recurFreq !== "none" && (
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-muted-foreground">Every</span>
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={recurInterval}
                        onChange={(e) => {
                          const v = Math.max(1, parseInt(e.target.value) || 1);
                          setRecurInterval(v);
                          if (!isCreating) save({ recurrence: buildRecurrence() });
                        }}
                        className="w-12 text-xs bg-muted/30 border border-border/50 rounded-md px-1.5 py-0.5 outline-none focus:border-primary/50 text-center"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-muted-foreground">Until</span>
                      <input
                        type="date"
                        value={recurEndDate}
                        onChange={(e) => {
                          setRecurEndDate(e.target.value);
                          if (!isCreating) save({ recurrence: buildRecurrence() });
                        }}
                        className="text-xs bg-muted/30 border border-border/50 rounded-md px-1.5 py-0.5 outline-none focus:border-primary/50"
                      />
                    </div>
                  </div>
                )}
              </div>
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

            {/* Estimate with Natural Text + Slider */}
            <MetaRow label="Estimate" icon={<Clock size={13} />}>
              <div className="flex flex-col gap-2 w-full max-w-[280px]">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={estimateInputStr}
                    onChange={(e) => setEstimateInputStr(e.target.value)}
                    onBlur={() => {
                      const mins = parseDurationToMinutes(estimateInputStr);
                      if (mins !== undefined) {
                        if (isCreating) {
                          setEstimateMins(mins);
                          setEstimateInputStr(formatMinutesToDurationString(mins));
                        } else {
                          save({ estimateMinutes: mins });
                          setEstimateInputStr(formatMinutesToDurationString(mins));
                        }
                      } else if (estimateInputStr === "") {
                        if (isCreating) {
                          setEstimateMins("");
                          setEstimateInputStr("");
                        } else {
                          save({ estimateMinutes: undefined });
                          setEstimateInputStr("");
                        }
                      } else {
                        // revert
                        const currentMins = isCreating ? estimateMins : (task?.estimateMinutes ?? "");
                        setEstimateInputStr(currentMins !== "" ? formatMinutesToDurationString(Number(currentMins)) : "");
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                    className="w-24 text-sm bg-muted/30 border border-border/50 rounded-lg px-2 py-1 outline-none focus:border-primary/50 text-foreground font-medium"
                    placeholder="e.g. 1h 30m"
                  />
                  {/* Human-friendly display of parsed value */}
                  {((isCreating ? estimateMins : task?.estimateMinutes) || 0) > 0 && (
                    <span className="text-xs text-muted-foreground/60 font-medium">
                      = {isCreating ? estimateMins : task?.estimateMinutes} min
                    </span>
                  )}
                </div>
                {/* Slider */}
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={240}
                    step={5}
                    value={Number(isCreating ? estimateMins : (task?.estimateMinutes ?? 0))}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (isCreating) {
                        setEstimateMins(val || "");
                        setEstimateInputStr(val ? formatMinutesToDurationString(val) : "");
                      } else {
                        save({ estimateMinutes: val || undefined });
                        setEstimateInputStr(val ? formatMinutesToDurationString(val) : "");
                      }
                    }}
                    className="flex-1 h-1 rounded-lg bg-border accent-primary cursor-pointer appearance-none"
                  />
                  <span className="text-[10px] text-muted-foreground/50 shrink-0 select-none">
                    max 4h
                  </span>
                </div>
              </div>
            </MetaRow>

            {/* Blocked by (Dependencies) */}
            <MetaRow label="Blocked by" icon={<Lock size={13} />}>
              <div className="flex flex-col gap-2 w-full">
                {/* Dependency Pills */}
                <div className="flex flex-wrap gap-1.5">
                  {(isCreating ? tempDependencies : (task?.dependencies ?? [])).map((depId) => (
                    <div key={depId} className="flex items-center gap-0.5 rounded bg-muted/60 border border-border/45 pl-1 pr-0.5 py-0.5">
                      <EntityBadge type="task" id={depId} />
                      <button
                        type="button"
                        onClick={() => handleRemoveDependency(depId)}
                        className="p-0.5 rounded text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-fast"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                  {/* Empty state placeholder */}
                  {((isCreating ? tempDependencies : task?.dependencies)?.length ?? 0) === 0 && (
                    <span className="text-xs text-muted-foreground/40 italic">— no blockers</span>
                  )}
                </div>

                {/* Add dependency button + selector */}
                <div className="relative">
                  <button
                    ref={depAnchor}
                    onClick={() => setDepOpen((v) => !v)}
                    className="text-xs text-primary font-medium hover:underline flex items-center gap-1 mt-1"
                  >
                    <Plus size={11} /> Add blocker
                  </button>
                  <Popover anchor={depAnchor} open={depOpen} onClose={() => setDepOpen(false)} className="w-64 p-2 flex flex-col gap-2 max-h-60 overflow-y-auto">
                    <input
                      type="text"
                      value={depSearch}
                      onChange={(e) => setDepSearch(e.target.value)}
                      placeholder="Search tasks..."
                      className="w-full text-xs bg-muted/50 rounded-lg px-2.5 py-1.5 outline-none border border-border focus:border-primary/50"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex flex-col gap-0.5">
                      {candidateBlockers.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => handleAddDependency(t.id)}
                          className="w-full text-left px-2 py-1.5 rounded text-[11px] hover:bg-accent/80 transition-colors flex items-center gap-2 truncate"
                        >
                          <Circle size={10} className="shrink-0 text-muted-foreground/45" />
                          <span className="truncate">{t.title}</span>
                        </button>
                      ))}
                      {candidateBlockers.length === 0 && (
                        <span className="text-center text-[10px] text-muted-foreground/40 py-2">No other tasks found</span>
                      )}
                    </div>
                  </Popover>
                </div>
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
              {!isCreating && task && (
                <button
                  onClick={async () => {
                    bus.emit("ui:notification", { type: "info", message: "Breaking down task..." });
                    try {
                      const { AIService } = await import("@/modules/ai/service");
                      const steps = await AIService.breakdownTask(task.title, task.description || undefined);
                      if (steps && steps.length > 0) {
                        for (const step of steps) {
                          await addChecklistItem(task.id, step.title);
                        }
                        bus.emit("ui:notification", { type: "success", message: "Task broken down" });
                      }
                    } catch (e) {
                      bus.emit("ui:notification", { type: "error", message: "Failed to break down task" });
                    }
                  }}
                  className="flex items-center gap-1 text-[11px] font-medium text-indigo-500 hover:text-indigo-400 transition-fast"
                >
                  <Sparkles size={11} /> AI Breakdown
                </button>
              )}
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
                      "shrink-0 w-4.5 h-4.5 rounded-lg border flex items-center justify-center transition-all duration-300 ease-spring active:scale-75",
                      item.checked
                        ? "bg-emerald-500 border-emerald-500 text-white"
                        : "border-border bg-muted/40 hover:border-primary text-transparent"
                    )}
                  >
                    <svg className="w-3 h-3 stroke-current fill-none stroke-[3.5]" viewBox="0 0 24 24">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </button>
                  <span className={cn("flex-1 text-[13.5px] text-foreground/90 font-medium", item.checked && "line-through text-muted-foreground/40")}>
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
                  className="bg-background rounded-lg border border-border shadow-sm overflow-hidden flex flex-col mt-2"
                >
                  <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30 group">
                    <div className="flex items-center gap-2">
                      <FileText size={14} className="text-muted-foreground" />
                      <input
                        value={n.title}
                        onChange={(e) => useNoteStore.getState().updateNote(n.id, { title: e.target.value })}
                        placeholder="Untitled Note"
                        className="text-sm font-semibold bg-transparent outline-none flex-1 min-w-0"
                      />
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => useNoteStore.getState().openNote(n.id)}
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                        title="Open in Notes"
                      >
                        <ExternalLink size={12} />
                      </button>
                      <button
                        onClick={() => {
                          if (task) save({ linkedNoteIds: task.linkedNoteIds.filter(id => id !== n.id) });
                        }}
                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-muted rounded"
                        title="Unlink Note"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="p-3 bg-background">
                    <NoteEditor note={n} className="min-h-[150px]" />
                  </div>
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
                  disabled={!title.trim() || isSubmitting}
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
              if (isCreating) {
                setStatus(s.value);
              } else {
                if (s.value === "done" && task?.status !== "done") {
                  void useTaskStore.getState().completeTask(task!.id);
                } else if (task?.status === "done" && s.value !== "done") {
                  void useTaskStore.getState().restoreTask(task!.id);
                  if (s.value !== "todo") {
                    save({ status: s.value });
                  }
                } else {
                  save({ status: s.value });
                }
              }
              setStatusOpen(false);
            }}
          >
            {s.label}
          </PopoverItem>
        ))}
      </Popover>

      {/* Goal Popover */}
      <Popover open={goalOpen} anchor={goalAnchor} onClose={() => setGoalOpen(false)}>
        <PopoverItem
          onClick={() => {
            setGoalId("");
            if (!isCreating) save({ goalId: null as any });
            setGoalOpen(false);
          }}
        >
          <span className="flex-1 text-sm font-medium">No goal aligned</span>
          {!goalId && <CheckSquare size={14} className="text-primary" />}
        </PopoverItem>
        <PopoverDivider />
        {activeGoals.map((g) => (
          <PopoverItem
            key={g.id}
            onClick={() => {
              setGoalId(g.id);
              if (!isCreating) save({ goalId: g.id });
              setGoalOpen(false);
            }}
          >
            <div className="flex items-center gap-2 flex-1">
              <span className="text-[10px]" style={{ color: g.color }}>{g.icon || "🎯"}</span>
              <span className="text-sm font-medium text-foreground">{g.title}</span>
            </div>
            {goalId === g.id && <CheckSquare size={14} className="text-primary" />}
          </PopoverItem>
        ))}
      </Popover>

      {/* Eisenhower Matrix Priority popover */}
      <Popover anchor={priorityAnchor} open={priorityOpen} onClose={() => setPriorityOpen(false)} className="w-[300px] p-4 flex flex-col gap-3 rounded-2xl shadow-premium border border-border bg-popover/95 backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-300 ease-spring">
        <div>
          <p className="text-xs font-extrabold text-foreground">Eisenhower Matrix</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Select priority quadrant</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {/* Urgent & Important */}
          <button
            onClick={() => {
              if (isCreating) setPriority("urgent");
              else save({ priority: "urgent" });
              setPriorityOpen(false);
            }}
            className={cn(
              "flex flex-col items-start p-3 rounded-xl border text-left transition-all duration-300 ease-spring active:scale-95",
              (isCreating ? priority : task?.priority) === "urgent"
                ? "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400 font-extrabold shadow-sm"
                : "border-border/60 hover:bg-accent/40"
            )}
          >
            <span className="text-[9px] uppercase font-extrabold text-red-500 tracking-wider">Q1: Urgent</span>
            <span className="text-[11px] leading-tight text-foreground/80 mt-1 font-semibold">&amp; Important</span>
          </button>

          {/* Important & Not Urgent */}
          <button
            onClick={() => {
              if (isCreating) setPriority("high");
              else save({ priority: "high" });
              setPriorityOpen(false);
            }}
            className={cn(
              "flex flex-col items-start p-3 rounded-xl border text-left transition-all duration-300 ease-spring active:scale-95",
              (isCreating ? priority : task?.priority) === "high"
                ? "bg-orange-500/10 border-orange-500/30 text-orange-600 dark:text-orange-400 font-extrabold shadow-sm"
                : "border-border/60 hover:bg-accent/40"
            )}
          >
            <span className="text-[9px] uppercase font-extrabold text-orange-500 tracking-wider">Q2: Important</span>
            <span className="text-[11px] leading-tight text-foreground/80 mt-1 font-semibold">Not Urgent</span>
          </button>

          {/* Urgent & Not Important */}
          <button
            onClick={() => {
              if (isCreating) setPriority("medium");
              else save({ priority: "medium" });
              setPriorityOpen(false);
            }}
            className={cn(
              "flex flex-col items-start p-3 rounded-xl border text-left transition-all duration-300 ease-spring active:scale-95",
              (isCreating ? priority : task?.priority) === "medium"
                ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-600 dark:text-yellow-400 font-extrabold shadow-sm"
                : "border-border/60 hover:bg-accent/40"
            )}
          >
            <span className="text-[9px] uppercase font-extrabold text-yellow-600 dark:text-yellow-400 tracking-wider">Q3: Urgent</span>
            <span className="text-[11px] leading-tight text-foreground/80 mt-1 font-semibold">Not Important</span>
          </button>

          {/* Not Urgent & Not Important (Low) */}
          <button
            onClick={() => {
              if (isCreating) setPriority("low");
              else save({ priority: "low" });
              setPriorityOpen(false);
            }}
            className={cn(
              "flex flex-col items-start p-3 rounded-xl border text-left transition-all duration-300 ease-spring active:scale-95",
              (isCreating ? priority : task?.priority) === "low"
                ? "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400 font-extrabold shadow-sm"
                : "border-border/60 hover:bg-accent/40"
            )}
          >
            <span className="text-[9px] uppercase font-extrabold text-blue-500 tracking-wider">Q4: Neither</span>
            <span className="text-[11px] leading-tight text-foreground/80 mt-1 font-semibold">(Low Priority)</span>
          </button>
        </div>
        <button
          onClick={() => {
            if (isCreating) setPriority("none");
            else save({ priority: "none" });
            setPriorityOpen(false);
          }}
          className="w-full py-2 rounded-xl border border-border text-[11px] font-bold text-muted-foreground hover:bg-accent/60 transition-all duration-300 ease-spring active:scale-95"
        >
          Clear Priority (None)
        </button>
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
