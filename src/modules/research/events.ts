// ============================================================
// RESEARCH MODULE — EVENTS
// Call setupResearchEventListeners() once, inside module's useEffect.
// ============================================================

import { bus } from "@/kernel/event-bus";
import { generateId, now } from "@/shared/utils";
import { useResearchStore } from "./store";

export function setupResearchEventListeners(): () => void {
  const unsubs: Array<() => void> = [];

  // ── focus:session-started ───────────────────────────────
  // Notify user that reading context is preserved during the session.
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

  // ── focus:session-completed ─────────────────────────────
  // Offer to create a summary annotation for the active document / thread.
  unsubs.push(
    bus.on("focus:session-completed", ({ session }) => {
      const { activeDocumentId, activeThreadId } = useResearchStore.getState();
      if (activeDocumentId || activeThreadId) {
        bus.emit("ui:notification", {
          id: `research-session-done-${session.id}`,
          type: "info",
          message: "Focus session complete. Add a research annotation?",
          durationMs: 6000,
          action: {
            label: "Add annotation",
            event: "research:open-annotation-modal",
            payload: { documentId: activeDocumentId, threadId: activeThreadId },
          },
        });
      }
    })
  );

  // ── task:deleted ────────────────────────────────────────
  // Clean linkedTaskId from both highlights AND annotations.
  unsubs.push(
    bus.on("task:deleted", ({ taskId }) => {
      const store = useResearchStore.getState();

      store.highlights
        .filter((h) => h.linkedTaskId === taskId)
        .forEach((h) => void store.updateHighlight(h.id, { linkedTaskId: undefined }));

      store.annotations
        .filter((a) => a.linkedTaskId === taskId)
        .forEach((a) => void store.updateAnnotation(a.id, a.content));
    })
  );

  // ── note:deleted ────────────────────────────────────────
  // Clean linkedNoteId from both highlights AND annotations.
  unsubs.push(
    bus.on("note:deleted", ({ noteId }) => {
      const store = useResearchStore.getState();

      store.highlights
        .filter((h) => h.linkedNoteId === noteId)
        .forEach((h) => void store.updateHighlight(h.id, { linkedNoteId: undefined }));

      store.annotations
        .filter((a) => a.linkedNoteId === noteId)
        .forEach((a) => void store.updateAnnotation(a.id, a.content));
    })
  );

  // ── project:archived ────────────────────────────────────
  // Remove the archived project from all thread linkedProjectIds.
  unsubs.push(
    bus.on("project:archived", ({ projectId }) => {
      const store = useResearchStore.getState();
      store.threads
        .filter((t) => t.linkedProjectIds.includes(projectId))
        .forEach((t) =>
          void store.updateThread(t.id, {
            linkedProjectIds: t.linkedProjectIds.filter((id) => id !== projectId),
          })
        );
    })
  );

  // ── Outbound: invalidate search index ───────────────────
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
