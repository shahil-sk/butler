// ============================================================
// JOURNAL MODULE — EVENTS
// Call setupJournalEventListeners() once in module's useEffect.
// ============================================================

import { bus } from "@/kernel/event-bus";
import { useJournalStore } from "./store";

export function setupJournalEventListeners(): () => void {
  const unsubs: Array<() => void> = [];

  // Auto-link completed tasks when opening today's daily entry
  // IntegrationLayer handles the heavier cross-module side effects.
  // Here we just react to journal:open-date to load/create the entry.
  unsubs.push(
    bus.on("journal:open-date", ({ date }) => {
      void useJournalStore.getState().getOrCreateDaily(date);
    })
  );

  // Autosave on sync:autosave — store is already reactive; this is a no-op
  // hook for future dirty-tracking if needed.
  unsubs.push(
    bus.on("sync:autosave", () => {
      // Journal auto-saves on every updateEntry call.
      // No additional action needed here.
    })
  );

  return () => unsubs.forEach((fn) => fn());
}
