// ============================================================
// RESEARCH — repository.test.ts
// Unit tests for all db* repository functions.
// @/kernel/db is mocked at the boundary.
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock @/kernel/db ──────────────────────────────────────────
const mockExecute = vi.fn().mockResolvedValue(undefined);
const mockSelect  = vi.fn().mockResolvedValue([]);
vi.mock("@/kernel/db", () => ({ db: { execute: mockExecute, select: mockSelect } }));

// ── Mock ./db (SQL constants + row mappers) ───────────────────
vi.mock("../db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../db")>();
  return {
    ...actual,
    RESEARCH_MIGRATIONS: [],
  };
});

import * as repo from "../repository";

const SOURCE_ROW = {
  id: "src-1",
  type: "pdf",
  title: "Test PDF",
  url: null,
  file_path: "/tmp/test.pdf",
  raw_content: null,
  mime_type: "application/pdf",
  size_bytes: 1024,
  processing_status: "pending",
  error_message: null,
  thread_ids: "[]",
  tags: "[]",
  imported_at: "2026-05-22T09:00:00.000Z",
  updated_at: "2026-05-22T09:00:00.000Z",
};

const THREAD_ROW = {
  id: "thr-1",
  title: "My Thread",
  description: null,
  color: null,
  source_ids: "[]",
  highlight_ids: "[]",
  annotation_ids: "[]",
  linked_note_ids: "[]",
  linked_task_ids: "[]",
  linked_project_ids: "[]",
  ai_summary: null,
  unresolved_questions: "[]",
  recent_insights: "[]",
  tags: "[]",
  is_pinned: 0,
  created_at: "2026-05-22T09:00:00.000Z",
  updated_at: "2026-05-22T09:00:00.000Z",
};

beforeEach(() => vi.clearAllMocks());

// ── dbSelectSources ───────────────────────────────────────────

describe("dbSelectSources", () => {
  it("maps rows to ResearchSource objects", async () => {
    mockSelect.mockResolvedValueOnce([SOURCE_ROW]);
    const sources = await repo.dbSelectSources();
    expect(sources).toHaveLength(1);
    expect(sources[0].id).toBe("src-1");
    expect(sources[0].threadIds).toEqual([]);
    expect(sources[0].tags).toEqual([]);
  });

  it("returns empty array when no rows", async () => {
    mockSelect.mockResolvedValueOnce([]);
    const sources = await repo.dbSelectSources();
    expect(sources).toHaveLength(0);
  });
});

// ── dbInsertSource ────────────────────────────────────────────

describe("dbInsertSource", () => {
  it("calls db.execute twice (INSERT + FTS_INSERT)", async () => {
    const source = {
      id: "src-1", type: "pdf" as const,
      title: "Test PDF", processingStatus: "pending" as const,
      threadIds: [], tags: [],
      importedAt: "2026-05-22T09:00:00.000Z",
      updatedAt: "2026-05-22T09:00:00.000Z",
    };
    await repo.dbInsertSource(source);
    expect(mockExecute).toHaveBeenCalledTimes(2);
  });

  it("first execute call contains the source id", async () => {
    const source = {
      id: "src-2", type: "web" as const,
      title: "Web Article", processingStatus: "pending" as const,
      url: "https://example.com",
      threadIds: [], tags: [],
      importedAt: "2026-05-22T09:00:00.000Z",
      updatedAt: "2026-05-22T09:00:00.000Z",
    };
    await repo.dbInsertSource(source);
    const [, params] = mockExecute.mock.calls[0];
    expect(params[0]).toBe("src-2");
  });
});

// ── dbUpdateSource ────────────────────────────────────────────

describe("dbUpdateSource", () => {
  it("calls db.execute with correct id at last position", async () => {
    await repo.dbUpdateSource("src-1", "New Title", ["tag-a"], [], "2026-05-22T10:00:00.000Z");
    expect(mockExecute).toHaveBeenCalledOnce();
    const [, params] = mockExecute.mock.calls[0];
    expect(params[params.length - 1]).toBe("src-1");
    expect(params[0]).toBe("New Title");
  });
});

