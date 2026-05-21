# Research Module — CONTEXT

**Role:** Knowledge OS layer. Central cognition module.
**Migration:** v110 (12 tables)
**Route:** `/research` (Threads), `/research/sources`, `/research/graph`
**Store:** `useResearchStore` in `store.ts` — owns sources, documents, chunks, highlights, annotations, threads, aiJobs
**Events emitted:** `research:source-imported`, `research:document-processed`, `research:chunk-created`, `research:highlight-created`, `research:annotation-created`, `research:thread-created`, `research:thread-updated`, `research:thread-deleted`, `research:highlight-deleted`, `research:annotation-updated`, `research:annotation-deleted`
**Listens to:** `focus:session-started`, `task:deleted`, `note:deleted`
**AI pipeline:** Modular. `ai/` subfolder reserved for embeddings, retrieval, summarization, entity-extraction. Not yet implemented — store has stubs (`updateChunkAi`, job queue via `research_ai_jobs` table).
**Key invariants:** Never write to other module stores. Use bus.emit for cross-module mutations. All SQL uses explicit column lists.
