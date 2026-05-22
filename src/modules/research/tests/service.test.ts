// ============================================================
// RESEARCH — service.test.ts
// Unit tests for the research service layer.
// repository and event bus are mocked at the boundary.
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock repository ───────────────────────────────────────────
vi.mock("../repository", () => ({
  dbInsertSource:              vi.fn().mockResolvedValue(undefined),
  dbUpdateSourceStatus:        vi.fn().mockResolvedValue(undefined),
  dbInsertDocument:            vi.fn().mockResolvedValue(undefined),
  dbInsertChunk:               vi.fn().mockResolvedValue(undefined),
  dbUpdateChunkAi:             vi.fn().mockResolvedValue(undefined),
  dbInsertThread:              vi.fn().mockResolvedValue(undefined),
  dbUpdateThread:              vi.fn().mockResolvedValue(undefined),
  dbDeleteThread:              vi.fn().mockResolvedValue(undefined),
}));

// ── Mock event bus ────────────────────────────────────────────
const mockEmit = vi.fn();
vi.mock("@/kernel/event-bus", () => ({ bus: { emit: mockEmit, on: vi.fn() } }));

// ── Mock shared utils ─────────────────────────────────────────
vi.mock("@/shared/utils", () => ({
  now:        () => "2026-05-22T09:00:00.000Z",
  generateId: () => "gen-id",
}));

import * as svc  from "../service";
import * as repo from "../repository";
import type { ResearchSource, ResearchThread } from "../types";

const baseSource = (): ResearchSource => ({
  id: "src-1",
  type: "pdf",
  title: "Test PDF",
  processingStatus: "pending",
  threadIds: [],
  tags: [],
  importedAt: "2026-05-22T08:00:00.000Z",
  updatedAt: "2026-05-22T08:00:00.000Z",
});

const baseThread = (): ResearchThread => ({
  id: "thr-1",
  title: "Quantum Computing",
  sourceIds: [], highlightIds: [], annotationIds: [],
  linkedNoteIds: [], linkedTaskIds: [], linkedProjectIds: [],
  unresolvedQuestions: [], recentInsights: [], tags: [],
  isPinned: false,
  createdAt: "2026-05-22T08:00:00.000Z",
  updatedAt: "2026-05-22T08:00:00.000Z",
});

beforeEach(() => vi.clearAllMocks());

// ── startIngestion ────────────────────────────────────────────

describe("startIngestion", () => {
  it("calls updateStatus with 'parsing' and emits ingestion-started", async () => {
    const updateStatus = vi.fn().mockResolvedValue(undefined);
    await svc.startIngestion(baseSource(), updateStatus);
    expect(updateStatus).toHaveBeenCalledWith("src-1", "parsing");
    expect(mockEmit).toHaveBeenCalledWith("research:ingestion-started", { sourceId: "src-1" });
  });
});

// ── onParseComplete ───────────────────────────────────────────

describe("onParseComplete", () => {
  it("inserts a document and transitions status to chunking", async () => {
    const updateStatus = vi.fn().mockResolvedValue(undefined);
    const doc = await svc.onParseComplete(
      baseSource(),
      { title: "Test PDF", abstract: "An abstract" },
      updateStatus,
    );
    expect(repo.dbInsertDocument).toHaveBeenCalledOnce();
    expect(doc.sourceId).toBe("src-1");
    expect(doc.id).toBe("gen-id");
    expect(updateStatus).toHaveBeenCalledWith("src-1", "chunking");
    expect(mockEmit).toHaveBeenCalledWith("research:document-processed",
      expect.objectContaining({ sourceId: "src-1" }));
  });

  it("defaults authors to []", async () => {
    const updateStatus = vi.fn().mockResolvedValue(undefined);
    const doc = await svc.onParseComplete(baseSource(), { title: "T" }, updateStatus);
    expect(doc.authors).toEqual([]);
  });
});

// ── ingestChunk ───────────────────────────────────────────────

describe("ingestChunk", () => {
  it("inserts chunk and emits research:chunk-created", async () => {
    const chunk = await svc.ingestChunk({
      documentId: "doc-1",
      sourceId: "src-1",
      type: "paragraph",
      content: "Hello world",
      order: 0,
    });
    expect(repo.dbInsertChunk).toHaveBeenCalledOnce();
    expect(chunk.id).toBe("gen-id");
    expect(chunk.semanticTags).toEqual([]);
    expect(mockEmit).toHaveBeenCalledWith("research:chunk-created", expect.any(Object));
  });

  it("carries pageNumber and sectionTitle through", async () => {
    const chunk = await svc.ingestChunk({
      documentId: "doc-1", sourceId: "src-1",
      type: "heading", content: "Introduction",
      order: 0, pageNumber: 3, sectionTitle: "Intro",
    });
    expect(chunk.pageNumber).toBe(3);
    expect(chunk.sectionTitle).toBe("Intro");
  });
});

// ── failIngestion ─────────────────────────────────────────────

