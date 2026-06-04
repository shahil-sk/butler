import { create } from "zustand";
import { db } from "@/kernel/db";
import { bus } from "@/kernel/event-bus";
import { generateId, now } from "@/shared/utils";
import type { Habit, HabitLog, Routine, HabitStreak, ID, ISODate } from "@/shared/types";

interface HabitsState {
  habits: Habit[];
  logs: HabitLog[];
  routines: Routine[];
  streaks: HabitStreak[];
  
  loadHabits: () => Promise<void>;
  createHabit: (habit: Omit<Habit, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  updateHabit: (id: ID, changes: Partial<Habit>) => Promise<void>;
  archiveHabit: (id: ID) => Promise<void>;
  deleteHabit: (id: ID) => Promise<void>;

  logHabit: (habitId: ID, date: ISODate, status: HabitLog["status"], value?: number, note?: string) => Promise<void>;
  
  createRoutine: (routine: Omit<Routine, "id" | "createdAt">) => Promise<void>;
  updateRoutine: (id: ID, changes: Partial<Routine>) => Promise<void>;
  deleteRoutine: (id: ID) => Promise<void>;
}

function rowToHabit(r: Record<string, any>): Habit {
  return {
    id: r.id as string,
    name: r.name as string,
    description: r.description as string,
    icon: r.icon as string,
    color: r.color as string,
    category: r.category as Habit["category"],
    frequencyType: r.frequency_type as Habit["frequencyType"],
    frequencyDays: r.frequency_days ? JSON.parse(r.frequency_days) : undefined,
    customIntervalDays: r.custom_interval_days as number,
    timesPerPeriod: r.times_per_period as number,
    targetValue: r.target_value as number,
    targetUnit: r.target_unit as string,
    reminderTime: r.reminder_time as string,
    reminderEnabled: Boolean(r.reminder_enabled),
    linkedGoalId: r.linked_goal_id as string,
    routineId: r.routine_id as string,
    startDate: r.start_date as string,
    endDate: r.end_date as string,
    archivedAt: r.archived_at as string,
    difficulty: r.difficulty as Habit["difficulty"],
    cue: r.cue as string,
    craving: r.craving as string,
    reward: r.reward as string,
    notes: r.notes as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function rowToHabitLog(r: Record<string, any>): HabitLog {
  return {
    id: r.id as string,
    habitId: r.habit_id as string,
    date: r.date as string,
    status: r.status as HabitLog["status"],
    value: r.value as number,
    note: r.note as string,
    loggedAt: r.logged_at as string,
    source: r.source as HabitLog["source"],
  };
}

function rowToRoutine(r: Record<string, any>): Routine {
  return {
    id: r.id as string,
    name: r.name as string,
    type: r.type as Routine["type"],
    habitIds: JSON.parse(r.habit_ids || "[]"),
    triggerTime: r.trigger_time as string,
    durationMin: r.duration_min as number,
    days: JSON.parse(r.days || "[]"),
    active: Boolean(r.active),
    createdAt: r.created_at as string,
  };
}

export const useHabitsStore = create<HabitsState>((set, get) => ({
  habits: [],
  logs: [],
  routines: [],
  streaks: [],

  loadHabits: async () => {
    const [habitRows, logRows, routineRows] = await Promise.all([
      db.select<Record<string, unknown>>("SELECT * FROM habits"),
      db.select<Record<string, unknown>>("SELECT * FROM habit_logs"),
      db.select<Record<string, unknown>>("SELECT * FROM routines"),
    ]);
    
    set({
      habits: habitRows.map(rowToHabit),
      logs: logRows.map(rowToHabitLog),
      routines: routineRows.map(rowToRoutine),
    });
  },

  createHabit: async (partial) => {
    const habit: Habit = {
      ...partial,
      id: generateId(),
      createdAt: now(),
      updatedAt: now(),
    };

    await db.execute(
      `INSERT INTO habits (
        id, name, description, icon, color, category, frequency_type, frequency_days,
        custom_interval_days, times_per_period, target_value, target_unit, reminder_time, reminder_enabled,
        linked_goal_id, routine_id, start_date, end_date, archived_at, difficulty, cue, craving, reward, notes,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        habit.id, habit.name, habit.description || null, habit.icon || null, habit.color, habit.category || null,
        habit.frequencyType, habit.frequencyDays ? JSON.stringify(habit.frequencyDays) : null, habit.customIntervalDays || null,
        habit.timesPerPeriod, habit.targetValue || null, habit.targetUnit || null, habit.reminderTime || null, habit.reminderEnabled ? 1 : 0,
        habit.linkedGoalId || null, habit.routineId || null, habit.startDate, habit.endDate || null, habit.archivedAt || null,
        habit.difficulty || null, habit.cue || null, habit.craving || null, habit.reward || null, habit.notes || null,
        habit.createdAt, habit.updatedAt
      ]
    );

    set((s) => ({ habits: [...s.habits, habit] }));
  },

  updateHabit: async (id, changes) => {
    const existing = get().habits.find(h => h.id === id);
    if (!existing) return;
    const updated = { ...existing, ...changes, updatedAt: now() };
    
    await db.execute(
      `UPDATE habits SET 
        name=?, description=?, icon=?, color=?, category=?, frequency_type=?, frequency_days=?,
        custom_interval_days=?, times_per_period=?, target_value=?, target_unit=?, reminder_time=?, reminder_enabled=?,
        linked_goal_id=?, routine_id=?, start_date=?, end_date=?, archived_at=?, difficulty=?, cue=?, craving=?, reward=?, notes=?,
        updated_at=?
       WHERE id=?`,
      [
        updated.name, updated.description || null, updated.icon || null, updated.color, updated.category || null,
        updated.frequencyType, updated.frequencyDays ? JSON.stringify(updated.frequencyDays) : null, updated.customIntervalDays || null,
        updated.timesPerPeriod, updated.targetValue || null, updated.targetUnit || null, updated.reminderTime || null, updated.reminderEnabled ? 1 : 0,
        updated.linkedGoalId || null, updated.routineId || null, updated.startDate, updated.endDate || null, updated.archivedAt || null,
        updated.difficulty || null, updated.cue || null, updated.craving || null, updated.reward || null, updated.notes || null,
        updated.updatedAt, id
      ]
    );
    
    set((s) => ({ habits: s.habits.map(h => h.id === id ? updated : h) }));
  },

  archiveHabit: async (id) => {
    await get().updateHabit(id, { archivedAt: now() });
  },

  deleteHabit: async (id) => {
    await db.execute("DELETE FROM habits WHERE id=?", [id]);
    set((s) => ({ 
      habits: s.habits.filter(h => h.id !== id),
      logs: s.logs.filter(l => l.habitId !== id)
    }));
  },

  logHabit: async (habitId, date, status, value, note) => {
    const log: HabitLog = {
      id: generateId(),
      habitId,
      date,
      status,
      value,
      note,
      loggedAt: now(),
      source: "manual"
    };

    // Upsert logic for that day
    await db.execute(
      `DELETE FROM habit_logs WHERE habit_id = ? AND date = ?`,
      [habitId, date]
    );

    await db.execute(
      `INSERT INTO habit_logs (id, habit_id, date, status, value, note, logged_at, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [log.id, log.habitId, log.date, log.status, log.value || null, log.note || null, log.loggedAt, log.source]
    );

    set((s) => ({
      logs: [...s.logs.filter(l => !(l.habitId === habitId && l.date === date)), log]
    }));

    bus.emit("habit:logged", { habitId, date, status });
  },

  createRoutine: async (partial) => {
    const routine: Routine = {
      ...partial,
      id: generateId(),
      createdAt: now(),
    };

    await db.execute(
      `INSERT INTO routines (id, name, type, habit_ids, trigger_time, duration_min, days, active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        routine.id, routine.name, routine.type, JSON.stringify(routine.habitIds),
        routine.triggerTime || null, routine.durationMin || null, JSON.stringify(routine.days),
        routine.active ? 1 : 0, routine.createdAt
      ]
    );

    set((s) => ({ routines: [...s.routines, routine] }));
  },

  updateRoutine: async (id, changes) => {
    const existing = get().routines.find(r => r.id === id);
    if (!existing) return;
    const updated = { ...existing, ...changes };
    
    await db.execute(
      `UPDATE routines SET name=?, type=?, habit_ids=?, trigger_time=?, duration_min=?, days=?, active=? WHERE id=?`,
      [
        updated.name, updated.type, JSON.stringify(updated.habitIds), updated.triggerTime || null,
        updated.durationMin || null, JSON.stringify(updated.days), updated.active ? 1 : 0, id
      ]
    );

    set((s) => ({ routines: s.routines.map(r => r.id === id ? updated : r) }));
  },

  deleteRoutine: async (id) => {
    await db.execute("DELETE FROM routines WHERE id=?", [id]);
    set((s) => ({ routines: s.routines.filter(r => r.id !== id) }));
  }
}));
