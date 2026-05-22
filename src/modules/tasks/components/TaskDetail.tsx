import { useState, useEffect, useRef } from "react";
import {
  Flag, Calendar, Clock, Trash2,
  FolderKanban, FileText, CalendarClock, X, Play, Square,
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
import { MetaPill, StatusChip, STATUS_OPTIONS } from "./TaskMetaPills";
import { TaskSchedulePanel } from "./TaskSchedulePanel";
import { TaskChecklist, TaskLinkedNotes } from "./TaskDetailBody";

export function TaskDetail() {
  const {
    openTaskId, closeTask, getTaskById, updateTask,
    addChecklistItem, toggleChecklistItem, deleteChecklistItem, deleteTask,
    quickAddOpen, quickAddPrefill, closeQuickAdd, createTask,
    startTimer, stopTimer, activeTimerTaskId,
  } = useTaskStore();

  const activeProjects = useProjectStore((s) => s.projects.filter((p) => p.status === "active"));
  const allProjects    = useProjectStore((s) => s.projects);
  const allNotes       = useNoteStore((s) => s.notes);
  const allEvents      = useCalendarStore((s) => s.events);

  const isCreating = quickAddOpen && !openTaskId;
  const task       = openTaskId ? getTaskById(openTaskId) : null;
  const isOpen     = isCreating || (openTaskId != null && task != null);

  const project     = task?.projectId ? allProjects.find((p) => p.id === task.projectId) : undefined;
  const linkedNotes = allNotes.filter((n) => task?.linkedNoteIds.includes(n.id));

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

  const handleClose    = isCreating ? closeQuickAdd : closeTask;
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
              onChange={(e) => {
                setDescription(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = e.target.scrollHeight + "px";
              }}
              onBlur={() => {
                if (!isCreating && description !== (task?.description ?? ""))
                  save({ description: description || undefined });
              }}
              className="w-full text-sm text-muted-foreground bg-transparent outline-none resize-none leading-relaxed placeholder:text-muted-foreground/25 min-h-[2.5rem] overflow-hidden"
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
                max={1440}
                step={5}
              />
              <span className="text-muted-foreground/50">min</span>
            </label>
          </div>

          {/* checklist */}
          <TaskChecklist
            isCreating={isCreating}
            checkItems={checkItems}
            completedCount={completedCount}
            newCheckItem={newCheckItem}
            onNewCheckItemChange={setNewCheckItem}
            onToggle={(id) => {
              if (isCreating) {
                setChecklistItems((prev) =>
                  prev.map((i) => i.id === id ? { ...i, checked: !i.checked } : i)
                );
              } else {
                void toggleChecklistItem(task!.id, id);
              }
            }}
            onDelete={(id) => {
              if (isCreating) {
                setChecklistItems((prev) => prev.filter((i) => i.id !== id));
              } else {
                void deleteChecklistItem(task!.id, id);
              }
            }}
            onAdd={addCheckItem}
            onCreateConfirm={() => void handleCreate()}
          />

          {/* linked notes — view mode only */}
          {!isCreating && (
            <TaskLinkedNotes
              linkedNotes={linkedNotes}
              linkNoteOpen={linkNoteOpen}
              noteSearch={noteSearch}
              filteredNotes={filteredNotes}
              onNoteSearchChange={setNoteSearch}
              onLinkNote={handleLinkNote}
            />
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
              <button
                onClick={() => task && (activeTimerTaskId === task.id ? stopTimer() : startTimer(task.id))}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border transition-fast",
                  activeTimerTaskId === task?.id
                    ? "text-blue-500 border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent border-transparent hover:border-border/50",
                )}
              >
                {activeTimerTaskId === task?.id ? (
                  <><Square size={12} fill="currentColor" /> Stop tracking</>
                ) : (
                  <><Play size={12} fill="currentColor" /> Track time</>
                )}
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
        <TaskSchedulePanel
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
