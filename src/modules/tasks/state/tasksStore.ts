import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { Task, TaskStatus, TaskPriority } from "../types";

interface TasksState {
  tasks: Task[];
  searchQuery: string;
  loading: boolean;
  error: string | null;

  setSearchQuery: (query: string) => void;
  loadTasks: () => Promise<void>;
  searchTasks: (query: string) => Promise<void>;
  createTask: (title: string, priority: TaskPriority, tags: string[], projectId?: string | null, parentId?: string | null) => Promise<void>;
  updateTaskStatus: (id: string, status: TaskStatus) => Promise<void>;
  updateTaskDetails: (id: string, title: string, priority: TaskPriority, dueDate: number | null, projectId: string | null, tags: string[]) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
}

export const useTasksStore = create<TasksState>((set, get) => ({
  tasks: [],
  searchQuery: "",
  loading: false,
  error: null,

  setSearchQuery: (query) => set({ searchQuery: query }),

  loadTasks: async () => {
    set({ loading: true, error: null });
    try {
      const query = get().searchQuery;
      let list: Task[];
      if (query.trim()) {
        list = await invoke<Task[]>("search_tasks", { query });
      } else {
        list = await invoke<Task[]>("list_tasks");
      }
      set({ tasks: list });
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to load tasks from SQLite" });
    } finally {
      set({ loading: false });
    }
  },

  searchTasks: async (query) => {
    set({ searchQuery: query, loading: true, error: null });
    try {
      const list = await invoke<Task[]>("search_tasks", { query });
      set({ tasks: list });
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to perform database search" });
    } finally {
      set({ loading: false });
    }
  },

  createTask: async (title, priority, tags, projectId = null, parentId = null) => {
    set({ loading: true, error: null });
    try {
      await invoke("create_task", {
        title,
        status: "todo",
        priority,
        dueDate: null,
        parentId,
        projectId,
        tags,
        metadata: "{}",
      });
      // Reload tasks after insertion
      const query = get().searchQuery;
      let list: Task[];
      if (query.trim()) {
        list = await invoke<Task[]>("search_tasks", { query });
      } else {
        list = await invoke<Task[]>("list_tasks");
      }
      set({ tasks: list });
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to insert task" });
    } finally {
      set({ loading: false });
    }
  },

  updateTaskStatus: async (id, status) => {
    // Optimistic update
    const previousTasks = get().tasks;
    set({
      tasks: previousTasks.map((t) => (t.id === id ? { ...t, status } : t)),
    });

    try {
      await invoke("update_task_status", { id, status });
    } catch (e: any) {
      console.error(e);
      // Revert on error
      set({ tasks: previousTasks, error: "Failed to update task status" });
    }
  },

  updateTaskDetails: async (id, title, priority, dueDate, projectId, tags) => {
    set({ loading: true, error: null });
    try {
      await invoke("update_task_details", {
        id,
        title,
        priority,
        dueDate,
        projectId,
        tags,
      });
      await get().loadTasks();
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to update task details" });
    } finally {
      set({ loading: false });
    }
  },

  deleteTask: async (id) => {
    // Optimistic update
    const previousTasks = get().tasks;
    set({
      tasks: previousTasks.filter((t) => t.id !== id),
    });

    try {
      await invoke("delete_task", { id });
    } catch (e: any) {
      console.error(e);
      // Revert on error
      set({ tasks: previousTasks, error: "Failed to delete task" });
    }
  },
}));
export default useTasksStore;
