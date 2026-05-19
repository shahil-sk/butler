import { useState, useEffect, useRef, useCallback } from "react";
import {
  X, Flag, Calendar, Clock, Plus, Trash2,
  CheckSquare, Circle, FolderKanban,
  FileText, ExternalLink, CalendarClock,
  ChevronDown, LayoutList, Link2, AlertTriangle,
} from "lucide-react";
import {
  cn, formatDate, PRIORITY_COLORS, PRIORITY_LABELS, today,
} from "@/shared/utils";
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

// ─── Constants ────────────────────────────────────────────────

const STATUS_OPTIONS: { value: TaskStatus; label: string; color: string }[] = [
  { value: "todo",        label: "To do",       color: "text-muted-foreground" },
  { value: "in_progress", label: "In progress", color: "text-blue-500" },
  { value: "done",        label: "Done",        color: "text-emerald-500" },
  { value: "cancelled",   label: "Cancelled",   color: "text-muted-foreground/50" },
];

const PRIORITY_OPTIONS: { value: Priority; color: string }[] = [
  { value: "urgent", color: "text-red-500" },
  { value: "high",   color: "text-orange-500" },
  { value: "medium", color: "text-yellow-500" },
  { value: "low",    color: "text-blue-400" },
  { value: "none",   color: "text-muted-foreground/50" },
];

type Tab = "details" | "checklist" | "links";

// ─── Sub-components ───────────────────────────────────────────

/** Thin horizontal divider */
function Divider() {
  return <div className="border-t border-border/60 my-0" />;
}

/** Sidebar meta row */
function SideRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-2.5 group">
      <span className="mt-0.5 shrink-0 text-muted-foreground/40">{icon}</span>
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40 leading-none">
          {label}
        </span>
        <div className="text-[13px] leading-snug">{children}</div>
      </div>
    </div>
  );
}

/** Status badge chip */
function StatusChip({
  status,
  onClick,
  btnRef,
}: {
  status: TaskStatus;
  onClick: () => void;
  btnRef: React.RefObject<HTMLButtonElement>;
}) {
  const opt = STATUS_OPTIONS.find((o) => o.value === status) ?? STATUS_OPTIONS[0];
  return (
    <button
      ref={btnRef}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold transition-colors",
        "border hover:border-border bg-transparent",
        status === "done"        && "border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
        status === "in_progress" && "border-blue-500/30 text-blue-600 dark:text-blue-400",
        status === "cancelled"   && "border-border text-muted-foreground/50 line-through",
        status === "todo"        && "border-border text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          status === "done"        && "bg-emerald-500",
          status === "in_progress" && "bg-blue-500",
          status === "cancelled"   && "bg-muted-foreground/30",
          status === "todo"        && "bg-muted-foreground/50",
        )}
      />
      {opt.label}
      <ChevronDown size={9} className="opacity-50" />
    </button>
  );
}

