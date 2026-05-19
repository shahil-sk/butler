// ============================================================
// DATABASE MODULE — Event listeners
// Call once: setupDatabaseEventListeners() in module useEffect
// ============================================================

import { bus } from "@/kernel/event-bus";
import { useDatabaseStore } from "./store";

export function setupDatabaseEventListeners(): () => void {
  const unsubs: Array<() => void> = [];

  // Reload rows when a row is created from another surface
  unsubs.push(
    bus.on("database:row:created", ({ databaseId }) => {
      const { rows, loadRows } = useDatabaseStore.getState();
      // Only reload if we already have rows loaded for this table
      if (rows[databaseId]) {
        void loadRows(databaseId);
      }
    })
  );

  // When a project is deleted, unlink any tables linked to it
  unsubs.push(
    bus.on("project:deleted", ({ projectId }) => {
      const { tables, updateTable } = useDatabaseStore.getState();
      tables
        .filter((t) => t.linkedProjectId === projectId)
        .forEach((t) => void updateTable(t.id, { linkedProjectId: undefined }));
    })
  );

  // When a note is deleted, unlink any tables linked to it
  unsubs.push(
    bus.on("note:deleted", ({ noteId }) => {
      const { tables, updateTable } = useDatabaseStore.getState();
      tables
        .filter((t) => t.linkedNoteId === noteId)
        .forEach((t) => void updateTable(t.id, { linkedNoteId: undefined }));
    })
  );

  // Autosave hook — database rows are persisted on every cell edit,
  // so autosave is a no-op here; we just invalidate search index.
  unsubs.push(
    bus.on("sync:autosave", () => {
      const { activeTableId } = useDatabaseStore.getState();
      if (activeTableId) {
        bus.emit("search:index-invalidated", { entityType: "database_row", id: activeTableId });
      }
    })
  );

  return () => unsubs.forEach((u) => u());
}
