// ============================================================
// NOTES — EVENT BUS LISTENERS
// Wire notes module to cross-module bus events.
// Call useNoteEventListeners() from the Notes UI component.
// ============================================================

import { useEffect } from "react";
import { bus } from "@/kernel/event-bus";
import { useNoteStore } from "./store";

export function useNoteEventListeners() {
  const updateNote = useNoteStore((s) => s.updateNote);
  const notes      = useNoteStore((s) => s.notes);

  useEffect(() => {
    // ── task:deleted → remove task link from all notes ──────
    const offTaskDeleted = bus.on("task:deleted", ({ taskId }) => {
      for (const note of notes) {
        if (note.linkedTaskIds.includes(taskId)) {
          void updateNote(note.id, {
            linkedTaskIds: note.linkedTaskIds.filter((id) => id !== taskId),
          });
        }
      }
    });

    // ── project:deleted → remove project link from all notes ─
    const offProjectDeleted = bus.on("project:deleted", ({ projectId }) => {
      for (const note of notes) {
        if (note.linkedProjectIds.includes(projectId)) {
          void updateNote(note.id, {
            linkedProjectIds: note.linkedProjectIds.filter((id) => id !== projectId),
          });
        }
      }
    });

    return () => {
      offTaskDeleted();
      offProjectDeleted();
    };
  }, [notes, updateNote]);
}
