import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { Project, ProjectStatus } from "../types";

interface ProjectsState {
  projects: Project[];
  activeProjectId: string | null;
  loading: boolean;
  error: string | null;

  loadProjects: () => Promise<void>;
  createProject: (
    name: string,
    description: string | null,
    status: ProjectStatus,
    budgetHours: number,
    tags: string[]
  ) => Promise<string>;
  updateProject: (
    id: string,
    name: string,
    description: string | null,
    status: ProjectStatus,
    budgetHours: number,
    tags: string[]
  ) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  setActiveProjectId: (id: string | null) => void;
  assignTaskToProject: (taskId: string, projectId: string | null) => Promise<void>;
}

export const useProjectsStore = create<ProjectsState>((set, get) => ({
  projects: [],
  activeProjectId: null,
  loading: false,
  error: null,

  setActiveProjectId: (id) => set({ activeProjectId: id }),

  loadProjects: async () => {
    set({ loading: true, error: null });
    try {
      const list = await invoke<Project[]>("list_projects");
      set({ projects: list });
      
      // If there are projects and no active project is set, default to the first one
      if (list.length > 0 && !get().activeProjectId) {
        set({ activeProjectId: list[0].id });
      }
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to load projects from SQLite" });
    } finally {
      set({ loading: false });
    }
  },

  createProject: async (name, description, status, budgetHours, tags) => {
    set({ loading: true, error: null });
    try {
      const created = await invoke<Project>("create_project", {
        name,
        description,
        status,
        budgetHours,
        tags,
        metadata: "{}",
      });
      set((state) => ({
        projects: [...state.projects, created],
        activeProjectId: state.activeProjectId || created.id,
      }));
      return created.id;
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to create project" });
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  updateProject: async (id, name, description, status, budgetHours, tags) => {
    set({ loading: true, error: null });
    try {
      await invoke("update_project", {
        id,
        name,
        description,
        status,
        budgetHours,
        tags,
      });
      await get().loadProjects();
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to update project" });
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  deleteProject: async (id) => {
    set({ loading: true, error: null });
    try {
      await invoke("delete_project", { id });
      set((state) => {
        const nextProjects = state.projects.filter((p) => p.id !== id);
        let nextActiveId = state.activeProjectId;
        if (nextActiveId === id) {
          nextActiveId = nextProjects.length > 0 ? nextProjects[0].id : null;
        }
        return {
          projects: nextProjects,
          activeProjectId: nextActiveId,
        };
      });
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to delete project" });
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  assignTaskToProject: async (taskId, projectId) => {
    try {
      await invoke("assign_task_to_project", { taskId, projectId });
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to assign task to project" });
      throw e;
    }
  },
}));

export default useProjectsStore;
