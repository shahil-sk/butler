import { useEffect } from "react";
import { Plus } from "lucide-react";
import { registry } from "@/kernel/router";
import { projectsManifest } from "./manifest";
import { useProjectStore } from "./store";
import { ProjectCard } from "./components/ProjectCard";
import { ProjectDetail } from "./components/ProjectDetail";
import { CreateProjectModal } from "./components/CreateProjectModal";
import { PageHeader, FilterBar, PrimaryButton, EmptyState, type FilterTab } from "@/shared/ui";

// Register manifest (idempotent)
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

  useEffect(() => { void loadProjects(); }, []);

  const projects = getFilteredProjects();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeader title="Projects" count={projects.length}>
        <PrimaryButton onClick={openCreateModal}>
          <Plus size={13} />
          New project
        </PrimaryButton>
      </PageHeader>

      <FilterBar
        tabs={FILTER_TABS}
        activeId={activeFilter}
        onSelect={(id) => setActiveFilter(id as typeof activeFilter)}
      />

      <div className="flex-1 overflow-y-auto p-4">
        {projects.length === 0 ? (
          <EmptyState
            title={activeFilter === "all" ? "No projects yet" : `No ${activeFilter} projects`}
            subtitle="Create a project to organize your work and track progress."
            action={{ label: "New project", onClick: openCreateModal }}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        )}
      </div>

      {openProjectId   && <ProjectDetail />}
      {createModalOpen && <CreateProjectModal />}
    </div>
  );
}
