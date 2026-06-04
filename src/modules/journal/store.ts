import { create } from "zustand";
import { db } from "@/kernel/db";
import { bus } from "@/kernel/event-bus";
import { generateId, now, today } from "@/shared/utils";
import type { JournalEntry, ISODate, ID } from "@/shared/types";

// ── DB helpers ───────────────────────────────────────────────

function rowToEntry(r: Record<string, unknown>): JournalEntry {
  return {
    id:                r.id as string,
    date:              r.date as string,
    noteId:            r.note_id as string,
    status:            (r.status as JournalEntry["status"]) || "draft",
    moodMorning:       (r.mood_morning as number) || undefined,
    moodEvening:       (r.mood_evening as number) || undefined,
    energyMorning:     (r.energy_morning as number) || undefined,
    energyEvening:     (r.energy_evening as number) || undefined,
    gratitude:         JSON.parse((r.gratitude as string) || "[]"),
    wins:              JSON.parse((r.wins as string) || "[]"),
    challenges:        JSON.parse((r.challenges as string) || "[]"),
    learnings:         JSON.parse((r.learnings as string) || "[]"),
    morningIntention:  (r.morning_intention as string) || undefined,
    eveningReflection: (r.evening_reflection as string) || undefined,
    tasksCompleted:    (r.tasks_completed as number) || 0,
    tasksDeferred:     (r.tasks_deferred as number) || 0,
    focusMinutes:      (r.focus_minutes as number) || 0,
    habitSummary:      r.habit_summary ? JSON.parse(r.habit_summary as string) : undefined,
    lifeAreaRatings:   r.life_area_ratings ? JSON.parse(r.life_area_ratings as string) : undefined,
    customPrompts:     r.custom_prompts ? JSON.parse(r.custom_prompts as string) : undefined,
    wordCount:         (r.word_count as number) || 0,
    writeStreak:       (r.write_streak as number) || 0,
    
    // Legacy mapping
    type:              (r.type as JournalEntry["type"]) || "daily",
    content:           (r.content as string) || "{}",
    mood:              (r.mood as number) || undefined,
    linkedTaskIds:     JSON.parse((r.linked_task_ids as string) || "[]"),
    linkedProjectIds:  JSON.parse((r.linked_project_ids as string) || "[]"),
    tags:              JSON.parse((r.tags as string) || "[]"),
    
    createdAt:         r.created_at as string,
    completedAt:       (r.completed_at as string) || undefined,
    updatedAt:         r.updated_at as string,
  };
}

const INSERT_SQL = `
  INSERT INTO journal_entries
    (id, date, note_id, status, mood_morning, mood_evening, energy_morning, energy_evening,
     gratitude, wins, challenges, learnings, morning_intention, evening_reflection,
     tasks_completed, tasks_deferred, focus_minutes, habit_summary, life_area_ratings,
     custom_prompts, word_count, write_streak, created_at, completed_at, updated_at,
     type, content, mood, linked_task_ids, linked_project_ids, tags)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;
function insertParams(e: JournalEntry): unknown[] {
  return [
    e.id, e.date, e.noteId, e.status, e.moodMorning ?? null, e.moodEvening ?? null,
    e.energyMorning ?? null, e.energyEvening ?? null,
    JSON.stringify(e.gratitude), JSON.stringify(e.wins), JSON.stringify(e.challenges), JSON.stringify(e.learnings),
    e.morningIntention ?? null, e.eveningReflection ?? null,
    e.tasksCompleted, e.tasksDeferred, e.focusMinutes,
    e.habitSummary ? JSON.stringify(e.habitSummary) : null,
    e.lifeAreaRatings ? JSON.stringify(e.lifeAreaRatings) : null,
    e.customPrompts ? JSON.stringify(e.customPrompts) : null,
    e.wordCount, e.writeStreak, e.createdAt, e.completedAt ?? null, e.updatedAt,
    e.type ?? "daily", e.content ?? "{}", e.mood ?? null, 
    JSON.stringify(e.linkedTaskIds ?? []), JSON.stringify(e.linkedProjectIds ?? []), JSON.stringify(e.tags ?? []),
  ];
}

const UPDATE_SQL = `
  UPDATE journal_entries
  SET date=?, note_id=?, status=?, mood_morning=?, mood_evening=?, energy_morning=?, energy_evening=?,
      gratitude=?, wins=?, challenges=?, learnings=?, morning_intention=?, evening_reflection=?,
      tasks_completed=?, tasks_deferred=?, focus_minutes=?, habit_summary=?, life_area_ratings=?,
      custom_prompts=?, word_count=?, write_streak=?, completed_at=?, updated_at=?,
      type=?, content=?, mood=?, linked_task_ids=?, linked_project_ids=?, tags=?
  WHERE id=?
