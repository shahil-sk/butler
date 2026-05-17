# Journal Module — CONTEXT

**Route:** `/journal`  
**Migration:** v60 — `journal_entries` table (unique index on date+type)  
**Store:** `useJournalStore` — entries[], activeEntryId, loadEntries, getOrCreateDaily, createEntry, updateEntry, deleteEntry, linkTask, unlinkTask  
**Events emitted:** `journal:entry-created`, `journal:entry-updated`, `search:index-invalidated`  
**Events consumed:** `journal:open-date` (auto-opens/creates daily entry), `sync:autosave`  
**UI:** Two-pane — entry list sidebar + editor. Mood picker (1–5 emoji). Auto-save on blur. Type filter: daily/weekly/monthly/gratitude/reflection.  
**Notes:** content stored as raw string (Tiptap JSON when wired). Tags stored as JSON array in DB. Explicit SQL params — INSERT 10 cols, UPDATE 9 cols (WHERE id last).
