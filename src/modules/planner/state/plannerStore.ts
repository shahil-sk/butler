import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { TimeBlock, Reflection, BlockType } from "../types";

interface PlannerState {
  timeBlocks: TimeBlock[];
  reflections: Reflection[];
  loading: boolean;
  error: string | null;

  loadTimeBlocks: () => Promise<void>;
  createTimeBlock: (
    title: string,
    startTime: number,
    endTime: number,
    blockType: BlockType,
    taskId: string | null
  ) => Promise<void>;
  deleteTimeBlock: (id: string) => Promise<void>;
  loadReflections: (date: string) => Promise<void>;
  saveReflection: (date: string, promptId: string, response: string) => Promise<void>;
}

export const usePlannerStore = create<PlannerState>((set, get) => ({
  timeBlocks: [],
  reflections: [],
  loading: false,
  error: null,

  loadTimeBlocks: async () => {
    set({ loading: true, error: null });
    try {
      const list = await invoke<TimeBlock[]>("list_time_blocks");
      set({ timeBlocks: list });
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to load time blocks" });
    } finally {
      set({ loading: false });
    }
  },

  createTimeBlock: async (title, startTime, endTime, blockType, taskId) => {
    set({ loading: true, error: null });
    try {
      await invoke("create_time_block", {
        title,
        startTime,
        endTime,
        blockType,
        taskId,
      });
      // Reload blocks
      const list = await invoke<TimeBlock[]>("list_time_blocks");
      set({ timeBlocks: list });
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to create time block" });
    } finally {
      set({ loading: false });
    }
  },

  deleteTimeBlock: async (id) => {
    const previousBlocks = get().timeBlocks;
    set({
      timeBlocks: previousBlocks.filter((b) => b.id !== id),
    });

    try {
      await invoke("delete_time_block", { id });
    } catch (e: any) {
      console.error(e);
      set({ timeBlocks: previousBlocks, error: "Failed to delete time block" });
    }
  },

  loadReflections: async (date) => {
    set({ loading: true, error: null });
    try {
      const list = await invoke<Reflection[]>("get_reflections_for_date", { date });
      set({ reflections: list });
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to load reflections" });
    } finally {
      set({ loading: false });
    }
  },

  saveReflection: async (date, promptId, response) => {
    try {
      const ref = await invoke<Reflection>("save_reflection", { date, promptId, response });
      
      set((state) => {
        const index = state.reflections.findIndex((r) => r.prompt_id === promptId);
        let updatedReflections = [...state.reflections];
        if (index >= 0) {
          updatedReflections[index] = ref;
        } else {
          updatedReflections.push(ref);
        }
        return { reflections: updatedReflections };
      });
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to save reflection response" });
    }
  },
}));
export default usePlannerStore;