`;
function updateParams(e: JournalEntry): unknown[] {
  return [
    e.date, e.noteId, e.status, e.moodMorning ?? null, e.moodEvening ?? null,
    e.energyMorning ?? null, e.energyEvening ?? null,
    JSON.stringify(e.gratitude), JSON.stringify(e.wins), JSON.stringify(e.challenges), JSON.stringify(e.learnings),
    e.morningIntention ?? null, e.eveningReflection ?? null,
    e.tasksCompleted, e.tasksDeferred, e.focusMinutes,
    e.habitSummary ? JSON.stringify(e.habitSummary) : null,
    e.lifeAreaRatings ? JSON.stringify(e.lifeAreaRatings) : null,
    e.customPrompts ? JSON.stringify(e.customPrompts) : null,
    e.wordCount, e.writeStreak, e.completedAt ?? null, e.updatedAt,
    e.type ?? "daily", e.content ?? "{}", e.mood ?? null, 
    JSON.stringify(e.linkedTaskIds ?? []), JSON.stringify(e.linkedProjectIds ?? []), JSON.stringify(e.tags ?? []),
    e.id,                        // WHERE last
  ];
}

// ── State ────────────────────────────────────────────────────

interface JournalState {
  entries: JournalEntry[];
  activeEntryId: ID | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadEntries: () => Promise<void>;
  getOrCreateDaily: (date?: ISODate, noteId?: ID) => Promise<JournalEntry>;
  createEntry: (partial: Partial<JournalEntry> & { date: ISODate; noteId?: ID }) => Promise<JournalEntry>;
  updateEntry: (id: ID, changes: Partial<JournalEntry>) => Promise<void>;
  deleteEntry: (id: ID) => Promise<void>;
  setActiveEntry: (id: ID | null) => void;
  linkTask: (entryId: ID, taskId: ID) => Promise<void>;
}

// ── Store ────────────────────────────────────────────────────

export const useJournalStore = create<JournalState>((set, get) => ({
  entries: [],
  activeEntryId: null,
  isLoading: false,
  error: null,

  loadEntries: async () => {
    set({ isLoading: true, error: null });
    try {
      const rows = await db.select<Record<string, unknown>>(
        "SELECT * FROM journal_entries ORDER BY date DESC, created_at DESC"
      );
      set({ entries: rows.map(rowToEntry), isLoading: false });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  getOrCreateDaily: async (date = today(), noteId = "legacy") => {
    // Check in-memory first
    const existing = get().entries.find((e) => e.date === date);
    if (existing) {
      set({ activeEntryId: existing.id });
      return existing;
    }

    // Check DB (may have been created in a prior session)
    const rows = await db.select<Record<string, unknown>>(
      "SELECT * FROM journal_entries WHERE date=? LIMIT 1",
      [date]
    );
    if (rows.length > 0) {
      const entry = rowToEntry(rows[0]);
      set((s) => ({
        entries: [entry, ...s.entries.filter((e) => e.id !== entry.id)],
        activeEntryId: entry.id,
      }));
      return entry;
    }

    // Create new
    return get().createEntry({ date, noteId });
  },

  createEntry: async (partial) => {
    const entry: JournalEntry = {
      id:               generateId(),
      date:             partial.date,
      noteId:           partial.noteId || "legacy",
      status:           "draft",
      moodMorning:      partial.moodMorning,
      moodEvening:      partial.moodEvening,
      energyMorning:    partial.energyMorning,
      energyEvening:    partial.energyEvening,
      gratitude:        partial.gratitude ?? [],
      wins:             partial.wins ?? [],
      challenges:       partial.challenges ?? [],
      learnings:        partial.learnings ?? [],
      morningIntention: partial.morningIntention,
      eveningReflection:partial.eveningReflection,
      tasksCompleted:   partial.tasksCompleted ?? 0,
      tasksDeferred:    partial.tasksDeferred ?? 0,
      focusMinutes:     partial.focusMinutes ?? 0,
      habitSummary:     partial.habitSummary,
      lifeAreaRatings:  partial.lifeAreaRatings,
      customPrompts:    partial.customPrompts,
      wordCount:        partial.wordCount ?? 0,
      writeStreak:      partial.writeStreak ?? 0,
      createdAt:        now(),
      updatedAt:        now(),
      
      type:             partial.type || "daily",
      content:          partial.content || "{}",
      mood:             partial.mood,
      linkedTaskIds:    partial.linkedTaskIds || [],
      linkedProjectIds: partial.linkedProjectIds || [],
      tags:             partial.tags || [],
    };

    try {
      await db.execute(INSERT_SQL, insertParams(entry));
      set((s) => ({ entries: [entry, ...s.entries], activeEntryId: entry.id }));
      
      bus.emit("journal:entry-created", { entry });
      
      return entry;
    } catch (err) {
      throw err;
    }
  },

  updateEntry: async (id, changes) => {
    const entry = get().entries.find((e) => e.id === id);
    if (!entry) return;

    const updated: JournalEntry = { ...entry, ...changes, updatedAt: now() };
    await db.execute(UPDATE_SQL, updateParams(updated));

    set((s) => ({
      entries: s.entries.map((e) => (e.id === id ? updated : e)),
    }));

    bus.emit("journal:entry-updated", { entry: updated });
  },

  deleteEntry: async (id) => {
    await db.execute("DELETE FROM journal_entries WHERE id=?", [id]);
    set((s) => ({
      entries: s.entries.filter((e) => e.id !== id),
      activeEntryId: s.activeEntryId === id ? null : s.activeEntryId,
    }));
    bus.emit("journal:entry-deleted", { entryId: id });
  },

  setActiveEntry: (id) => {
    set({ activeEntryId: id });
  },

  linkTask: async (entryId, taskId) => {
    const entry = get().entries.find((e) => e.id === entryId);
    if (!entry) return;
    if (entry.linkedTaskIds?.includes(taskId)) return;
    const linkedTaskIds = [...(entry.linkedTaskIds || []), taskId];
    await get().updateEntry(entryId, { linkedTaskIds });
  },
}));
