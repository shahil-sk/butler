// ============================================================
// RESEARCH MODULE — STORE
// Zustand slice. Only research module mutates this store.
// Other modules: read-only via useResearchStore((s) => ...)
// ============================================================

import { create } from "zustand";
import { db } from "@/kernel/db";
import { bus } from "@/kernel/event-bus";
import { generateId, now } from "@/shared/utils";
import {
  SQL,
  RESEARCH_MIGRATIONS,
  rowToSource,
  rowToDocument,
  rowToChunk,
  rowToThread,
  rowToHighlight,
  rowToAnnotation,
} from "./db";
import type {
  ResearchSource,
  ResearchDocument,
  ResearchChunk,
  ResearchHighlight,
  ResearchAnnotation,
  ResearchCitation,
  ResearchEntity,
  ResearchThread,
  ResearchInsight,
  ResearchQuestion,
  ResearchAiJob,
  ResearchLink,
  ResearchSourceType,
  ResearchChunkType,
  ResearchRelationType,
} from "@/shared/types";

// ── State shape ─────────────────────────────────────────────

export interface ResearchState {
  // data
  sources: ResearchSource[];
  documents: ResearchDocument[];
  chunks: ResearchChunk[];         // chunks for active document
  highlights: ResearchHighlight[]; // highlights for active document
  annotations: ResearchAnnotation[];
  threads: ResearchThread[];
  aiJobs: ResearchAiJob[];

  // navigation
  activeSourceId: string | null;
  activeDocumentId: string | null;
  activeThreadId: string | null;
  activeView: "threads" | "sources" | "document" | "graph";

  // search
  searchQuery: string;
  searchResults: Array<{ id: string; entityType: string; title: string; excerpt?: string }>;

  // ui flags
  isLoading: boolean;
  isIngesting: boolean;
  sidebarTab: "info" | "highlights" | "annotations" | "citations" | "related";

  // actions
  init: () => Promise<void>;

  // sources
  importSource: (input: ImportSourceInput) => Promise<ResearchSource>;
  updateSourceStatus: (id: string, status: ResearchSource["processingStatus"], error?: string) => Promise<void>;
  deleteSource: (id: string) => Promise<void>;

  // documents
  createDocument: (input: CreateDocumentInput) => Promise<ResearchDocument>;
  loadDocumentChunks: (documentId: string) => Promise<void>;

  // chunks
  createChunk: (input: CreateChunkInput) => Promise<ResearchChunk>;
  updateChunkAi: (id: string, tags: string[], entities: string[], score: number, summary: string) => Promise<void>;

  // highlights
  loadHighlights: (documentId: string) => Promise<void>;
  createHighlight: (input: CreateHighlightInput) => Promise<ResearchHighlight>;
  updateHighlight: (id: string, patch: Partial<Pick<ResearchHighlight, "note" | "color" | "linkedNoteId" | "linkedTaskId">>) => Promise<void>;
  deleteHighlight: (id: string) => Promise<void>;

  // annotations
  loadAnnotations: (documentId: string) => Promise<void>;
  createAnnotation: (input: CreateAnnotationInput) => Promise<ResearchAnnotation>;
  updateAnnotation: (id: string, content: string) => Promise<void>;
  deleteAnnotation: (id: string) => Promise<void>;

  // threads
  createThread: (title: string, description?: string) => Promise<ResearchThread>;
  updateThread: (id: string, patch: Partial<ResearchThread>) => Promise<void>;
  deleteThread: (id: string) => Promise<void>;
  addSourceToThread: (threadId: string, sourceId: string) => Promise<void>;

  // navigation
  setActiveDocument: (id: string | null) => void;
  setActiveThread: (id: string | null) => void;
  setActiveView: (view: ResearchState["activeView"]) => void;
  setSidebarTab: (tab: ResearchState["sidebarTab"]) => void;

  // search
  search: (query: string) => Promise<void>;
}

// ── Input types ─────────────────────────────────────────────

export interface ImportSourceInput {
  type: ResearchSourceType;
  title: string;
  url?: string;
  filePath?: string;
  rawContent?: string;
  mimeType?: string;
  sizeBytes?: number;
  tags?: string[];
  threadIds?: string[];
}

