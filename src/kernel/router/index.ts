// ============================================================
// BUTLER — ROUTER + MODULE REGISTRY (Kernel)
// Modules register themselves here at boot.
// Never hard-code module routes in shell components.
// ============================================================

import type { ModuleManifest } from "@/shared/types";
import { bus } from "@/kernel/event-bus";

// ── Module registry ──────────────────────────────────────────

class ModuleRegistry {
  private modules = new Map<string, ModuleManifest>();

  register(manifest: ModuleManifest): void {
    if (this.modules.has(manifest.id)) return; // idempotent
    this.modules.set(manifest.id, manifest);
    console.log(`[Registry] Module "${manifest.id}" registered.`);
  }

  get(id: string): ModuleManifest | undefined {
    return this.modules.get(id);
  }

  getAll(): ModuleManifest[] {
    return Array.from(this.modules.values()).sort(
      (a, b) => a.sidebarOrder - b.sidebarOrder
    );
  }

  getEnabled(): ModuleManifest[] {
    return this.getAll().filter((m) => m.isEnabled);
  }

  getAllCommands() {
    return this.getEnabled().flatMap((m) =>
      m.commands.map((cmd) => ({ ...cmd, moduleId: m.id, moduleName: m.name }))
    );
  }

  getAllShortcuts() {
    return this.getEnabled().flatMap((m) =>
      m.shortcuts.map((s) => ({ ...s, moduleId: m.id }))
    );
  }
}

export const registry = new ModuleRegistry();

// ── Navigation helpers ───────────────────────────────────────

export function navigate(path: string, replace = false): void {
  bus.emit("navigate:to", { path, replace });
}

export function navigateBack(): void {
  bus.emit("navigate:back", undefined);
}

// ── Global shortcut dispatcher ────────────────────────────────
// Attach once in App.tsx — maps key combos to bus events

export function setupGlobalShortcuts(): () => void {
  const handler = (e: KeyboardEvent) => {
    const combo = buildCombo(e);
    if (!combo) return;

    const shortcuts = registry.getAllShortcuts().filter((s) => s.global);
    const match = shortcuts.find((s) => s.keys === combo);
    if (!match) return;

    e.preventDefault();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bus.emit(match.action as any, undefined);
  };

  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}

function buildCombo(e: KeyboardEvent): string | null {
  if (["Meta", "Control", "Shift", "Alt"].includes(e.key)) return null;
  const parts: string[] = [];
  if (e.metaKey || e.ctrlKey) parts.push("cmd");
  if (e.shiftKey) parts.push("shift");
  if (e.altKey) parts.push("alt");
  parts.push(e.key.toLowerCase());
  return parts.join("+");
}
