import type { ModuleManifest } from "@/shared/types";

export const GOALS_MANIFEST: ModuleManifest = {
  id: "goals",
  name: "Goals",
  icon: "Target",
  routes: [
    { path: "/goals", label: "Goals Dashboard", icon: "Target" },
  ],
  commands: [
    {
      id: "goals:new-goal",
      label: "New Goal",
      shortcut: "g g n",
      group: "Goals",
      action: "navigate:to",
    },
  ],
  shortcuts: [
    {
      keys: "g g",
      action: "navigate:to",
      description: "Go to Goals",
      global: true,
    },
  ],
  sidebarOrder: 5,
  isEnabled: true,
};
