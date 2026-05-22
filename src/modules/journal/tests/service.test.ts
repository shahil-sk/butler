// ============================================================
// JOURNAL — service.test.ts
// Unit tests for the journal service layer.
// repository and event bus are mocked at the boundary.
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock repository ───────────────────────────────────────────
vi.mock("../repository", () => ({
  dbLoadAllEntries:  vi.fn().mockResolvedValue([]),
  dbFindDailyEntry:  vi.fn().mockResolvedValue(null),
  dbInsertEntry:     vi.fn().mockResolvedValue(undefined),
  dbUpdateEntry:     vi.fn().mockResolvedValue(undefined),
  dbDeleteEntry:     vi.fn().mockResolvedValue(undefined),
}));

// ── Mock event bus ────────────────────────────────────────────
const mockEmit = vi.fn();
vi.mock("@/kernel/event-bus", () => ({ bus: { emit: mockEmit, on: vi.fn() } }));

// ── Mock shared utils ─────────────────────────────────────────
vi.mock("@/shared/utils", () => ({
  now:        () => "2026-05-22T09:00:00.000Z",
  today:      () => "2026-05-22",
  generateId: () => "test-id",
}));

import * as svc from "../service";
import * as repo from "../repository";

const baseEntry = (): svc.JournalEntry => ({
  id:               "entry-1",
  date:             "2026-05-22",
  type:             "daily",
  content:          "{}",
  linkedTaskIds:    [],
  linkedProjectIds: [],
  tags:             [],
  createdAt:        "2026-05-22T08:00:00.000Z",
  updatedAt:        "2026-05-22T08:00:00.000Z",
});

beforeEach(() => vi.clearAllMocks());

// ── buildEntry ───────────────────────────────────────────────
describe("buildEntry", () => {
  it("fills defaults for missing arrays", () => {
    const e = svc.buildEntry({ type: "daily", date: "2026-05-22" });
    expect(e.linkedTaskIds).toEqual([]);
    expect(e.linkedProjectIds).toEqual([]);
    expect(e.tags).toEqual([]);
    expect(e.content).toBe("{}");
  });

  it("carries provided content through", () => {
    const e = svc.buildEntry({ type: "freeform", date: "2026-05-22", content: "{\"text\":\"hello\"}" });
    expect(e.content).toBe("{\"text\":\"hello\"}");
    expect(e.type).toBe("freeform");
  });
});

// ── createEntry ─────────────────────────────────────────────
describe("createEntry", () => {
  it("inserts entry and emits journal:entry-created", async () => {
    const entry = await svc.createEntry({ type: "daily", date: "2026-05-22" });
    expect(repo.dbInsertEntry).toHaveBeenCalledOnce();
    expect(mockEmit).toHaveBeenCalledWith("journal:entry-created", { entry });
  });

  it("also emits ui:notification", async () => {
    await svc.createEntry({ type: "daily", date: "2026-05-22" });
    expect(mockEmit).toHaveBeenCalledWith("ui:notification", expect.objectContaining({ type: "success" }));
  });
});

// ── updateEntry ─────────────────────────────────────────────
describe("updateEntry", () => {
  it("merges changes, stamps updatedAt, persists, and emits event", async () => {
    const updated = await svc.updateEntry(baseEntry(), { content: "{\"text\":\"changed\"}" });
    expect(updated.content).toBe("{\"text\":\"changed\"}");
    expect(updated.updatedAt).toBe("2026-05-22T09:00:00.000Z");
    expect(repo.dbUpdateEntry).toHaveBeenCalledWith(expect.objectContaining({ content: "{\"text\":\"changed\"}" }));
    expect(mockEmit).toHaveBeenCalledWith("journal:entry-updated", { entry: updated });
  });

  it("preserves id through update", async () => {
    const updated = await svc.updateEntry(baseEntry(), { mood: 4 });
    expect(updated.id).toBe("entry-1");
    expect(updated.mood).toBe(4);
  });
});

// ── deleteEntry ─────────────────────────────────────────────
describe("deleteEntry", () => {
  it("calls dbDeleteEntry and emits search:index-invalidated", async () => {
    await svc.deleteEntry("entry-1");
    expect(repo.dbDeleteEntry).toHaveBeenCalledWith("entry-1");
    expect(mockEmit).toHaveBeenCalledWith("search:index-invalidated", { entityType: "journal", id: "entry-1" });
  });
});

// ── getOrCreateDaily ────────────────────────────────────────

describe("getOrCreateDaily", () => {
  it("returns in-memory entry without hitting DB", async () => {
    const entries = [baseEntry()];
    const { entry, wasCreated } = await svc.getOrCreateDaily(entries, "2026-05-22");
    expect(entry.id).toBe("entry-1");
    expect(wasCreated).toBe(false);
    expect(repo.dbFindDailyEntry).not.toHaveBeenCalled();
  });

  it("returns DB entry when not in memory", async () => {
    vi.mocked(repo.dbFindDailyEntry).mockResolvedValueOnce(baseEntry());
    const { entry, wasCreated } = await svc.getOrCreateDaily([], "2026-05-22");
    expect(entry.id).toBe("entry-1");
    expect(wasCreated).toBe(false);
    expect(repo.dbInsertEntry).not.toHaveBeenCalled();
  });

  it("creates a new entry when not found in memory or DB", async () => {
    const { entry, wasCreated } = await svc.getOrCreateDaily([], "2026-05-22");
    expect(wasCreated).toBe(true);
    expect(repo.dbInsertEntry).toHaveBeenCalledOnce();
    expect(entry.type).toBe("daily");
    expect(entry.date).toBe("2026-05-22");
  });
});

// ── linkTask / unlinkTask ───────────────────────────────────

describe("linkTask", () => {
  it("adds taskId to linkedTaskIds", async () => {
    const updated = await svc.linkTask(baseEntry(), "task-99");
    expect(updated?.linkedTaskIds).toContain("task-99");
  });

  it("is a no-op (returns null) if taskId already linked", async () => {
    const entry = { ...baseEntry(), linkedTaskIds: ["task-99"] };
    const result = await svc.linkTask(entry, "task-99");
    expect(result).toBeNull();
    expect(repo.dbUpdateEntry).not.toHaveBeenCalled();
  });
});

describe("unlinkTask", () => {
  it("removes taskId from linkedTaskIds", async () => {
    const entry = { ...baseEntry(), linkedTaskIds: ["task-1", "task-2"] };
    const updated = await svc.unlinkTask(entry, "task-1");
    expect(updated.linkedTaskIds).toEqual(["task-2"]);
  });

  it("is safe when taskId is not present", async () => {
    const updated = await svc.unlinkTask(baseEntry(), "no-such-task");
    expect(updated.linkedTaskIds).toEqual([]);
  });
});
