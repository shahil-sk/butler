// src/modules/notes/events.ts
// Module-level bus listeners for cross-module reactions.
// Call registerNoteEventListeners() once at app startup (not inside a React component).
// This replaces the previous React-hook pattern that re-registered listeners
// on every render whenever `notes` or `updateNote` changed reference.

import { bus } from '@/kernel/event-bus';
import { handleTaskDeleted, handleProjectDeleted } from './service';
import { useNoteStore } from './store';

export function registerNoteEventListeners(): () => void {
  // ── task:deleted → unlink from all notes ──────────────────────────
  const offTaskDeleted = bus.on('task:deleted', async ({ taskId }: { taskId: string }) => {
    await handleTaskDeleted(taskId);
    // Sync in-memory store: re-fetch affected notes from DB state.
    // Simpler than patching each note individually — notes list is small.
    const { loadNotes } = useNoteStore.getState();
    void loadNotes();
  });

  // ── project:deleted → unlink from all notes ───────────────────────
  const offProjectDeleted = bus.on('project:deleted', async ({ projectId }: { projectId: string }) => {
    await handleProjectDeleted(projectId);
    const { loadNotes } = useNoteStore.getState();
    void loadNotes();
  });

  // Return a cleanup function for use in test teardown or HMR.
  return () => {
    offTaskDeleted();
    offProjectDeleted();
  };
}

// Re-export typed emitter helpers for use in service.ts or UI code.
export const noteEvents = {
  emit: {
    created:  (note: import('./types').Note) => bus.emit('note:created',  { note }),
    updated:  (note: import('./types').Note) => bus.emit('note:updated',  { note }),
    deleted:  (id: string)                   => bus.emit('note:deleted',  { noteId: id }),
    opened:   (id: string)                   => bus.emit('note:open',     { noteId: id }),
  },
};
