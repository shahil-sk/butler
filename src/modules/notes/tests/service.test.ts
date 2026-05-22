// src/modules/notes/tests/service.test.ts
// Unit tests for notes/service.ts.
// Repository and bus are mocked — no real SQLite or Tauri IPC.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────

const mockRepo = {
  findAllNotes:          vi.fn(),
  findNoteById:          vi.fn(),
  findDailyNote:         vi.fn(),
  searchNotesFts:        vi.fn(),
  insertNote:            vi.fn(),
  updateNote:            vi.fn(),
  deleteNote:            vi.fn(),
  unlinkTaskFromNotes:   vi.fn(),
  unlinkProjectFromNotes: vi.fn(),
};

const mockBus = { emit: vi.fn() };

vi.mock('../repository', () => mockRepo);
vi.mock('@/kernel/event-bus', () => ({ bus: mockBus }));
vi.mock('@/shared/utils', () => ({
  generateId: vi.fn(() => 'note-id-001'),
  now:        vi.fn(() => '2026-05-22T10:00:00.000Z'),
  today:      vi.fn(() => '2026-05-22'),
}));

import * as svc from '../service';
import type { Note } from '../types';

// ── Fixtures ─────────────────────────────────────────────────────

const baseNote: Note = {
  id: 'note-1', title: 'Stand-up notes',
  content: JSON.stringify({ type: 'doc', content: [] }),
  type: 'note',
  linkedTaskIds: [], linkedProjectIds: [], linkedEventIds: [],
  backlinks: [], tags: [],
  isPinned: false,
  createdAt: '2026-05-22T08:00:00', updatedAt: '2026-05-22T08:00:00',
};

// ── Setup ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockRepo.insertNote.mockResolvedValue(undefined);
  mockRepo.updateNote.mockResolvedValue(undefined);
  mockRepo.deleteNote.mockResolvedValue(undefined);
  mockRepo.unlinkTaskFromNotes.mockResolvedValue([]);
  mockRepo.unlinkProjectFromNotes.mockResolvedValue([]);
});

// ── loadNotes ───────────────────────────────────────────────────

describe('loadNotes', () => {
  it('delegates to repo and returns notes', async () => {
    mockRepo.findAllNotes.mockResolvedValue([baseNote]);
    expect(await svc.loadNotes()).toEqual([baseNote]);
    expect(mockRepo.findAllNotes).toHaveBeenCalledOnce();
  });
});

// ── filterNotes ──────────────────────────────────────────────────

describe('filterNotes', () => {
  const daily: Note = { ...baseNote, id: 'note-2', type: 'daily', date: '2026-05-22', title: 'Daily' };
  const pinned: Note = { ...baseNote, id: 'note-3', title: 'Pinned', isPinned: true };
  const all = [baseNote, daily, pinned];

  it('filter=all returns everything', () => {
    expect(svc.filterNotes(all, 'all', '')).toHaveLength(3);
  });

  it('filter=daily returns only daily notes', () => {
    const result = svc.filterNotes(all, 'daily', '');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('daily');
  });

  it('filter=pinned returns only pinned notes', () => {
    const result = svc.filterNotes(all, 'pinned', '');
    expect(result).toHaveLength(1);
    expect(result[0].isPinned).toBe(true);
  });

  it('query filters by title case-insensitively', () => {
    expect(svc.filterNotes(all, 'all', 'DAILY')).toHaveLength(1);
  });

  it('empty query returns all (for active filter)', () => {
    expect(svc.filterNotes(all, 'note', '')).toHaveLength(2); // baseNote + pinned both type='note'
  });
});

// ── createNote ──────────────────────────────────────────────────

describe('createNote', () => {
  it('inserts note and emits note:created + search:index-invalidated', async () => {
    const note = await svc.createNote({ title: 'Sprint retro' });
    expect(note.id).toBe('note-id-001');
    expect(note.title).toBe('Sprint retro');
    expect(note.type).toBe('note');
    expect(mockRepo.insertNote).toHaveBeenCalledWith(note);
    expect(mockBus.emit).toHaveBeenCalledWith('note:created', { note });
    expect(mockBus.emit).toHaveBeenCalledWith('search:index-invalidated', { entityType: 'note', id: note.id });
  });

  it('defaults title to Untitled when not provided', async () => {
    const note = await svc.createNote();
    expect(note.title).toBe('Untitled');
  });

  it('creates daily note with correct type and date', async () => {
    const note = await svc.createNote({ type: 'daily', date: '2026-05-22' });
    expect(note.type).toBe('daily');
    expect(note.date).toBe('2026-05-22');
  });
});

