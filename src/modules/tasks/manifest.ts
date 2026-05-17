// ============================================================
// TASKS MODULE — MANIFEST
// ============================================================

import type { ModuleManifest } from "@/shared/types";

export const tasksManifest: ModuleManifest = {
  id: "tasks",
  name: "Tasks",
  icon: "CheckSquare",
  sidebarOrder: 1,
  isEnabled: true,
  routes: [
    { path: "/tasks",          label: "All Tasks",   icon: "List" },
    { path: "/tasks/today",    label: "Today",       icon: "Sun" },
    { path: "/tasks/upcoming", label: "Upcoming",    icon: "CalendarDays" },
    { path: "/tasks/overdue",  label: "Overdue",     icon: "AlertCircle" },
    { path: "/tasks/inbox",    label: "Inbox",       icon: "Inbox" },
  ],
  commands: [
    { id: "task.new",         label: "New task",           group: "Tasks", action: "task:quick-add",   shortcut: "c" },
    { id: "task.today",       label: "Go to Today",        group: "Tasks", action: "navigate:to",      shortcut: "g t" },
    { id: "task.inbox",       label: "Go to Inbox",        group: "Tasks", action: "navigate:to",      shortcut: "g i" },
    { id: "task.upcoming",    label: "Go to Upcoming",     group: "Tasks", action: "navigate:to",      shortcut: "g u" },
  ],
  shortcuts: [
    { keys: "c",       action: "task:quick-add", description: "New task",     global: false },
    { keys: "cmd+enter", action: "task:quick-add", description: "New task",   global: true  },
  ],
};
