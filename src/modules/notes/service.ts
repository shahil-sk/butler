// src/modules/notes/service.ts
// Business logic only.
// Calls repository for DB access. Emits bus events.
// No direct db import, no store import, no UI imports.

import { generateId, now, today } from '@/shared/utils';
import { bus } from '@/kernel/event-bus';
import * as repo from './repository';
import type { Note, CreateNoteInput, UpdateNoteInput, NoteFilter, NoteFtsResult } from './types';

// ── Reads ──────────────────────────────────────────────────────────

export async function loadNotes(): Promise<Note[]> {
  return repo.findAllNotes();
}

export async function searchNotes(query: string): Promise<NoteFtsResult[]> {
  if (!query.trim()) return [];
  return repo.searchNotesFts(query);
}

// ── In-memory filters (pure, called from store selectors) ────────────────

export function filterNotes(
  notes: Note[],
  filter: NoteFilter,
  query: string,
): Note[] {
  let result = notes;

  if (filter === 'pinned') {
    result = result.filter((n) => n.isPinned);
  } else if (filter !== 'all') {
    result = result.filter((n) => n.type === filter);
  }

  if (query.trim()) {
    const q = query.toLowerCase();
    result = result.filter(
      (n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q),
    );
  }

  return result;
}

// ── Writes ──────────────────────────────────────────────────────────

export async function createNote(input: CreateNoteInput = {}): Promise<Note> {
  const ts = now();
  const note: Note = {
    id:               generateId(),
    title:            input.title            ?? 'Untitled',
    content:          input.content          ?? JSON.stringify({ type: 'doc', content: [] }),
    type:             input.type             ?? 'note',
    date:             input.date,
    linkedTaskIds:    input.linkedTaskIds    ?? [],
    linkedProjectIds: input.linkedProjectIds ?? [],
    linkedEventIds:   input.linkedEventIds   ?? [],
    backlinks:        input.backlinks        ?? [],
    tags:             input.tags             ?? [],
    isPinned:         input.isPinned         ?? false,
    createdAt:        ts,
    updatedAt:        ts,
  };
  await repo.insertNote(note);
  bus.emit('note:created', { note });
  bus.emit('search:index-invalidated', { entityType: 'note', id: note.id });
  return note;
}

export async function updateNote(
  existing: Note,
  patch: UpdateNoteInput,
): Promise<Note> {
  const updated: Note = { ...existing, ...patch, updatedAt: now() };
  await repo.updateNote(updated);
  bus.emit('note:updated', { note: updated });
  bus.emit('search:index-invalidated', { entityType: 'note', id: updated.id });
  return updated;
}

export async function deleteNote(id: string): Promise<void> {
  await repo.deleteNote(id);
  bus.emit('note:deleted', { noteId: id });
}

export async function pinNote(existing: Note): Promise<Note> {
  return updateNote(existing, { isPinned: !existing.isPinned });
}

// ── Daily note ─────────────────────────────────────────────────────

/**
 * Returns the daily note for today from the in-memory list.
 * Pure — no DB access.  Call from the store selector path.
 */
export function findTodayNote(notes: Note[]): Note | undefined {
  const t = today();
  return notes.find((n) => n.type === 'daily' && n.date === t);
}

/**
 * Finds or creates today's daily note.
 * Checks DB first (not just in-memory) so concurrent opens are safe.
 */
export async function getOrCreateTodayNote(): Promise<Note> {
  const t = today();
  const existing = await repo.findDailyNote(t);
  if (existing) return existing;
  return createNote({ type: 'daily', date: t, title: `Daily — ${t}` });
}

// ── Cross-module reactions ───────────────────────────────────────

/**
 * Called when a task is deleted.
 * Removes taskId from linked_task_ids of every referencing note.
 * Emits note:updated for each patched note.
 */
export async function handleTaskDeleted(taskId: string): Promise<void> {
  const affectedIds = await repo.unlinkTaskFromNotes(taskId);
  for (const noteId of affectedIds) {
    const note = await repo.findNoteById(noteId);
    if (note) {
      bus.emit('note:updated', { note });
      bus.emit('search:index-invalidated', { entityType: 'note', id: noteId });
    }
  }
}

/**
 * Called when a project is deleted.
 * Removes projectId from linked_project_ids of every referencing note.
 */
export async function handleProjectDeleted(projectId: string): Promise<void> {
  const affectedIds = await repo.unlinkProjectFromNotes(projectId);
  for (const noteId of affectedIds) {
    const note = await repo.findNoteById(noteId);
    if (note) {
      bus.emit('note:updated', { note });
      bus.emit('search:index-invalidated', { entityType: 'note', id: noteId });
    }
  }
}
