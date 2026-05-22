// ============================================================
// PROJECTS — service.test.ts
// Unit tests for the project service layer.
// repository and event bus are mocked at the boundary.
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock repository ──────────────────────────────────────────
vi.mock("../repository", () => ({
  dbLoadAllProjects: vi.fn().mockResolvedValue([]),
  dbFindProjectById: vi.fn().mockResolvedValue(null),
  dbInsertProject:   vi.fn().mockResolvedValue(undefined),
  dbUpdateProject:   vi.fn().mockResolvedValue(undefined),
  dbDeleteProject:   vi.fn().mockResolvedValue(undefined),
}));

// ── Mock event bus ────────────────────────────────────────────
const mockEmit = vi.fn();
vi.mock("@/kernel/event-bus", () => ({ bus: { emit: mockEmit, on: vi.fn() } }));

// ── Mock shared utils ─────────────────────────────────────────
vi.mock("@/shared/utils", () => ({
  now:        () => "2026-05-22T09:00:00.000Z",
  generateId: vi.fn().mockReturnValue("test-id"),
}));

import * as svc from "../service";
import * as repo from "../repository";

const baseProject = (): svc.Project => ({
  id:            "proj-1",
  name:          "Test Project",
  status:        "active",
  color:         "#3b82f6",
  milestones:    [],
  linkedNoteIds: [],
  order:         1000,
  createdAt:     "2026-05-22T08:00:00.000Z",
  updatedAt:     "2026-05-22T08:00:00.000Z",
});

beforeEach(() => vi.clearAllMocks());

// ── buildProject ──────────────────────────────────────────────
describe("buildProject", () => {
  it("applies defaults for missing fields", () => {
    const p = svc.buildProject({});
    expect(p.name).toBe("Untitled project");
    expect(p.status).toBe("active");
    expect(p.color).toBe("#3b82f6");
    expect(p.milestones).toEqual([]);
    expect(p.linkedNoteIds).toEqual([]);
  });

  it("trims and uses provided name", () => {
    const p = svc.buildProject({ name: "  My Project  " });
    expect(p.name).toBe("My Project");
  });
});

// ── createProject ─────────────────────────────────────────────
describe("createProject", () => {
  it("inserts project and emits project:created", async () => {
    const project = await svc.createProject({ name: "Test" });
    expect(repo.dbInsertProject).toHaveBeenCalledOnce();
    expect(mockEmit).toHaveBeenCalledWith("project:created", { project });
  });

  it("returns the built project", async () => {
    const project = await svc.createProject({ name: "Alpha", status: "on_hold" });
    expect(project.name).toBe("Alpha");
    expect(project.status).toBe("on_hold");
  });
});

// ── updateProject ─────────────────────────────────────────────
describe("updateProject", () => {
  it("merges patch, stamps updatedAt, persists, emits project:updated", async () => {
    const updated = await svc.updateProject(baseProject(), { name: "Renamed" });
    expect(updated.name).toBe("Renamed");
    expect(updated.updatedAt).toBe("2026-05-22T09:00:00.000Z");
    expect(repo.dbUpdateProject).toHaveBeenCalledWith(expect.objectContaining({ name: "Renamed" }));
    expect(mockEmit).toHaveBeenCalledWith("project:updated", expect.objectContaining({
      project: expect.objectContaining({ name: "Renamed" }),
      changed: { name: "Renamed" },
    }));
  });

  it("preserves id through update", async () => {
    const updated = await svc.updateProject(baseProject(), { color: "#ff0000" });
    expect(updated.id).toBe("proj-1");
  });
});

// ── deleteProject ─────────────────────────────────────────────
describe("deleteProject", () => {
  it("calls dbDeleteProject and emits project:deleted + search:index-invalidated", async () => {
    await svc.deleteProject("proj-1");
    expect(repo.dbDeleteProject).toHaveBeenCalledWith("proj-1");
    expect(mockEmit).toHaveBeenCalledWith("project:deleted", { projectId: "proj-1" });
    expect(mockEmit).toHaveBeenCalledWith("search:index-invalidated", { entityType: "project", id: "proj-1" });
  });
});

// ── archiveProject ────────────────────────────────────────────
describe("archiveProject", () => {
  it("sets status to archived and emits project:updated", async () => {
    const updated = await svc.archiveProject(baseProject());
    expect(updated.status).toBe("archived");
    expect(mockEmit).toHaveBeenCalledWith("project:updated", expect.objectContaining({
      changed: { status: "archived" },
    }));
  });
});

// ── Milestones ────────────────────────────────────────────────
describe("addMilestone", () => {
  it("appends a milestone and persists", async () => {
    const updated = await svc.addMilestone(baseProject(), "Ship v1", "2026-06-01");
    expect(updated.milestones).toHaveLength(1);
    expect(updated.milestones[0].title).toBe("Ship v1");
    expect(updated.milestones[0].dueDate).toBe("2026-06-01");
    expect(updated.milestones[0].projectId).toBe("proj-1");
    expect(repo.dbUpdateProject).toHaveBeenCalledOnce();
  });
});

describe("completeMilestone", () => {
  it("sets completedAt on the target milestone", async () => {
    const project = {
      ...baseProject(),
      milestones: [{
        id: "ms-1", projectId: "proj-1", title: "Ship v1",
        completedAt: undefined, linkedTaskIds: [],
      }],
    };
    const updated = await svc.completeMilestone(project, "ms-1");
    expect(updated.milestones[0].completedAt).toBe("2026-05-22T09:00:00.000Z");
    expect(repo.dbUpdateProject).toHaveBeenCalledOnce();
  });
});

describe("deleteMilestone", () => {
  it("removes the target milestone and preserves others", async () => {
    const project = {
      ...baseProject(),
      milestones: [
        { id: "ms-1", projectId: "proj-1", title: "A", completedAt: undefined, linkedTaskIds: [] },
        { id: "ms-2", projectId: "proj-1", title: "B", completedAt: undefined, linkedTaskIds: [] },
      ],
    };
    const updated = await svc.deleteMilestone(project, "ms-1");
    expect(updated.milestones).toHaveLength(1);
    expect(updated.milestones[0].id).toBe("ms-2");
  });

  it("is safe when milestoneId does not exist", async () => {
    const updated = await svc.deleteMilestone(baseProject(), "no-such-ms");
    expect(updated.milestones).toHaveLength(0);
  });
});
