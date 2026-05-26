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
  let lastKey = "";
  let lastTime = 0;

  const handler = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const isInput =
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable;

    const combo = buildCombo(e);
    if (!combo) return;

    const shortcuts = registry.getAllShortcuts();

    // 1. Check direct combos (e.g. "cmd+enter", "c")
    const match = shortcuts.find((s) => {
      const matchKeys = s.keys.toLowerCase() === combo.toLowerCase();
      if (!matchKeys) return false;
      if (s.global) return true;
      return !isInput;
    });

    if (match) {
      e.preventDefault();
      let payload: any = undefined;
      if (match.action === "navigate:to") {
        const mod = registry.get(match.moduleId);
        const path = mod?.routes[0]?.path;
        if (path) payload = { path };
      } else if (match.action === "journal:open-date") {
        const todayStr = new Date().toISOString().slice(0, 10);
        payload = { date: todayStr };
      }
      bus.emit(match.action as any, payload);
      lastKey = "";
      return;
    }

    // 2. Check sequential shortcuts (e.g. "g n", "c n")
    if (!isInput) {
      const now = Date.now();
      const currentKey = e.key.toLowerCase();

      if (lastKey && now - lastTime < 1000) {
        const fullSequence = `${lastKey} ${currentKey}`;
        const seqMatch = shortcuts.find(
          (s) => s.keys.toLowerCase() === fullSequence.toLowerCase()
        );

        if (seqMatch) {
          e.preventDefault();
          let payload: any = undefined;
          if (seqMatch.action === "navigate:to") {
            const mod = registry.get(seqMatch.moduleId);
            const path = mod?.routes[0]?.path;
            if (path) payload = { path };
          } else if (seqMatch.action === "journal:open-date") {
            const todayStr = new Date().toISOString().slice(0, 10);
            payload = { date: todayStr };
          }
          bus.emit(seqMatch.action as any, payload);
          lastKey = "";
          return;
        }
      }

      // Record first key of potential sequence
      if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        lastKey = currentKey;
        lastTime = now;
      } else {
        lastKey = "";
      }
    }
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
