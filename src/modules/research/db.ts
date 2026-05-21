// ============================================================
// RESEARCH MODULE — DB
// Migration version: 110
// 12 tables covering the full knowledge pipeline.
// Register in main.tsx: db.registerMigrations(RESEARCH_MIGRATIONS)
// ============================================================

import type { Migration } from "@/kernel/db";

export const RESEARCH_MIGRATIONS: Migration[] = [
  {
    version: 110,
    module: "research",
    up: `
      -- ── research_sources ─────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS research_sources (
        id                 TEXT NOT NULL PRIMARY KEY,
        type               TEXT NOT NULL,
        title              TEXT NOT NULL,
        url                TEXT,
        file_path          TEXT,
        raw_content        TEXT,
        mime_type          TEXT,
        size_bytes         INTEGER,
        processing_status  TEXT NOT NULL DEFAULT 'pending',
        error_message      TEXT,
        thread_ids         TEXT NOT NULL DEFAULT '[]',
        tags               TEXT NOT NULL DEFAULT '[]',
        imported_at        TEXT NOT NULL,
        updated_at         TEXT NOT NULL
      );

      -- ── research_documents ────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS research_documents (
        id                  TEXT NOT NULL PRIMARY KEY,
        source_id           TEXT NOT NULL REFERENCES research_sources(id) ON DELETE CASCADE,
        title               TEXT NOT NULL,
        authors             TEXT NOT NULL DEFAULT '[]',
        published_date      TEXT,
        language            TEXT,
        abstract            TEXT,
        total_chunks        INTEGER NOT NULL DEFAULT 0,
        total_pages         INTEGER,
        word_count          INTEGER,
        processing_version  TEXT NOT NULL DEFAULT '1',
        created_at          TEXT NOT NULL,
        updated_at          TEXT NOT NULL
      );

      -- ── research_chunks ───────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS research_chunks (
        id               TEXT NOT NULL PRIMARY KEY,
        document_id      TEXT NOT NULL REFERENCES research_documents(id) ON DELETE CASCADE,
        source_id        TEXT NOT NULL,
        type             TEXT NOT NULL DEFAULT 'paragraph',
        content          TEXT NOT NULL,
        chunk_order      INTEGER NOT NULL DEFAULT 0,
        page_number      INTEGER,
        section_title    TEXT,
        embedding_id     TEXT,
        semantic_tags    TEXT NOT NULL DEFAULT '[]',
        entities         TEXT NOT NULL DEFAULT '[]',
        importance_score REAL,
        summary          TEXT,
        created_at       TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_research_chunks_document ON research_chunks(document_id);
      CREATE INDEX IF NOT EXISTS idx_research_chunks_source   ON research_chunks(source_id);

      -- ── research_embeddings ───────────────────────────────────────
      -- vector column stored as JSON; swap to sqlite-vss later
      CREATE TABLE IF NOT EXISTS research_embeddings (
        id         TEXT NOT NULL PRIMARY KEY,
        chunk_id   TEXT NOT NULL REFERENCES research_chunks(id) ON DELETE CASCADE,
        model      TEXT NOT NULL,
        dimensions INTEGER NOT NULL,
        vector     TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_research_embeddings_chunk ON research_embeddings(chunk_id);

      -- ── research_entities ─────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS research_entities (
        id               TEXT NOT NULL PRIMARY KEY,
        document_id      TEXT NOT NULL REFERENCES research_documents(id) ON DELETE CASCADE,
        chunk_id         TEXT,
        name             TEXT NOT NULL,
        type             TEXT NOT NULL,
        aliases          TEXT NOT NULL DEFAULT '[]',
        description      TEXT,
        importance_score REAL,
        created_at       TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_research_entities_document ON research_entities(document_id);
      CREATE INDEX IF NOT EXISTS idx_research_entities_name     ON research_entities(name);

      -- ── research_relations ────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS research_relations (
        id            TEXT NOT NULL PRIMARY KEY,
        from_id       TEXT NOT NULL,
        from_type     TEXT NOT NULL,
        to_id         TEXT NOT NULL,
        to_type       TEXT NOT NULL,
        relation_type TEXT NOT NULL,
        weight        REAL,
        context       TEXT,
        created_at    TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_research_relations_from ON research_relations(from_id);
      CREATE INDEX IF NOT EXISTS idx_research_relations_to   ON research_relations(to_id);

      -- ── research_highlights ───────────────────────────────────────
      CREATE TABLE IF NOT EXISTS research_highlights (
        id           TEXT NOT NULL PRIMARY KEY,
        document_id  TEXT NOT NULL REFERENCES research_documents(id) ON DELETE CASCADE,
        chunk_id     TEXT NOT NULL,
        source_id    TEXT NOT NULL,
        text         TEXT NOT NULL,
        color        TEXT NOT NULL DEFAULT '#FFD700',
        page_number  INTEGER,
        position     TEXT,
        note         TEXT,
        linked_note_id TEXT,
        linked_task_id TEXT,
        created_at   TEXT NOT NULL,
        updated_at   TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_research_highlights_document ON research_highlights(document_id);

      -- ── research_annotations ──────────────────────────────────────
      CREATE TABLE IF NOT EXISTS research_annotations (
        id             TEXT NOT NULL PRIMARY KEY,
        document_id    TEXT NOT NULL REFERENCES research_documents(id) ON DELETE CASCADE,
        chunk_id       TEXT,
        source_id      TEXT NOT NULL,
        type           TEXT NOT NULL DEFAULT 'note',
        content        TEXT NOT NULL,
        page_number    INTEGER,
        position       TEXT,
        linked_note_id TEXT,
        linked_task_id TEXT,
        created_at     TEXT NOT NULL,
        updated_at     TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_research_annotations_document ON research_annotations(document_id);

      -- ── research_citations ────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS research_citations (
        id               TEXT NOT NULL PRIMARY KEY,
        document_id      TEXT NOT NULL REFERENCES research_documents(id) ON DELETE CASCADE,
        chunk_id         TEXT,
        raw              TEXT NOT NULL,
        title            TEXT,
        authors          TEXT NOT NULL DEFAULT '[]',
        year             INTEGER,
        url              TEXT,
        doi              TEXT,
        linked_source_id TEXT,
        created_at       TEXT NOT NULL
      );

      -- ── research_threads ──────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS research_threads (
        id                   TEXT NOT NULL PRIMARY KEY,
        title                TEXT NOT NULL,
        description          TEXT,
        color                TEXT,
        source_ids           TEXT NOT NULL DEFAULT '[]',
        highlight_ids        TEXT NOT NULL DEFAULT '[]',
        annotation_ids       TEXT NOT NULL DEFAULT '[]',
        linked_note_ids      TEXT NOT NULL DEFAULT '[]',
        linked_task_ids      TEXT NOT NULL DEFAULT '[]',
        linked_project_ids   TEXT NOT NULL DEFAULT '[]',
        ai_summary           TEXT,
        unresolved_questions TEXT NOT NULL DEFAULT '[]',
        recent_insights      TEXT NOT NULL DEFAULT '[]',
        tags                 TEXT NOT NULL DEFAULT '[]',
        is_pinned            INTEGER NOT NULL DEFAULT 0,
        created_at           TEXT NOT NULL,
        updated_at           TEXT NOT NULL
      );

      -- ── research_ai_jobs ──────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS research_ai_jobs (
        id            TEXT NOT NULL PRIMARY KEY,
        source_id     TEXT NOT NULL REFERENCES research_sources(id) ON DELETE CASCADE,
        job_type      TEXT NOT NULL,
        status        TEXT NOT NULL DEFAULT 'queued',
        progress      INTEGER,
        error_message TEXT,
        started_at    TEXT,
        completed_at  TEXT,
        created_at    TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_research_ai_jobs_source ON research_ai_jobs(source_id);
      CREATE INDEX IF NOT EXISTS idx_research_ai_jobs_status ON research_ai_jobs(status);

      -- ── research_links ────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS research_links (
        id                    TEXT NOT NULL PRIMARY KEY,
        research_entity_type  TEXT NOT NULL,
        research_entity_id    TEXT NOT NULL,
        linked_entity_type    TEXT NOT NULL,
        linked_entity_id      TEXT NOT NULL,
        created_at            TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_research_links_research ON research_links(research_entity_id);
      CREATE INDEX IF NOT EXISTS idx_research_links_linked   ON research_links(linked_entity_id);

      -- ── FTS virtual table for full-text search ────────────────────
      CREATE VIRTUAL TABLE IF NOT EXISTS research_fts USING fts5(
        id UNINDEXED,
        entity_type UNINDEXED,
        title,
        content,
        tokenize = 'unicode61'
      );
    `,
  },
];

