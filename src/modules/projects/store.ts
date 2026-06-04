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
    attachments:  JSON.parse((r.attachments as string) || "[]"),
    order:        r.sort_order as number,
    createdAt:    r.created_at as string,
    updatedAt:    r.updated_at as string,
    health:       (r.health as any) ?? undefined,
    priority:     (r.priority as any) ?? "none",
    visibility:   (r.visibility as any) ?? "private",
    goalId:       (r.goal_id as string) ?? undefined,
    parentProjectId: (r.parent_project_id as string) ?? undefined,
    targetDate:   (r.target_date as string) ?? undefined,
    hardDeadline: (r.hard_deadline as string) ?? undefined,
    completedAt:  (r.completed_at as string) ?? undefined,
    ownerId:      (r.owner_id as string) ?? "",
    coverImageUrl: (r.cover_image_url as string) ?? undefined,
    budgetHours:  (r.budget_hours as number) ?? undefined,
    budgetCost:   (r.budget_cost as number) ?? undefined,
    currency:     (r.currency as string) ?? undefined,
    tags:         JSON.parse((r.tags as string) || "[]"),
    labels:       JSON.parse((r.labels as string) || "[]"),
    customFields: JSON.parse((r.custom_fields as string) || "{}"),
    progressMode: (r.progress_mode as any) ?? "manual",
    progressPercent: (r.progress_percent as number) ?? 0,
    templateId:   (r.template_id as string) ?? undefined,
    isTemplate:   Boolean(r.is_template),
    createdBy:    (r.created_by as string) ?? "",
    archivedAt:   (r.archived_at as string) ?? undefined,
  };
}

// ── SQL ───────────────────────────────────────────────────────

const INSERT_SQL = `
  INSERT INTO projects (
    id, name, description, status, color, icon,
    start_date, due_date, milestones, linked_note_ids, attachments,
    sort_order, created_at, updated_at,
    health, priority, visibility, goal_id, parent_project_id,
    target_date, hard_deadline, completed_at, owner_id,
    cover_image_url, budget_hours, budget_cost, currency,
    tags, labels, custom_fields, progress_mode, progress_percent,
    template_id, is_template, created_by, archived_at
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
`;

const UPDATE_SQL = `
  UPDATE projects SET
    name=?, description=?, status=?, color=?, icon=?,
    start_date=?, due_date=?, milestones=?, linked_note_ids=?, attachments=?,
    sort_order=?, updated_at=?,
    health=?, priority=?, visibility=?, goal_id=?, parent_project_id=?,
    target_date=?, hard_deadline=?, completed_at=?, owner_id=?,
    cover_image_url=?, budget_hours=?, budget_cost=?, currency=?,
    tags=?, labels=?, custom_fields=?, progress_mode=?, progress_percent=?,
    template_id=?, is_template=?, created_by=?, archived_at=?
  WHERE id=?
`;

function insertParams(p: Project): unknown[] {
  return [
    p.id, p.name, p.description ?? null, p.status, p.color, p.icon ?? null,
    p.startDate ?? null, p.dueDate ?? null,
    JSON.stringify(p.milestones), JSON.stringify(p.linkedNoteIds), JSON.stringify(p.attachments || []),
    p.order, p.createdAt, p.updatedAt,
    p.health ?? null, p.priority, p.visibility, p.goalId ?? null, p.parentProjectId ?? null,
    p.targetDate ?? null, p.hardDeadline ?? null, p.completedAt ?? null, p.ownerId,
    p.coverImageUrl ?? null, p.budgetHours ?? null, p.budgetCost ?? null, p.currency ?? null,
    JSON.stringify(p.tags), JSON.stringify(p.labels), JSON.stringify(p.customFields),
    p.progressMode, p.progressPercent, p.templateId ?? null, p.isTemplate ? 1 : 0,
    p.createdBy, p.archivedAt ?? null
  ];
}

function updateParams(p: Project): unknown[] {
  return [
    p.name, p.description ?? null, p.status, p.color, p.icon ?? null,
    p.startDate ?? null, p.dueDate ?? null,
    JSON.stringify(p.milestones), JSON.stringify(p.linkedNoteIds), JSON.stringify(p.attachments || []),
    p.order, p.updatedAt,
    p.health ?? null, p.priority, p.visibility, p.goalId ?? null, p.parentProjectId ?? null,
    p.targetDate ?? null, p.hardDeadline ?? null, p.completedAt ?? null, p.ownerId,
    p.coverImageUrl ?? null, p.budgetHours ?? null, p.budgetCost ?? null, p.currency ?? null,
    JSON.stringify(p.tags), JSON.stringify(p.labels), JSON.stringify(p.customFields),
    p.progressMode, p.progressPercent, p.templateId ?? null, p.isTemplate ? 1 : 0,
    p.createdBy, p.archivedAt ?? null,
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
      id: generateId(),
      name: input.name || "Untitled Project",
      description: input.description,
      status: input.status || "active",
      color: input.color || "#3b82f6",
      icon: input.icon,
      startDate: input.startDate,
      dueDate: input.dueDate,
      milestones: input.milestones || [],
      linkedNoteIds: input.linkedNoteIds || [],
      attachments: input.attachments || [],
      order:        Date.now(),
      createdAt:    now(),
      updatedAt:    now(),
      health:       input.health,
      priority:     input.priority ?? "none",
      visibility:   input.visibility ?? "private",
      goalId:       input.goalId,
      parentProjectId: input.parentProjectId,
      targetDate:   input.targetDate,
      hardDeadline: input.hardDeadline,
      completedAt:  input.completedAt,
      ownerId:      input.ownerId ?? "",
      coverImageUrl: input.coverImageUrl,
      budgetHours:  input.budgetHours,
      budgetCost:   input.budgetCost,
      currency:     input.currency,
      tags:         input.tags ?? [],
      labels:       input.labels ?? [],
      customFields: input.customFields ?? {},
      progressMode: input.progressMode ?? "manual",
      progressPercent: input.progressPercent ?? 0,
      templateId:   input.templateId,
      isTemplate:   input.isTemplate ?? false,
      createdBy:    input.createdBy ?? "",
      archivedAt:   input.archivedAt,
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
      id: generateId(), projectId, title, dueDate: dueDate || "",
      status: "pending", tasks: [], dependsOn: [], linkedTaskIds: [],
      createdAt: now()
    };
    await get().updateProject(projectId, { milestones: [...project.milestones, milestone] });
    bus.emit("project:milestone-created" as any, { project, milestone });
  },

  updateMilestone: async (projectId, milestoneId, patch) => {
    const project = get().projects.find((p) => p.id === projectId);
    if (!project) return;
    const nextMilestones = project.milestones.map((m) => m.id === milestoneId ? { ...m, ...patch } : m);
    await get().updateProject(projectId, { milestones: nextMilestones });
    const updated = nextMilestones.find(m => m.id === milestoneId);
    if (updated) {
      bus.emit("project:milestone-updated" as any, { project, milestone: updated });
    }
  },

  completeMilestone: async (projectId, milestoneId) =>
    get().updateMilestone(projectId, milestoneId, { completedAt: now() }),

  deleteMilestone: async (projectId, milestoneId) => {
    const project = get().projects.find((p) => p.id === projectId);
    if (!project) return;
    const milestone = project.milestones.find((m) => m.id === milestoneId);
    await get().updateProject(projectId, {
      milestones: project.milestones.filter((m) => m.id !== milestoneId),
    });
    if (milestone) {
      bus.emit("project:milestone-deleted" as any, { project, milestone });
    }
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
