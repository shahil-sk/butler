import { useState, useEffect } from "react";
import { X, Trash2, CheckCircle2, Circle, Clock, CheckSquare, Calendar, Activity, GitBranch } from "lucide-react";
import { cn, formatDate } from "@/shared/utils";
import { useProjectStore } from "../store";
import { useTaskStore } from "@/modules/tasks/store";
import type { ProjectStatus } from "@/shared/types";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef } from "react";

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "active",    label: "Active" },
  { value: "on_hold",   label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "archived",  label: "Archived" },
];

export function ProjectDetail() {
  const {
    openProjectId, closeProject, getProjectById,
    updateProject, deleteProject, addMilestone, completeMilestone, deleteMilestone
  } = useProjectStore();

  const { tasks: allTasks, updateTask } = useTaskStore();
  const project = openProjectId ? getProjectById(openProjectId) : null;
  const tasks = allTasks.filter((t) => t.projectId === openProjectId && t.status !== "archived");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [newMilestone, setNewMilestone] = useState("");

  useEffect(() => {
    if (project) { 
      setName(project.name); 
      setDescription(project.description ?? ""); 
    }
  }, [project?.id]);

  if (!project) return null;

  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (project && panelRef.current && overlayRef.current) {
      gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power2.out" });
      gsap.fromTo(panelRef.current, 
        { scale: 0.96, opacity: 0 }, 
        { scale: 1, opacity: 1, duration: 0.4, ease: "power3.out" }
      );
    }
  }, [project?.id]);

  const handleClose = () => {
    if (panelRef.current && overlayRef.current) {
      gsap.to(overlayRef.current, { opacity: 0, duration: 0.2 });
      gsap.to(panelRef.current, { 
        scale: 0.98, opacity: 0, duration: 0.2, ease: "power2.in",
        onComplete: closeProject
      });
    } else {
      closeProject();
    }
  };

  const done = tasks.filter((t) => t.status === "done").length;
  const total = tasks.length;
  const progress = total > 0 ? Math.round((done / total) * 100) : 0;
  const save = (patch: Parameters<typeof updateProject>[1]) => void updateProject(project.id, patch);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 lg:p-12">
      <div ref={overlayRef} className="absolute inset-0 bg-background/60 backdrop-blur-md" onClick={handleClose} />
      
      <div ref={panelRef} className="relative w-full md:w-[700px] max-h-[90vh] bg-card border border-border/50 flex flex-col shadow-2xl rounded-3xl overflow-hidden">
        
        
        {/* Action Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <select
              value={project.status}
              onChange={(e) => save({ status: e.target.value as ProjectStatus })}
              className="text-xs font-bold uppercase tracking-wider bg-muted/50 px-3 py-1.5 rounded-md focus:outline-none cursor-pointer"
              style={{ color: project.status === 'active' ? project.color : 'inherit' }}
            >
              {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { void deleteProject(project.id); handleClose(); }} className="p-2 text-muted-foreground hover:text-red-500 rounded-full hover:bg-red-500/10 transition-colors" title="Delete">
              <Trash2 size={16} />
            </button>
            <button onClick={handleClose} className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Hero Section */}
          <div className="px-8 py-10 space-y-6">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => { if (name.trim() && name !== project.name) save({ name: name.trim() }); }}
              onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
              className="w-full text-4xl md:text-5xl font-extrabold tracking-tight bg-transparent outline-none text-foreground"
              placeholder="Project Name"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => { if (description !== (project.description ?? "")) save({ description: description || undefined }); }}
              placeholder="Add project details, goals, or scope..."
              className="w-full min-h-[80px] text-[15px] bg-transparent outline-none resize-none leading-relaxed text-muted-foreground placeholder:text-muted-foreground/40"
            />

            {/* Progress Big Bar */}
            <div className="bg-muted/20 border border-border/60 rounded-2xl p-5 mt-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Overall Progress</span>
                <span className="text-sm font-bold tabular-nums" style={{color: project.color}}>{progress}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${progress}%`, backgroundColor: project.color }} />
              </div>
              <div className="flex items-center gap-6 mt-4 pt-4 border-t border-border/40 text-xs font-medium text-muted-foreground">
                <span className="flex items-center gap-2"><CheckSquare size={14} className="text-emerald-500" /> {done}/{total} Tasks completed</span>
                {project.dueDate && <span className="flex items-center gap-2"><Calendar size={14} className="text-blue-500" /> Due {formatDate(project.dueDate)}</span>}
              </div>
            </div>
          </div>

          <div className="px-8 pb-10 space-y-10">
            {/* Milestones Section */}
            <section className="space-y-4">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <GitBranch size={14} /> Milestones
              </h3>
              <div className="flex flex-col gap-2">
                {project.milestones.map((m) => (
                  <div key={m.id} className="group flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-border/50 hover:border-border transition-colors">
                    <button onClick={() => void completeMilestone(project.id, m.id)} className={cn("shrink-0 transition-colors", m.completedAt ? "text-emerald-500" : "text-muted-foreground/40 hover:text-foreground")}>
                      {m.completedAt ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                    </button>
                    <span className={cn("flex-1 text-[14px] font-medium", m.completedAt && "line-through text-muted-foreground/50")}>
                      {typeof m.title === "string" ? m.title : (m.title as any)?.title || String(m.title)}
                    </span>
                    <button onClick={() => void deleteMilestone(project.id, m.id)} className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-red-500 transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <input
                  value={newMilestone}
                  onChange={(e) => setNewMilestone(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newMilestone.trim()) {
                      void addMilestone(project.id, newMilestone.trim());
                      setNewMilestone("");
                    }
                  }}
                  placeholder="+ Add a milestone..."
                  className="w-full text-sm bg-transparent border border-dashed border-border/60 rounded-xl px-4 py-3 outline-none focus:border-primary/50 text-foreground placeholder:text-muted-foreground/50"
                />
              </div>
            </section>

            {/* Quick Tasks List */}
            <section className="space-y-4">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Activity size={14} /> Tasks Overview
              </h3>
              <div className="flex flex-col gap-1.5">
                {tasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground/50 py-4 italic">No tasks assigned to this project yet.</p>
                ) : (
                  tasks.map((t) => (
                    <div key={t.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/30 transition-colors cursor-default">
                      <button onClick={() => void updateTask(t.id, { status: t.status === "done" ? "todo" : "done" })} className="shrink-0">
                        {t.status === "done" ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Circle size={16} className="text-muted-foreground/50" />}
                      </button>
                      <span className={cn("text-[13px]", t.status === "done" && "line-through text-muted-foreground/50")}>{t.title}</span>
                    </div>
                  ))
                )}
              </div>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}
