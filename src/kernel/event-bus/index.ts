// ============================================================
// BUTLER — EVENT BUS (Kernel)
// Typed pub/sub. ONLY way modules communicate with each other.
// Never import another module's store directly.
// ============================================================

import type {
  ID,
  Task,
  Project,
  Note,
  CalendarEvent,
  FocusSession,
  TimeEntry,
  JournalEntry,
  SearchResult,
} from "@/shared/types";

// ── Event map — add new events here as modules are built ─────

export interface ButlerEventMap {
  // ── Navigation ────────────────────────────────────────────
  "navigate:to": { path: string; replace?: boolean };
  "navigate:back": void;

  // ── Command palette ───────────────────────────────────────
  "command-palette:open": void;
  "command-palette:close": void;
  "command-palette:execute": { commandId: string };

  // ── Task events ───────────────────────────────────────────
  "task:created": { task: Task };
  "task:updated": { task: Task; changed: Partial<Task> };
  "task:deleted": { taskId: ID };
  "task:completed": { taskId: ID; completedAt: string };
  "task:restored": { taskId: ID };
  "task:moved": { taskId: ID; toProjectId: ID | null };
  "task:quick-add": { prefill?: Partial<Task> };
  "task:open": { taskId: ID };

  // ── Project events ────────────────────────────────────────
  "project:created": { project: Project };
  "project:updated": { project: Project; changed: Partial<Project> };
  "project:deleted": { projectId: ID };
  "project:open": { projectId: ID };

  // ── Note events ───────────────────────────────────────────
  "note:created": { note: Note };
  "note:updated": { note: Note };
  "note:deleted": { noteId: ID };
  "note:open": { noteId: ID };
  "note:link-to-task": { noteId: ID; taskId: ID };

  // ── Calendar events ───────────────────────────────────────
  "calendar:event-created": { event: CalendarEvent };
  "calendar:event-updated": { event: CalendarEvent };
  "calendar:event-deleted": { eventId: ID };
  "calendar:time-block-created": { event: CalendarEvent; taskId?: ID };

  // ── Focus events ──────────────────────────────────────────
  "focus:start-requested": { taskId?: ID };  // any module requests focus on a task
  "focus:session-started": { session: FocusSession };
  "focus:session-paused": { sessionId: ID };
  "focus:session-resumed": { sessionId: ID };
  "focus:session-completed": { session: FocusSession };
  "focus:session-cancelled": { sessionId: ID };
  "focus:tick": { sessionId: ID; remainingSeconds: number };

  // ── Time tracking events ──────────────────────────────────
  "time:entry-created": { entry: TimeEntry };
  "time:entry-updated": { entry: TimeEntry };
  "time:entry-deleted": { entryId: ID };
  "time:timer-started": { entryId: ID };
  "time:timer-stopped": { entryId: ID };

  // ── Journal events ────────────────────────────────────────
  "journal:entry-created": { entry: JournalEntry };
  "journal:entry-updated": { entry: JournalEntry };
  "journal:open-date": { date: string };

  // ── Search events ─────────────────────────────────────────
  "search:open": { query?: string };
  "search:close": void;
  "search:result-selected": { result: SearchResult };
  "search:index-invalidated": { entityType: string; id: ID };

  // ── UI / Shell events ─────────────────────────────────────
  "ui:sidebar-toggle": void;
  "ui:theme-changed": { theme: "light" | "dark" | "system" };
  "ui:panel-open": { panelId: string; props?: Record<string, unknown> };
  "ui:panel-close": { panelId: string };
  "ui:notification": { id: ID; type: "info" | "success" | "warning" | "error"; message: string; durationMs?: number };

  // ── Sync / Persistence ────────────────────────────────────
  "sync:autosave": void;
  "sync:conflict": { entityType: string; entityId: ID };

  // ── AI hooks (future phase 2) ─────────────────────────────
  "ai:context-update": { context: Record<string, unknown> };
  "ai:suggestion": { type: string; payload: unknown };
}

export type ButlerEventKey = keyof ButlerEventMap;
export type ButlerEventPayload<K extends ButlerEventKey> = ButlerEventMap[K];

type Listener<K extends ButlerEventKey> = (
  payload: ButlerEventPayload<K>
) => void | Promise<void>;

type ListenerEntry = {
  listener: Listener<ButlerEventKey>;
  once: boolean;
};

// ── Event Bus implementation ─────────────────────────────────

class EventBus {
  private listeners = new Map<ButlerEventKey, Set<ListenerEntry>>();
  private history: Array<{ event: ButlerEventKey; payload: unknown; ts: number }> = [];
  private readonly MAX_HISTORY = 100;

  on<K extends ButlerEventKey>(event: K, listener: Listener<K>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const entry: ListenerEntry = { listener: listener as Listener<ButlerEventKey>, once: false };
    this.listeners.get(event)!.add(entry);

    // Return unsubscribe fn
    return () => this.off(event, listener);
  }

  once<K extends ButlerEventKey>(event: K, listener: Listener<K>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const entry: ListenerEntry = { listener: listener as Listener<ButlerEventKey>, once: true };
    this.listeners.get(event)!.add(entry);
    return () => this.listeners.get(event)?.forEach((e) => { if (e === entry) this.listeners.get(event)?.delete(e); });
  }

  off<K extends ButlerEventKey>(event: K, listener: Listener<K>): void {
    const entries = this.listeners.get(event);
    if (!entries) return;
    entries.forEach((entry) => {
      if (entry.listener === (listener as Listener<ButlerEventKey>)) {
        entries.delete(entry);
      }
    });
  }

  emit<K extends ButlerEventKey>(event: K, payload: ButlerEventPayload<K>): void {
    // Record history
    this.history.push({ event, payload, ts: Date.now() });
    if (this.history.length > this.MAX_HISTORY) this.history.shift();

    const entries = this.listeners.get(event);
    if (!entries) return;

    const toDelete: ListenerEntry[] = [];
    entries.forEach((entry) => {
      try {
        void entry.listener(payload as ButlerEventPayload<ButlerEventKey>);
      } catch (err) {
        console.error(`[EventBus] Error in listener for "${event}":`, err);
      }
      if (entry.once) toDelete.push(entry);
    });
    toDelete.forEach((e) => entries.delete(e));
  }

  /** Returns last N emitted events (for debugging / AI context) */
  getHistory(n = 20) {
    return this.history.slice(-n);
  }

  /** Remove all listeners for an event — call on module unmount */
  clear(event: ButlerEventKey): void {
    this.listeners.delete(event);
  }

  /** Remove all listeners — call on app teardown */
  clearAll(): void {
    this.listeners.clear();
  }
}

// Singleton — import this everywhere
export const bus = new EventBus();

// ── React hook ───────────────────────────────────────────────

import { useEffect } from "react";

export function useBusEvent<K extends ButlerEventKey>(
  event: K,
  listener: Listener<K>,
  deps: React.DependencyList = []
): void {
  useEffect(() => {
    const unsub = bus.on(event, listener);
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
