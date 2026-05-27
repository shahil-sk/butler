import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { Goal, KeyResult, GoalLink, GoalHorizon, GoalStatus, KeyResultType } from "../types";

interface GoalsState {
  goals: Goal[];
  activeGoalId: string | null;
  keyResults: KeyResult[];
  goalLinks: GoalLink[];
  loading: boolean;
  error: string | null;

  loadGoals: () => Promise<void>;
  createGoal: (
    title: string,
    description: string | null,
    horizon: GoalHorizon,
    status: GoalStatus,
    targetDate: number | null,
    tags: string[],
    initialKrs: Array<{ title: string; targetValue: number; unit: string; keyResultType: KeyResultType }>
  ) => Promise<void>;
  updateGoal: (
    id: string,
    title: string,
    description: string | null,
    horizon: GoalHorizon,
    status: GoalStatus,
    targetDate: number | null,
    tags: string[]
  ) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  setActiveGoalId: (id: string | null) => void;

  loadKeyResults: (goalId: string) => Promise<void>;
  createKeyResult: (
    goalId: string,
    title: string,
    targetValue: number,
    currentValue: number,
    unit: string,
    keyResultType: KeyResultType
  ) => Promise<void>;
  updateKeyResultValue: (id: string, currentValue: number) => Promise<void>;
  deleteKeyResult: (id: string) => Promise<void>;

  loadGoalLinks: (goalId: string) => Promise<void>;
  linkEntity: (goalId: string, entityId: string, entityType: "project" | "habit" | "task") => Promise<void>;
  unlinkEntity: (goalId: string, entityId: string, entityType: "project" | "habit" | "task") => Promise<void>;
}

export const useGoalsStore = create<GoalsState>((set, get) => ({
  goals: [],
  activeGoalId: null,
  keyResults: [],
  goalLinks: [],
  loading: false,
  error: null,

  setActiveGoalId: (id) => {
    set({ activeGoalId: id, keyResults: [], goalLinks: [] });
    if (id) {
      void get().loadKeyResults(id);
      void get().loadGoalLinks(id);
    }
  },

  loadGoals: async () => {
    set({ loading: true, error: null });
    try {
      const list = await invoke<Goal[]>("list_goals");
      set({ goals: list });
      
      // If there are goals and no active goal is set, default to first
      if (list.length > 0 && !get().activeGoalId) {
        get().setActiveGoalId(list[0].id);
      }
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to load goals from database" });
    } finally {
      set({ loading: false });
    }
  },

  createGoal: async (title, description, horizon, status, targetDate, tags, initialKrs) => {
    set({ loading: true, error: null });
    try {
      const created = await invoke<Goal>("create_goal", {
        title,
        description,
        horizon,
        status,
        targetDate,
        tags,
        metadata: "{}",
      });
      
      // Create initial key results sequentially
      for (const kr of initialKrs) {
        await invoke("create_key_result", {
          goalId: created.id,
          title: kr.title,
          targetValue: kr.targetValue,
          currentValue: 0.0,
          unit: kr.unit,
          keyResultType: kr.keyResultType,
        });
      }

      set((state) => ({
        goals: [...state.goals, created],
      }));
      get().setActiveGoalId(created.id);
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to create goal" });
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  updateGoal: async (id, title, description, horizon, status, targetDate, tags) => {
    set({ loading: true, error: null });
    try {
      await invoke("update_goal", {
        id,
        title,
        description,
        horizon,
        status,
        targetDate,
        tags,
      });
      await get().loadGoals();
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to update goal" });
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  deleteGoal: async (id) => {
    set({ loading: true, error: null });
    try {
      await invoke("delete_goal", { id });
      set((state) => {
        const nextGoals = state.goals.filter((g) => g.id !== id);
        let nextActiveId = state.activeGoalId;
        if (nextActiveId === id) {
          nextActiveId = nextGoals.length > 0 ? nextGoals[0].id : null;
        }
        return {
          goals: nextGoals,
          activeGoalId: nextActiveId,
        };
      });
      if (get().activeGoalId) {
        get().setActiveGoalId(get().activeGoalId);
      }
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to delete goal" });
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  loadKeyResults: async (goalId) => {
    try {
      const list = await invoke<KeyResult[]>("list_key_results", { goalId });
      set({ keyResults: list });
    } catch (e) {
      console.error("Failed to load key results", e);
    }
  },

  createKeyResult: async (goalId, title, targetValue, currentValue, unit, keyResultType) => {
    try {
      const created = await invoke<KeyResult>("create_key_result", {
        goalId,
        title,
        targetValue,
        currentValue,
        unit,
        keyResultType,
      });
      set((state) => ({
        keyResults: [...state.keyResults, created],
      }));
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to create key result" });
    }
  },

  updateKeyResultValue: async (id, currentValue) => {
    // Optimistic update
    const previous = get().keyResults;
    set({
      keyResults: previous.map((k) => (k.id === id ? { ...k, current_value: currentValue } : k)),
    });
    try {
      await invoke("update_key_result_value", { id, currentValue });
    } catch (e) {
      console.error(e);
      set({ keyResults: previous, error: "Failed to update key result value" });
    }
  },

  deleteKeyResult: async (id) => {
    set((state) => ({
      keyResults: state.keyResults.filter((k) => k.id !== id),
    }));
    try {
      await invoke("delete_key_result", { id });
    } catch (e) {
      console.error(e);
      set({ error: "Failed to delete key result" });
    }
  },

  loadGoalLinks: async (goalId) => {
    try {
      const list = await invoke<GoalLink[]>("list_goal_links", { goalId });
      set({ goalLinks: list });
    } catch (e) {
      console.error("Failed to load goal links", e);
    }
  },

  linkEntity: async (goalId, entityId, entityType) => {
    try {
      await invoke("link_entity_to_goal", { goalId, entityId, entityType });
      await get().loadGoalLinks(goalId);
    } catch (e) {
      console.error(e);
    }
  },

  unlinkEntity: async (goalId, entityId, entityType) => {
    try {
      await invoke("unlink_entity_from_goal", { goalId, entityId, entityType });
      await get().loadGoalLinks(goalId);
    } catch (e) {
      console.error(e);
    }
  },
}));

export default useGoalsStore;
