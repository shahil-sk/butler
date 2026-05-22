// ============================================================
// RESEARCH MODULE — STORE
// Zustand slice. Only research module mutates this store.
// Other modules: read-only via useResearchStore((s) => ...)
// ============================================================

import { create } from "zustand";
import { bus } from "@/kernel/event-bus";
import { generateId, now } from "@/shared/utils";
import {
  dbSelectSources,
  dbInsertSource,
  dbUpdateSource,
  dbUpdateSourceStatus,
  dbDeleteSource,
  dbSelectDocuments,
  dbInsertDocument,
  dbSelectChunksByDocument,
  dbInsertChunk,
  dbUpdateChunkAi,
  dbSelectHighlightsByDocument,
  dbInsertHighlight,
  dbUpdateHighlight,
  dbDeleteHighlight,
  dbSelectAnnotationsByDocument,
  dbInsertAnnotation,
  dbUpdateAnnotation,
  dbDeleteAnnotation,
  dbSelectThreads,
  dbInsertThread,
  dbUpdateThread,
  dbDeleteThread,
  dbSelectPendingJobs,
  dbFtsSearch,
} from "./repository";
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
} from "./types";

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
  updateSource: (id: string, patch: Partial<Pick<ResearchSource, "title" | "tags">>) => Promise<void>;
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
  removeSourceFromThread: (threadId: string, sourceId: string) => Promise<void>;

  // navigation
  setActiveSource: (id: string | null) => void;
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
      const [sources, documents, threads, aiJobs] = await Promise.all([
        dbSelectSources(),
        dbSelectDocuments(),
        dbSelectThreads(),
        dbSelectPendingJobs(),
      ]);
      set({ sources, documents, threads, aiJobs, isLoading: false });
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
    await dbInsertSource(source);
    set((s) => ({ sources: [source, ...s.sources] }));
    bus.emit("research:source-imported", { source });
    bus.emit("search:index-invalidated", { entityType: "research_document", id: source.id });
    return source;
  },

  // ── updateSource ─────────────────────────────────────────
  updateSource: async (id, patch) => {
    const src = get().sources.find((s) => s.id === id);
    if (!src) return;
    const updated = { ...src, ...patch, updatedAt: now() };
    await dbUpdateSource(id, updated.title, updated.tags, updated.threadIds, updated.updatedAt);
    set((s) => ({ sources: s.sources.map((x) => (x.id === id ? updated : x)) }));
  },

  // ── updateSourceStatus ───────────────────────────────────
  updateSourceStatus: async (id, status, error) => {
    await dbUpdateSourceStatus(id, status, error, now());
    set((s) => ({
      sources: s.sources.map((src) =>
        src.id === id ? { ...src, processingStatus: status, errorMessage: error, updatedAt: now() } : src
      ),
    }));
  },

  // ── deleteSource ─────────────────────────────────────────
  deleteSource: async (id) => {
    await dbDeleteSource(id);
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
    await dbInsertDocument(doc);
    set((s) => ({ documents: [doc, ...s.documents] }));
    bus.emit("research:document-processed", { document: doc, sourceId: input.sourceId });
    return doc;
  },

  // ── loadDocumentChunks ───────────────────────────────────
  loadDocumentChunks: async (documentId) => {
    const chunks = await dbSelectChunksByDocument(documentId);
    set({ chunks });
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
    await dbInsertChunk(chunk);
    set((s) => ({ chunks: [...s.chunks, chunk] }));
    bus.emit("research:chunk-created", { chunk });
    return chunk;
  },

  // ── updateChunkAi ────────────────────────────────────────
  updateChunkAi: async (id, tags, entities, score, summary) => {
    await dbUpdateChunkAi(id, tags, entities, score, summary);
    set((s) => ({
      chunks: s.chunks.map((c) =>
        c.id === id ? { ...c, semanticTags: tags, entities, importanceScore: score, summary } : c
      ),
    }));
  },

  // ── loadHighlights ───────────────────────────────────────
  loadHighlights: async (documentId) => {
    const highlights = await dbSelectHighlightsByDocument(documentId);
    set({ highlights });
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
    await dbInsertHighlight(h);
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
    await dbUpdateHighlight(updated);
    set((s) => ({ highlights: s.highlights.map((x) => (x.id === id ? updated : x)) }));
  },

  // ── deleteHighlight ──────────────────────────────────────
  deleteHighlight: async (id) => {
    await dbDeleteHighlight(id);
    set((s) => ({ highlights: s.highlights.filter((h) => h.id !== id) }));
    bus.emit("research:highlight-deleted", { highlightId: id });
  },

  // ── loadAnnotations ──────────────────────────────────────
  loadAnnotations: async (documentId) => {
    const annotations = await dbSelectAnnotationsByDocument(documentId);
    set({ annotations });
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
    await dbInsertAnnotation(a);
    set((s) => ({ annotations: [...s.annotations, a] }));
    bus.emit("research:annotation-created", { annotation: a });
    return a;
  },

  // ── updateAnnotation ─────────────────────────────────────
  updateAnnotation: async (id, content) => {
    const a = get().annotations.find((x) => x.id === id);
    if (!a) return;
    const updated = { ...a, content, updatedAt: now() };
    await dbUpdateAnnotation(updated);
    set((s) => ({ annotations: s.annotations.map((x) => (x.id === id ? updated : x)) }));
    bus.emit("research:annotation-updated", { annotation: updated });
  },

  // ── deleteAnnotation ─────────────────────────────────────
  deleteAnnotation: async (id) => {
    await dbDeleteAnnotation(id);
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
    await dbInsertThread(t);
    set((s) => ({ threads: [t, ...s.threads] }));
    bus.emit("research:thread-created", { thread: t });
    return t;
  },

  // ── updateThread ─────────────────────────────────────────
  updateThread: async (id, patch) => {
    const t = get().threads.find((x) => x.id === id);
    if (!t) return;
    const updated = { ...t, ...patch, updatedAt: now() };
    await dbUpdateThread(updated);
    set((s) => ({ threads: s.threads.map((x) => (x.id === id ? updated : x)) }));
    bus.emit("research:thread-updated", { thread: updated });
  },

  // ── deleteThread ─────────────────────────────────────────
  deleteThread: async (id) => {
    await dbDeleteThread(id);
    set((s) => ({ threads: s.threads.filter((t) => t.id !== id) }));
    bus.emit("research:thread-deleted", { threadId: id });
  },

  // ── addSourceToThread ────────────────────────────────────
  addSourceToThread: async (threadId, sourceId) => {
    try {
      const thread = get().threads.find((t) => t.id === threadId);
      if (!thread) return;
      if (thread.sourceIds.includes(sourceId)) return;
      await get().updateThread(threadId, { sourceIds: [...thread.sourceIds, sourceId] });
      const source = get().sources.find((s) => s.id === sourceId);
      if (source && !source.threadIds.includes(threadId)) {
        const newThreadIds = [...source.threadIds, threadId];
        await dbUpdateSource(sourceId, source.title, source.tags, newThreadIds, now());
        set((s) => ({
          sources: s.sources.map((src) =>
            src.id === sourceId ? { ...src, threadIds: newThreadIds, updatedAt: now() } : src
          ),
        }));
      }
    } catch (err) {
      console.error("[ResearchStore] addSourceToThread failed:", err);
      bus.emit("ui:notification", {
        id: `research-add-src-err-${Date.now()}`,
        type: "error",
        message: "Failed to add source to thread.",
        durationMs: 4000,
      });
    }
  },

  // ── removeSourceFromThread ───────────────────────────────
  removeSourceFromThread: async (threadId, sourceId) => {
    try {
      const thread = get().threads.find((t) => t.id === threadId);
      if (!thread) return;
      await get().updateThread(threadId, {
        sourceIds: thread.sourceIds.filter((id) => id !== sourceId),
      });
      const src = get().sources.find((s) => s.id === sourceId);
      if (src) {
        const newThreadIds = src.threadIds.filter((id) => id !== threadId);
        await dbUpdateSource(sourceId, src.title, src.tags, newThreadIds, now());
        set((s) => ({
          sources: s.sources.map((x) =>
            x.id === sourceId ? { ...x, threadIds: newThreadIds, updatedAt: now() } : x
          ),
        }));
      }
    } catch (err) {
      console.error("[ResearchStore] removeSourceFromThread failed:", err);
      bus.emit("ui:notification", {
        id: `research-rm-src-err-${Date.now()}`,
        type: "error",
        message: "Failed to remove source from thread.",
        durationMs: 4000,
      });
    }
  },

  // ── navigation ───────────────────────────────────────────
  setActiveSource: (id) => set({ activeSourceId: id }),
  setActiveDocument: (id) => set({ activeDocumentId: id }),
  setActiveThread: (id) => set({ activeThreadId: id }),
  setActiveView: (view) => set({ activeView: view }),
  setSidebarTab: (tab) => set({ sidebarTab: tab }),

  // ── search ───────────────────────────────────────────────
  search: async (query) => {
    set({ searchQuery: query });
    if (!query.trim()) { set({ searchResults: [] }); return; }
    try {
      const safeQ = query.replace(/[^a-zA-Z0-9 ]/g, "").trim() + "*";
      const rows = await dbFtsSearch(safeQ, 30);
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
        if (s.title.toLowerCase().includes(q))
          results.push({ id: s.id, entityType: "source", title: s.title });
      });
      get().documents.forEach((d) => {
        if (d.title.toLowerCase().includes(q))
          results.push({ id: d.id, entityType: "document", title: d.title });
      });
      set({ searchResults: results });
    }
  },
}));
