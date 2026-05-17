// ============================================================
// PROJECTS MODULE — STORE  (fixed)
// Explicit SQL column lists everywhere. No slice() tricks.
// ============================================================

import { create } from "zustand";
import { db } from "@/kernel/db";
import { bus } from "@/kernel/event-bus";
import { generateId, now } from "@/shared/utils";
import type { Project, Milestone, ID, ProjectStatus } from "@/shared/types";

// ── DB row → Project ─────────────────────────────────────────

function rowToProject(r: Record<string, unknown>): Project {
  return {
    id:           r.id as string,
    name:         r.name as string,
    description:  (r.description as string | null) ?? undefined,
    status:       r.status as ProjectStatus,
    color:        r.color as string,
    icon:         (r.icon as string | null) ?? undefined,
    startDate:    (r.start_date as string | null) ?? undefined,
    dueDate:      (r.due_date as string | null) ?? undefined,
    milestones:   JSON.parse((r.milestones as string) || "[]"),
    linkedNoteIds:JSON.parse((r.linked_note_ids as string) || "[]"),
    order:        r.sort_order as number,
    createdAt:    r.created_at as string,
    updatedAt:    r.updated_at as string,
  };
}

// ── SQL ───────────────────────────────────────────────────────

const INSERT_SQL = `
  INSERT INTO projects (
    id, name, description, status, color, icon,
    start_date, due_date, milestones, linked_note_ids,
    sort_order, created_at, updated_at
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
`;

const UPDATE_SQL = `
  UPDATE projects SET
    name=?, description=?, status=?, color=?, icon=?,
    start_date=?, due_date=?, milestones=?, linked_note_ids=?,
    sort_order=?, updated_at=?
  WHERE id=?
`;

function insertParams(p: Project): unknown[] {
  return [
    p.id, p.name, p.description ?? null, p.status, p.color, p.icon ?? null,
    p.startDate ?? null, p.dueDate ?? null,
    JSON.stringify(p.milestones), JSON.stringify(p.linkedNoteIds),
    p.order, p.createdAt, p.updatedAt,
  ];
}

function updateParams(p: Project): unknown[] {
  // 11 SET fields + 1 WHERE = 12 params
  return [
    p.name, p.description ?? null, p.status, p.color, p.icon ?? null,
    p.startDate ?? null, p.dueDate ?? null,
    JSON.stringify(p.milestones), JSON.stringify(p.linkedNoteIds),
    p.order, p.updatedAt,
    p.id, // WHERE
  ];
}

// ── State ─────────────────────────────────────────────────────

interface ProjectState {
  projects:        Project[];
  loading:         boolean;
  error:           string | null;
  openProjectId:   ID | null;
  createModalOpen: boolean;
  activeFilter:    "all" | "active" | "on_hold" | "completed" | "archived";
}

interface ProjectActions {
  loadProjects:     () => Promise<void>;
  createProject:    (input: Partial<Project>) => Promise<Project>;
  updateProject:    (id: ID, patch: Partial<Project>) => Promise<void>;
  deleteProject:    (id: ID) => Promise<void>;
  archiveProject:   (id: ID) => Promise<void>;
  addMilestone:     (projectId: ID, title: string, dueDate?: string) => Promise<void>;
  updateMilestone:  (projectId: ID, milestoneId: ID, patch: Partial<Milestone>) => Promise<void>;
  completeMilestone:(projectId: ID, milestoneId: ID) => Promise<void>;
  deleteMilestone:  (projectId: ID, milestoneId: ID) => Promise<void>;
  openProject:      (id: ID) => void;
  closeProject:     () => void;
  openCreateModal:  () => void;
  closeCreateModal: () => void;
  setActiveFilter:  (f: ProjectState["activeFilter"]) => void;
  getFilteredProjects: () => Project[];
  getProjectById:   (id: ID) => Project | undefined;
}

