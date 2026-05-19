// ============================================================
// PROJECTS MODULE — index.tsx
// ============================================================

import { useEffect, useState } from "react";
import { Plus, LayoutGrid, List, FolderKanban, AlertTriangle } from "lucide-react";
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

const VIEW_TABS = [
  { id: "grid" as const, icon: LayoutGrid, label: "Grid" },
  { id: "list" as const, icon: List,        label: "List" },
];

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
    <div className="rounded-xl border border-border bg-card px-4 pt-3 pb-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </p>
        {warn && value > 0 && <AlertTriangle size={12} className="text-red-500" />}
      </div>
      <p
        className={cn(
          "text-[26px] font-bold tabular-nums leading-none",
          warn && value > 0 ? "text-red-500" : "text-foreground",
        )}
      >
        {value}
      </p>
      <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", accent)}
          style={{ width: `${pct}%` }}
        />
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

  const allTasks = useTaskStore((s) => s.tasks);
  const [view, setView] = useState<"grid" | "list">("grid");

  useEffect(() => { void loadProjects(); }, []);

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
      <div className="flex items-center justify-between px-6 pt-6 pb-3 shrink-0">
        <div>
          <h1 className="text-[18px] font-bold leading-tight tracking-tight">Projects</h1>
          <p className="text-[12px] text-muted-foreground mt-0.5 leading-tight">
            {projects.length} project{projects.length !== 1 ? "s" : ""}
          </p>
        </div>

        <PrimaryButton onClick={openCreateModal}>
          <Plus size={13} />
          New project
        </PrimaryButton>
      </div>

      {/* ── Row 2: View switcher tabs (underline) ───────── */}
      <div className="flex items-center px-6 border-b border-border shrink-0">
        {VIEW_TABS.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-3 text-[13px] font-medium",
              "border-b-2 -mb-px transition-colors",
              view === id
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
            )}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* ── KPI strip ───────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3 px-6 py-4 shrink-0">
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

      {/* ── Content ─────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
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
