import type { ModuleManifest } from "@/shared/types";

export const databaseManifest: ModuleManifest = {
  id: "database",
  name: "Database",
  icon: "table",
  routes: [
    { path: "/database", label: "All Tables" },
  ],
  commands: [
    {
      id: "database:new-table",
      label: "New Table",
      shortcut: "g d n",
      group: "Database",
      action: "navigate:to",
    },
  ],
  shortcuts: [
    {
      keys: "g d",
      action: "navigate:to",
      description: "Go to Database",
      global: true,
    },
  ],
  sidebarOrder: 8,
  isEnabled: true,
};