// ── SQL helpers ─────────────────────────────────────────────
// Always use explicit column lists. Never slice() row arrays.

export const SQL = {
  // sources
  INSERT_SOURCE: `INSERT INTO research_sources (id, type, title, url, file_path, raw_content, mime_type, size_bytes, processing_status, error_message, thread_ids, tags, imported_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  UPDATE_SOURCE_STATUS: `UPDATE research_sources SET processing_status=?, error_message=?, updated_at=? WHERE id=?`,
  UPDATE_SOURCE: `UPDATE research_sources SET title=?, tags=?, thread_ids=?, updated_at=? WHERE id=?`,
  SELECT_SOURCES: `SELECT id, type, title, url, file_path, raw_content, mime_type, size_bytes, processing_status, error_message, thread_ids, tags, imported_at, updated_at FROM research_sources ORDER BY imported_at DESC`,
  SELECT_SOURCE: `SELECT id, type, title, url, file_path, raw_content, mime_type, size_bytes, processing_status, error_message, thread_ids, tags, imported_at, updated_at FROM research_sources WHERE id=?`,
  DELETE_SOURCE: `DELETE FROM research_sources WHERE id=?`,

  // documents
  INSERT_DOCUMENT: `INSERT INTO research_documents (id, source_id, title, authors, published_date, language, abstract, total_chunks, total_pages, word_count, processing_version, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  UPDATE_DOCUMENT: `UPDATE research_documents SET title=?, total_chunks=?, word_count=?, updated_at=? WHERE id=?`,
  SELECT_DOCUMENTS: `SELECT id, source_id, title, authors, published_date, language, abstract, total_chunks, total_pages, word_count, processing_version, created_at, updated_at FROM research_documents ORDER BY created_at DESC`,
  SELECT_DOCUMENT: `SELECT id, source_id, title, authors, published_date, language, abstract, total_chunks, total_pages, word_count, processing_version, created_at, updated_at FROM research_documents WHERE id=?`,
  SELECT_DOCUMENT_BY_SOURCE: `SELECT id, source_id, title, authors, published_date, language, abstract, total_chunks, total_pages, word_count, processing_version, created_at, updated_at FROM research_documents WHERE source_id=?`,

  // chunks
  INSERT_CHUNK: `INSERT INTO research_chunks (id, document_id, source_id, type, content, chunk_order, page_number, section_title, embedding_id, semantic_tags, entities, importance_score, summary, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  SELECT_CHUNKS_BY_DOC: `SELECT id, document_id, source_id, type, content, chunk_order, page_number, section_title, embedding_id, semantic_tags, entities, importance_score, summary, created_at FROM research_chunks WHERE document_id=? ORDER BY chunk_order ASC`,
  UPDATE_CHUNK_EMBEDDING: `UPDATE research_chunks SET embedding_id=? WHERE id=?`,
  UPDATE_CHUNK_AI: `UPDATE research_chunks SET semantic_tags=?, entities=?, importance_score=?, summary=? WHERE id=?`,

  // embeddings
  INSERT_EMBEDDING: `INSERT INTO research_embeddings (id, chunk_id, model, dimensions, vector, created_at) VALUES (?,?,?,?,?,?)`,
  SELECT_EMBEDDING: `SELECT id, chunk_id, model, dimensions, vector, created_at FROM research_embeddings WHERE id=?`,

  // entities
  INSERT_ENTITY: `INSERT INTO research_entities (id, document_id, chunk_id, name, type, aliases, description, importance_score, created_at) VALUES (?,?,?,?,?,?,?,?,?)`,
  SELECT_ENTITIES_BY_DOC: `SELECT id, document_id, chunk_id, name, type, aliases, description, importance_score, created_at FROM research_entities WHERE document_id=? ORDER BY importance_score DESC`,
  SELECT_ENTITY_BY_NAME: `SELECT id, document_id, chunk_id, name, type, aliases, description, importance_score, created_at FROM research_entities WHERE name=? LIMIT 1`,

  // relations
  INSERT_RELATION: `INSERT INTO research_relations (id, from_id, from_type, to_id, to_type, relation_type, weight, context, created_at) VALUES (?,?,?,?,?,?,?,?,?)`,
  SELECT_RELATIONS_FROM: `SELECT id, from_id, from_type, to_id, to_type, relation_type, weight, context, created_at FROM research_relations WHERE from_id=?`,
  SELECT_RELATIONS_TO: `SELECT id, from_id, from_type, to_id, to_type, relation_type, weight, context, created_at FROM research_relations WHERE to_id=?`,
  DELETE_RELATION: `DELETE FROM research_relations WHERE id=?`,

  // highlights
  INSERT_HIGHLIGHT: `INSERT INTO research_highlights (id, document_id, chunk_id, source_id, text, color, page_number, position, note, linked_note_id, linked_task_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  UPDATE_HIGHLIGHT: `UPDATE research_highlights SET note=?, color=?, linked_note_id=?, linked_task_id=?, updated_at=? WHERE id=?`,
  SELECT_HIGHLIGHTS_BY_DOC: `SELECT id, document_id, chunk_id, source_id, text, color, page_number, position, note, linked_note_id, linked_task_id, created_at, updated_at FROM research_highlights WHERE document_id=? ORDER BY created_at ASC`,
  DELETE_HIGHLIGHT: `DELETE FROM research_highlights WHERE id=?`,

  // annotations
  INSERT_ANNOTATION: `INSERT INTO research_annotations (id, document_id, chunk_id, source_id, type, content, page_number, position, linked_note_id, linked_task_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
  UPDATE_ANNOTATION: `UPDATE research_annotations SET content=?, type=?, linked_note_id=?, linked_task_id=?, updated_at=? WHERE id=?`,
  SELECT_ANNOTATIONS_BY_DOC: `SELECT id, document_id, chunk_id, source_id, type, content, page_number, position, linked_note_id, linked_task_id, created_at, updated_at FROM research_annotations WHERE document_id=? ORDER BY created_at ASC`,
  DELETE_ANNOTATION: `DELETE FROM research_annotations WHERE id=?`,

  // citations
  INSERT_CITATION: `INSERT INTO research_citations (id, document_id, chunk_id, raw, title, authors, year, url, doi, linked_source_id, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
  SELECT_CITATIONS_BY_DOC: `SELECT id, document_id, chunk_id, raw, title, authors, year, url, doi, linked_source_id, created_at FROM research_citations WHERE document_id=? ORDER BY created_at ASC`,

  // threads
  INSERT_THREAD: `INSERT INTO research_threads (id, title, description, color, source_ids, highlight_ids, annotation_ids, linked_note_ids, linked_task_ids, linked_project_ids, ai_summary, unresolved_questions, recent_insights, tags, is_pinned, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  UPDATE_THREAD: `UPDATE research_threads SET title=?, description=?, color=?, source_ids=?, highlight_ids=?, annotation_ids=?, linked_note_ids=?, linked_task_ids=?, linked_project_ids=?, ai_summary=?, unresolved_questions=?, recent_insights=?, tags=?, is_pinned=?, updated_at=? WHERE id=?`,
  SELECT_THREADS: `SELECT id, title, description, color, source_ids, highlight_ids, annotation_ids, linked_note_ids, linked_task_ids, linked_project_ids, ai_summary, unresolved_questions, recent_insights, tags, is_pinned, created_at, updated_at FROM research_threads ORDER BY is_pinned DESC, updated_at DESC`,
  DELETE_THREAD: `DELETE FROM research_threads WHERE id=?`,

  // ai_jobs
  INSERT_AI_JOB: `INSERT INTO research_ai_jobs (id, source_id, job_type, status, progress, error_message, started_at, completed_at, created_at) VALUES (?,?,?,?,?,?,?,?,?)`,
  UPDATE_AI_JOB: `UPDATE research_ai_jobs SET status=?, progress=?, error_message=?, started_at=?, completed_at=? WHERE id=?`,
  SELECT_PENDING_JOBS: `SELECT id, source_id, job_type, status, progress, error_message, started_at, completed_at, created_at FROM research_ai_jobs WHERE status IN ('queued','running') ORDER BY created_at ASC`,
  SELECT_JOBS_BY_SOURCE: `SELECT id, source_id, job_type, status, progress, error_message, started_at, completed_at, created_at FROM research_ai_jobs WHERE source_id=? ORDER BY created_at DESC`,

  // links
  INSERT_LINK: `INSERT INTO research_links (id, research_entity_type, research_entity_id, linked_entity_type, linked_entity_id, created_at) VALUES (?,?,?,?,?,?)`,
  SELECT_LINKS_BY_RESEARCH: `SELECT id, research_entity_type, research_entity_id, linked_entity_type, linked_entity_id, created_at FROM research_links WHERE research_entity_id=?`,
  SELECT_LINKS_BY_LINKED: `SELECT id, research_entity_type, research_entity_id, linked_entity_type, linked_entity_id, created_at FROM research_links WHERE linked_entity_id=?`,
  DELETE_LINK: `DELETE FROM research_links WHERE id=?`,

  // FTS helpers
  FTS_INSERT: `INSERT INTO research_fts (id, entity_type, title, content) VALUES (?,?,?,?)`,
  FTS_DELETE: `DELETE FROM research_fts WHERE id=?`,
  FTS_SEARCH: `SELECT id, entity_type, title, snippet(research_fts, 3, '<mark>', '</mark>', '...', 20) AS excerpt FROM research_fts WHERE research_fts MATCH ? ORDER BY rank LIMIT ?`,
};

// ── Row → entity mappers (no implicit slice()) ───────────────

type Row = Record<string, unknown>;

function j<T>(v: unknown): T {
  if (typeof v === "string") {
    try { return JSON.parse(v) as T; } catch { return [] as unknown as T; }
  }
  return (v ?? []) as unknown as T;
}

export function rowToSource(r: Row) {
  return {
    id: r.id as string,
    type: r.type as string,
    title: r.title as string,
    url: r.url as string | undefined,
    filePath: r.file_path as string | undefined,
    rawContent: r.raw_content as string | undefined,
    mimeType: r.mime_type as string | undefined,
    sizeBytes: r.size_bytes as number | undefined,
    processingStatus: r.processing_status as string,
    errorMessage: r.error_message as string | undefined,
    threadIds: j<string[]>(r.thread_ids),
    tags: j<string[]>(r.tags),
    importedAt: r.imported_at as string,
    updatedAt: r.updated_at as string,
  };
}

export function rowToDocument(r: Row) {
  return {
    id: r.id as string,
    sourceId: r.source_id as string,
    title: r.title as string,
    authors: j<string[]>(r.authors),
    publishedDate: r.published_date as string | undefined,
    language: r.language as string | undefined,
    abstract: r.abstract as string | undefined,
    totalChunks: r.total_chunks as number,
    totalPages: r.total_pages as number | undefined,
    wordCount: r.word_count as number | undefined,
    processingVersion: r.processing_version as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export function rowToChunk(r: Row) {
  return {
    id: r.id as string,
    documentId: r.document_id as string,
    sourceId: r.source_id as string,
    type: r.type as string,
    content: r.content as string,
    order: r.chunk_order as number,
    pageNumber: r.page_number as number | undefined,
    sectionTitle: r.section_title as string | undefined,
    embeddingId: r.embedding_id as string | undefined,
    semanticTags: j<string[]>(r.semantic_tags),
    entities: j<string[]>(r.entities),
    importanceScore: r.importance_score as number | undefined,
    summary: r.summary as string | undefined,
    createdAt: r.created_at as string,
  };
}

export function rowToThread(r: Row) {
  return {
    id: r.id as string,
    title: r.title as string,
    description: r.description as string | undefined,
    color: r.color as string | undefined,
    sourceIds: j<string[]>(r.source_ids),
    highlightIds: j<string[]>(r.highlight_ids),
    annotationIds: j<string[]>(r.annotation_ids),
    linkedNoteIds: j<string[]>(r.linked_note_ids),
    linkedTaskIds: j<string[]>(r.linked_task_ids),
    linkedProjectIds: j<string[]>(r.linked_project_ids),
    aiSummary: r.ai_summary as string | undefined,
    unresolvedQuestions: j<string[]>(r.unresolved_questions),
    recentInsights: j<string[]>(r.recent_insights),
    tags: j<string[]>(r.tags),
    isPinned: Boolean(r.is_pinned),
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export function rowToHighlight(r: Row) {
  return {
    id: r.id as string,
    documentId: r.document_id as string,
    chunkId: r.chunk_id as string,
    sourceId: r.source_id as string,
    text: r.text as string,
    color: r.color as string,
    pageNumber: r.page_number as number | undefined,
    position: r.position ? (JSON.parse(r.position as string) as { start: number; end: number }) : undefined,
    note: r.note as string | undefined,
    linkedNoteId: r.linked_note_id as string | undefined,
    linkedTaskId: r.linked_task_id as string | undefined,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export function rowToAnnotation(r: Row) {
  return {
    id: r.id as string,
    documentId: r.document_id as string,
    chunkId: r.chunk_id as string | undefined,
    sourceId: r.source_id as string,
    type: r.type as string,
    content: r.content as string,
    pageNumber: r.page_number as number | undefined,
    position: r.position ? (JSON.parse(r.position as string) as { start: number; end: number }) : undefined,
    linkedNoteId: r.linked_note_id as string | undefined,
    linkedTaskId: r.linked_task_id as string | undefined,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}
