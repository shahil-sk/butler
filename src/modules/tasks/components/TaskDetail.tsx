import { useState, useEffect, useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { 
  X, Calendar as CalIcon, Tag, Clock, ArrowRight, Trash2, Copy, Inbox, Layout, 
  Folder, Network, Repeat, Link as LinkIcon, GitBranch, Play, CheckSquare, Hash, CheckCircle2, Circle
} from "lucide-react";
import { useTaskStore } from "../store";
import { useFocusStore } from "@/modules/focus/store";
import { useProjectStore } from "@/modules/projects/store";
import type { Task, Priority, RecurrenceRule } from "@/shared/types";
import { cn, getNextRecurrenceDate, today } from "@/shared/utils";

const notes: any[] = [];

export function TaskDetail() {
  const { 
    openTaskId, tasks, closeTask, updateTask, completeTask, restoreTask, deleteTask, duplicateTask,
    quickAddOpen, closeQuickAdd, createTask, quickAddPrefill
  } = useTaskStore();

  const startFocus = useFocusStore(s => s.startFocus);
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
  
  const [checklistItems, setChecklistItems] = useState<any[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  
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
      setChecklistItems(quickAddPrefill?.checklistItems || []);
      setTags(quickAddPrefill?.tags || []);
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
      setChecklistItems(task.checklistItems || []);
      setTags(task.tags || []);
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

  const performClose = () => {
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

  const handleDismiss = async () => {
    if (!title.trim()) {
      performClose();
      return;
    }
    
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
          scheduledAt: finalDate,
          projectId: projectId || undefined,
          dependencies,
          linkedNoteIds,
          recurrence: recurrenceObj,
          estimateMinutes: est,
          checklistItems,
          tags
        });
      } else if (task) {
        await updateTask(task.id, {
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          status: status as any,
          scheduledDate: finalDate,
          scheduledAt: finalDate,
          projectId: projectId || undefined,
          dependencies,
          linkedNoteIds,
          recurrence: recurrenceObj,
          estimateMinutes: est,
          checklistItems,
          tags
        });
      }
    } finally {
      performClose();
    }
  };

  const handleDelete = async () => {
    if (!task) return;
    performClose();
    setTimeout(() => {
      void deleteTask(task.id);
    }, 400);
  };

  const handleDuplicate = async () => {
    if (!task) return;
    performClose();
    setTimeout(() => {
      void duplicateTask(task.id);
    }, 400);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 lg:p-12">
      <div 
        ref={overlayRef}
        onClick={handleDismiss}
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
                    <button onClick={() => { if (task) startFocus(task.id); handleDismiss(); }} className="px-3 py-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary hover:bg-primary/10 transition-colors rounded-full border border-primary/30 hover:border-primary">
                      <Play size={14} fill="currentColor" /> Flow
                    </button>
                    <button onClick={handleDuplicate} className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-muted ml-2">
                      <Copy size={20} />
                    </button>
                    <button onClick={handleDelete} className="p-2 text-muted-foreground hover:text-red-500 transition-colors rounded-full hover:bg-red-500/10">
                      <Trash2 size={20} />
                    </button>
                  </>
                )}
                <button onClick={handleDismiss} className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-muted">
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


            {/* Pickers (Status & Priority) */}
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-1.5 p-1 bg-muted/30 rounded-full border border-border/50">
                {(["none", "low", "medium", "high", "urgent"] as any[]).map(p => {
                  const activeMap: Record<string, string> = {
                    none:   "bg-muted text-foreground",
                    low:    "bg-blue-500/20 text-blue-400 border border-blue-500/40",
                    medium: "bg-yellow-400/20 text-yellow-400 border border-yellow-400/40",
                    high:   "bg-orange-500/20 text-orange-400 border border-orange-500/40",
                    urgent: "bg-red-500 text-white shadow-lg shadow-red-500/30",
                  };
                  return (
                    <button key={p} onClick={() => setPriority(p)} className={cn("px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-200", priority === p ? activeMap[p] : "text-muted-foreground hover:text-foreground hover:bg-muted")}>
                      {p}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-1.5 p-1 bg-muted/30 rounded-full border border-border/50">
                {(["todo", "in_progress", "done", "cancelled"] as any[]).map(s => {
                  const statusMap: Record<string, string> = {
                    todo:        "bg-muted text-foreground",
                    in_progress: "bg-blue-500/20 text-blue-400 border border-blue-500/40",
                    done:        "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40",
                    cancelled:   "bg-zinc-500/20 text-zinc-400 border border-zinc-500/40",
                  };
                  return (
                    <button key={s} onClick={() => setStatus(s)} className={cn("px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-200", status === s ? statusMap[s] : "text-muted-foreground hover:text-foreground hover:bg-muted")}>
                      {s.replace("_", " ")}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-hidden p-8 pt-4 flex flex-col min-h-0">
            <div className="flex-1 flex flex-col gap-6 overflow-y-auto pr-2 min-h-0 pb-10">
              
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 shrink-0">
                {/* LEFT COL: Description, Tags, Blockers */}
                <div className="col-span-1 lg:col-span-8 flex flex-col gap-4">
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Add rich details, context, or links here..."
                    className="w-full h-[140px] shrink-0 bg-muted/10 border border-border/50 rounded-2xl p-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none leading-relaxed"
                  />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="shrink-0 bg-muted/10 border border-border/50 rounded-2xl p-4 space-y-3">
                      <h4 className="text-xs font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-2">
                        <Hash size={14} /> Tags
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {tags.map(tag => (
                          <span key={tag} className="flex items-center gap-1 bg-primary/10 border border-primary/20 text-primary px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider">
                            {tag} <button onClick={() => setTags(tags.filter(t => t !== tag))} className="hover:text-red-500"><X size={10} /></button>
                          </span>
                        ))}
                        <input type="text" value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newTag.trim()) { e.preventDefault(); const t = newTag.trim().toLowerCase().replace(/[^a-z0-9-]/g, ''); if (t && !tags.includes(t)) setTags([...tags, t]); setNewTag(""); } }} placeholder="Add tag..." className="bg-transparent text-xs w-24 focus:outline-none border-b border-transparent focus:border-primary/50" />
                      </div>
                    </div>

                    <div className={cn("flex flex-col shrink-0 bg-muted/10 border border-border/50 rounded-2xl p-4 space-y-3")}>
                      <h4 className="text-xs font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-2">
                        <Network size={14} /> Blockers
                      </h4>
                      <div className="flex flex-col gap-2 max-h-[150px] overflow-y-auto">
                        {dependencies.map(depId => {
                          const d = tasks.find(t => t.id === depId);
                          if (!d) return null;
                          return (
                            <div key={d.id} className="flex items-center justify-between bg-background border border-border/50 rounded-lg px-2 py-1.5 text-xs">
                              <span className="truncate max-w-[120px]">{d.title}</span>
                              <button onClick={() => setDependencies(dependencies.filter(id => id !== d.id))} className="text-red-500"><X size={10} /></button>
                            </div>
                          );
                        })}
                        <select onChange={e => { if (e.target.value && !dependencies.includes(e.target.value)) setDependencies([...dependencies, e.target.value]); e.target.value = ""; }} className="w-full bg-background border border-border/50 rounded-lg px-2 py-1.5 text-xs focus:outline-none">
                          <option value="">+ Add blocker...</option>
                          {tasks.filter(t => t.id !== task?.id && t.status !== "done").map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT COL: Schedule, Project, Recurrence */}
                <div className="col-span-1 lg:col-span-4 flex flex-col gap-4">
                  <div className="bg-muted/10 border border-border/50 rounded-2xl p-4 space-y-3">
                    <h4 className="text-xs font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-2">
                      <Folder size={14} /> Project
                    </h4>
                    <select value={projectId} onChange={e => setProjectId(e.target.value)} className="w-full bg-background border border-border/50 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50">
                      <option value="">No Project</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>

                  <div className="bg-muted/10 border border-border/50 rounded-2xl p-4 space-y-3">
                    <h4 className="text-xs font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-2">
                      <Clock size={14} /> Schedule & Estimate
                    </h4>
                    <div className="flex gap-2">
                      <input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} className="flex-1 w-full bg-background border border-border/50 rounded-xl px-2 py-2 text-xs focus:outline-none" />
                      <input type="time" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} className="flex-1 w-full bg-background border border-border/50 rounded-xl px-2 py-2 text-xs focus:outline-none" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setScheduledDate(today())} className="px-2 py-1 bg-background border border-border/50 rounded-lg text-[10px] text-muted-foreground hover:bg-muted">Today</button>
                      <button onClick={() => { const tmrw = new Date(); tmrw.setDate(tmrw.getDate() + 1); setScheduledDate(tmrw.toISOString().slice(0, 10)); }} className="px-2 py-1 bg-background border border-border/50 rounded-lg text-[10px] text-muted-foreground hover:bg-muted">Tomorrow</button>
                      <button onClick={() => { setScheduledDate(""); setScheduledTime(""); }} className="px-2 py-1 bg-background border border-border/50 rounded-lg text-[10px] text-red-500/80 hover:bg-red-500/10 ml-auto">Clear</button>
                    </div>
                    <input type="number" value={estimateMins} onChange={e => setEstimateMins(e.target.value)} placeholder="Estimate (mins)" className="w-full bg-background border border-border/50 rounded-xl px-3 py-2 text-xs focus:outline-none" />
                  </div>

                  <div className="bg-muted/10 border border-border/50 rounded-2xl p-4 space-y-3">
                    <h4 className="text-xs font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-2">
                      <Repeat size={14} /> Recurrence
                    </h4>
                    <select value={recurFreq} onChange={e => setRecurFreq(e.target.value)} className="w-full bg-background border border-border/50 rounded-xl px-3 py-2 text-xs focus:outline-none">
                      <option value="none">Does not repeat</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                    {recurFreq === "weekly" && (
                      <div className="flex justify-between mt-2">
                        {["S", "M", "T", "W", "T", "F", "S"].map((dayLabel, idx) => (
                          <button key={idx} onClick={() => recurDays.includes(idx) ? setRecurDays(recurDays.filter(d => d !== idx)) : setRecurDays([...recurDays, idx])} className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border", recurDays.includes(idx) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border/50 text-muted-foreground")}>{dayLabel}</button>
                        ))}
                      </div>
                    )}
                    {recurFreq === "monthly" && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] text-muted-foreground">Day:</span>
                        <input type="number" min="1" max="31" value={recurDayOfMonth} onChange={e => setRecurDayOfMonth(parseInt(e.target.value) || 1)} className="w-16 bg-background border border-border/50 rounded-lg px-2 py-1 text-xs focus:outline-none" />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* BOTTOM ROW: Subtasks Full Width */}
              {!isCreating && task && (
                <div className="bg-muted/10 border border-border/50 rounded-2xl p-4 space-y-3 shrink-0">
                  <h4 className="text-xs font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-2 shrink-0">
                    <GitBranch size={14} /> Subtasks
                  </h4>
                  <div className="flex flex-col gap-2">
                    {tasks.filter(t => t.parentTaskId === task.id).map(sub => (
                      <div key={sub.id} className="flex items-center gap-3 bg-background border border-border/50 rounded-xl px-4 py-2.5 text-sm">
                        <button onClick={() => sub.status === "done" ? restoreTask(sub.id) : completeTask(sub.id)} className="text-muted-foreground hover:text-primary">
                          {sub.status === "done" ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Circle size={16} />}
                        </button>
                        <span className={cn("flex-1 truncate font-medium", sub.status === "done" && "line-through text-muted-foreground")}>{sub.title}</span>
                        <button onClick={() => deleteTask(sub.id)} className="text-red-500 hover:text-red-400"><X size={14} /></button>
                      </div>
                    ))}
                    <input type="text" placeholder="+ Add subtask... (press Enter)" onKeyDown={e => { if (e.key === 'Enter' && e.currentTarget.value.trim()) { e.preventDefault(); createTask({ title: e.currentTarget.value.trim(), parentTaskId: task.id }); e.currentTarget.value = ""; } }} className="w-full bg-background border border-border/50 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground" />
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
