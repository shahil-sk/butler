import { create } from "zustand";
import { db } from "@/kernel/db";
import { generateId, now } from "@/shared/utils";
import { bus } from "@/kernel/event-bus";
import type { Goal, KeyResult, GoalCheckIn, GoalLink, ID } from "@/shared/types";

export interface GoalsState {
  goals: Goal[];
  keyResults: KeyResult[];
  checkIns: GoalCheckIn[];
  links: GoalLink[];

  activeGoalId: ID | null;

  loadAll: () => Promise<void>;
  createGoal: (partial: Partial<Goal> & { title: string, horizon: Goal["horizon"] }) => Promise<void>;
  updateGoal: (id: ID, changes: Partial<Goal>) => Promise<void>;
  deleteGoal: (id: ID) => Promise<void>;
  
  createKeyResult: (goalId: ID, partial: Partial<KeyResult> & { title: string, metricType: KeyResult["metricType"], targetValue: number }) => Promise<void>;
  updateKeyResult: (id: ID, changes: Partial<KeyResult>) => Promise<void>;
  deleteKeyResult: (id: ID) => Promise<void>;

  openGoal: (id: ID) => void;
  closeGoal: () => void;
}

function syncGoalKRProgress(goalId: ID, state: GoalsState) {
  const goal = state.goals.find(g => g.id === goalId);
  if (!goal) return;
  
  const krs = state.keyResults.filter(kr => kr.goalId === goalId);
  if (krs.length === 0) {
    if (goal.progressPercent !== 0) {
      void state.updateGoal(goalId, { progressPercent: 0 });
    }
    return;
  }

  const totalProgress = krs.reduce((acc, kr) => {
    const start = kr.startValue || 0;
    const target = kr.targetValue;
    const current = kr.currentValue;
    if (target === start) return acc;
    const percent = Math.max(0, Math.min(100, ((current - start) / (target - start)) * 100));
    return acc + percent;
  }, 0);

  const progressPercent = Math.round(totalProgress / krs.length);
  if (goal.progressPercent !== progressPercent || goal.progressType !== "key_result_based") {
    void state.updateGoal(goalId, { progressPercent, progressType: "key_result_based" });
  }
}

export const useGoalsStore = create<GoalsState>((set, get) => ({
  goals: [],
  keyResults: [],
  checkIns: [],
  links: [],
  activeGoalId: null,

  loadAll: async () => {
    const [goalsRows, krRows, checkInRows, linksRows] = await Promise.all([
      db.select<Record<string, unknown>>("SELECT * FROM goals"),
      db.select<Record<string, unknown>>("SELECT * FROM key_results"),
      db.select<Record<string, unknown>>("SELECT * FROM goal_check_ins"),
      db.select<Record<string, unknown>>("SELECT * FROM goal_links"),
    ]);

    set({
      goals: goalsRows.map(rowToGoal),
      keyResults: krRows.map(rowToKR),
      checkIns: checkInRows.map(rowToCheckIn),
      links: linksRows.map(rowToLink),
    });
  },

  createGoal: async (partial) => {
    const goal: Goal = {
      id: generateId(),
      status: "draft",
      progressType: "manual",
      progressPercent: 0,
      obstacles: [],
      tags: [],
      createdAt: now(),
      updatedAt: now(),
      createdBy: "local",
      ...partial,
    } as Goal;

    await db.execute(
      `INSERT INTO goals (
        id, title, description, status, horizon, parent_goal_id, area, start_date, target_date,
        achieved_at, abandoned_at, progress_type, progress_percent, progress_notes, motivation,
        outcome, obstacles, tags, color, icon, review_cadence, next_review_date, last_reviewed_at,
        created_at, updated_at, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        goal.id, goal.title, goal.description || null, goal.status, goal.horizon, goal.parentGoalId || null,
        goal.area || null, goal.startDate || null, goal.targetDate || null, goal.achievedAt || null,
        goal.abandonedAt || null, goal.progressType, goal.progressPercent, goal.progressNotes || null,
        goal.motivation || null, goal.outcome || null, JSON.stringify(goal.obstacles), JSON.stringify(goal.tags),
        goal.color || null, goal.icon || null, goal.reviewCadence || null, goal.nextReviewDate || null,
        goal.lastReviewedAt || null, goal.createdAt, goal.updatedAt, goal.createdBy
      ]
    );

    set((s) => ({ goals: [...s.goals, goal] }));
    bus.emit("goal:created", { goal });
  },

  updateGoal: async (id, changes) => {
    const existing = get().goals.find(g => g.id === id);
    if (!existing) return;
    const updated = { ...existing, ...changes, updatedAt: now() };

    await db.execute(
      `UPDATE goals SET
        title=?, description=?, status=?, horizon=?, parent_goal_id=?, area=?, start_date=?, target_date=?,
        achieved_at=?, abandoned_at=?, progress_type=?, progress_percent=?, progress_notes=?, motivation=?,
        outcome=?, obstacles=?, tags=?, color=?, icon=?, review_cadence=?, next_review_date=?, last_reviewed_at=?,
        updated_at=?
      WHERE id=?`,
      [
        updated.title, updated.description || null, updated.status, updated.horizon, updated.parentGoalId || null,
        updated.area || null, updated.startDate || null, updated.targetDate || null, updated.achievedAt || null,
        updated.abandonedAt || null, updated.progressType, updated.progressPercent, updated.progressNotes || null,
        updated.motivation || null, updated.outcome || null, JSON.stringify(updated.obstacles), JSON.stringify(updated.tags),
        updated.color || null, updated.icon || null, updated.reviewCadence || null, updated.nextReviewDate || null,
        updated.lastReviewedAt || null, updated.updatedAt, id
      ]
    );

    set((s) => ({ goals: s.goals.map(g => g.id === id ? updated : g) }));
    bus.emit("goal:updated", { goal: updated });
  },

  deleteGoal: async (id) => {
    await db.execute("DELETE FROM goals WHERE id=?", [id]);
    set((s) => ({
      goals: s.goals.filter(g => g.id !== id),
      keyResults: s.keyResults.filter(kr => kr.goalId !== id),
      checkIns: s.checkIns.filter(c => c.goalId !== id),
      links: s.links.filter(l => l.goalId !== id),
    }));
    bus.emit("goal:deleted", { goalId: id });
  },

  createKeyResult: async (goalId, partial) => {
    const kr: KeyResult = {
      id: generateId(),
      goalId,
      currentValue: 0,
      position: 0,
      ...partial,
    } as KeyResult;

    await db.execute(
      `INSERT INTO key_results (id, goal_id, title, description, metric_type, start_value, target_value, current_value, unit, confidence, due_date, completed_at, position)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        kr.id, kr.goalId, kr.title, kr.description || null, kr.metricType, kr.startValue || null, kr.targetValue,
        kr.currentValue, kr.unit || null, kr.confidence || null, kr.dueDate || null, kr.completedAt || null, kr.position
      ]
    );

    set((s) => ({ keyResults: [...s.keyResults, kr] }));
    syncGoalKRProgress(goalId, get());
  },

  updateKeyResult: async (id, changes) => {
    const existing = get().keyResults.find(kr => kr.id === id);
    if (!existing) return;
    const updated = { ...existing, ...changes };

    await db.execute(
      `UPDATE key_results SET
        title=?, description=?, metric_type=?, start_value=?, target_value=?, current_value=?, unit=?, confidence=?, due_date=?, completed_at=?, position=?
       WHERE id=?`,
      [
        updated.title, updated.description || null, updated.metricType, updated.startValue || null, updated.targetValue,
        updated.currentValue, updated.unit || null, updated.confidence || null, updated.dueDate || null, updated.completedAt || null, updated.position,
        id
      ]
    );

    set((s) => ({ keyResults: s.keyResults.map(kr => kr.id === id ? updated : kr) }));
    syncGoalKRProgress(updated.goalId, get());
  },

  deleteKeyResult: async (id) => {
    const existing = get().keyResults.find(kr => kr.id === id);
    await db.execute("DELETE FROM key_results WHERE id=?", [id]);
    set((s) => ({ keyResults: s.keyResults.filter(kr => kr.id !== id) }));
    if (existing) syncGoalKRProgress(existing.goalId, get());
  },

  openGoal: (id) => set({ activeGoalId: id }),
  closeGoal: () => set({ activeGoalId: null }),
}));

