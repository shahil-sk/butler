// ============================================================
// SETTINGS MODULE — MANIFEST
// ============================================================

import type { ModuleManifest } from "@/shared/types";

export const SETTINGS_MANIFEST: ModuleManifest = {
  id: "settings",
  name: "Settings",
  icon: "Settings",
  sidebarOrder: 100, // shown via icon button, not main nav list
  isEnabled: true,
  routes: [
    { path: "/settings",              label: "General",      icon: "Settings" },
    { path: "/settings/integrations", label: "Integrations", icon: "Zap"      },
    { path: "/settings/shortcuts",    label: "Shortcuts",    icon: "Keyboard" },
    { path: "/settings/appearance",   label: "Appearance",   icon: "Palette"  },
  ],
  commands: [
    { id: "settings.open",        label: "Open Settings",      group: "App", action: "navigate:to", shortcut: "cmd+," },
    { id: "settings.appearance",  label: "Appearance Settings", group: "App", action: "navigate:to" },
  ],
  shortcuts: [
    { keys: "cmd+,", action: "navigate:to", description: "Open Settings", global: true },
  ],
};