export interface CreateDocumentInput {
  sourceId: string;
  title: string;
  authors?: string[];
  publishedDate?: string;
  language?: string;
  abstract?: string;
  totalPages?: number;
}

export interface CreateChunkInput {
  documentId: string;
  sourceId: string;
  type: ResearchChunkType;
  content: string;
  order: number;
  pageNumber?: number;
  sectionTitle?: string;
}

export interface CreateHighlightInput {
  documentId: string;
  chunkId: string;
  sourceId: string;
  text: string;
  color?: string;
  pageNumber?: number;
  position?: { start: number; end: number };
  note?: string;
}

export interface CreateAnnotationInput {
  documentId: string;
  chunkId?: string;
  sourceId: string;
  type: ResearchAnnotation["type"];
  content: string;
  pageNumber?: number;
  position?: { start: number; end: number };
}

// ── Store ────────────────────────────────────────────────────

export const useResearchStore = create<ResearchState>((set, get) => ({
  sources: [],
  documents: [],
  chunks: [],
  highlights: [],
  annotations: [],
  threads: [],
  aiJobs: [],
  activeSourceId: null,
  activeDocumentId: null,
  activeThreadId: null,
  activeView: "threads",
  searchQuery: "",
  searchResults: [],
  isLoading: false,
  isIngesting: false,
  sidebarTab: "info",

  // ── init ─────────────────────────────────────────────────
  init: async () => {
    set({ isLoading: true });
    try {
      const [sourceRows, docRows, threadRows] = await Promise.all([
        db.select<Record<string, unknown>>(SQL.SELECT_SOURCES, []),
        db.select<Record<string, unknown>>(SQL.SELECT_DOCUMENTS, []),
        db.select<Record<string, unknown>>(SQL.SELECT_THREADS, []),
      ]);
      set({
        sources: sourceRows.map(rowToSource) as ResearchSource[],
        documents: docRows.map(rowToDocument) as ResearchDocument[],
        threads: threadRows.map(rowToThread) as ResearchThread[],
        isLoading: false,
      });
    } catch (err) {
      console.error("[ResearchStore] init failed:", err);
      set({ isLoading: false });
    }
  },

  // ── importSource ─────────────────────────────────────────
  importSource: async (input) => {
    const source: ResearchSource = {
      id: generateId(),
      type: input.type,
      title: input.title,
      url: input.url,
      filePath: input.filePath,
      rawContent: input.rawContent,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      processingStatus: "pending",
      threadIds: input.threadIds ?? [],
      tags: input.tags ?? [],
      importedAt: now(),
      updatedAt: now(),
    };
    await db.execute(SQL.INSERT_SOURCE, [
      source.id, source.type, source.title, source.url ?? null,
      source.filePath ?? null, source.rawContent ?? null,
      source.mimeType ?? null, source.sizeBytes ?? null,
      source.processingStatus, source.errorMessage ?? null,
      JSON.stringify(source.threadIds), JSON.stringify(source.tags),
      source.importedAt, source.updatedAt,
    ]);
    // FTS
    await db.execute(SQL.FTS_INSERT, [source.id, "source", source.title, source.rawContent ?? ""]);
    set((s) => ({ sources: [source, ...s.sources] }));
    bus.emit("research:source-imported", { source });
    bus.emit("search:index-invalidated", { entityType: "research_document", id: source.id });
    return source;
  },

  // ── updateSourceStatus ───────────────────────────────────
  updateSourceStatus: async (id, status, error) => {
    await db.execute(SQL.UPDATE_SOURCE_STATUS, [status, error ?? null, now(), id]);
    set((s) => ({
      sources: s.sources.map((src) =>
        src.id === id ? { ...src, processingStatus: status, errorMessage: error, updatedAt: now() } : src
      ),
    }));
  },

  // ── deleteSource ─────────────────────────────────────────
  deleteSource: async (id) => {
    await db.execute(SQL.DELETE_SOURCE, [id]);
    await db.execute(SQL.FTS_DELETE, [id]);
    set((s) => ({
      sources: s.sources.filter((src) => src.id !== id),
      documents: s.documents.filter((doc) => doc.sourceId !== id),
    }));
    bus.emit("search:index-invalidated", { entityType: "research_document", id });
  },

  // ── createDocument ───────────────────────────────────────
  createDocument: async (input) => {
    const doc: ResearchDocument = {
      id: generateId(),
      sourceId: input.sourceId,
      title: input.title,
      authors: input.authors ?? [],
      publishedDate: input.publishedDate,
      language: input.language,
      abstract: input.abstract,
      totalChunks: 0,
      totalPages: input.totalPages,
      processingVersion: "1",
      createdAt: now(),
      updatedAt: now(),
    };
    await db.execute(SQL.INSERT_DOCUMENT, [
      doc.id, doc.sourceId, doc.title,
      JSON.stringify(doc.authors),
      doc.publishedDate ?? null, doc.language ?? null, doc.abstract ?? null,
      doc.totalChunks, doc.totalPages ?? null, doc.wordCount ?? null,
      doc.processingVersion, doc.createdAt, doc.updatedAt,
    ]);
    await db.execute(SQL.FTS_INSERT, [doc.id, "document", doc.title, doc.abstract ?? ""]);
    set((s) => ({ documents: [doc, ...s.documents] }));
    bus.emit("research:document-processed", { document: doc, sourceId: input.sourceId });
    return doc;
  },

  // ── loadDocumentChunks ───────────────────────────────────
  loadDocumentChunks: async (documentId) => {
    const rows = await db.select<Record<string, unknown>>(SQL.SELECT_CHUNKS_BY_DOC, [documentId]);
    set({ chunks: rows.map(rowToChunk) as ResearchChunk[] });
  },

  // ── createChunk ──────────────────────────────────────────
  createChunk: async (input) => {
    const chunk: ResearchChunk = {
      id: generateId(),
      documentId: input.documentId,
      sourceId: input.sourceId,
      type: input.type,
      content: input.content,
      order: input.order,
      pageNumber: input.pageNumber,
      sectionTitle: input.sectionTitle,
      semanticTags: [],
      entities: [],
      createdAt: now(),
    };
    await db.execute(SQL.INSERT_CHUNK, [
      chunk.id, chunk.documentId, chunk.sourceId, chunk.type, chunk.content,
      chunk.order, chunk.pageNumber ?? null, chunk.sectionTitle ?? null,
      null, JSON.stringify(chunk.semanticTags), JSON.stringify(chunk.entities),
      null, null, chunk.createdAt,
    ]);
    await db.execute(SQL.FTS_INSERT, [chunk.id, "chunk", chunk.sectionTitle ?? "", chunk.content]);
    set((s) => ({ chunks: [...s.chunks, chunk] }));
    bus.emit("research:chunk-created", { chunk });
    return chunk;
  },

  // ── updateChunkAi ────────────────────────────────────────
  updateChunkAi: async (id, tags, entities, score, summary) => {
    await db.execute(SQL.UPDATE_CHUNK_AI, [
      JSON.stringify(tags), JSON.stringify(entities), score, summary, id,
    ]);
    set((s) => ({
      chunks: s.chunks.map((c) =>
        c.id === id ? { ...c, semanticTags: tags, entities, importanceScore: score, summary } : c
      ),
    }));
  },

  // ── loadHighlights ───────────────────────────────────────
  loadHighlights: async (documentId) => {
    const rows = await db.select<Record<string, unknown>>(SQL.SELECT_HIGHLIGHTS_BY_DOC, [documentId]);
    set({ highlights: rows.map(rowToHighlight) as ResearchHighlight[] });
  },

  // ── createHighlight ──────────────────────────────────────
  createHighlight: async (input) => {
    const h: ResearchHighlight = {
      id: generateId(),
      documentId: input.documentId,
      chunkId: input.chunkId,
      sourceId: input.sourceId,
      text: input.text,
      color: input.color ?? "#FFD700",
      pageNumber: input.pageNumber,
      position: input.position,
      note: input.note,
      createdAt: now(),
      updatedAt: now(),
    };
    await db.execute(SQL.INSERT_HIGHLIGHT, [
      h.id, h.documentId, h.chunkId, h.sourceId, h.text, h.color,
      h.pageNumber ?? null,
      h.position ? JSON.stringify(h.position) : null,
      h.note ?? null, h.linkedNoteId ?? null, h.linkedTaskId ?? null,
      h.createdAt, h.updatedAt,
    ]);
    set((s) => ({ highlights: [...s.highlights, h] }));
    bus.emit("research:highlight-created", { highlight: h });
    bus.emit("search:index-invalidated", { entityType: "research_chunk", id: input.chunkId });
    return h;
  },

  // ── updateHighlight ──────────────────────────────────────
  updateHighlight: async (id, patch) => {
    const h = get().highlights.find((x) => x.id === id);
    if (!h) return;
    const updated = { ...h, ...patch, updatedAt: now() };
    await db.execute(SQL.UPDATE_HIGHLIGHT, [
      updated.note ?? null, updated.color,
      updated.linkedNoteId ?? null, updated.linkedTaskId ?? null,
      updated.updatedAt, id,
    ]);
    set((s) => ({ highlights: s.highlights.map((x) => (x.id === id ? updated : x)) }));
  },

  // ── deleteHighlight ──────────────────────────────────────
  deleteHighlight: async (id) => {
    await db.execute(SQL.DELETE_HIGHLIGHT, [id]);
    set((s) => ({ highlights: s.highlights.filter((h) => h.id !== id) }));
    bus.emit("research:highlight-deleted", { highlightId: id });
  },

  // ── loadAnnotations ──────────────────────────────────────
  loadAnnotations: async (documentId) => {
    const rows = await db.select<Record<string, unknown>>(SQL.SELECT_ANNOTATIONS_BY_DOC, [documentId]);
    set({ annotations: rows.map(rowToAnnotation) as ResearchAnnotation[] });
  },

  // ── createAnnotation ─────────────────────────────────────
  createAnnotation: async (input) => {
    const a: ResearchAnnotation = {
      id: generateId(),
      documentId: input.documentId,
      chunkId: input.chunkId,
      sourceId: input.sourceId,
      type: input.type,
      content: input.content,
      pageNumber: input.pageNumber,
      position: input.position,
      createdAt: now(),
      updatedAt: now(),
    };
    await db.execute(SQL.INSERT_ANNOTATION, [
      a.id, a.documentId, a.chunkId ?? null, a.sourceId, a.type, a.content,
      a.pageNumber ?? null,
      a.position ? JSON.stringify(a.position) : null,
      a.linkedNoteId ?? null, a.linkedTaskId ?? null,
      a.createdAt, a.updatedAt,
    ]);
    set((s) => ({ annotations: [...s.annotations, a] }));
    bus.emit("research:annotation-created", { annotation: a });
    return a;
  },

  // ── updateAnnotation ─────────────────────────────────────
  updateAnnotation: async (id, content) => {
    const a = get().annotations.find((x) => x.id === id);
    if (!a) return;
    const updated = { ...a, content, updatedAt: now() };
    await db.execute(SQL.UPDATE_ANNOTATION, [
      updated.content, updated.type,
      updated.linkedNoteId ?? null, updated.linkedTaskId ?? null,
      updated.updatedAt, id,
    ]);
    set((s) => ({ annotations: s.annotations.map((x) => (x.id === id ? updated : x)) }));
    bus.emit("research:annotation-updated", { annotation: updated });
  },

  // ── deleteAnnotation ─────────────────────────────────────
  deleteAnnotation: async (id) => {
    await db.execute(SQL.DELETE_ANNOTATION, [id]);
    set((s) => ({ annotations: s.annotations.filter((a) => a.id !== id) }));
    bus.emit("research:annotation-deleted", { annotationId: id });
  },

  // ── createThread ─────────────────────────────────────────
  createThread: async (title, description) => {
    const t: ResearchThread = {
      id: generateId(),
      title,
      description,
      sourceIds: [],
      highlightIds: [],
      annotationIds: [],
      linkedNoteIds: [],
      linkedTaskIds: [],
      linkedProjectIds: [],
      unresolvedQuestions: [],
      recentInsights: [],
      tags: [],
      isPinned: false,
      createdAt: now(),
      updatedAt: now(),
    };
    await db.execute(SQL.INSERT_THREAD, [
      t.id, t.title, t.description ?? null, t.color ?? null,
      JSON.stringify(t.sourceIds), JSON.stringify(t.highlightIds),
      JSON.stringify(t.annotationIds), JSON.stringify(t.linkedNoteIds),
      JSON.stringify(t.linkedTaskIds), JSON.stringify(t.linkedProjectIds),
      t.aiSummary ?? null,
      JSON.stringify(t.unresolvedQuestions), JSON.stringify(t.recentInsights),
      JSON.stringify(t.tags), t.isPinned ? 1 : 0,
      t.createdAt, t.updatedAt,
    ]);
    set((s) => ({ threads: [t, ...s.threads] }));
    bus.emit("research:thread-created", { thread: t });
    return t;
  },

  // ── updateThread ─────────────────────────────────────────
  updateThread: async (id, patch) => {
    const t = get().threads.find((x) => x.id === id);
    if (!t) return;
    const updated = { ...t, ...patch, updatedAt: now() };
    await db.execute(SQL.UPDATE_THREAD, [
      updated.title, updated.description ?? null, updated.color ?? null,
      JSON.stringify(updated.sourceIds), JSON.stringify(updated.highlightIds),
      JSON.stringify(updated.annotationIds), JSON.stringify(updated.linkedNoteIds),
      JSON.stringify(updated.linkedTaskIds), JSON.stringify(updated.linkedProjectIds),
      updated.aiSummary ?? null,
      JSON.stringify(updated.unresolvedQuestions), JSON.stringify(updated.recentInsights),
      JSON.stringify(updated.tags), updated.isPinned ? 1 : 0,
      updated.updatedAt, id,
    ]);
    set((s) => ({ threads: s.threads.map((x) => (x.id === id ? updated : x)) }));
    bus.emit("research:thread-updated", { thread: updated });
  },

  // ── deleteThread ─────────────────────────────────────────
  deleteThread: async (id) => {
    await db.execute(SQL.DELETE_THREAD, [id]);
    set((s) => ({ threads: s.threads.filter((t) => t.id !== id) }));
    bus.emit("research:thread-deleted", { threadId: id });
  },

  // ── addSourceToThread ────────────────────────────────────
  addSourceToThread: async (threadId, sourceId) => {
    const thread = get().threads.find((t) => t.id === threadId);
    if (!thread) return;
    if (thread.sourceIds.includes(sourceId)) return;
    const updated = { ...thread, sourceIds: [...thread.sourceIds, sourceId] };
    await get().updateThread(threadId, { sourceIds: updated.sourceIds });
    // also update source.threadIds
    const source = get().sources.find((s) => s.id === sourceId);
    if (source && !source.threadIds.includes(threadId)) {
      const newThreadIds = [...source.threadIds, threadId];
      await db.execute(SQL.UPDATE_SOURCE, [
        source.title, JSON.stringify(source.tags), JSON.stringify(newThreadIds), now(), sourceId,
      ]);
      set((s) => ({
        sources: s.sources.map((src) =>
          src.id === sourceId ? { ...src, threadIds: newThreadIds, updatedAt: now() } : src
        ),
      }));
    }
  },

  // ── navigation ───────────────────────────────────────────
  setActiveDocument: (id) => set({ activeDocumentId: id }),
  setActiveThread: (id) => set({ activeThreadId: id }),
  setActiveView: (view) => set({ activeView: view }),
  setSidebarTab: (tab) => set({ sidebarTab: tab }),

  // ── search ───────────────────────────────────────────────
  search: async (query) => {
    set({ searchQuery: query });
    if (!query.trim()) { set({ searchResults: [] }); return; }
    try {
      const rows = await db.select<{ id: string; entity_type: string; title: string; excerpt?: string }>(
        SQL.FTS_SEARCH, [query + "*", 30]
      );
      set({
        searchResults: rows.map((r) => ({
          id: r.id,
          entityType: r.entity_type,
          title: r.title,
          excerpt: r.excerpt,
        })),
      });
    } catch {
      // FTS gracefully degrades — JS-side fallback
      const q = query.toLowerCase();
      const results: ResearchState["searchResults"] = [];
      get().sources.forEach((s) => {
        if (s.title.toLowerCase().includes(q)) {
          results.push({ id: s.id, entityType: "source", title: s.title });
        }
      });
      get().documents.forEach((d) => {
        if (d.title.toLowerCase().includes(q)) {
          results.push({ id: d.id, entityType: "document", title: d.title });
        }
      });
      set({ searchResults: results });
    }
  },
}));
