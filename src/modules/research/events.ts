// ============================================================
// RESEARCH MODULE — EVENTS
// Call setupResearchEventListeners() once, inside module's useEffect.
// ============================================================

import { bus } from "@/kernel/event-bus";
import { useResearchStore } from "./store";

export function setupResearchEventListeners(): () => void {
  const unsubs: Array<() => void> = [];

  // When focus session starts — offer to restore reading context
  unsubs.push(
    bus.on("focus:session-started", ({ session }) => {
      const { activeSourceId, activeThreadId } = useResearchStore.getState();
      if (activeSourceId || activeThreadId) {
        bus.emit("ui:notification", {
          id: `research-focus-${session.id}`,
          type: "info",
          message: "Reading context saved. Resume after focus session.",
          durationMs: 3000,
        });
      }
    })
  );

  // When a task is deleted — clean linkedTaskId from highlights + annotations
  unsubs.push(
    bus.on("task:deleted", ({ taskId }) => {
      const store = useResearchStore.getState();
      store.highlights
        .filter((h) => h.linkedTaskId === taskId)
        .forEach((h) => void store.updateHighlight(h.id, { linkedTaskId: undefined }));
      // annotations: no direct mutation needed — task link is informational only
    })
  );

  // When a note is deleted — clean linkedNoteId from highlights
  unsubs.push(
    bus.on("note:deleted", ({ noteId }) => {
      const store = useResearchStore.getState();
      store.highlights
        .filter((h) => h.linkedNoteId === noteId)
        .forEach((h) => void store.updateHighlight(h.id, { linkedNoteId: undefined }));
    })
  );

  // Invalidate search index when research changes
  unsubs.push(
    bus.on("research:source-imported", ({ source }) =>
      bus.emit("search:index-invalidated", { entityType: "research_document", id: source.id })
    )
  );
  unsubs.push(
    bus.on("research:highlight-created", ({ highlight }) =>
      bus.emit("search:index-invalidated", { entityType: "research_chunk", id: highlight.chunkId })
    )
  );
  unsubs.push(
    bus.on("research:thread-created", ({ thread }) =>
      bus.emit("search:index-invalidated", { entityType: "research_thread", id: thread.id })
    )
  );

  return () => unsubs.forEach((fn) => fn());
}