export const useProjectStore = create<ProjectState & ProjectActions>()((set, get) => ({
  projects: [], loading: false, error: null,
  openProjectId: null, createModalOpen: false, activeFilter: "all",

  loadProjects: async () => {
    set({ loading: true, error: null });
    try {
      const rows = await db.select<Record<string, unknown>>(
        "SELECT * FROM projects ORDER BY sort_order ASC, created_at DESC"
      );
      set({ projects: rows.map(rowToProject), loading: false });
    } catch (err) {
      console.error("[Projects] loadProjects failed:", err);
      set({ error: String(err), loading: false });
    }
  },

  createProject: async (input) => {
    const project: Project = {
      id:           generateId(),
      name:         input.name?.trim() || "Untitled project",
      description:  input.description,
      status:       input.status   ?? "active",
      color:        input.color    ?? "#3b82f6",
      icon:         input.icon,
      startDate:    input.startDate,
      dueDate:      input.dueDate,
      milestones:   input.milestones    ?? [],
      linkedNoteIds:input.linkedNoteIds ?? [],
      order:        Date.now(),
      createdAt:    now(),
      updatedAt:    now(),
    };

    try {
      await db.execute(INSERT_SQL, insertParams(project));
    } catch (err) {
      console.error("[Projects] createProject DB error:", err);
      throw err;
    }

    set((s) => ({ projects: [project, ...s.projects] }));
    bus.emit("project:created", { project });
    return project;
  },

  updateProject: async (id, patch) => {
    const existing = get().projects.find((p) => p.id === id);
    if (!existing) { console.warn("[Projects] updateProject: not found", id); return; }

    const updated: Project = { ...existing, ...patch, updatedAt: now() };

    try {
      await db.execute(UPDATE_SQL, updateParams(updated));
    } catch (err) {
      console.error("[Projects] updateProject DB error:", err);
      throw err;
    }

    set((s) => ({ projects: s.projects.map((p) => (p.id === id ? updated : p)) }));
    bus.emit("project:updated", { project: updated, changed: patch });
  },

  deleteProject: async (id) => {
    await db.execute("DELETE FROM projects WHERE id=?", [id]);
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== id),
      openProjectId: s.openProjectId === id ? null : s.openProjectId,
    }));
    bus.emit("project:deleted", { projectId: id });
  },

  archiveProject: async (id) => get().updateProject(id, { status: "archived" }),

  // ── Milestones ────────────────────────────────────────────

  addMilestone: async (projectId, title, dueDate) => {
    const project = get().projects.find((p) => p.id === projectId);
    if (!project) return;
    const milestone: Milestone = {
      id: generateId(), projectId, title, dueDate,
      completedAt: undefined, linkedTaskIds: [],
    };
    await get().updateProject(projectId, { milestones: [...project.milestones, milestone] });
  },

  updateMilestone: async (projectId, milestoneId, patch) => {
    const project = get().projects.find((p) => p.id === projectId);
    if (!project) return;
    await get().updateProject(projectId, {
      milestones: project.milestones.map((m) => m.id === milestoneId ? { ...m, ...patch } : m),
    });
  },

  completeMilestone: async (projectId, milestoneId) =>
    get().updateMilestone(projectId, milestoneId, { completedAt: now() }),

  deleteMilestone: async (projectId, milestoneId) => {
    const project = get().projects.find((p) => p.id === projectId);
    if (!project) return;
    await get().updateProject(projectId, {
      milestones: project.milestones.filter((m) => m.id !== milestoneId),
    });
  },

  // ── UI ────────────────────────────────────────────────────

  openProject:     (id) => { set({ openProjectId: id }); bus.emit("project:open", { projectId: id }); },
  closeProject:    ()   => set({ openProjectId: null }),
  openCreateModal: ()   => set({ createModalOpen: true }),
  closeCreateModal:()   => set({ createModalOpen: false }),
  setActiveFilter: (f)  => set({ activeFilter: f }),

  getFilteredProjects: () => {
    const { projects, activeFilter } = get();
    if (activeFilter === "all") return projects.filter((p) => p.status !== "archived");
    return projects.filter((p) => p.status === activeFilter);
  },

  getProjectById: (id) => get().projects.find((p) => p.id === id),
}));
