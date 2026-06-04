import { useEffect, useState } from "react";
import { Plus, LayoutGrid, List, FolderKanban, CalendarRange, Activity, CheckCircle2 } from "lucide-react";
import { registry } from "@/kernel/router";
import { projectsManifest } from "./manifest";
import { useProjectStore } from "./store";
import { useTaskStore } from "@/modules/tasks/store";
import { ProjectCard } from "./components/ProjectCard";
import { ProjectDetail } from "./components/ProjectDetail";
import { CreateProjectModal } from "./components/CreateProjectModal";
import { cn, formatDate } from "@/shared/utils";
import type { Project, ProjectStatus } from "@/shared/types";

registry.register(projectsManifest);

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "active",    label: "Active" },
  { value: "on_hold",   label: "On hold" },
  { value: "completed", label: "Completed" },
  { value: "archived",  label: "Archived" },
];

function ProjectsHeroHeader({ activeCount, doneTasks }: { activeCount: number, doneTasks: number }) {
  return (
    <div className="px-8 md:px-12 pt-8 pb-12">
      <div className="max-w-4xl">
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-foreground leading-none mb-6 animate-slide-in">
          Projects
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed animate-slide-in" style={{ animationDelay: '100ms', animationFillMode: 'both' }}>
          You are currently driving <span className="font-bold text-foreground">{activeCount} active projects</span>. 
          Across all initiatives, <span className="font-bold text-foreground">{doneTasks} tasks</span> have been completed.
        </p>
      </div>

      <div className="flex flex-wrap gap-4 mt-10 animate-slide-in" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
        <div className="px-6 py-4 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col gap-2 min-w-[200px]">
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
            <Activity size={14} /> Active
          </span>
          <span className="text-4xl font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">{activeCount}</span>
        </div>
        <div className="px-6 py-4 rounded-3xl bg-blue-500/10 border border-blue-500/20 flex flex-col gap-2 min-w-[200px]">
          <span className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400 flex items-center gap-2">
            <CheckCircle2 size={14} /> Tasks Done
          </span>
          <span className="text-4xl font-extrabold tabular-nums text-blue-600 dark:text-blue-400">{doneTasks}</span>
        </div>
      </div>
    </div>
  );
}

