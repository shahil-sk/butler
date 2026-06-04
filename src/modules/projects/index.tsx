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

const VIEW_TABS = [
  { id: "grid" as const, icon: LayoutGrid, label: "Grid" },
  { id: "list" as const, icon: List,        label: "List" },
  { id: "board" as const, icon: FolderKanban, label: "Board" },
  { id: "timeline" as const, icon: CalendarRange, label: "Timeline" },
];

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "active",    label: "Active" },
  { value: "on_hold",   label: "On hold" },
  { value: "completed", label: "Completed" },
  { value: "archived",  label: "Archived" },
];

// ── Kanban Board View ───────────────────────────────────────
function ProjectsBoardView({ projects }: { projects: Project[] }) {
  const { openProject } = useProjectStore();

  return (
    <div className="flex gap-6 h-full overflow-x-auto pb-4 pt-2">
      {STATUS_OPTIONS.map((opt) => {
        const colProjects = projects.filter((p) => p.status === opt.value);
        return (
          <div key={opt.value} className="flex flex-col w-[320px] shrink-0">
            <div className="flex items-center gap-3 mb-4 px-1">
              <span className="text-sm font-semibold tracking-tight text-foreground">{opt.label}</span>
              <span className="text-[11px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{colProjects.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 min-h-0 pr-2">
              {colProjects.length === 0 ? (
                <div className="border border-dashed border-border/40 rounded-xl py-8 text-center text-[13px] text-muted-foreground/50">
                  No projects
                </div>
              ) : (
                colProjects.map((p) => (
                  <div key={p.id} onClick={() => openProject(p.id)}>
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
    <div className="border border-border/60 bg-card rounded-2xl p-6 overflow-hidden flex flex-col h-full shadow-sm">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-border/40">
        <h3 className="text-sm font-semibold text-foreground tracking-tight">Roadmap</h3>
        <span className="text-[12px] font-medium text-muted-foreground">
          {formatDate(minDate.toISOString())} – {formatDate(maxDate.toISOString())}
        </span>
      </div>

      <div className="flex-1 overflow-x-auto min-h-0 relative">
        <div className="min-w-[800px] h-full flex flex-col">
          {/* Header Row */}
          <div className="flex pb-3 mb-3 text-[11px] uppercase font-bold text-muted-foreground tracking-wider select-none border-b border-border/40">
            <div className="w-1/4 shrink-0 px-2">Project</div>
            <div className="flex-1 relative h-6 border-l border-border/30">
              <div 
                className="absolute w-px h-[600px] bg-red-500/50 z-10 pointer-events-none"
                style={{ left: `${getPercentage(todayStr)}%` }}
              >
                <div className="absolute -top-3 -translate-x-1/2 bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold shadow-sm">TODAY</div>
              </div>
            </div>
          </div>

          {/* Rows */}
          <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
            {projects.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground/50">
                No active projects to display.
              </div>
            ) : (
              projects.map((p) => {
                const start = p.startDate ?? p.createdAt.slice(0, 10);
                const due = p.dueDate ?? start;
                const leftPct = getPercentage(start);
                const rightPct = getPercentage(due);
                const widthPct = Math.max(8, rightPct - leftPct);

                return (
                  <div key={p.id} className="flex items-center group cursor-pointer hover:bg-muted/30 p-2 rounded-xl transition-colors" onClick={() => openProject(p.id)}>
                    <div className="w-1/4 pr-4 min-w-0 flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                      <div className="min-w-0">
                        <span className="text-[13px] font-semibold text-foreground block truncate group-hover:text-primary transition-colors">{p.name}</span>
                      </div>
                    </div>

                    <div className="flex-1 relative h-8 rounded-lg overflow-hidden bg-muted/20 border border-border/30">
                      <div
                        className="absolute h-full top-0 rounded-md flex items-center justify-between px-3 overflow-hidden transition-all duration-300 shadow-sm"
                        style={{
                          left: `${leftPct}%`,
                          width: `${widthPct}%`,
                          backgroundColor: `${p.color}15`,
                          border: `1px solid ${p.color}40`,
                        }}
                      >
                        <span className="text-[10px] font-bold tracking-wide uppercase truncate z-10" style={{ color: p.color }}>
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
  const [view, setView] = useState<"grid" | "list" | "board" | "timeline">("grid");

  useEffect(() => {
    void loadProjects();
    void loadTasks();
  }, [loadProjects, loadTasks]);

  const projects = getFilteredProjects();

  const doneTasks   = allTasks.filter((t) => t.projectId != null && t.status === "done").length;
  const activeCount = projects.filter((p) => p.status === "active").length;

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden relative">
      
      {/* ── Minimalist Header ───────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between px-8 md:px-12 pt-14 pb-8 shrink-0">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">Projects</h1>
          <div className="flex gap-6 mt-5 text-[13px] font-medium text-muted-foreground">
            <span className="flex items-center gap-2">
              <Activity size={14} className="text-emerald-500" />
              {activeCount} Active
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-blue-500" />
              {doneTasks} Completed Tasks
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-6 md:mt-0">
          <div className="flex bg-muted/40 p-1 rounded-xl border border-border/40">
            {VIEW_TABS.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setView(id)}
                className={cn(
                  "inline-flex items-center justify-center w-10 h-8 rounded-lg transition-all duration-200 text-muted-foreground hover:text-foreground",
                  view === id && "bg-card text-foreground shadow-[0_2px_10px_rgb(0,0,0,0.04)] border border-border/50"
                )}
                title={label}
              >
                <Icon size={14} />
              </button>
            ))}
          </div>
          <button 
            onClick={openCreateModal} 
            className="h-10 px-4 bg-foreground text-background font-semibold rounded-xl text-[13px] flex items-center gap-2 shadow-sm hover:opacity-90 transition-opacity"
          >
            <Plus size={16} /> New Project
          </button>
        </div>
      </div>

      {/* ── Content Area ─────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-8 md:px-12 pb-12">
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center border border-dashed border-border/60 rounded-3xl">
            <div className="w-12 h-12 bg-muted rounded-2xl flex items-center justify-center text-muted-foreground mb-4">
              <LayoutGrid size={24} />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">No projects yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">Create a project to organise your work and track progress.</p>
            <button onClick={openCreateModal} className="h-9 px-4 bg-primary text-primary-foreground font-semibold rounded-lg text-[13px] shadow-sm hover:opacity-90">
              Create Project
            </button>
          </div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} view="grid" />
            ))}
          </div>
        ) : view === "list" ? (
          <div className="flex flex-col gap-3 max-w-5xl">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} view="list" />
            ))}
          </div>
        ) : view === "board" ? (
          <ProjectsBoardView projects={projects} />
        ) : (
          <ProjectsTimelineView projects={projects} />
        )}
      </div>

      {openProjectId && <ProjectDetail />}
      {createModalOpen && <CreateProjectModal />}
    </div>
  );
}
