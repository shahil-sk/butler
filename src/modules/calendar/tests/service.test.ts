// src/modules/calendar/tests/service.test.ts
// Unit tests for calendar/service.ts.
// Repository and bus are mocked — no real SQLite or Tauri IPC.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────

const mockRepo = {
  findAllCalendars:    vi.fn(),
  findEventsInRange:   vi.fn(),
  findEventById:       vi.fn(),
  findEventsByTaskId:  vi.fn(),
  insertEvent:         vi.fn(),
  updateEvent:         vi.fn(),
  deleteEvent:         vi.fn(),
  unlinkTaskFromEvents: vi.fn(),
};

const mockBus = { emit: vi.fn() };

vi.mock('../repository', () => mockRepo);
vi.mock('@/kernel/event-bus', () => ({ bus: mockBus }));
vi.mock('@/shared/utils', () => ({
  generateId: vi.fn(() => 'test-id-123'),
  now:        vi.fn(() => '2026-05-22T10:00:00.000Z'),
}));

import * as svc from '../service';
import type { CalendarEvent, Calendar } from '../types';

// ── Fixtures ─────────────────────────────────────────────────────

const baseCalendar: Calendar = {
  id: 'cal-1', name: 'Personal', color: '#3b82f6',
  isDefault: true, isVisible: true, source: 'local',
};

const baseEvent: CalendarEvent = {
  id: 'evt-1', title: 'Sprint planning',
  startAt: '2026-05-22T09:00:00', endAt: '2026-05-22T10:00:00',
  allDay: false, calendarId: 'cal-1',
  linkedTaskIds: [], linkedNoteIds: [],
  isTimeBlock: false,
  createdAt: '2026-05-22T08:00:00', updatedAt: '2026-05-22T08:00:00',
};

// ── Setup ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockRepo.insertEvent.mockResolvedValue(undefined);
  mockRepo.updateEvent.mockResolvedValue(undefined);
  mockRepo.deleteEvent.mockResolvedValue(undefined);
  mockRepo.unlinkTaskFromEvents.mockResolvedValue([]);
});

// ── loadCalendars ─────────────────────────────────────────────────

describe('loadCalendars', () => {
  it('returns calendars from repo', async () => {
    mockRepo.findAllCalendars.mockResolvedValue([baseCalendar]);
    const result = await svc.loadCalendars();
    expect(result).toEqual([baseCalendar]);
    expect(mockRepo.findAllCalendars).toHaveBeenCalledOnce();
  });

  it('returns empty array when no calendars', async () => {
    mockRepo.findAllCalendars.mockResolvedValue([]);
    expect(await svc.loadCalendars()).toEqual([]);
  });
});

// ── loadEventsInRange ─────────────────────────────────────────────

describe('loadEventsInRange', () => {
  it('delegates to repo with correct range params', async () => {
    mockRepo.findEventsInRange.mockResolvedValue([baseEvent]);
    const result = await svc.loadEventsInRange('2026-05-22T00:00:00', '2026-05-22T23:59:59');
    expect(result).toEqual([baseEvent]);
    expect(mockRepo.findEventsInRange)
      .toHaveBeenCalledWith('2026-05-22T00:00:00', '2026-05-22T23:59:59');
  });
});

// ── filterEventsInRange ───────────────────────────────────────────

describe('filterEventsInRange', () => {
  const calendars = [baseCalendar];

  it('includes event that overlaps range', () => {
    const result = svc.filterEventsInRange(
      [baseEvent], calendars,
      '2026-05-22T08:00:00', '2026-05-22T12:00:00',
    );
    expect(result).toHaveLength(1);
  });

  it('excludes event from invisible calendar', () => {
    const hiddenCal = { ...baseCalendar, isVisible: false };
    expect(
      svc.filterEventsInRange([baseEvent], [hiddenCal], '2026-05-22T00:00:00', '2026-05-22T23:59:59'),
    ).toHaveLength(0);
  });

  it('excludes event outside range', () => {
    expect(
      svc.filterEventsInRange([baseEvent], calendars, '2026-05-23T00:00:00', '2026-05-23T23:59:59'),
    ).toHaveLength(0);
  });
});

// ── filterEventsForDay ────────────────────────────────────────────