/** Tab bar for the right sidebar */
function SidebarTabs({
  active,
  onChange,
  checklistCount,
  linksCount,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
  checklistCount: number;
  linksCount: number;
}) {
  const tabs: { id: Tab; icon: React.ReactNode; label: string; badge?: number }[] = [
    { id: "details",   icon: <FolderKanban size={12} />, label: "Details" },
    { id: "checklist", icon: <LayoutList size={12} />,  label: "Checklist", badge: checklistCount },
    { id: "links",     icon: <Link2 size={12} />,        label: "Links",     badge: linksCount },
  ];
  return (
    <div className="flex items-center border-b border-border/60 shrink-0">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-medium transition-colors border-b-[1.5px] -mb-px",
            active === t.id
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {t.icon}
          {t.label}
          {t.badge !== undefined && t.badge > 0 && (
            <span className="min-w-[16px] text-center bg-muted rounded-full text-[10px] px-1 tabular-nums">
              {t.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Schedule panel (modal overlay) ──────────────────────────

function SchedulePanel({
  isCreating,
  scheduleDate,
  scheduleTime,
  scheduledDate,
  scheduledTime,
  taskScheduledDate,
  onDateChange,
  onTimeChange,
  onClose,
  onConfirm,
  onClearExisting,
}: {
  isCreating: boolean;
  scheduleDate: string;
  scheduleTime: string;
  scheduledDate?: string;
  scheduledTime?: string;
  taskScheduledDate?: string;
  onDateChange: (v: string) => void;
  onTimeChange: (v: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  onClearExisting: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative z-10 bg-popover border border-border rounded-2xl shadow-2xl p-5 w-80 animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold">
            {isCreating ? "Schedule task" : "Schedule to calendar"}
          </p>
          <button onClick={onClose} className="p-1 rounded text-muted-foreground hover:text-foreground">
            <X size={13} />
          </button>
        </div>

        {/* Existing badge */}
        {!isCreating && taskScheduledDate && (
          <div className="flex items-center gap-2 mb-3 px-2.5 py-2 rounded-lg bg-primary/8 text-primary text-xs font-medium">
            <CalendarClock size={12} />
            <span className="flex-1">Scheduled: {taskScheduledDate}</span>
            <button
              onClick={onClearExisting}
              className="text-muted-foreground hover:text-red-500 transition-fast"
              title="Remove"
            >
              <X size={11} />
            </button>
          </div>
        )}
        {isCreating && scheduledDate && (
          <div className="flex items-center gap-2 mb-3 px-2.5 py-2 rounded-lg bg-primary/8 text-primary text-xs font-medium">
            <CalendarClock size={12} />
            <span className="flex-1">
              {scheduledDate} · {scheduledTime ?? "09:00"}
            </span>
            <button onClick={onClearExisting} className="text-muted-foreground hover:text-red-500">
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
              className="w-full text-sm bg-muted/50 rounded-lg px-3 py-2 outline-none border border-border focus:border-primary/50"
            />
          </div>
          <div>
            <label className="block text-[11px] text-muted-foreground mb-1">Time</label>
            <input
              type="time"
              value={scheduleTime}
              onChange={(e) => onTimeChange(e.target.value)}
              className="w-full text-sm bg-muted/50 rounded-lg px-3 py-2 outline-none border border-border focus:border-primary/50"
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
            className="flex-1 px-3 py-2 rounded-lg text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-fast font-semibold"
          >
            {isCreating ? "Set schedule" : "Add to calendar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────

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
  const linkedEvents = allEvents.filter((e) => task?.linkedEventIds.includes(e.id));

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

  const [tab,            setTab]            = useState<Tab>("details");
  const [noteSearch,     setNoteSearch]     = useState("");
  const [linkNoteOpen,   setLinkNoteOpen]   = useState(false);

  // Schedule
  const [scheduleOpen,   setScheduleOpen]   = useState(false);
  const [scheduleDate,   setScheduleDate]   = useState(today());
  const [scheduleTime,   setScheduleTime]   = useState("09:00");
  const [scheduledDate,  setScheduledDate]  = useState<string | undefined>(undefined);
  const [scheduledTime,  setScheduledTime]  = useState<string | undefined>(undefined);

  // Popovers
  const statusAnchor   = useRef<HTMLButtonElement>(null);
  const priorityAnchor = useRef<HTMLButtonElement>(null);
  const projectAnchor  = useRef<HTMLButtonElement>(null);
  const [statusOpen,   setStatusOpen]   = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const [projectOpen,  setProjectOpen]  = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  // ── sync state ────────────────────────────────────────────

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
      setTab("details");
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
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") closeQuickAdd(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isCreating, closeQuickAdd]);

  if (!isOpen) return null;

  // ── helpers ───────────────────────────────────────────────

  const save = (patch: Partial<Task>) => {
    if (task) void updateTask(task.id, patch);
  };

  const currentStatus   = isCreating ? status   : (task?.status   ?? "todo");
  const currentPriority = isCreating ? priority : (task?.priority ?? "none");
  const currentProject  = isCreating
    ? activeProjects.find((p) => p.id === projectId)
    : project;

  const checkItems = isCreating ? checklistItems : (task?.checklistItems ?? []);
  const completedCount = checkItems.filter((i) => i.checked).length;

  const filteredNotes = allNotes
    .filter((n) => n.title.toLowerCase().includes(noteSearch.toLowerCase()))
    .slice(0, 8);

  const handleCreate = async () => {
    if (!title.trim()) { titleRef.current?.focus(); return; }
    await createTask({
      ...quickAddPrefill,
      title:           title.trim(),
      description:     description.trim() || undefined,
      dueDate:         dueDate || undefined,
      priority,
      projectId:       projectId || undefined,
      status,
      estimateMinutes: estimateMins !== "" ? Number(estimateMins) : undefined,
      checklistItems:  checklistItems.map((item, i) => ({ ...item, order: i })),
      scheduledDate:   scheduledDate || undefined,
      scheduledTime:   scheduledTime || undefined,
    });
    if (scheduledDate) {
      const time        = scheduledTime ?? "09:00";
      const startAt     = `${scheduledDate}T${time}:00`;
      const durMins     = estimateMins ? Number(estimateMins) : 60;
      const [h, m]      = time.split(":").map(Number);
      const totalEnd    = h * 60 + m + durMins;
      const endAt       = `${scheduledDate}T${String(Math.floor(totalEnd / 60)).padStart(2, "0")}:${String(totalEnd % 60).padStart(2, "0")}:00`;
      await useCalendarStore.getState().createEvent({ title: title.trim(), startAt, endAt, linkedTaskIds: [] });
    }
    closeQuickAdd();
  };

  const handleScheduleToCalendar = async () => {
    if (!task) return;
    const startAt  = `${scheduleDate}T${scheduleTime}:00`;
    const durMins  = task.estimateMinutes ?? 60;
    const [h, m]   = scheduleTime.split(":").map(Number);
    const totalEnd = h * 60 + m + durMins;
    const endAt    = `${scheduleDate}T${String(Math.floor(totalEnd / 60)).padStart(2, "0")}:${String(totalEnd % 60).padStart(2, "0")}:00`;
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

  const handleClose = isCreating ? closeQuickAdd : closeTask;

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

  // ── render ────────────────────────────────────────────────

  return (
    <>
      <Modal
        open={isOpen}
        onClose={handleClose}
        maxWidth="max-w-[760px]"
        maxHeight="max-h-[88dvh]"
      >
        {/* ╔══════════════════════════════════════════════════╗ */}
        {/* ║  DIALOG SHELL: header + two-column body + footer ║ */}
        {/* ╚══════════════════════════════════════════════════╝ */}

        {/* ── Header ──────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-4 h-10 border-b border-border shrink-0 bg-muted/10">
          <StatusChip
            status={currentStatus}
            btnRef={statusAnchor}
            onClick={() => setStatusOpen((v) => !v)}
          />

          <span className="flex-1 text-[11px] text-muted-foreground/50 tabular-nums">
            {isCreating ? "New task" : `Updated ${formatDate(task!.updatedAt)}`}
          </span>

          {!isCreating && (
            <button
              onClick={() => { void deleteTask(task!.id); closeTask(); }}
              className="p-1.5 rounded text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10 transition-fast"
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

        {/* ── Two-column body ──────────────────────────────── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* ── LEFT: main content ─────────────────────────── */}
          <div className="flex flex-col flex-1 min-w-0 overflow-y-auto">

            {/* Title */}
            <div className="px-5 pt-5 pb-2">
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
                className="w-full text-[17px] font-semibold bg-transparent outline-none leading-snug tracking-tight placeholder:text-muted-foreground/30"
                placeholder="Task title…"
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
                className="w-full text-sm text-muted-foreground bg-transparent outline-none resize-none leading-relaxed placeholder:text-muted-foreground/25"
                placeholder="Add notes or description…"
                rows={3}
              />
            </div>

            <Divider />

            {/* Checklist section */}
            <div className="px-5 py-4 flex-1">
              {/* Checklist header */}
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

              {/* Progress bar */}
              {checkItems.length > 0 && (
                <div className="h-1 rounded-full bg-border mb-3 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${(completedCount / checkItems.length) * 100}%` }}
                  />
                </div>
              )}

              {/* Items */}
              <div className="space-y-0.5 mb-3">
                {checkItems.map((item) => (
                  <div key={item.id} className="group flex items-center gap-2.5 py-1.5 rounded-lg hover:bg-accent/30 px-1 -mx-1 transition-colors">
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
                        item.checked ? "text-emerald-500" : "text-muted-foreground/25 hover:text-primary"
                      )}
                    >
                      {item.checked ? <CheckSquare size={14} /> : <Circle size={14} />}
                    </button>
                    <span className={cn("flex-1 text-sm leading-snug", item.checked && "line-through text-muted-foreground/35")}>
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

              {/* Add item input */}
              <div className="flex items-center gap-2 py-1.5 rounded-lg border border-dashed border-border/50 hover:border-border px-3 transition-colors">
                <Plus size={12} className="text-muted-foreground/30 shrink-0" />
                <input
                  value={newCheckItem}
                  onChange={(e) => setNewCheckItem(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addCheckItem(); }}
                  placeholder="Add checklist item…"
                  className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/25"
                />
                {newCheckItem.trim() && (
                  <button
                    onClick={addCheckItem}
                    className="text-[11px] text-primary font-medium hover:opacity-80 transition-fast"
                  >
                    Add
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── RIGHT: sidebar ──────────────────────────────── */}
          <div
            className={cn(
              "w-[220px] shrink-0 border-l border-border/60 flex flex-col",
              "bg-muted/5",
            )}
          >
            {/* Sidebar tabs */}
            <SidebarTabs
              active={tab}
              onChange={setTab}
              checklistCount={checkItems.length}
              linksCount={linkedNotes.length + linkedEvents.length}
            />

            {/* Tab: Details */}
            {tab === "details" && (
              <div className="flex-1 overflow-y-auto divide-y divide-border/40">

                {/* Project */}
                <SideRow icon={<FolderKanban size={13} />} label="Project">
                  <button
                    ref={projectAnchor}
                    onClick={() => setProjectOpen((v) => !v)}
                    className="flex items-center gap-1.5 text-[13px] hover:text-primary transition-fast w-full"
                  >
                    {currentProject
                      ? (
                        <>
                          <ProjectDot color={currentProject.color} size={7} />
                          <span className="truncate">{currentProject.name}</span>
                        </>
                      )
                      : <span className="text-muted-foreground/40 text-xs">No project</span>
                    }
                    <ChevronDown size={10} className="opacity-30 ml-auto shrink-0" />
                  </button>
                </SideRow>

                {/* Priority */}
                <SideRow icon={<Flag size={13} />} label="Priority">
                  <button
                    ref={priorityAnchor}
                    onClick={() => setPriorityOpen((v) => !v)}
                    className={cn(
                      "flex items-center gap-1.5 text-[13px] transition-fast w-full",
                      currentPriority === "urgent" && "text-red-500",
                      currentPriority === "high"   && "text-orange-500",
                      currentPriority === "medium" && "text-yellow-500",
                      currentPriority === "low"    && "text-blue-400",
                      currentPriority === "none"   && "text-muted-foreground/40 text-xs",
                    )}
                  >
                    <Flag size={11} strokeWidth={1.75} />
                    {PRIORITY_LABELS[currentPriority]}
                    <ChevronDown size={10} className="opacity-30 ml-auto shrink-0" />
                  </button>
                </SideRow>

                {/* Due date */}
                <SideRow icon={<Calendar size={13} />} label="Due date">
                  <input
                    type="date"
                    value={isCreating ? dueDate : (task?.dueDate ?? "")}
                    onChange={(e) => {
                      if (isCreating) setDueDate(e.target.value);
                      else save({ dueDate: e.target.value || undefined });
                    }}
                    className="text-[13px] bg-transparent outline-none text-foreground w-full"
                  />
                </SideRow>

                {/* Scheduled */}
                <SideRow icon={<CalendarClock size={13} />} label="Scheduled">
                  {isCreating ? (
                    scheduledDate ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[12px] text-primary font-medium">
                          {scheduledDate}{scheduledTime ? ` · ${scheduledTime}` : ""}
                        </span>
                        <button
                          onClick={() => setScheduleOpen(true)}
                          className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground transition-fast"
                        >
                          change
                        </button>
                        <button
                          onClick={() => { setScheduledDate(undefined); setScheduledTime(undefined); }}
                          className="text-muted-foreground/30 hover:text-red-500 transition-fast"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setScheduleOpen(true)}
                        className="text-[12px] text-muted-foreground/40 hover:text-foreground transition-fast"
                      >
                        — pick date &amp; time
                      </button>
                    )
                  ) : (
                    task?.scheduledDate ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[12px] text-primary font-medium">{task.scheduledDate}</span>
                        <button
                          onClick={() => setScheduleOpen(true)}
                          className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
                        >
                          reschedule
                        </button>
                        <button
                          onClick={() => save({ scheduledDate: undefined })}
                          className="text-muted-foreground/30 hover:text-red-500"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setScheduleOpen(true)}
                        className="text-[12px] text-muted-foreground/40 hover:text-foreground transition-fast"
                      >
                        — not scheduled
                      </button>
                    )
                  )}
                </SideRow>

                {/* Estimate */}
                <SideRow icon={<Clock size={13} />} label="Estimate">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={isCreating ? estimateMins : (task?.estimateMinutes ?? "")}
                      onChange={(e) => {
                        if (isCreating) setEstimateMins(e.target.value ? Number(e.target.value) : "");
                        else save({ estimateMinutes: e.target.value ? Number(e.target.value) : undefined });
                      }}
                      className="w-12 text-[13px] bg-transparent outline-none text-foreground"
                      placeholder="—"
                      min={0}
                      step={5}
                    />
                    <span className="text-[11px] text-muted-foreground/50">min</span>
                    {(() => {
                      const val = Number(isCreating ? estimateMins : (task?.estimateMinutes ?? 0));
                      return val > 0 ? (
                        <span className="text-[11px] text-muted-foreground/40">
                          ({Math.round(val / 60 * 10) / 10}h)
                        </span>
                      ) : null;
                    })()}
                  </div>
                </SideRow>

                {/* Task ID — view mode only */}
                {!isCreating && (
                  <div className="px-4 py-3">
                    <span className="text-[10px] text-muted-foreground/30 font-mono select-all">
                      {task?.id.slice(0, 8)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Checklist summary */}
            {tab === "checklist" && (
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
                {checkItems.length === 0 ? (
                  <p className="text-[12px] text-muted-foreground/40 text-center pt-8">
                    No checklist items yet.
                  </p>
                ) : (
                  checkItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <span className={item.checked ? "text-emerald-500" : "text-muted-foreground/30"}>
                        {item.checked ? <CheckSquare size={13} /> : <Circle size={13} />}
                      </span>
                      <span className={cn("text-[12px] leading-snug flex-1", item.checked && "line-through text-muted-foreground/35")}>
                        {item.text}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab: Links (notes + events) */}
            {tab === "links" && (
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
                {/* Linked notes */}
                {linkedNotes.length > 0 && (
                  <>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-1">
                      Notes
                    </p>
                    {linkedNotes.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => useNoteStore.getState().openNote(n.id)}
                        className="flex items-center gap-2 py-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-fast w-full text-left"
                      >
                        <FileText size={12} className="shrink-0" />
                        <span className="flex-1 truncate">{n.title || "Untitled"}</span>
                        <ExternalLink size={10} className="shrink-0 opacity-30" />
                      </button>
                    ))}
                  </>
                )}

                {/* Link note search */}
                {!isCreating && (
                  <>
                    <button
                      onClick={() => setLinkNoteOpen((v) => !v)}
                      className="flex items-center gap-1.5 text-[12px] text-muted-foreground/50 hover:text-foreground transition-fast mt-1"
                    >
                      <Plus size={12} />
                      Link note
                    </button>
                    {linkNoteOpen && (
                      <div className="mt-1 space-y-1">
                        <input
                          autoFocus
                          value={noteSearch}
                          onChange={(e) => setNoteSearch(e.target.value)}
                          placeholder="Search notes…"
                          className="w-full text-[12px] bg-muted/50 rounded-lg px-2.5 py-1.5 outline-none border border-border focus:border-primary/50"
                        />
                        {filteredNotes.map((n) => (
                          <button
                            key={n.id}
                            onClick={() => handleLinkNote(n.id)}
                            className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded-lg text-[12px] hover:bg-accent transition-fast text-left"
                          >
                            <FileText size={11} className="shrink-0 text-muted-foreground/40" />
                            {n.title || "Untitled"}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {linkedNotes.length === 0 && !linkNoteOpen && isCreating && (
                  <p className="text-[12px] text-muted-foreground/40 text-center pt-8">
                    Links available after saving.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ───────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-t border-border shrink-0 bg-muted/10">
          {isCreating ? (
            <>
              {scheduledDate && (
                <span className="flex items-center gap-1.5 text-[11px] text-primary font-medium">
                  <CalendarClock size={11} />
                  {scheduledDate} · {scheduledTime ?? "09:00"}
                </span>
              )}
              <span className="hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground/25 ml-2">
                <kbd className="px-1 py-0.5 rounded bg-muted text-[9px] font-mono">Enter</kbd> save
                <span className="mx-0.5">·</span>
                <kbd className="px-1 py-0.5 rounded bg-muted text-[9px] font-mono">Esc</kbd> cancel
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
                onClick={() => { setTab("links"); setLinkNoteOpen(true); }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent border border-transparent hover:border-border/50 transition-fast"
              >
                <FileText size={12} /> Link note
              </button>
              <button
                onClick={() => setScheduleOpen((v) => !v)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] border transition-fast",
                  task?.scheduledDate
                    ? "text-primary border-primary/30 bg-primary/8 hover:bg-primary/12"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent border-transparent hover:border-border/50",
                )}
              >
                <CalendarClock size={12} />
                {task?.scheduledDate ? `Scheduled · ${task.scheduledDate}` : "Schedule"}
              </button>
            </>
          )}
        </div>
      </Modal>

      {/* Schedule panel */}
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

      {/* Status popover */}
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
            <span className={cn("flex items-center gap-2", s.color)}>
              <span className={cn("w-1.5 h-1.5 rounded-full bg-current")} />
              {s.label}
            </span>
          </PopoverItem>
        ))}
      </Popover>

      {/* Priority popover */}
      <Popover anchor={priorityAnchor} open={priorityOpen} onClose={() => setPriorityOpen(false)} className="w-44">
        {PRIORITY_OPTIONS.map((p) => (
          <PopoverItem
            key={p.value}
            active={currentPriority === p.value}
            onClick={() => {
              if (isCreating) setPriority(p.value);
              else save({ priority: p.value });
              setPriorityOpen(false);
            }}
          >
            <span className={cn("flex items-center gap-2", p.color)}>
              <Flag size={11} strokeWidth={1.75} />
              {PRIORITY_LABELS[p.value]}
            </span>
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
              <ProjectDot color={p.color} size={7} />
              {p.name}
            </span>
          </PopoverItem>
        ))}
      </Popover>
    </>
  );
}