// ── dbUpdateSourceStatus ──────────────────────────────────────

describe("dbUpdateSourceStatus", () => {
  it("passes status and error correctly", async () => {
    await repo.dbUpdateSourceStatus("src-1", "failed", "parse error", "2026-05-22T10:00:00.000Z");
    const [, params] = mockExecute.mock.calls[0];
    expect(params[0]).toBe("failed");
    expect(params[1]).toBe("parse error");
    expect(params[params.length - 1]).toBe("src-1");
  });

  it("passes null for undefined error", async () => {
    await repo.dbUpdateSourceStatus("src-1", "completed", undefined, "2026-05-22T10:00:00.000Z");
    const [, params] = mockExecute.mock.calls[0];
    expect(params[1]).toBeNull();
  });
});

// ── dbDeleteSource ────────────────────────────────────────────

describe("dbDeleteSource", () => {
  it("calls db.execute twice (DELETE + FTS_DELETE)", async () => {
    await repo.dbDeleteSource("src-1");
    expect(mockExecute).toHaveBeenCalledTimes(2);
    const [, p1] = mockExecute.mock.calls[0];
    expect(p1[0]).toBe("src-1");
  });
});

// ── dbSelectThreads ───────────────────────────────────────────

describe("dbSelectThreads", () => {
  it("maps rows to ResearchThread objects", async () => {
    mockSelect.mockResolvedValueOnce([THREAD_ROW]);
    const threads = await repo.dbSelectThreads();
    expect(threads).toHaveLength(1);
    expect(threads[0].id).toBe("thr-1");
    expect(threads[0].isPinned).toBe(false);
    expect(threads[0].sourceIds).toEqual([]);
  });
});

// ── dbInsertThread ────────────────────────────────────────────

describe("dbInsertThread", () => {
  it("calls db.execute once with thread id as first param", async () => {
    const thread = {
      id: "thr-1", title: "T",
      sourceIds: [], highlightIds: [], annotationIds: [],
      linkedNoteIds: [], linkedTaskIds: [], linkedProjectIds: [],
      unresolvedQuestions: [], recentInsights: [], tags: [],
      isPinned: false,
      createdAt: "2026-05-22T09:00:00.000Z",
      updatedAt: "2026-05-22T09:00:00.000Z",
    };
    await repo.dbInsertThread(thread);
    expect(mockExecute).toHaveBeenCalledOnce();
    const [, params] = mockExecute.mock.calls[0];
    expect(params[0]).toBe("thr-1");
  });
});

// ── dbUpdateThread ────────────────────────────────────────────

describe("dbUpdateThread", () => {
  it("places thread id as the last param", async () => {
    const thread = {
      id: "thr-1", title: "Updated",
      sourceIds: [], highlightIds: [], annotationIds: [],
      linkedNoteIds: [], linkedTaskIds: [], linkedProjectIds: [],
      unresolvedQuestions: [], recentInsights: [], tags: [],
      isPinned: true,
      createdAt: "2026-05-22T09:00:00.000Z",
      updatedAt: "2026-05-22T10:00:00.000Z",
    };
    await repo.dbUpdateThread(thread);
    const [, params] = mockExecute.mock.calls[0];
    expect(params[params.length - 1]).toBe("thr-1");
    // isPinned serialised as 1
    expect(params.includes(1)).toBe(true);
  });
});

// ── dbFtsSearch ───────────────────────────────────────────────

describe("dbFtsSearch", () => {
  it("passes query and limit to db.select", async () => {
    mockSelect.mockResolvedValueOnce([]);
    await repo.dbFtsSearch("machine learning*", 20);
    const [, params] = mockSelect.mock.calls[0];
    expect(params[0]).toBe("machine learning*");
    expect(params[1]).toBe(20);
  });

  it("returns mapped results", async () => {
    const row = { id: "src-1", entity_type: "source", title: "ML Paper", excerpt: "..." };
    mockSelect.mockResolvedValueOnce([row]);
    const results = await repo.dbFtsSearch("ml*", 10);
    expect(results[0].entity_type).toBe("source");
    expect(results[0].title).toBe("ML Paper");
  });
});