describe('filterEventsForDay', () => {
  const calendars = [baseCalendar];

  it('includes timed event that occurs on the day', () => {
    expect(svc.filterEventsForDay([baseEvent], calendars, '2026-05-22')).toHaveLength(1);
  });

  it('includes all-day event on matching date', () => {
    const allDay: CalendarEvent = {
      ...baseEvent, id: 'evt-2', allDay: true,
      startAt: '2026-05-22', endAt: '2026-05-22',
    };
    expect(svc.filterEventsForDay([allDay], calendars, '2026-05-22')).toHaveLength(1);
  });

  it('excludes timed event on a different day', () => {
    expect(svc.filterEventsForDay([baseEvent], calendars, '2026-05-23')).toHaveLength(0);
  });

  it('excludes all-day event on a different day', () => {
    const allDay: CalendarEvent = {
      ...baseEvent, id: 'evt-3', allDay: true,
      startAt: '2026-05-20', endAt: '2026-05-21',
    };
    expect(svc.filterEventsForDay([allDay], calendars, '2026-05-22')).toHaveLength(0);
  });
});

// ── createEvent ───────────────────────────────────────────────────

describe('createEvent', () => {
  it('inserts event and emits calendar:event-created', async () => {
    const event = await svc.createEvent(
      { startAt: '2026-05-22T14:00:00', endAt: '2026-05-22T15:00:00', title: 'Standup' },
    );
    expect(event.id).toBe('test-id-123');
    expect(event.title).toBe('Standup');
    expect(event.calendarId).toBe('default');
    expect(mockRepo.insertEvent).toHaveBeenCalledWith(event);
    expect(mockBus.emit).toHaveBeenCalledWith('calendar:event-created', { event });
  });

  it('trims whitespace from title', async () => {
    const event = await svc.createEvent(
      { startAt: '2026-05-22T14:00:00', endAt: '2026-05-22T15:00:00', title: '  Standup  ' },
    );
    expect(event.title).toBe('Standup');
  });

  it('falls back to "New event" for blank title', async () => {
    const event = await svc.createEvent(
      { startAt: '2026-05-22T14:00:00', endAt: '2026-05-22T15:00:00' },
    );
    expect(event.title).toBe('New event');
  });

  it('uses provided calendarId over the default', async () => {
    const event = await svc.createEvent(
      { startAt: '2026-05-22T14:00:00', endAt: '2026-05-22T15:00:00', calendarId: 'work' },
      'default',
    );
    expect(event.calendarId).toBe('work');
  });
});

// ── updateEvent ───────────────────────────────────────────────────

describe('updateEvent', () => {
  it('merges patch, bumps updatedAt, persists, and emits', async () => {
    const updated = await svc.updateEvent(baseEvent, { title: 'Retrospective' });
    expect(updated.title).toBe('Retrospective');
    expect(updated.id).toBe(baseEvent.id);
    expect(updated.updatedAt).toBe('2026-05-22T10:00:00.000Z');
    expect(mockRepo.updateEvent).toHaveBeenCalledWith(updated);
    expect(mockBus.emit).toHaveBeenCalledWith('calendar:event-updated', { event: updated });
  });
});

// ── deleteEvent ───────────────────────────────────────────────────

describe('deleteEvent', () => {
  it('deletes from repo and emits calendar:event-deleted', async () => {
    await svc.deleteEvent('evt-1');
    expect(mockRepo.deleteEvent).toHaveBeenCalledWith('evt-1');
    expect(mockBus.emit).toHaveBeenCalledWith('calendar:event-deleted', { eventId: 'evt-1' });
  });
});

// ── handleTaskDeleted ─────────────────────────────────────────────

describe('handleTaskDeleted', () => {
  it('unlinks task and re-emits calendar:event-updated for each affected event', async () => {
    mockRepo.unlinkTaskFromEvents.mockResolvedValue(['evt-1']);
    mockRepo.findEventById.mockResolvedValue({ ...baseEvent, linkedTaskIds: [] });
    await svc.handleTaskDeleted('task-99');
    expect(mockRepo.unlinkTaskFromEvents).toHaveBeenCalledWith('task-99');
    expect(mockBus.emit).toHaveBeenCalledWith(
      'calendar:event-updated',
      expect.objectContaining({ event: expect.objectContaining({ id: 'evt-1' }) }),
    );
  });

  it('does nothing when no events are linked to the task', async () => {
    mockRepo.unlinkTaskFromEvents.mockResolvedValue([]);
    await svc.handleTaskDeleted('task-00');
    expect(mockBus.emit).not.toHaveBeenCalled();
  });
});

// ── handleTaskUpdated ─────────────────────────────────────────────

describe('handleTaskUpdated', () => {
  it('emits calendar:event-updated for each linked event', async () => {
    mockRepo.findEventsByTaskId.mockResolvedValue([baseEvent]);
    await svc.handleTaskUpdated('task-42');
    expect(mockBus.emit).toHaveBeenCalledWith(
      'calendar:event-updated',
      { event: baseEvent },
    );
  });

  it('emits nothing when no events are linked', async () => {
    mockRepo.findEventsByTaskId.mockResolvedValue([]);
    await svc.handleTaskUpdated('task-00');
    expect(mockBus.emit).not.toHaveBeenCalled();
  });
});
