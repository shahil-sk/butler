// ============================================================
// RESEARCH MODULE — REPOSITORY
// Single point of contact between the store and @/kernel/db.
// The store must NEVER import db directly.
// All SQL constants live in db.ts; row mappers live here.
// ============================================================

import { db } from "@/kernel/db";
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
  ResearchThread,
  ResearchAiJob,
} from "./types";
import type {
  ImportSourceInput,
  CreateDocumentInput,
  CreateChunkInput,
  CreateHighlightInput,
  CreateAnnotationInput,
} from "./store";
import { generateId, now } from "@/shared/utils";

export { RESEARCH_MIGRATIONS };

// ── Sources ─────────────────────────────────────────────────

export async function dbSelectSources(): Promise<ResearchSource[]> {
  const rows = await db.select<Record<string, unknown>>(SQL.SELECT_SOURCES, []);
  return rows.map(rowToSource) as ResearchSource[];
}

export async function dbInsertSource(source: ResearchSource): Promise<void> {
  await db.execute(SQL.INSERT_SOURCE, [
    source.id, source.type, source.title, source.url ?? null,
    source.filePath ?? null, source.rawContent ?? null,
    source.mimeType ?? null, source.sizeBytes ?? null,
    source.processingStatus, source.errorMessage ?? null,
    JSON.stringify(source.threadIds), JSON.stringify(source.tags),
    source.importedAt, source.updatedAt,
  ]);
  await db.execute(SQL.FTS_INSERT, [source.id, "source", source.title, source.rawContent ?? ""]);
}

export async function dbUpdateSource(
  id: string,
  title: string,
  tags: string[],
  threadIds: string[],
  updatedAt: string,
): Promise<void> {
  await db.execute(SQL.UPDATE_SOURCE, [
    title, JSON.stringify(tags), JSON.stringify(threadIds), updatedAt, id,
  ]);
}

export async function dbUpdateSourceStatus(
  id: string,
  status: ResearchSource["processingStatus"],
  error: string | undefined,
  updatedAt: string,
): Promise<void> {
  await db.execute(SQL.UPDATE_SOURCE_STATUS, [status, error ?? null, updatedAt, id]);
}

export async function dbDeleteSource(id: string): Promise<void> {
  await db.execute(SQL.DELETE_SOURCE, [id]);
  await db.execute(SQL.FTS_DELETE, [id]);
}

// ── Documents ───────────────────────────────────────────────

export async function dbSelectDocuments(): Promise<ResearchDocument[]> {
  const rows = await db.select<Record<string, unknown>>(SQL.SELECT_DOCUMENTS, []);
  return rows.map(rowToDocument) as ResearchDocument[];
}

export async function dbInsertDocument(doc: ResearchDocument): Promise<void> {
  await db.execute(SQL.INSERT_DOCUMENT, [
    doc.id, doc.sourceId, doc.title,
    JSON.stringify(doc.authors ?? []),
    doc.publishedDate ?? null, doc.language ?? null, doc.abstract ?? null,
    doc.totalChunks, doc.totalPages ?? null, doc.wordCount ?? null,
    doc.processingVersion, doc.createdAt, doc.updatedAt,
  ]);
  await db.execute(SQL.FTS_INSERT, [doc.id, "document", doc.title, doc.abstract ?? ""]);
}

// ── Chunks ──────────────────────────────────────────────────

export async function dbSelectChunksByDocument(documentId: string): Promise<ResearchChunk[]> {
  const rows = await db.select<Record<string, unknown>>(SQL.SELECT_CHUNKS_BY_DOC, [documentId]);
  return rows.map(rowToChunk) as ResearchChunk[];
}

export async function dbInsertChunk(chunk: ResearchChunk): Promise<void> {
  await db.execute(SQL.INSERT_CHUNK, [
    chunk.id, chunk.documentId, chunk.sourceId, chunk.type, chunk.content,
    chunk.order, chunk.pageNumber ?? null, chunk.sectionTitle ?? null,
    null, JSON.stringify(chunk.semanticTags ?? []), JSON.stringify(chunk.entities ?? []),
    null, null, chunk.createdAt,
  ]);
  await db.execute(SQL.FTS_INSERT, [chunk.id, "chunk", chunk.sectionTitle ?? "", chunk.content]);
}

export async function dbUpdateChunkAi(
  id: string,
  tags: string[],
  entities: string[],
  score: number,
  summary: string,
): Promise<void> {
  await db.execute(SQL.UPDATE_CHUNK_AI, [
    JSON.stringify(tags), JSON.stringify(entities), score, summary, id,
  ]);
}

