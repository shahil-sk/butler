// ============================================================
// PROJECTS — SERVICE
// Business logic only. Calls repository.*; no direct db import.
// ============================================================

import { bus } from "@/kernel/event-bus";
import { generateId, now } from "@/shared/utils";
import {
  dbLoadAllProjects,
  dbInsertProject,
  dbUpdateProject,
  dbDeleteProject,
} from "./repository";
import { type Project, type Milestone } from "./types";

export type { Project, Milestone, ProjectStatus } from "./types";

// ── Factory ───────────────────────────────────────────────────

export function buildProject(input: Partial<Project>): Project {
  return {
    id:            generateId(),
    name:          input.name?.trim() || "Untitled project",
    description:   input.description,
    status:        input.status       ?? "active",
    color:         input.color        ?? "#3b82f6",
    icon:          input.icon,
    startDate:     input.startDate,
    dueDate:       input.dueDate,
    milestones:    input.milestones    ?? [],
    linkedNoteIds: input.linkedNoteIds ?? [],
    order:         Date.now(),
    createdAt:     now(),
    updatedAt:     now(),
  };
}

// ── Load ──────────────────────────────────────────────────────

export async function loadProjects(): Promise<Project[]> {
  return dbLoadAllProjects();
}

// ── Create ────────────────────────────────────────────────────

export async function createProject(input: Partial<Project>): Promise<Project> {
  const project = buildProject(input);
  await dbInsertProject(project);
  bus.emit("project:created", { project });
  return project;
}

// ── Update ────────────────────────────────────────────────────

export async function updateProject(
  existing: Project,
  patch: Partial<Project>
): Promise<Project> {
  const updated: Project = { ...existing, ...patch, updatedAt: now() };
  await dbUpdateProject(updated);
  bus.emit("project:updated", { project: updated, changed: patch });
  return updated;
}

// ── Delete ────────────────────────────────────────────────────

export async function deleteProject(id: string): Promise<void> {
  await dbDeleteProject(id);
  bus.emit("project:deleted", { projectId: id });
  bus.emit("search:index-invalidated", { entityType: "project", id });
}

// ── Archive ───────────────────────────────────────────────────

export async function archiveProject(existing: Project): Promise<Project> {
  return updateProject(existing, { status: "archived" });
}

// ── Milestones ────────────────────────────────────────────────
// All milestone operations are projections onto Project.milestones[]
// and persist via updateProject — no separate milestones table.

function buildMilestone(
  projectId: string,
  title: string,
  dueDate?: string
): Milestone {
  return {
    id:            generateId(),
    projectId,
    title,
    dueDate,
    completedAt:   undefined,
    linkedTaskIds: [],
  };
}

export async function addMilestone(
  project: Project,
  title: string,
  dueDate?: string
): Promise<Project> {
  const milestone = buildMilestone(project.id, title, dueDate);
  return updateProject(project, {
    milestones: [...project.milestones, milestone],
  });
}

export async function updateMilestone(
  project: Project,
  milestoneId: string,
  patch: Partial<Milestone>
): Promise<Project> {
  return updateProject(project, {
    milestones: project.milestones.map((m) =>
      m.id === milestoneId ? { ...m, ...patch } : m
    ),
  });
}

export async function completeMilestone(
  project: Project,
  milestoneId: string
): Promise<Project> {
  return updateMilestone(project, milestoneId, { completedAt: now() });
}

export async function deleteMilestone(
  project: Project,
  milestoneId: string
): Promise<Project> {
  return updateProject(project, {
    milestones: project.milestones.filter((m) => m.id !== milestoneId),
  });
}