// ── Kanban Board View ───────────────────────────────────────
function ProjectsBoardView({ projects }: { projects: Project[] }) {
  const { openProject } = useProjectStore();

  return (
    <div className="flex gap-6 min-h-[calc(100vh-180px)] overflow-x-auto pb-4 pt-2 px-8 md:px-12">
      {STATUS_OPTIONS.map((opt) => {
        const colProjects = projects.filter((p) => p.status === opt.value);
        return (
          <div key={opt.value} className="flex flex-col flex-1 w-[320px] min-w-[320px] shrink-0 border border-border/50 rounded-3xl bg-card/30">
            <div className="flex items-center gap-3 p-5 border-b border-border/50">
              <span className="text-lg font-bold tracking-tight text-foreground">{opt.label}</span>
              <span className="text-xs font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{colProjects.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 p-5 min-h-0">
              {colProjects.length === 0 ? (
                <div className="border border-dashed border-border/40 rounded-2xl py-8 text-center text-[13px] text-muted-foreground/50">
                  No projects
                </div>
              ) : (
                colProjects.map((p, i) => (
                  <div key={p.id} onClick={() => openProject(p.id)} className="animate-slide-in" style={{ animationDelay: `${i * 40}ms`, animationFillMode: 'both' }}>
                    <ProjectCard project={p} view="grid" />
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Gantt Roadmap Timeline View ──────────────────────────────
function ProjectsTimelineView({ projects }: { projects: Project[] }) {
  const { openProject } = useProjectStore();
  const allTasks = useTaskStore(s => s.tasks);
  const dates = projects.flatMap(p => [p.startDate, p.dueDate].filter(Boolean) as string[]);
  const todayStr = new Date().toISOString().slice(0, 10);
  
  let minDate = new Date(todayStr);
  minDate.setDate(minDate.getDate() - 15);
  let maxDate = new Date(todayStr);
  maxDate.setDate(maxDate.getDate() + 30);

  if (dates.length > 0) {
    const parsed = dates.map(d => new Date(d));
    const calculatedMin = new Date(Math.min(...parsed.map(d => d.getTime())));
    const calculatedMax = new Date(Math.max(...parsed.map(d => d.getTime())));
    calculatedMin.setDate(calculatedMin.getDate() - 5);
    calculatedMax.setDate(calculatedMax.getDate() + 5);
    minDate = calculatedMin;
    maxDate = calculatedMax;
  }

  const totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
  
  const getPercentage = (dateStr: string) => {
    const d = new Date(dateStr);
    const offset = d.getTime() - minDate.getTime();
    const pct = (offset / (1000 * 60 * 60 * 24)) / totalDays * 100;
    return Math.max(0, Math.min(100, pct));
  };

  return (
    <div className="px-8 md:px-12 mt-4">
      <div className="border border-border/60 bg-card rounded-[2rem] p-8 overflow-hidden flex flex-col h-full shadow-sm">
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-border/40">
          <h3 className="text-xl font-bold text-foreground tracking-tight">Roadmap</h3>
          <span className="text-[13px] font-medium text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
            {formatDate(minDate.toISOString())} – {formatDate(maxDate.toISOString())}
          </span>
        </div>

        <div className="flex-1 overflow-x-auto min-h-[400px] relative">
          <div className="min-w-[800px] h-full flex flex-col">
            {/* Header Row */}
            <div className="flex pb-4 mb-4 text-[11px] uppercase font-bold text-muted-foreground tracking-wider select-none border-b border-border/40 sticky top-0 bg-card z-20">
              <div className="w-1/4 min-w-[200px] shrink-0 px-2 sticky left-0 bg-card z-30">Project</div>
              <div className="flex-1 relative h-6 border-l border-border/30">
                <div 
                  className="absolute w-px h-[200vh] bg-red-500/50 z-10 pointer-events-none"
                  style={{ left: `${getPercentage(todayStr)}%` }}
                >
                  <div className="absolute -top-3 -translate-x-1/2 bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold shadow-sm">TODAY</div>
                </div>
              </div>
            </div>

            {/* Rows */}
            <div className="flex-1 overflow-y-auto space-y-4 min-h-0">
              {projects.length === 0 ? (
                <div className="text-center py-12 text-sm text-muted-foreground/50">
                  No active projects to display.
                </div>
              ) : (
                projects.map((p, i) => {
                  const start = p.startDate ?? p.createdAt.slice(0, 10);
                  const due = p.dueDate ?? start;
                  const leftPct = getPercentage(start);
                  const rightPct = getPercentage(due);
                  const widthPct = Math.max(8, rightPct - leftPct);

                  const projectTasks = allTasks.filter(t => t.projectId === p.id && t.status !== "archived");
                  const doneTasks = projectTasks.filter(t => t.status === "done").length;
                  const totalTasks = projectTasks.length;
                  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

                  return (
                    <div key={p.id} className="flex items-center group cursor-pointer hover:bg-muted/30 p-2 rounded-2xl transition-colors animate-slide-in" style={{ animationDelay: `${i * 30}ms`, animationFillMode: 'both' }} onClick={() => openProject(p.id)}>
                      <div className="w-1/4 min-w-[200px] pr-4 flex flex-col justify-center sticky left-0 bg-card group-hover:bg-muted/10 z-10 transition-colors py-1">
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: p.color }} />
                          <span className="text-[14px] font-semibold text-foreground block truncate group-hover:text-primary transition-colors">{p.name}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 pl-6 text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                          <span className={cn("px-1.5 py-0.5 rounded", p.status === 'active' ? "bg-emerald-500/10 text-emerald-500" : "bg-muted")}>
                            {STATUS_OPTIONS.find(s => s.value === p.status)?.label || p.status}
                          </span>
                          {totalTasks > 0 && <span>{progress}% • {doneTasks}/{totalTasks} Tasks</span>}
                        </div>
                      </div>

                      <div className="flex-1 relative h-10 rounded-xl overflow-hidden bg-muted/20 border border-border/30">
                        <div
                          className="absolute h-full top-0 rounded-lg flex items-center justify-between px-4 overflow-hidden transition-all duration-300 shadow-sm"
                          style={{
                            left: `${leftPct}%`,
                            width: `${widthPct}%`,
                            backgroundColor: `${p.color}15`,
                            border: `1px solid ${p.color}40`,
                          }}
                        >
                          <div className="absolute left-0 top-0 bottom-0 opacity-20" style={{ width: `${progress}%`, backgroundColor: p.color }} />
                          <span className="text-[10px] font-bold tracking-widest uppercase truncate z-10" style={{ color: p.color }}>
                            {formatDate(start)} → {formatDate(due)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Module ───────────────────────────────────────────────────
export function ProjectsModule() {
  const {
    loadProjects, getFilteredProjects,
    openProjectId, createModalOpen,
    openCreateModal
  } = useProjectStore();
  const { loadTasks } = useTaskStore();

  const allTasks = useTaskStore((s) => s.tasks);
  const [activeView, setActiveView] = useState<"grid" | "list" | "board" | "timeline">("grid");

  useEffect(() => {
    void loadProjects();
    void loadTasks();
  }, [loadProjects, loadTasks]);

  const projects = getFilteredProjects();

  const doneTasks   = allTasks.filter((t) => t.projectId != null && t.status === "done").length;
  const activeCount = projects.filter((p) => p.status === "active").length;

  return (
    <main className="w-full h-full overflow-y-auto overflow-x-hidden bg-background text-foreground pb-32">
      
      {/* Top Glass Navigation */}
      <div className="sticky top-6 mx-auto w-fit z-50 flex items-center gap-2 p-2 bg-card/70 backdrop-blur-xl border border-border/50 rounded-full shadow-2xl mb-8">
        <button
          onClick={() => setActiveView("grid")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all",
            activeView === "grid" ? "bg-foreground text-background shadow-md" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <LayoutGrid size={16} /> Grid
        </button>
        <button
          onClick={() => setActiveView("board")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all",
            activeView === "board" ? "bg-foreground text-background shadow-md" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <FolderKanban size={16} /> Board
        </button>
        <button
          onClick={() => setActiveView("list")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all",
            activeView === "list" ? "bg-foreground text-background shadow-md" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <List size={16} /> List
        </button>
        <button
          onClick={() => setActiveView("timeline")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all",
            activeView === "timeline" ? "bg-foreground text-background shadow-md" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <CalendarRange size={16} /> Timeline
        </button>
      </div>

      {activeView === "grid" && <ProjectsHeroHeader activeCount={activeCount} doneTasks={doneTasks} />}

      {/* ── Content Area ─────────────────────────────────────── */}
      <div className="w-full">
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center mx-8 md:mx-12 mt-8 border border-dashed border-border/60 rounded-[2rem]">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center text-muted-foreground mb-4 shadow-sm">
              <LayoutGrid size={32} />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">No projects yet</h3>
            <p className="text-[15px] text-muted-foreground max-w-sm mb-6">Create a project to organise your work and track progress.</p>
            <button onClick={openCreateModal} className="h-10 px-6 bg-foreground text-background font-semibold rounded-xl text-sm shadow-sm hover:opacity-90">
              Create Project
            </button>
          </div>
        ) : activeView === "grid" ? (
          <div className="px-8 md:px-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {projects.map((p, i) => (
              <div key={p.id} className="animate-slide-in" style={{ animationDelay: `${i * 30}ms`, animationFillMode: 'both' }}>
                <ProjectCard project={p} view="grid" />
              </div>
            ))}
          </div>
        ) : activeView === "list" ? (
          <div className="px-8 md:px-12 flex flex-col gap-4 max-w-6xl mx-auto mt-4">
            {projects.map((p, i) => (
              <div key={p.id} className="animate-slide-in" style={{ animationDelay: `${i * 30}ms`, animationFillMode: 'both' }}>
                <ProjectCard project={p} view="list" />
              </div>
            ))}
          </div>
        ) : activeView === "board" ? (
          <ProjectsBoardView projects={projects} />
        ) : (
          <ProjectsTimelineView projects={projects} />
        )}
      </div>

      {/* Floating Massive CTA */}
      <button
        onClick={() => openCreateModal()}
        className="fixed bottom-10 right-10 z-50 w-20 h-20 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-2xl shadow-primary/30 hover:scale-110 hover:shadow-primary/50 transition-all duration-500 ease-out group"
        title="Create New Project"
      >
        <Plus size={36} className="group-hover:rotate-90 transition-transform duration-500" />
      </button>

      {openProjectId && <ProjectDetail />}
      {createModalOpen && <CreateProjectModal />}
    </main>
  );
}
