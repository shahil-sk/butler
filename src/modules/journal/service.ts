// ============================================================
// JOURNAL — SERVICE
// Business logic only. Calls repository.*; no direct db import.
// ============================================================

import { bus } from "@/kernel/event-bus";
import { generateId, now, today } from "@/shared/utils";
import {
  dbLoadAllEntries,
  dbFindDailyEntry,
  dbInsertEntry,
  dbUpdateEntry,
  dbDeleteEntry,
} from "./repository";
import { type JournalEntry, type JournalEntryType } from "./types";

export type { JournalEntry, JournalEntryType };

// ── Factory ──────────────────────────────────────────────────

export function buildEntry(
  partial: Partial<JournalEntry> & { type: JournalEntryType; date: string }
): JournalEntry {
  return {
    id:               generateId(),
    date:             partial.date,
    type:             partial.type,
    content:          partial.content ?? "{}",
    mood:             partial.mood,
    linkedTaskIds:    partial.linkedTaskIds    ?? [],
    linkedProjectIds: partial.linkedProjectIds ?? [],
    tags:             partial.tags             ?? [],
    createdAt:        now(),
    updatedAt:        now(),
  };
}

// ── Load ─────────────────────────────────────────────────────

export async function loadEntries(): Promise<JournalEntry[]> {
  return dbLoadAllEntries();
}

// ── Create ──────────────────────────────────────────────────

export async function createEntry(
  partial: Partial<JournalEntry> & { type: JournalEntryType; date: string }
): Promise<JournalEntry> {
  const entry = buildEntry(partial);
  await dbInsertEntry(entry);
  bus.emit("journal:entry-created", { entry });
  bus.emit("ui:notification", {
    id:         generateId(),
    type:       "success",
    message:    "Journal entry created",
    durationMs: 2000,
  });
  return entry;
}

// ── Update ──────────────────────────────────────────────────

export async function updateEntry(
  entry: JournalEntry,
  changes: Partial<JournalEntry>
): Promise<JournalEntry> {
  const updated: JournalEntry = { ...entry, ...changes, updatedAt: now() };
  await dbUpdateEntry(updated);
  bus.emit("journal:entry-updated", { entry: updated });
  return updated;
}

// ── Delete ──────────────────────────────────────────────────

export async function deleteEntry(id: string): Promise<void> {
  await dbDeleteEntry(id);
  bus.emit("search:index-invalidated", { entityType: "journal", id });
}

// ── getOrCreateDaily ──────────────────────────────────────────
// Takes the current in-memory entries list to avoid a redundant
// DB round-trip when the entry is already loaded.

export async function getOrCreateDaily(
  entries: JournalEntry[],
  date: string = today()
): Promise<{ entry: JournalEntry; wasCreated: boolean }> {
  // 1. Check in-memory
  const inMemory = entries.find((e) => e.date === date && e.type === "daily");
  if (inMemory) return { entry: inMemory, wasCreated: false };

  // 2. Check DB (prior session)
  const inDb = await dbFindDailyEntry(date);
  if (inDb) return { entry: inDb, wasCreated: false };

  // 3. Create new
  const entry = await createEntry({ type: "daily", date });
  return { entry, wasCreated: true };
}

// ── Task linking ──────────────────────────────────────────────

export async function linkTask(
  entry: JournalEntry,
  taskId: string
): Promise<JournalEntry | null> {
  if (entry.linkedTaskIds.includes(taskId)) return null; // already linked
  return updateEntry(entry, { linkedTaskIds: [...entry.linkedTaskIds, taskId] });
}

export async function unlinkTask(
  entry: JournalEntry,
  taskId: string
): Promise<JournalEntry> {
  return updateEntry(entry, {
    linkedTaskIds: entry.linkedTaskIds.filter((id) => id !== taskId),
  });
}
