import { useEffect, useState, useMemo } from "react";
import { Plus, LayoutGrid, List, FolderKanban, AlertTriangle, CalendarRange } from "lucide-react";
import { registry } from "@/kernel/router";
import { projectsManifest } from "./manifest";
import { useProjectStore } from "./store";
import { useTaskStore } from "@/modules/tasks/store";
import { ProjectCard } from "./components/ProjectCard";
import { ProjectDetail } from "./components/ProjectDetail";
import { CreateProjectModal } from "./components/CreateProjectModal";
import { FilterBar, PrimaryButton, EmptyState, type FilterTab } from "@/shared/ui";
import { cn, formatDate } from "@/shared/utils";
import type { Project, ProjectStatus } from "@/shared/types";

registry.register(projectsManifest);

const FILTER_TABS: FilterTab[] = [
  { id: "all",       label: "All" },
  { id: "active",    label: "Active" },
  { id: "on_hold",   label: "On hold" },
  { id: "completed", label: "Completed" },
  { id: "archived",  label: "Archived" },
];

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
    <div className="flex gap-4 h-full overflow-x-auto pb-4 select-none">
      {STATUS_OPTIONS.map((opt) => {
        const colProjects = projects.filter((p) => p.status === opt.value);
        return (
          <div key={opt.value} className="flex flex-col w-72 shrink-0 bg-muted/20 border border-border/50 rounded-xl p-3">
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-sm font-semibold text-foreground capitalize">{opt.label}</span>
              <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium tabular-nums">{colProjects.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
              {colProjects.length === 0 ? (
                <div className="border border-dashed border-border/55 rounded-lg py-8 text-center text-xs text-muted-foreground/40 italic">
                  No projects
                </div>
              ) : (
                colProjects.map((p) => (
                  <div key={p.id} className="cursor-pointer" onClick={() => openProject(p.id)}>
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
    <div className="border border-border/60 bg-card rounded-xl p-4 overflow-hidden flex flex-col h-full min-h-[400px]">
      <div className="flex items-center justify-between mb-4 border-b border-border pb-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <CalendarRange size={16} className="text-primary" />
          Project Roadmap Timeline
        </h3>
        <span className="text-[11px] text-muted-foreground/60">
          Timeline: {minDate.toISOString().slice(0, 10)} to {maxDate.toISOString().slice(0, 10)}
        </span>
      </div>

      <div className="flex-1 overflow-x-auto min-h-0 relative">
        <div className="min-w-[800px] h-full flex flex-col">
          {/* Header Row */}
          <div className="flex border-b border-border/40 pb-2 mb-2 text-[10px] uppercase font-bold text-muted-foreground tracking-wider select-none">
            <div className="w-1/4 shrink-0">Project</div>
            <div className="flex-1 relative h-6 border-l border-border/30">
              <div 
                className="absolute w-0.5 h-64 bg-red-500/40 z-10 pointer-events-none flex flex-col items-center"
                style={{ left: `${getPercentage(todayStr)}%` }}
              >
                <span className="bg-red-500 text-white text-[8px] px-1 py-0.5 rounded -mt-2.5 font-bold shadow">TODAY</span>
              </div>
              <div className="absolute left-0 text-left pl-1">Past</div>
              <div className="absolute right-0 text-right pr-1">Future</div>
            </div>
          </div>

          {/* Rows */}
          <div className="flex-1 overflow-y-auto space-y-4 min-h-0 pr-1">
            {projects.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground/40 italic">
                No active projects to display on roadmap.
              </div>
            ) : (
              projects.map((p) => {
                const start = p.startDate ?? p.createdAt.slice(0, 10);
                const due = p.dueDate ?? start;
                const leftPct = getPercentage(start);
                const rightPct = getPercentage(due);
                const widthPct = Math.max(8, rightPct - leftPct);

                return (
                  <div key={p.id} className="flex items-center group cursor-pointer hover:bg-muted/10 p-1.5 rounded-lg transition-fast" onClick={() => openProject(p.id)}>
                    <div className="w-1/4 pr-3 min-w-0 flex items-center gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-foreground leading-tight block truncate group-hover:text-primary transition-fast">{p.name}</span>
                        <span className="text-[10px] text-muted-foreground/60 block truncate mt-0.5">
                          {p.milestones.length} milestones
                        </span>
                      </div>
                    </div>

                    <div className="flex-1 relative h-10 bg-muted/10 rounded-lg border border-border/30 overflow-hidden">
                      <div
                        className="absolute h-6 top-2 rounded-md shadow-sm border flex items-center justify-between px-2 overflow-hidden transition-all duration-300 group-hover:shadow-md"
                        style={{
                          left: `${leftPct}%`,
                          width: `${widthPct}%`,
                          backgroundColor: `${p.color}15`,
                          borderColor: p.color,
                        }}
                      >
                        <div 
                          className="absolute left-0 top-0 bottom-0 opacity-15"
                          style={{
                            width: `${p.milestones.length > 0 ? (p.milestones.filter(m => m.completedAt).length / p.milestones.length) * 100 : 50}%`,
                            backgroundColor: p.color,
                          }}
                        />

                        <span className="text-[9px] font-bold tracking-tight uppercase truncate select-none z-10" style={{ color: p.color }}>
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

// ── KPI card ────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  total,
  accent,
  warn = false,
}: {
  label: string;
  value: number;
  total: number;
  accent: string;
  warn?: boolean;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="rounded-2xl border border-border/30 bg-card/45 dark:bg-card/20 backdrop-blur-md p-5 flex flex-col gap-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/25 group">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">{label}</p>
        {warn && value > 0 ? (
          <AlertTriangle size={14} className="text-red-500 animate-pulse shrink-0" />
        ) : (
          <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", accent)} />
        )}
      </div>
      <div className="flex items-baseline gap-1.5">
        <p className={cn(
          "text-3xl font-extrabold tabular-nums leading-none tracking-tight",
          warn && value > 0 ? "text-red-500" : "text-foreground",
        )}>
          {value}
        </p>
        {total > 0 && (
          <span className="text-xs text-muted-foreground/40 tabular-nums">
            / {total}
          </span>
        )}
      </div>
      <div className="space-y-1 mt-1">
        <div className="h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
          <div className={cn("h-full rounded-full transition-all duration-500", accent)} style={{ width: `${pct}%` }} />
        </div>
        <div className="flex justify-between items-center text-[9px] font-semibold text-muted-foreground/45 tabular-nums">
          <span>Progress</span>
          <span>{pct}%</span>
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
    openCreateModal, activeFilter, setActiveFilter,
  } = useProjectStore();
  const { loadTasks } = useTaskStore();

  const allTasks = useTaskStore((s) => s.tasks);
  const [view, setView] = useState<"grid" | "list" | "board" | "timeline">("grid");

  useEffect(() => {
    void loadProjects();
    void loadTasks();
  }, [loadProjects, loadTasks]);

  const projects = getFilteredProjects();

  // KPI aggregates across visible projects
  const totalTasks  = allTasks.filter((t) => t.projectId != null && t.status !== "archived").length;
  const doneTasks   = allTasks.filter((t) => t.projectId != null && t.status === "done").length;
  const today       = new Date().toISOString().slice(0, 10);
  const overdue     = allTasks.filter(
    (t) => t.projectId != null && t.status !== "done" && t.status !== "archived" && t.dueDate && t.dueDate < today,
  ).length;
  const activeCount = projects.filter((p) => p.status === "active").length;

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Row 1: Title + action ───────────────────────── */}
      <div className="flex items-center justify-between px-8 pt-7 pb-4 shrink-0 bg-card/15 backdrop-blur-sm border-b border-border/30">
        <div>
          <h1 className="text-2xl font-extrabold leading-none tracking-tight text-gradient">Projects</h1>
          <p className="text-[12px] text-muted-foreground/75 mt-2 font-medium">
            {projects.length} project{projects.length !== 1 ? "s" : ""}
          </p>
        </div>

        <PrimaryButton onClick={openCreateModal}>
          <Plus size={13} />
          New Project
        </PrimaryButton>
      </div>

      {/* ── Row 2: View switcher tabs (underline) ───────── */}
      <div className="flex items-center justify-between px-8 py-3 border-b border-border/30 bg-card/5 shrink-0 backdrop-blur-xs">
        <div className="bg-muted/50 dark:bg-muted/20 p-1 rounded-xl flex gap-1 border border-border/40">
          {VIEW_TABS.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-1.5 text-[12px] font-bold rounded-lg transition-all duration-200",
                view === id
                  ? "bg-card text-foreground shadow-sm border border-border/20 font-extrabold"
                  : "text-muted-foreground hover:text-foreground border border-transparent"
              )}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI DASHBOARD ───────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-8 py-6 bg-card/5 border-b border-border/30 shrink-0">
        <KpiCard label="Active"    value={activeCount} total={projects.length} accent="bg-emerald-500" />
        <KpiCard label="Tasks"     value={totalTasks}  total={totalTasks}      accent="bg-foreground/30" />
        <KpiCard label="Completed" value={doneTasks}   total={totalTasks}      accent="bg-blue-500" />
        <KpiCard label="Overdue"   value={overdue}     total={totalTasks}      accent="bg-red-500" warn />
      </div>

      {/* ── Filter bar ──────────────────────────────────── */}
      <FilterBar
        tabs={FILTER_TABS}
        activeId={activeFilter}
        onSelect={(id) => setActiveFilter(id as typeof activeFilter)}
      />

      {/* ── CONTENT AREA ─────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {projects.length === 0 ? (
          <EmptyState
            title={activeFilter === "all" ? "No projects yet" : `No ${activeFilter} projects`}
            subtitle="Create a project to organise your work and track progress."
            action={{ label: "New project", onClick: openCreateModal }}
          />
        ) : view === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} view="grid" />
            ))}
          </div>
        ) : view === "list" ? (
          <div className="flex flex-col gap-3">
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

      {openProjectId   && <ProjectDetail />}
      {createModalOpen && <CreateProjectModal />}
    </div>
  );
}
