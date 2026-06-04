import type { ModuleManifest } from "@/shared/types";

export const AI_MANIFEST: ModuleManifest = {
  id: "ai",
  name: "AI Assistant",
  icon: "Bot",
  routes: [{ path: "/ai", label: "AI Assistant" }],
  commands: [
    { id: "ai.open",    label: "Open AI Assistant",  action: "navigate:to", group: "AI" },
    { id: "ai.chat",    label: "New AI conversation", action: "ai:open-chat", group: "AI" },
    { id: "ai.nl-task", label: "Parse task with AI",  action: "ai:nl-task",  group: "AI" },
  ],
  shortcuts: [
    { keys: "g a", action: "navigate:to", description: "Go to AI Assistant", global: false },
  ],
  sidebarOrder: 90,
  isEnabled: true,
};

