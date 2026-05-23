import { bus } from "@/kernel/event-bus";
import { useNoteStore } from "./store";

export function setupNotesEventListeners(): () => void {
  const unsubs: Array<() => void> = [];

  // Future listeners for cross-module integration can be added here.
  // Note: note:created, note:updated, note:deleted, and note:link-to-task
  // are emitted directly by the useNoteStore.

  return () => unsubs.forEach((fn) => fn());
}