function rowToGoal(row: any): Goal {
  return {
    id: row.id,
    title: row.title,
    description: row.description || undefined,
    status: row.status,
    horizon: row.horizon,
    parentGoalId: row.parent_goal_id || undefined,
    area: row.area || undefined,
    startDate: row.start_date || undefined,
    targetDate: row.target_date || undefined,
    achievedAt: row.achieved_at || undefined,
    abandonedAt: row.abandoned_at || undefined,
    progressType: row.progress_type,
    progressPercent: row.progress_percent,
    progressNotes: row.progress_notes || undefined,
    motivation: row.motivation || undefined,
    outcome: row.outcome || undefined,
    obstacles: row.obstacles ? JSON.parse(row.obstacles) : [],
    tags: row.tags ? JSON.parse(row.tags) : [],
    color: row.color || undefined,
    icon: row.icon || undefined,
    reviewCadence: row.review_cadence || undefined,
    nextReviewDate: row.next_review_date || undefined,
    lastReviewedAt: row.last_reviewed_at || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
  };
}

function rowToKR(row: any): KeyResult {
  return {
    id: row.id,
    goalId: row.goal_id,
    title: row.title,
    description: row.description || undefined,
    metricType: row.metric_type,
    startValue: row.start_value || undefined,
    targetValue: row.target_value,
    currentValue: row.current_value,
    unit: row.unit || undefined,
    confidence: row.confidence || undefined,
    dueDate: row.due_date || undefined,
    completedAt: row.completed_at || undefined,
    position: row.position,
  };
}

function rowToCheckIn(row: any): GoalCheckIn {
  return {
    id: row.id,
    goalId: row.goal_id,
    checkInDate: row.check_in_date,
    progressPercent: row.progress_percent,
    confidence: row.confidence,
    notes: row.notes || undefined,
    keyResultUpdates: row.key_result_updates ? JSON.parse(row.key_result_updates) : {},
    mood: row.mood || undefined,
    calendarEventId: row.calendar_event_id || undefined,
    createdAt: row.created_at,
  };
}

function rowToLink(row: any): GoalLink {
  return {
    goalId: row.goal_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    linkStrength: row.link_strength,
    createdAt: row.created_at,
  };
}
