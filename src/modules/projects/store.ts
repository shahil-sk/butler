// ============================================================
// PROJECTS — STORE
// UI state only. Zero db import. Zero SQL. Zero bus import.
// Delegates all writes to svc.*; owns projects[], loading,
// error, and UI state (openProjectId, createModalOpen, activeFilter).
// ============================================================

import { create } from "zustand";
import * as svc from "./service";
import { dbLoadAllProjects } from "./repository";
import type { Project, Milestone, ProjectStatus } from "./types";

// ── State shape ───────────────────────────────────────────────

interface ProjectState {
  projects:        Project[];
  loading:         boolean;
  error:           string | null;
  openProjectId:   string | null;
  createModalOpen: boolean;
  activeFilter:    "all" | ProjectStatus;

  loadProjects:      () => Promise<void>;
  createProject:     (input: Partial<Project>) => Promise<Project>;
  updateProject:     (id: string, patch: Partial<Project>) => Promise<void>;
  deleteProject:     (id: string) => Promise<void>;
  archiveProject:    (id: string) => Promise<void>;
  addMilestone:      (projectId: string, title: string, dueDate?: string) => Promise<void>;
  updateMilestone:   (projectId: string, milestoneId: string, patch: Partial<Milestone>) => Promise<void>;
  completeMilestone: (projectId: string, milestoneId: string) => Promise<void>;
  deleteMilestone:   (projectId: string, milestoneId: string) => Promise<void>;
  openProject:       (id: string) => void;
  closeProject:      () => void;
  openCreateModal:   () => void;
  closeCreateModal:  () => void;
  setActiveFilter:   (f: ProjectState["activeFilter"]) => void;
  getFilteredProjects: () => Project[];
  getProjectById:    (id: string) => Project | undefined;
}

// ── Store ─────────────────────────────────────────────────────

export const useProjectStore = create<ProjectState>()((set, get) => ({
  projects: [], loading: false, error: null,
  openProjectId: null, createModalOpen: false, activeFilter: "all",

  loadProjects: async () => {
    set({ loading: true, error: null });
    try {
      const projects = await dbLoadAllProjects();
      set({ projects, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  createProject: async (input) => {
    const project = await svc.createProject(input);
    set((s) => ({ projects: [project, ...s.projects] }));
    return project;
  },

  updateProject: async (id, patch) => {
    const existing = get().projects.find((p) => p.id === id);
    if (!existing) return;
    const updated = await svc.updateProject(existing, patch);
    set((s) => ({ projects: s.projects.map((p) => (p.id === id ? updated : p)) }));
  },

  deleteProject: async (id) => {
    await svc.deleteProject(id);
    set((s) => ({
      projects:     s.projects.filter((p) => p.id !== id),
      openProjectId: s.openProjectId === id ? null : s.openProjectId,
    }));
  },

  archiveProject: async (id) => {
    const existing = get().projects.find((p) => p.id === id);
    if (!existing) return;
    const updated = await svc.archiveProject(existing);
    set((s) => ({ projects: s.projects.map((p) => (p.id === id ? updated : p)) }));
  },

  addMilestone: async (projectId, title, dueDate) => {
    const project = get().projects.find((p) => p.id === projectId);
    if (!project) return;
    const updated = await svc.addMilestone(project, title, dueDate);
    set((s) => ({ projects: s.projects.map((p) => (p.id === projectId ? updated : p)) }));
  },

  updateMilestone: async (projectId, milestoneId, patch) => {
    const project = get().projects.find((p) => p.id === projectId);
    if (!project) return;
    const updated = await svc.updateMilestone(project, milestoneId, patch);
    set((s) => ({ projects: s.projects.map((p) => (p.id === projectId ? updated : p)) }));
  },

  completeMilestone: async (projectId, milestoneId) => {
    const project = get().projects.find((p) => p.id === projectId);
    if (!project) return;
    const updated = await svc.completeMilestone(project, milestoneId);
    set((s) => ({ projects: s.projects.map((p) => (p.id === projectId ? updated : p)) }));
  },

  deleteMilestone: async (projectId, milestoneId) => {
    const project = get().projects.find((p) => p.id === projectId);
    if (!project) return;
    const updated = await svc.deleteMilestone(project, milestoneId);
    set((s) => ({ projects: s.projects.map((p) => (p.id === projectId ? updated : p)) }));
  },

  openProject:      (id) => set({ openProjectId: id }),
  closeProject:     ()   => set({ openProjectId: null }),
  openCreateModal:  ()   => set({ createModalOpen: true }),
  closeCreateModal: ()   => set({ createModalOpen: false }),
  setActiveFilter:  (f)  => set({ activeFilter: f }),

  getFilteredProjects: () => {
    const { projects, activeFilter } = get();
    if (activeFilter === "all") return projects.filter((p) => p.status !== "archived");
    return projects.filter((p) => p.status === activeFilter);
  },

  getProjectById: (id) => get().projects.find((p) => p.id === id),
}));