describe("failIngestion", () => {
  it("calls updateStatus with 'failed' and emits error notification", async () => {
    const updateStatus = vi.fn().mockResolvedValue(undefined);
    await svc.failIngestion("src-1", "unsupported format", updateStatus);
    expect(updateStatus).toHaveBeenCalledWith("src-1", "failed", "unsupported format");
    expect(mockEmit).toHaveBeenCalledWith("ui:notification",
      expect.objectContaining({ type: "error" }));
    expect(mockEmit).toHaveBeenCalledWith("research:ingestion-failed",
      { sourceId: "src-1", error: "unsupported format" });
  });
});

// ── completeIngestion ─────────────────────────────────────────

describe("completeIngestion", () => {
  it("transitions to completed and invalidates search index", async () => {
    const updateStatus = vi.fn().mockResolvedValue(undefined);
    await svc.completeIngestion("src-1", updateStatus);
    expect(updateStatus).toHaveBeenCalledWith("src-1", "completed");
    expect(mockEmit).toHaveBeenCalledWith("research:ingestion-completed", { sourceId: "src-1" });
    expect(mockEmit).toHaveBeenCalledWith("search:index-invalidated",
      { entityType: "research_document", id: "src-1" });
  });
});

// ── buildAiJob ────────────────────────────────────────────────

describe("buildAiJob", () => {
  it("creates a queued job with correct shape", () => {
    const job = svc.buildAiJob("src-1", "summarize");
    expect(job.status).toBe("queued");
    expect(job.sourceId).toBe("src-1");
    expect(job.jobType).toBe("summarize");
    expect(job.id).toBe("gen-id");
  });
});

// ── applyChunkAiResults ───────────────────────────────────────

describe("applyChunkAiResults", () => {
  it("delegates to updateChunkAi and emits chunk-ai-updated", async () => {
    const updateChunkAi = vi.fn().mockResolvedValue(undefined);
    await svc.applyChunkAiResults(
      "chunk-1", ["ml", "nlp"], ["BERT"], 0.9, "Summary text", updateChunkAi
    );
    expect(updateChunkAi).toHaveBeenCalledWith("chunk-1", ["ml", "nlp"], ["BERT"], 0.9, "Summary text");
    expect(mockEmit).toHaveBeenCalledWith("research:chunk-ai-updated",
      expect.objectContaining({ chunkId: "chunk-1", importanceScore: 0.9 }));
  });
});

// ── createThread ──────────────────────────────────────────────

describe("createThread (service)", () => {
  it("inserts thread and emits thread-created", async () => {
    const thread = await svc.createThread("Neural Networks", "A deep dive");
    expect(repo.dbInsertThread).toHaveBeenCalledOnce();
    expect(thread.title).toBe("Neural Networks");
    expect(thread.description).toBe("A deep dive");
    expect(thread.isPinned).toBe(false);
    expect(mockEmit).toHaveBeenCalledWith("research:thread-created", expect.any(Object));
  });

  it("defaults description to undefined when not supplied", async () => {
    const thread = await svc.createThread("Just a title");
    expect(thread.description).toBeUndefined();
  });
});

// ── updateThread ──────────────────────────────────────────────

describe("updateThread (service)", () => {
  it("merges patch, bumps updatedAt, persists and emits", async () => {
    const existing = baseThread();
    const updated = await svc.updateThread(existing, { title: "New Title", isPinned: true });
    expect(updated.title).toBe("New Title");
    expect(updated.isPinned).toBe(true);
    expect(repo.dbUpdateThread).toHaveBeenCalledOnce();
    expect(mockEmit).toHaveBeenCalledWith("research:thread-updated", expect.any(Object));
  });
});

// ── deleteThread ──────────────────────────────────────────────

describe("deleteThread (service)", () => {
  it("calls dbDeleteThread and emits thread-deleted", async () => {
    await svc.deleteThread("thr-1");
    expect(repo.dbDeleteThread).toHaveBeenCalledWith("thr-1");
    expect(mockEmit).toHaveBeenCalledWith("research:thread-deleted", { threadId: "thr-1" });
  });
});

// ── suggestAnnotationForTask ──────────────────────────────────

describe("suggestAnnotationForTask", () => {
  it("emits notification when activeDocumentId is set", async () => {
    await svc.suggestAnnotationForTask("task-1", "doc-1");
    expect(mockEmit).toHaveBeenCalledWith("ui:notification",
      expect.objectContaining({ type: "info" }));
  });

  it("does nothing when activeDocumentId is null", async () => {
    await svc.suggestAnnotationForTask("task-1", null);
    expect(mockEmit).not.toHaveBeenCalled();
  });
});

// ── suggestThreadLinkForNote ──────────────────────────────────

describe("suggestThreadLinkForNote", () => {
  it("suggests link when note title matches a thread title", async () => {
    const threads = [baseThread()]; // title: "Quantum Computing"
    await svc.suggestThreadLinkForNote("note-1", "Quantum Computing basics", threads);
    expect(mockEmit).toHaveBeenCalledWith("ui:notification",
      expect.objectContaining({ type: "info" }));
  });

  it("does nothing when no thread title matches", async () => {
    const threads = [baseThread()]; // title: "Quantum Computing"
    await svc.suggestThreadLinkForNote("note-1", "Unrelated topic", threads);
    expect(mockEmit).not.toHaveBeenCalled();
  });
});
