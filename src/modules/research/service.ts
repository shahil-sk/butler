// ============================================================
// RESEARCH MODULE — SERVICE
// Business logic and cross-module side-effects.
// Calls repository.*; never imports @/kernel/db directly.
// bus.on() listeners live in events.ts; this file is pure fns.
// ============================================================

import { bus } from "@/kernel/event-bus";
import { generateId, now } from "@/shared/utils";
import {
  dbInsertSource,
  dbUpdateSourceStatus,
  dbInsertDocument,
  dbInsertChunk,
  dbUpdateChunkAi,
  dbInsertThread,
  dbUpdateThread,
  dbDeleteThread,
} from "./repository";
import type {
  ResearchSource,
  ResearchDocument,
  ResearchChunk,
  ResearchThread,
  ResearchAiJob,
  ResearchSourceType,
  ResearchChunkType,
} from "./types";

// ============================================================
// INGESTION PIPELINE
// ============================================================

/**
 * Kick off ingestion for a newly imported source.
 * Sets status → parsing, emits research:ingestion-started.
 * The actual parse/chunk/embed work is handled by the Tauri
 * backend command; this fn manages the job record and status.
 */
export async function startIngestion(
  source: ResearchSource,
  updateStatus: (id: string, status: ResearchSource["processingStatus"], err?: string) => Promise<void>,
): Promise<void> {
  await updateStatus(source.id, "parsing");
  bus.emit("research:ingestion-started", { sourceId: source.id });
}

/**
 * Called when the Tauri backend finishes parsing raw content.
 * Creates the ResearchDocument record and transitions status.
 */
export async function onParseComplete(
  source: ResearchSource,
  parsed: {
    title: string;
    authors?: string[];
    publishedDate?: string;
    language?: string;
    abstract?: string;
    totalPages?: number;
  },
  updateStatus: (id: string, status: ResearchSource["processingStatus"], err?: string) => Promise<void>,
): Promise<ResearchDocument> {
  const doc: ResearchDocument = {
    id: generateId(),
    sourceId: source.id,
    title: parsed.title,
    authors: parsed.authors ?? [],
    publishedDate: parsed.publishedDate,
    language: parsed.language,
    abstract: parsed.abstract,
    totalChunks: 0,
    totalPages: parsed.totalPages,
    processingVersion: "1",
    createdAt: now(),
    updatedAt: now(),
  };
  await dbInsertDocument(doc);
  await updateStatus(source.id, "chunking");
  bus.emit("research:document-processed", { document: doc, sourceId: source.id });
  return doc;
}

/**
 * Ingest a single chunk into the knowledge pipeline.
 * Emits research:chunk-created after persisting.
 */
export async function ingestChunk(
  input: {
    documentId: string;
    sourceId: string;
    type: ResearchChunkType;
    content: string;
    order: number;
    pageNumber?: number;
    sectionTitle?: string;
  },
): Promise<ResearchChunk> {
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
  bus.emit("research:chunk-created", { chunk });
  return chunk;
}

/**
 * Mark ingestion as failed; surfaces error to UI via notification.
 */
export async function failIngestion(
  sourceId: string,
  error: string,
  updateStatus: (id: string, status: ResearchSource["processingStatus"], err?: string) => Promise<void>,
): Promise<void> {
  await updateStatus(sourceId, "failed", error);
  bus.emit("ui:notification", {
    id: `research-ingest-fail-${sourceId}`,
    type: "error",
    message: `Ingestion failed: ${error}`,
    durationMs: 6000,
  });
  bus.emit("research:ingestion-failed", { sourceId, error });
}

/**
 * Transition source to completed after all chunks are indexed.
 */
export async function completeIngestion(
  sourceId: string,
  updateStatus: (id: string, status: ResearchSource["processingStatus"], err?: string) => Promise<void>,
): Promise<void> {
  await updateStatus(sourceId, "completed");
  bus.emit("research:ingestion-completed", { sourceId });
  bus.emit("search:index-invalidated", { entityType: "research_document", id: sourceId });
}

// ============================================================
// AI JOB LIFECYCLE
// ============================================================

/**
 * Build an AI job record shell (not persisted here — store owns that).
 * Used by the store before dispatching to the Tauri AI backend.
 */
export function buildAiJob(
  sourceId: string,
  jobType: ResearchAiJob["jobType"],
): ResearchAiJob {
  return {
    id: generateId(),
    sourceId,
    jobType,
    status: "queued",
    createdAt: now(),
  };
}

/**
 * Apply AI analysis results to a chunk.
 * Delegates persistence to repository via the updateChunkAi store action.
 */
export async function applyChunkAiResults(
  chunkId: string,
  tags: string[],
  entities: string[],
  importanceScore: number,
  summary: string,
  updateChunkAi: (id: string, tags: string[], entities: string[], score: number, summary: string) => Promise<void>,
): Promise<void> {
  await updateChunkAi(chunkId, tags, entities, importanceScore, summary);
  bus.emit("research:chunk-ai-updated", { chunkId, tags, entities, importanceScore, summary });
}

// ============================================================
// THREAD MANAGEMENT
// ============================================================

/**
 * Create a new research thread and persist it.
 */
export async function createThread(
  title: string,
  description?: string,
): Promise<ResearchThread> {
  const thread: ResearchThread = {
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
  await dbInsertThread(thread);
  bus.emit("research:thread-created", { thread });
  return thread;
}

/**
 * Apply a patch to an existing thread and persist.
 */
export async function updateThread(
  existing: ResearchThread,
  patch: Partial<ResearchThread>,
): Promise<ResearchThread> {
  const updated = { ...existing, ...patch, updatedAt: now() };
  await dbUpdateThread(updated);
  bus.emit("research:thread-updated", { thread: updated });
  return updated;
}

/**
 * Delete a thread by id.
 */
export async function deleteThread(
  threadId: string,
): Promise<void> {
  await dbDeleteThread(threadId);
  bus.emit("research:thread-deleted", { threadId });
}

// ============================================================
// CROSS-MODULE SIDE-EFFECTS
// Called from events.ts listeners; never use bus.on() here.
// ============================================================

/**
 * When a task is completed, offer to promote its linked
 * research highlights into a summary annotation.
 */
export async function suggestAnnotationForTask(
  taskId: string,
  activeDocumentId: string | null,
): Promise<void> {
  if (!activeDocumentId) return;
  bus.emit("ui:notification", {
    id: `research-task-done-${taskId}`,
    type: "info",
    message: "Task completed. Save highlights as a research annotation?",
    durationMs: 6000,
    action: {
      label: "Save annotation",
      event: "research:open-annotation-modal",
      payload: { documentId: activeDocumentId, fromTaskId: taskId },
    },
  });
}

/**
 * When a note is created, check if any open research threads
 * mention the note's content and surface a linking suggestion.
 */
export async function suggestThreadLinkForNote(
  noteId: string,
  noteTitle: string,
  threads: ResearchThread[],
): Promise<void> {
  const matches = threads.filter((t) =>
    t.title.toLowerCase().includes(noteTitle.toLowerCase().slice(0, 20))
  );
  if (matches.length === 0) return;
  bus.emit("ui:notification", {
    id: `research-note-link-${noteId}`,
    type: "info",
    message: `Link note to research thread "${matches[0].title}"?`,
    durationMs: 6000,
    action: {
      label: "Link",
      event: "research:link-note-to-thread",
      payload: { noteId, threadId: matches[0].id },
    },
  });
}