// ── updateNote ──────────────────────────────────────────────────

describe('updateNote', () => {
  it('merges patch, bumps updatedAt, persists, emits note:updated and index-invalidated', async () => {
    const updated = await svc.updateNote(baseNote, { title: 'Updated title' });
    expect(updated.title).toBe('Updated title');
    expect(updated.updatedAt).toBe('2026-05-22T10:00:00.000Z');
    expect(mockRepo.updateNote).toHaveBeenCalledWith(updated);
    expect(mockBus.emit).toHaveBeenCalledWith('note:updated', { note: updated });
    expect(mockBus.emit).toHaveBeenCalledWith('search:index-invalidated', { entityType: 'note', id: updated.id });
  });
});

// ── deleteNote ──────────────────────────────────────────────────

describe('deleteNote', () => {
  it('deletes and emits note:deleted', async () => {
    await svc.deleteNote('note-1');
    expect(mockRepo.deleteNote).toHaveBeenCalledWith('note-1');
    expect(mockBus.emit).toHaveBeenCalledWith('note:deleted', { noteId: 'note-1' });
  });
});

// ── pinNote ───────────────────────────────────────────────────────

describe('pinNote', () => {
  it('toggles isPinned from false to true', async () => {
    const updated = await svc.pinNote(baseNote);
    expect(updated.isPinned).toBe(true);
    expect(mockRepo.updateNote).toHaveBeenCalled();
  });

  it('toggles isPinned from true to false', async () => {
    const pinned = { ...baseNote, isPinned: true };
    const updated = await svc.pinNote(pinned);
    expect(updated.isPinned).toBe(false);
  });
});

// ── getOrCreateTodayNote ───────────────────────────────────────────

describe('getOrCreateTodayNote', () => {
  it('returns existing daily note without inserting', async () => {
    const daily: Note = { ...baseNote, type: 'daily', date: '2026-05-22' };
    mockRepo.findDailyNote.mockResolvedValue(daily);
    const result = await svc.getOrCreateTodayNote();
    expect(result).toEqual(daily);
    expect(mockRepo.insertNote).not.toHaveBeenCalled();
  });

  it('creates a new daily note when none exists', async () => {
    mockRepo.findDailyNote.mockResolvedValue(undefined);
    const result = await svc.getOrCreateTodayNote();
    expect(result.type).toBe('daily');
    expect(result.date).toBe('2026-05-22');
    expect(mockRepo.insertNote).toHaveBeenCalledOnce();
  });
});

// ── handleTaskDeleted ─────────────────────────────────────────────

describe('handleTaskDeleted', () => {
  it('unlinks task and emits note:updated for affected notes', async () => {
    mockRepo.unlinkTaskFromNotes.mockResolvedValue(['note-1']);
    mockRepo.findNoteById.mockResolvedValue({ ...baseNote, linkedTaskIds: [] });
    await svc.handleTaskDeleted('task-99');
    expect(mockRepo.unlinkTaskFromNotes).toHaveBeenCalledWith('task-99');
    expect(mockBus.emit).toHaveBeenCalledWith(
      'note:updated',
      expect.objectContaining({ note: expect.objectContaining({ id: 'note-1' }) }),
    );
  });

  it('does nothing when no notes are linked', async () => {
    mockRepo.unlinkTaskFromNotes.mockResolvedValue([]);
    await svc.handleTaskDeleted('task-00');
    expect(mockBus.emit).not.toHaveBeenCalled();
  });
});

// ── handleProjectDeleted ──────────────────────────────────────────

describe('handleProjectDeleted', () => {
  it('unlinks project and emits note:updated for affected notes', async () => {
    mockRepo.unlinkProjectFromNotes.mockResolvedValue(['note-1']);
    mockRepo.findNoteById.mockResolvedValue({ ...baseNote, linkedProjectIds: [] });
    await svc.handleProjectDeleted('proj-5');
    expect(mockRepo.unlinkProjectFromNotes).toHaveBeenCalledWith('proj-5');
    expect(mockBus.emit).toHaveBeenCalledWith(
      'note:updated',
      expect.objectContaining({ note: expect.objectContaining({ id: 'note-1' }) }),
    );
  });

  it('does nothing when no notes reference the project', async () => {
    mockRepo.unlinkProjectFromNotes.mockResolvedValue([]);
    await svc.handleProjectDeleted('proj-00');
    expect(mockBus.emit).not.toHaveBeenCalled();
  });
});
