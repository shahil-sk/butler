import type { ModuleManifest } from "@/shared/types";

export const projectsManifest: ModuleManifest = {
  id: "projects",
  name: "Projects",
  icon: "FolderKanban",
  sidebarOrder: 2,
  isEnabled: true,
  routes: [
    { path: "/projects",          label: "All Projects" },
    { path: "/projects/active",   label: "Active" },
    { path: "/projects/archived", label: "Archived" },
  ],
  commands: [
    { id: "project.new", label: "New project", group: "Projects", action: "project:quick-add" },
  ],
  shortcuts: [
    { keys: "g p", action: "navigate:to", description: "Go to Projects", global: false },
  ],
};
