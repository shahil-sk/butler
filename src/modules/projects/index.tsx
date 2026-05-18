// ============================================================
// PROJECTS MODULE — index.tsx
// ============================================================

import { useEffect, useState } from "react";
import { Plus, LayoutGrid, List, FolderKanban } from "lucide-react";
import { registry } from "@/kernel/router";
import { projectsManifest } from "./manifest";
import { useProjectStore } from "./store";
import { useTaskStore } from "@/modules/tasks/store";
import { ProjectCard } from "./components/ProjectCard";
import { ProjectDetail } from "./components/ProjectDetail";
import { CreateProjectModal } from "./components/CreateProjectModal";
import { FilterBar, PrimaryButton, EmptyState, type FilterTab } from "@/shared/ui";
import { cn } from "@/shared/utils";

registry.register(projectsManifest);

const FILTER_TABS: FilterTab[] = [
  { id: "all",       label: "All" },
  { id: "active",    label: "Active" },
  { id: "on_hold",   label: "On hold" },
  { id: "completed", label: "Completed" },
  { id: "archived",  label: "Archived" },
];

export function ProjectsModule() {
  const {
    loadProjects, getFilteredProjects,
    openProjectId, createModalOpen,
    openCreateModal, activeFilter, setActiveFilter,
  } = useProjectStore();

  const allTasks = useTaskStore((s) => s.tasks);
  const [view, setView] = useState<"grid" | "list">("grid");

  useEffect(() => { void loadProjects(); }, []);

  const projects = getFilteredProjects();

  // KPI aggregates across visible projects
  const totalTasks  = allTasks.filter((t) => t.projectId != null && t.status !== "archived").length;
  const doneTasks   = allTasks.filter((t) => t.projectId != null && t.status === "done").length;
  const today       = new Date().toISOString().slice(0, 10);
  const overdue     = allTasks.filter(
    (t) => t.projectId != null && t.status !== "done" && t.status !== "archived" && t.dueDate && t.dueDate < today
  ).length;
  const activeCount = projects.filter((p) => p.status === "active").length;

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Page header ────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 px-5 pt-5 pb-4 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "hsl(var(--color-primary) / 0.12)" }}>
            <FolderKanban size={16} style={{ color: "hsl(var(--color-primary))" }} />
          </div>
          <div>
            <h1 className="text-[17px] font-semibold leading-tight tracking-tight">Projects</h1>
            <p className="text-[12px] text-muted-foreground leading-tight">
              {projects.length} project{projects.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center rounded-md border border-border overflow-hidden">
            <button
              onClick={() => setView("grid")}
              className={cn(
                "p-1.5 transition-fast",
                view === "grid"
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Grid view"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setView("list")}
              className={cn(
                "p-1.5 transition-fast border-l border-border",
                view === "list"
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="List view"
            >
              <List size={14} />
            </button>
          </div>

          <PrimaryButton onClick={openCreateModal}>
            <Plus size={13} />
            New project
          </PrimaryButton>
        </div>
      </div>

      {/* ── KPI strip ───────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3 px-5 pb-4 shrink-0">
        {[
          { label: "Active",     value: activeCount,  color: "text-emerald-500" },
          { label: "Tasks",      value: totalTasks,   color: "text-foreground" },
          { label: "Completed",  value: doneTasks,    color: "text-blue-500" },
          { label: "Overdue",    value: overdue,      color: overdue > 0 ? "text-red-500" : "text-muted-foreground" },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-border bg-card px-4 py-3"
          >
            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide mb-1">
              {kpi.label}
            </p>
            <p className={cn("text-[22px] font-bold tabular-nums leading-none", kpi.color)}>
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Filter bar ───────────────────────────────────── */}
      <FilterBar
        tabs={FILTER_TABS}
        activeId={activeFilter}
        onSelect={(id) => setActiveFilter(id as typeof activeFilter)}
      />

      {/* ── Content ─────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
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
        ) : (
          <div className="flex flex-col gap-2">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} view="list" />
            ))}
          </div>
        )}
      </div>

      {openProjectId   && <ProjectDetail />}
      {createModalOpen && <CreateProjectModal />}
    </div>
  );
}