// ── Highlights ──────────────────────────────────────────────

export async function dbSelectHighlightsByDocument(documentId: string): Promise<ResearchHighlight[]> {
  const rows = await db.select<Record<string, unknown>>(SQL.SELECT_HIGHLIGHTS_BY_DOC, [documentId]);
  return rows.map(rowToHighlight) as ResearchHighlight[];
}

export async function dbInsertHighlight(h: ResearchHighlight): Promise<void> {
  await db.execute(SQL.INSERT_HIGHLIGHT, [
    h.id, h.documentId, h.chunkId, h.sourceId, h.text, h.color,
    h.pageNumber ?? null,
    h.position ? JSON.stringify(h.position) : null,
    h.note ?? null, h.linkedNoteId ?? null, h.linkedTaskId ?? null,
    h.createdAt, h.updatedAt,
  ]);
}

export async function dbUpdateHighlight(
  h: ResearchHighlight,
): Promise<void> {
  await db.execute(SQL.UPDATE_HIGHLIGHT, [
    h.note ?? null, h.color,
    h.linkedNoteId ?? null, h.linkedTaskId ?? null,
    h.updatedAt, h.id,
  ]);
}

export async function dbDeleteHighlight(id: string): Promise<void> {
  await db.execute(SQL.DELETE_HIGHLIGHT, [id]);
}

// ── Annotations ─────────────────────────────────────────────

export async function dbSelectAnnotationsByDocument(documentId: string): Promise<ResearchAnnotation[]> {
  const rows = await db.select<Record<string, unknown>>(SQL.SELECT_ANNOTATIONS_BY_DOC, [documentId]);
  return rows.map(rowToAnnotation) as ResearchAnnotation[];
}

export async function dbInsertAnnotation(a: ResearchAnnotation): Promise<void> {
  await db.execute(SQL.INSERT_ANNOTATION, [
    a.id, a.documentId, a.chunkId ?? null, a.sourceId, a.type, a.content,
    a.pageNumber ?? null,
    a.position ? JSON.stringify(a.position) : null,
    a.linkedNoteId ?? null, a.linkedTaskId ?? null,
    a.createdAt, a.updatedAt,
  ]);
}

export async function dbUpdateAnnotation(a: ResearchAnnotation): Promise<void> {
  await db.execute(SQL.UPDATE_ANNOTATION, [
    a.content, a.type,
    a.linkedNoteId ?? null, a.linkedTaskId ?? null,
    a.updatedAt, a.id,
  ]);
}

export async function dbDeleteAnnotation(id: string): Promise<void> {
  await db.execute(SQL.DELETE_ANNOTATION, [id]);
}

// ── Threads ─────────────────────────────────────────────────

export async function dbSelectThreads(): Promise<ResearchThread[]> {
  const rows = await db.select<Record<string, unknown>>(SQL.SELECT_THREADS, []);
  return rows.map(rowToThread) as ResearchThread[];
}

export async function dbInsertThread(t: ResearchThread): Promise<void> {
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
}

export async function dbUpdateThread(t: ResearchThread): Promise<void> {
  await db.execute(SQL.UPDATE_THREAD, [
    t.title, t.description ?? null, t.color ?? null,
    JSON.stringify(t.sourceIds), JSON.stringify(t.highlightIds),
    JSON.stringify(t.annotationIds), JSON.stringify(t.linkedNoteIds),
    JSON.stringify(t.linkedTaskIds), JSON.stringify(t.linkedProjectIds),
    t.aiSummary ?? null,
    JSON.stringify(t.unresolvedQuestions), JSON.stringify(t.recentInsights),
    JSON.stringify(t.tags), t.isPinned ? 1 : 0,
    t.updatedAt, t.id,
  ]);
}

export async function dbDeleteThread(id: string): Promise<void> {
  await db.execute(SQL.DELETE_THREAD, [id]);
}

// ── AI Jobs ─────────────────────────────────────────────────

export async function dbSelectPendingJobs(): Promise<ResearchAiJob[]> {
  const rows = await db.select<Record<string, unknown>>(SQL.SELECT_PENDING_JOBS, []);
  return rows as ResearchAiJob[];
}

// ── FTS Search ──────────────────────────────────────────────

export async function dbFtsSearch(
  safeQuery: string,
  limit: number,
): Promise<Array<{ id: string; entity_type: string; title: string; excerpt?: string }>> {
  return db.select<{ id: string; entity_type: string; title: string; excerpt?: string }>(
    SQL.FTS_SEARCH, [safeQuery, limit]
  );
}
