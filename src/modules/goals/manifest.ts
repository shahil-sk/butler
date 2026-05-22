// ============================================================
// GOALS — MANIFEST
// Module stub. Full spec: Goals → Milestones → Tasks hierarchy.
// ============================================================

import type { ModuleManifest } from "@/shared/types";

export const goalsManifest: ModuleManifest = {
  id:   "goals",
  name: "Goals",
  icon: "Target",
  routes: [
    { path: "/goals", label: "Goals" },
  ],
  commands: [
    {
      id:     "goals:new",
      label:  "New Goal",
      group:  "Goals",
      action: "goal:quick-add",
    },
  ],
  shortcuts: [],
  sidebarOrder: 10,
  isEnabled:    false, // disabled until implementation complete
};
