import { useState, useEffect, useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { 
  X, Calendar as CalIcon, Tag, Clock, ArrowRight, Trash2, Copy, Inbox, Layout, 
  Folder, Network, Repeat, Link as LinkIcon, GitBranch 
} from "lucide-react";
import { useTaskStore } from "../store";
import { useProjectStore } from "@/modules/projects/store";
import type { Task, Priority, RecurrenceRule } from "@/shared/types";
import { cn, getNextRecurrenceDate, today } from "@/shared/utils";

const notes: any[] = [];

export function TaskDetail() {
  const { 
    openTaskId, tasks, closeTask, updateTask, deleteTask, duplicateTask,
    quickAddOpen, closeQuickAdd, createTask, quickAddPrefill
  } = useTaskStore();

  const projects = useProjectStore(s => s.projects);

  const isCreating = quickAddOpen;
  const task = tasks.find(t => t.id === openTaskId);
  
  const isOpen = isCreating || !!task;

  // Local state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("none");
  const [status, setStatus] = useState<string>("todo");
  const [scheduledDate, setScheduledDate] = useState<string>("");
  const [scheduledTime, setScheduledTime] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [dependencies, setDependencies] = useState<string[]>([]);
  const [linkedNoteIds, setLinkedNoteIds] = useState<string[]>([]);
  const [recurFreq, setRecurFreq] = useState("none");
  const [recurDays, setRecurDays] = useState<number[]>([]);
  const [recurDayOfMonth, setRecurDayOfMonth] = useState<number>(1);
  const [estimateMins, setEstimateMins] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"general" | "schedule" | "relations">("general");

  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Sync state
  useEffect(() => {
    if (isCreating) {
      setTitle(quickAddPrefill?.title || "");
      setDescription(quickAddPrefill?.description || "");
      setPriority(quickAddPrefill?.priority || "none");
      setStatus(quickAddPrefill?.status || "todo");
      if (quickAddPrefill?.scheduledDate) {
        const parts = quickAddPrefill.scheduledDate.split("T");
        setScheduledDate(parts[0]);
        setScheduledTime(parts[1]?.slice(0, 5) || "");
      } else {
        setScheduledDate("");
        setScheduledTime("");
      }
      setProjectId(quickAddPrefill?.projectId || "");
      setDependencies([]);
      setLinkedNoteIds([]);
      setRecurFreq("none");
      setEstimateMins("");
    } else if (task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setPriority(task.priority);
      setStatus(task.status);
      if (task.scheduledDate) {
        const parts = task.scheduledDate.split("T");
        setScheduledDate(parts[0]);
        setScheduledTime(parts[1]?.slice(0, 5) || "");
      } else {
        setScheduledDate("");
        setScheduledTime("");
      }
      setProjectId(task.projectId || "");
      setDependencies(task.dependencies || []);
      setLinkedNoteIds(task.linkedNoteIds || []);
      setRecurFreq(task.recurrence?.frequency || "none");
      setRecurDays(task.recurrence?.daysOfWeek || []);
      setRecurDayOfMonth(task.recurrence?.dayOfMonth || 1);
      setEstimateMins(task.estimateMinutes ? String(task.estimateMinutes) : "");
    }
  }, [task, isCreating, quickAddPrefill]);

  // GSAP Animation
  useGSAP(() => {
    if (isOpen && panelRef.current && overlayRef.current) {
      gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power2.out" });
      gsap.fromTo(panelRef.current, 
        { scale: 0.96, opacity: 0 }, 
        { scale: 1, opacity: 1, duration: 0.4, ease: "power3.out" }
      );
    }
  }, [isOpen]);

  const handleClose = () => {
    if (panelRef.current && overlayRef.current) {
      gsap.to(overlayRef.current, { opacity: 0, duration: 0.2 });
      gsap.to(panelRef.current, { 
        scale: 0.98, opacity: 0, duration: 0.2, ease: "power2.in",
        onComplete: () => {
          isCreating ? closeQuickAdd() : closeTask();
        }
      });
    } else {
      isCreating ? closeQuickAdd() : closeTask();
    }
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setIsSubmitting(true);
    
    let recurrenceObj: RecurrenceRule | undefined = undefined;
    if (recurFreq !== "none") {
      recurrenceObj = { 
        frequency: recurFreq as any, 
        interval: 1,
        daysOfWeek: recurFreq === "weekly" && recurDays.length > 0 ? recurDays : undefined,
        dayOfMonth: recurFreq === "monthly" ? recurDayOfMonth : undefined
      };
    }
    const est = estimateMins ? Number(estimateMins) : undefined;

    let finalDate = scheduledDate ? (scheduledTime ? `${scheduledDate}T${scheduledTime}:00` : scheduledDate) : undefined;
    if (!finalDate && recurrenceObj) {
      finalDate = getNextRecurrenceDate(today(), recurrenceObj);
    }
    
    try {
      if (isCreating) {
        await createTask({
          ...quickAddPrefill,
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          status: status as any,
          scheduledDate: finalDate,
          projectId: projectId || undefined,
          dependencies,
          linkedNoteIds,
          recurrence: recurrenceObj,
          estimateMinutes: est
        });
      } else if (task) {
        await updateTask(task.id, {
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          status: status as any,
          scheduledDate: finalDate,
          projectId: projectId || undefined,
          dependencies,
          linkedNoteIds,
          recurrence: recurrenceObj,
          estimateMinutes: est
        });
      }
      handleClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!task) return;
    handleClose();
    setTimeout(() => {
      void deleteTask(task.id);
    }, 400);
  };

  const handleDuplicate = async () => {
    if (!task) return;
    handleClose();
    setTimeout(() => {
      void duplicateTask(task.id);
    }, 400);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 lg:p-12">
      <div 
        ref={overlayRef}
        onClick={handleClose}
        className="absolute inset-0 bg-background/80 backdrop-blur-xl transition-opacity"
      />
      
      <div 
        ref={panelRef}
        className="relative w-full max-w-5xl h-full max-h-[90vh] bg-card border border-border/50 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="flex-1 overflow-y-auto">
          <div className="sticky top-0 z-10 px-8 py-6 bg-card/80 backdrop-blur-md border-b border-border/50 flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold tracking-wider text-muted-foreground uppercase">
                {isCreating ? <Layout size={16} /> : <Inbox size={16} />}
                {isCreating ? "Create Task" : "Edit Task"}
              </div>
              <div className="flex items-center gap-2">
                {!isCreating && (
                  <>
                    <button onClick={handleDuplicate} className="p-2 text-muted-foreground hover:text-primary transition-colors rounded-full hover:bg-muted">
                      <Copy size={20} />
                    </button>
                    <button onClick={handleDelete} className="p-2 text-muted-foreground hover:text-red-500 transition-colors rounded-full hover:bg-red-500/10">
                      <Trash2 size={20} />
                    </button>
                  </>
                )}
                <button onClick={handleClose} className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-muted">
                  <X size={24} />
                </button>
              </div>
            </div>
            
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full bg-transparent text-4xl md:text-5xl font-bold tracking-tight text-foreground placeholder:text-muted focus:outline-none"
              autoFocus
            />

            {/* Tabs */}
            <div className="flex items-center gap-6 border-b border-border/50 pb-2 mt-4">
              {(
                [
                  { id: "general", label: "General", icon: <Layout size={16} /> },
                  { id: "schedule", label: "Scheduling", icon: <Clock size={16} /> },
                  { id: "relations", label: "Relations", icon: <Network size={16} /> }
                ] as const
              ).map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={cn(
                    "flex items-center gap-2 pb-2 text-sm font-semibold tracking-wider uppercase transition-colors relative",
                    activeTab === t.id ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t.icon}
                  {t.label}
                  {activeTab === t.id && (
                    <span className="absolute -bottom-2.5 left-0 w-full h-0.5 bg-primary rounded-t-full" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="p-8">
            {activeTab === "general" && (
              <div className="space-y-7 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Quick Actions / Metadata */}
                <div className="flex flex-wrap gap-3 items-center">
                  {/* Priority picker */}
                  <div className="flex items-center gap-1 p-1 rounded-full bg-muted/10">
                    {(["none", "low", "medium", "high", "urgent"] as Priority[]).map(p => {
                  const activeMap: Record<string, string> = {
                    none:   "bg-muted text-foreground",
                    low:    "bg-blue-500/10 text-blue-400",
                    medium: "bg-yellow-400/10 text-yellow-400",
                    high:   "bg-orange-500/10 text-orange-400",
                    urgent: "bg-red-500 text-white",
                  };
                  return (
                    <button
                      key={p}
                      onClick={() => setPriority(p)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-[0.18em] transition-all duration-200",
                        priority === p
                          ? activeMap[p]
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/20"
                      )}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
              
              {/* Status picker */}
              <div className="flex items-center gap-1 p-1 rounded-full bg-muted/10">
                {(["todo", "in_progress", "done", "cancelled"] as const).map(s => {
                  const statusMap: Record<string, string> = {
                    todo:        "bg-muted text-foreground",
                    in_progress: "bg-blue-500/10 text-blue-400",
                    done:        "bg-emerald-500/10 text-emerald-400",
                    cancelled:   "bg-zinc-500/10 text-zinc-400",
                  };
                  return (
                    <button
                      key={s}
                      onClick={() => setStatus(s)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-[0.18em] transition-all duration-200",
                        status === s
                          ? statusMap[s]
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/20"
                      )}
                    >
                      {s.replace("_", " ")}
                    </button>
                  );
                })}
              </div>
            </div>

                {/* Description */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-2">
                    <Tag size={16} /> Details
                  </h4>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Add rich details, context, or links here..."
                    className="w-full min-h-[160px] bg-muted/10 border border-border/50 rounded-2xl p-6 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none leading-relaxed"
                  />
                </div>

                {/* Project */}
                <div className="p-5 bg-muted/10 rounded-2xl">
                  <h4 className="text-[11px] font-semibold tracking-[0.24em] text-muted-foreground uppercase flex items-center gap-2">
                    <Folder size={14} /> Project Assignment
                  </h4>
                  <select
                    value={projectId}
                    onChange={e => setProjectId(e.target.value)}
                    className="w-full bg-background border border-border/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
                  >
                    <option value="">No Project</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {activeTab === "schedule" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Schedule */}
                <div className="p-5 bg-muted/10 rounded-2xl">
                <h4 className="text-[11px] font-semibold tracking-[0.24em] text-muted-foreground uppercase flex items-center gap-2">
                  <Clock size={14} /> Schedule & Estimate
                </h4>
                <div className="flex flex-col gap-3 mt-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="date"
                      value={scheduledDate}
                      onChange={e => setScheduledDate(e.target.value)}
                      className="w-full bg-background border border-border/50 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                    <input
                      type="time"
                      value={scheduledTime}
                      onChange={e => setScheduledTime(e.target.value)}
                      className="w-full bg-background border border-border/50 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                    <button onClick={() => setScheduledDate(today())} className="px-2 py-1 rounded-lg bg-muted/20">Today</button>
                    <button onClick={() => {
                      const tmrw = new Date(); tmrw.setDate(tmrw.getDate() + 1);
                      setScheduledDate(tmrw.toISOString().slice(0, 10));
                    }} className="px-2 py-1 rounded-lg bg-muted/20">Tomorrow</button>
                    <button onClick={() => { setScheduledDate(""); setScheduledTime(""); }} className="ml-auto px-2 py-1 rounded-lg bg-muted/20">Clear</button>
                  </div>
                  <input
                    type="number"
                    value={estimateMins}
                    onChange={e => setEstimateMins(e.target.value)}
                    placeholder="Estimate (mins)"
                    className="w-full bg-background border border-border/50 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                  />
                  {scheduledDate && (() => {
                    const conflicts = tasks.filter(t => 
                      t.id !== openTaskId && 
                      t.status !== "done" && 
                      (t.scheduledDate?.startsWith(scheduledDate) || t.dueDate?.startsWith(scheduledDate))
                    );
                    if (conflicts.length === 0) return null;
                    const sameTime = scheduledTime ? conflicts.filter(t => t.scheduledDate?.includes("T" + scheduledTime)) : [];
                    return (
                      <div className="mt-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-[11px] text-amber-500">
                        {sameTime.length > 0
                          ? `Conflict: ${sameTime.length} task(s) scheduled at this time.`
                          : `Note: ${conflicts.length} task(s) are scheduled on this date.`}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Repetition */}
              <div className="p-5 bg-muted/10 rounded-2xl space-y-4">
                <h4 className="text-[11px] font-semibold tracking-[0.24em] text-muted-foreground uppercase flex items-center gap-2">
                  <Repeat size={14} /> Recurrence
                </h4>
                <select
                  value={recurFreq}
                  onChange={e => setRecurFreq(e.target.value)}
                  className="w-full bg-background border border-border/50 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                >
                  <option value="none">Does not repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>

                {recurFreq === "weekly" && (
                  <div className="grid grid-cols-7 gap-2 mt-3">
                    {["S", "M", "T", "W", "T", "F", "S"].map((dayLabel, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          if (recurDays.includes(idx)) {
                            setRecurDays(recurDays.filter(d => d !== idx));
                          } else {
                            setRecurDays([...recurDays, idx]);
                          }
                        }}
                        className={cn(
                          "w-full h-8 rounded-full text-xs font-semibold transition-all border",
                          recurDays.includes(idx) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border/50 text-muted-foreground hover:border-primary/50"
                        )}
                      >
                        {dayLabel}
                      </button>
                    ))}
                  </div>
                )}

                {recurFreq === "monthly" && (
                  <div className="flex items-center gap-3 mt-3">
                    <span className="text-xs font-medium text-muted-foreground">On day</span>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={recurDayOfMonth}
                      onChange={e => setRecurDayOfMonth(parseInt(e.target.value) || 1)}
                      className="w-16 bg-background border border-border/50 rounded-xl px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                  </div>
                )}
              </div>
            </div>
            )}

            {activeTab === "relations" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Dependencies */}
                <div className="p-6 bg-muted/20 border border-border/50 rounded-2xl space-y-4 hover:bg-muted/30 transition-colors">
                <h4 className="text-xs font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-2">
                  <Network size={14} /> Blockers (Dependencies)
                </h4>
                <div className="flex flex-col gap-2">
                  {dependencies.map(depId => {
                    const d = tasks.find(t => t.id === depId);
                    if (!d) return null;
                    return (
                      <div key={d.id} className="flex items-center justify-between bg-background px-3 py-2 rounded-xl text-xs border border-border/50">
                        <span className="truncate max-w-[150px]">{d.title}</span>
                        <button onClick={() => setDependencies(dependencies.filter(id => id !== d.id))} className="text-red-500 hover:text-red-400"><X size={14} /></button>
                      </div>
                    );
                  })}
                  <select
                    onChange={e => {
                      if (e.target.value && !dependencies.includes(e.target.value)) {
                        setDependencies([...dependencies, e.target.value]);
                      }
                      e.target.value = "";
                    }}
                    className="w-full bg-background border border-border/50 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 text-muted-foreground"
                    value=""
                  >
                    <option value="">+ Add blocker...</option>
                    {tasks.filter(t => t.id !== task?.id && t.status !== "done").map(t => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Linked Notes */}
              <div className="p-6 bg-muted/20 border border-border/50 rounded-2xl space-y-4 hover:bg-muted/30 transition-colors">
                <h4 className="text-xs font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-2">
                  <LinkIcon size={14} /> Linked Notes
                </h4>
                <div className="flex flex-col gap-2">
                  {linkedNoteIds.map(nid => {
                    const n = notes.find(x => x.id === nid);
                    if (!n) return null;
                    return (
                      <div key={n.id} className="flex items-center justify-between bg-background px-4 py-3 rounded-xl text-sm border border-border/50">
                        <span className="truncate max-w-[150px]">{n.title}</span>
                        <button onClick={() => setLinkedNoteIds(linkedNoteIds.filter(id => id !== n.id))} className="text-red-500 hover:text-red-400"><X size={14} /></button>
                      </div>
                    );
                  })}
                  <select
                    onChange={e => {
                      if (e.target.value && !linkedNoteIds.includes(e.target.value)) {
                        setLinkedNoteIds([...linkedNoteIds, e.target.value]);
                      }
                      e.target.value = "";
                    }}
                    className="w-full bg-background border border-border/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
                  >
                    <option value="">Link a Note...</option>
                    {notes.filter(n => !linkedNoteIds.includes(n.id)).map(n => (
                      <option key={n.id} value={n.id}>{n.title}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border/50 bg-card/80 backdrop-blur-md">
          <button
            onClick={handleSave}
            disabled={!title.trim() || isSubmitting}
            className="w-full h-14 bg-primary text-primary-foreground font-bold text-lg rounded-2xl flex items-center justify-center gap-2 shadow-2xl hover:bg-primary/90 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Saving..." : isCreating ? "Create Task" : "Save Changes"}
            {!isSubmitting && <ArrowRight size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
}
