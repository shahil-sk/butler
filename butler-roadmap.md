# Butler — Comprehensive Improvement Roadmap

## Project Architecture Overview

Butler is a **Tauri + React + TypeScript** desktop app with a modular architecture.

**Modules:** tasks, focus, journal, notes, planner, projects, calendar, time-tracking, research, database, settings

**Kernel:** event-bus, db, router, workspace

Cross-module communication happens exclusively via a shared typed event bus — no direct store imports between modules. The `IntegrationLayer.tsx` is a zero-UI component mounted once in Shell that wires all cross-module side effects.

---

## What's Already Wired ✅

The `IntegrationLayer` already handles:

- `project:deleted` → archives all project tasks + removes from journal/time entries
- `task:completed` → milestone auto-complete + links to today's daily journal
- `note:link-to-task` / `note:deleted` → syncs `linkedNoteIds` on tasks bidirectionally
- `calendar:event-created/deleted` → syncs `linkedEventIds` on tasks
- `focus:session-completed` → creates `TimeEntry`, updates `task.actualMinutes`, links to journal, checks estimate overrun
- `time:entry-created/updated/deleted` → keeps `task.actualMinutes` in sync
- `search:result-selected` → navigates to the right module
- `note:created` → projects: if note has `linkedProjectIds`, update `project.linkedNoteIds`
- `note:link-to-task` → tasks: append note to `task.linkedNoteIds`
- `focus:session-started` → research: (listens) surface related research for the task

---

## Module-by-Module Improvements

### 📋 Tasks

**Add:**
- Recurring task support (daily/weekly/custom RRULE) with auto-spawn on completion — emit `task:created` for the new instance so Journal + Calendar automatically pick it up
- Task dependencies (`blockedBy: ID[]`) — surface as a "blocked" badge in board view; when all blockers complete, emit `task:unblocked` so Planner can auto-reschedule
- Effort estimation field (`estimateMinutes`) — UI input in task detail panel (slider or `1h 30m` text parser); already partially used in IntegrationLayer for overrun warnings
- Timeline/Gantt view — `components/TimelineView.tsx` showing tasks as horizontal bars across dates, pulling `dueDate` and `estimateMinutes`; clicking a bar emits `task:schedule-in-planner`
- Natural language QuickAdd — parse `"finish report tomorrow 3pm #work !high"` into `{ title, dueDate, startTime, projectId, priority }` via a regex pipeline in the store before `createTask()`
- Replace flat priority labels with an Eisenhower matrix quadrant picker UI

**Update:**
- Board view: add WIP limits per column, swimlane grouping by project/assignee
- Upgrade QuickAdd to support natural language parsing

**Remove:**
- Remove redundant `task-calendar-sync.ts` from `src/modules/tasks/` — consolidate to the kernel version at `src/kernel/task-calendar-sync.ts`

**Integration wires to add:**
```
task:completed   →  focus: if active session on this task, auto-stop it
task:completed   →  database: update linked row's status cell to "Done"
task:created     →  calendar: if task has dueDate, create a soft "deadline" event
task:due-today   →  journal: append task to today's daily entry (via kernel cron)
task:overdue     →  shell: emit ui:notification with overdue warning
task:schedule-in-planner  →  planner: createBlock with task metadata  ← MISSING
task:open        →  research: semantic search for relevant chunks and open sidebar panel  ← MISSING
```

---

### ⏱️ Focus

**Add:**
- Flow mode — a non-Pomodoro `"flow"` session type with no timer ring, just a stopwatch and a "Done" button; add to `FocusSession.type` alongside `focus/short_break/long_break`; emit `focus:flow-started` and `focus:flow-ended`
- Session goal field — free-text goal input shown before session starts (field stub exists in store); surface it in the pre-session UI
- Interruption counter — `interruptCount` field already referenced in IntegrationLayer toast; needs a visible `+1 Interrupt` button in the focus UI
- Daily focus goal ring — mini SVG ring in the sidebar showing today's focus hours vs daily goal (e.g. 4h), subscribing to `focus:session-completed` via `useBusEvent`
- Web Worker / Tauri background task timer — move `_tick()` setInterval to prevent drift when window is minimized or loses focus
- Desktop notification + OS-level DND toggle using Tauri's notification plugin when session starts
- Ambient sound player (rain, white noise) with volume control via Tauri
- Animated canvas/lottie timer with smooth arc transitions (replace ring SVG)
- Session history heatmap calendar (GitHub-style) showing focus density per day

**Remove:**
- Remove the idle-guard toast `task:open` listener — replace with a subtle ambient indicator in the sidebar

**Integration wires to add:**
```
focus:session-started    →  tasks: set task status to "in-progress"
focus:session-started    →  calendar: create a soft "busy" block for session duration
focus:session-completed  →  planner: mark linked planner block as done  ← MISSING
focus:session-completed  →  projects: add session minutes to project.totalFocusMinutes  ← MISSING
focus:session-completed  →  research: if task has linked research, surface "review highlights" prompt
```

---

### 📅 Calendar

**Current state:** Month/Week/Day/Agenda/Year views, TaskEventPanel, EventForm, DateTimePicker, WeekView, DayView. Cross-module in: `task:scheduled`, `note:pinned`, `focus:block:requested`.

**Add:**
- Drag-to-reschedule — drag an event on the week/day grid to a new slot; on drop, emit `calendar:event-updated` to update the linked task's `dueDate`
- Conflict detection — highlight overlapping events in red on the day view; check against active focus blocks
- `findFreeSlots(date, durationMinutes)` utility in the store — called by Planner's "Plan My Day" to suggest time blocks
- Color-coded event sources — visually distinguish events sourced from planner, focus, tasks vs manually created ones using the `source` field

**Integration wires to add:**
```
calendar:event-updated (reschedule)  →  tasks: update task.dueDate to match
calendar:event-starting (15min ahead) →  shell: emit ui:notification prompting focus session start
task:completed  →  calendar: mark linked deadline event as "done" with strikethrough style
planner:block-linked-task  →  calendar: mirror block as calendar event  ← MISSING
```

---

### 📁 Projects

**Add:**
- Project health dashboard tab — `components/ProjectHealth.tsx` showing: task completion %, overdue task count, total focus hours this week, time logged vs estimated
- Project `status` field — `"active" | "on-hold" | "completed" | "archived"`; on `"completed"`, auto-archive all remaining tasks via bus
- Time budget field — `budgetHours` on the project with a progress bar vs logged `time_entries` total
- Project templates — `useProjectTemplate()` hook pre-populating tasks + milestones from a saved template JSON
- `project:selected` bus event so sidebar highlights the active project context across all modules
- Every task, note, focus session, and time entry should optionally belong to a project (primary context anchor)

**Integration wires to add:**
```
project:created  →  calendar: create a recurring "project standup" event if template has it
project:created  →  database: auto-create a "Project Tracker" table with preset columns
project:updated (status=completed)  →  tasks: archive incomplete tasks
project:updated (status=completed)  →  journal: create a "Project Wrap-up" reflection entry
focus:session-completed  →  projects: update project.totalFocusMinutes  ← MISSING
time:entry-created  →  projects: recalculate project.totalLoggedMinutes  ← MISSING
```

---

### ⏳ Time Tracking

**Current state:** Manual + timer entries, live timer (one active max), reports by project/day/range, billable flag, auto-entry from focus.

**Add:**
- Visual timeline view — the day as a vertical timeline with colored bars per project (Toggl-style day view)
- Idle detection — Tauri system idle time API: if no mouse/keyboard for 5 minutes, pause the timer and ask "Were you working?" on resume
- Weekly report export — Markdown or CSV summary of hours by project + task, downloadable via Tauri file dialog
- Billable rate field — `hourlyRate` on the project; time-tracking shows estimated invoice amount alongside hours

**Integration wires to add:**
```
time:timer-started   →  focus: if no active focus session, suggest starting one via ui:notification
time:timer-stopped   →  tasks: recalculate task.actualMinutes from all entries  ← already wired ✅
time:entry-created   →  projects: update project.totalLoggedMinutes  ← MISSING
time:entry-created   →  journal: silently log entry in today's daily entry stats block
```

---

### 📔 Journal

**Current state:** Two-pane editor, mood picker (1–5 emoji), auto-save, type filter (daily/weekly/monthly/gratitude/reflection), tags, Tiptap JSON (not yet wired), `linkTask` action.

**Add:**
- **Wire Tiptap fully** — content is stored as raw string; Tiptap JSON unlocks rich `/slash` commands, `[[task links]]`, `[[note links]]`, inline checklists — **#1 priority**
- Habit tracker rows — embeddable checkbox rows in daily entries persisting to a `habits` table; emit `habit:checked` for streaks
- Auto-populated stats block — when creating a daily entry, auto-insert a read-only stats block showing: tasks completed, focus time, weekly mood avg
- Weekly review template — on weekly entry creation, auto-populate with last 7 days of completed tasks + focus sessions via IntegrationLayer
- Search within journal entries (full-text SQLite FTS5 index)
- Export to Markdown / PDF via Tauri file dialog

**Update:**
- Mood picker: upgrade from 1–5 emoji to a 2D valence/arousal grid for richer emotional tagging
- Sidebar entry list: show mood color band + word count + tags inline
- Replace type filter with a left-rail tag cloud + type tabs hybrid for faster navigation

**Remove:**
- Remove `sync:autosave` event listener dependency — replace with a local debounced `updateEntry()` call in the editor component directly

**Integration wires to add:**
```
focus:session-completed  →  journal: append focus session to today's stats block  ← partially wired ✅
task:completed           →  journal: append task to today's completions list  ← wired ✅
journal:entry-created (weekly)  →  tasks+focus: pull week's data into review template  ← MISSING
habit:checked            →  focus: if "exercise" habit checked, unlock extra break time
research:highlight-created  →  journal: offer "Add to journal" quick-action
```

---

### 🗒️ Notes

**Current state:** Basic CRUD, store, components — no `events.ts`, no `manifest.ts`, no `CONTEXT.md`.

**Add (infrastructure — immediate):**
- `events.ts` — emit `note:created`, `note:updated`, `note:deleted`, `note:link-to-task` (tasks module already listens for this)
- `manifest.ts` — register with the kernel like every other module
- `CONTEXT.md` — document the module

**Add (features):**
- Bidirectional `[[wikilinks]]` — `[[Note Title]]` syntax rendered in the Tiptap editor with a backlinks panel in the detail view
- Note types — meeting, daily, snippet, book-summary templates selectable on creation
- Pin to date — emit `note:pinned` when user pins a note (calendar already listens for this)
- Inline code blocks with syntax highlighting (Shiki or Prism)
- Note folders/collections

**Update:**
- Wire the shared `<RichEditor />` (already built in `src/shared/`) — replace any inline editor logic in `index.tsx`

**Integration wires to add:**
```
note:created         →  projects: if note has linkedProjectIds, update project.linkedNoteIds  ← wired ✅
note:link-to-task    →  tasks: append note to task.linkedNoteIds  ← wired ✅
research:linked-to-note  →  notes: append researchEntityId to note.linkedResearchIds  ← MISSING
note:pinned          →  calendar: create a date marker  ← calendar already listens ✅
journal:open-date    →  notes: auto-create a matching daily note  ← wired ✅
```

---

### 🔬 Research

**Current state:** 12 DB tables for sources, documents, chunks, highlights, annotations, threads, AI jobs. AI pipeline stubs exist (`ai/` folder reserved) but not implemented. Listens to `focus:session-started`, `task:deleted`, `note:deleted`.

**Add (infrastructure):**
- `CONTEXT.md` and `manifest.ts` — align with module convention
- `events.ts` — emit `research:item-saved`, `research:linked-to-note`, `research:linked-to-task`, `research:insight-created`, `research:entity-detected`, `research:ai-analysis-completed`, `research:semantic-results`, `research:summary-ready`

**Add (AI pipeline — `ai/` subfolder):**
- `ai/embedder.ts` — Tauri sidecar calling a local `nomic-embed-text` ONNX model; takes `ResearchChunk.text`, returns `Float32Array` embedding vector stored in `research_chunks.embedding_json`
- `ai/retriever.ts` — cosine similarity search over stored embeddings: `semanticSearch(query: string, topK: number): ResearchChunk[]`
- `ai/summarizer.ts` — Tauri sidecar or Ollama local LLM call: `summarizeDocument(documentId: ID): string`; stores result in `research_documents.summary`
- `ai/entity-extractor.ts` — NER pass over document text, creates `ResearchEntity` rows (people, orgs, concepts, dates); emit `research:entity-detected` per entity

**Add (features):**
- "Ask your research" panel — thread-based Q&A chat that does RAG (embed query → retrieve top-k chunks → send to LLM with context → stream answer); each thread maps to a `ResearchThread` row
- Quick-import from URL — URL bar that fetches page content, extracts text, chunks it, stores in `research_documents` automatically
- Highlight extraction — save highlighted text snippets linked back to source URL
- Reading list with read/unread/archived states
- Research sidebar panel — when a task or note is open, show contextually relevant research highlights in a slide-in panel (triggered by `task:open` / `note:open`)

**Integration wires to add:**
```
task:open  →  research: semanticSearch(task.title, 5), emit ui:panel-open with results  ← MISSING
research:linked-to-task   →  tasks: update task.linkedResearchIds  ← MISSING
research:linked-to-note   →  notes: update note.linkedResearchIds  ← MISSING
research:insight-created  →  notes: offer "Create note from insight" via ui:notification
research:ai-analysis-completed  →  projects: update project knowledge base
focus:session-started     →  research: surface related chunks for the task  ← already listens ✅
```

---

### 🗓️ Planner

**Current state:** Daily planner with `store.ts`, `hooks/`, `components/`.

**Add:**
- Hour-grid drag UI — replace list-based plan with a 24-hour vertical grid (00:00–23:00, 30-min slots); drag tasks from a sidebar panel onto slots
- "Plan My Day" button — calls `findFreeSlots()` from Calendar store + reads today's overdue + priority tasks → suggests optimal schedule → emits `task:schedule-in-planner` for each
- Weekly overview panel — all 7 days' blocks in a compact grid; clicking any block navigates to that day
- Carry-over: unfinished blocks from yesterday auto-carried over on `day:started`

**Update:**
- Planner store: add `plannedItems` that can hold both tasks AND calendar events in a unified timeline
- Add drag-and-drop reordering using `@dnd-kit/sortable`

**Integration wires to add:**
```
planner:block-linked-task  →  calendar: mirror block as calendar event  ← MISSING
planner:block-linked-task  →  tasks: update task.linkedPlannerBlockIds  ← MISSING
task:schedule-in-planner   →  planner: createBlock with task metadata  ← MISSING
focus:session-completed    →  planner: mark linked block as done  ← MISSING
calendar:event-updated     →  planner: if event was planner-sourced, update block time
```

---

### 🗃️ Database

**Current state:** Full Notion-style engine with Grid + Kanban views, 7 tables, filters, sorts, relation columns, and a RowDetail panel.

**Add:**
- `relation` column fully wired — UI picker to link rows to Tasks, Projects, or Notes by ID; emit `database:row:created` so IntegrationLayer creates the reverse link
- Formula column type — simple expressions like `{Done} / {Total} * 100` rendered as read-only computed cells
- Calendar view — plot rows with date columns on a calendar; reuse a shared `<MiniCalendarGrid />` from `src/shared/ui/`
- Gallery view — image/card gallery for rows with a `url` or attached image field
- Row templates — save a row as a template; new rows pre-fill from it
- Full-text search within a table — `Cmd+F` filters rows by any cell value; emit `search:index-invalidated` on every row mutation

**Integration wires to add:**
```ts
// database:row:created → tasks: if table has taskId relation, link the row
bus.on("database:row:created", ({ databaseId, rowId }) => {
  // look up relation cells, find any taskId links
  // emit task:updated with linkedDatabaseRowIds
});

// task:completed → database: update linked row's status cell to "Done"
bus.on("task:completed", ({ taskId }) => {
  const linkedRows = useDatabaseStore.getState().findRowsByRelation("taskId", taskId);
  linkedRows.forEach(row => {
    void useDatabaseStore.getState().updateCell(row.id, "status", "Done");
  });
});

// project:created → database: auto-create a "Project Tracker" table
bus.on("project:created", ({ project }) => {
  if (!project.autoDatabase) return;
  void useDatabaseStore.getState().createTable({
    name: `${project.name} — Tracker`,
    linkedProjectId: project.id,
  });
});
```

---

### ⚙️ Settings

**Current state:** Placeholder route (`ModulePlaceholder`).

**Implement `src/modules/settings/index.tsx` with:**
- Theme: light / dark / system (bus already has `ui:theme-changed`)
- Keyboard shortcuts registry: read all module `manifest.ts` files and show a searchable list
- Notification preferences: toggle per-event-type toasts (e.g. disable `task:created` toast)
- Focus settings: default Pomodoro durations, daily focus goal, ambient sound choice
- Data management: SQLite export/import/backup via Tauri file dialog

---

## Cross-Module Integration — Full Event Map

| Event Emitted | From | Consumed By | Effect | Status |
|---|---|---|---|---|
| `task:completed` | Tasks | Journal | Append to today's completions | ✅ Wired |
| `task:completed` | Tasks | Projects | Check milestone completion | ✅ Wired |
| `task:completed` | Tasks | Calendar | Mark deadline event as done | ✅ Wired |
| `task:completed` | Tasks | Focus | Stop active session on this task | ❌ Missing |
| `task:completed` | Tasks | Database | Update linked row status to "Done" | ❌ Missing |
| `task:schedule-in-planner` | Tasks/any | Planner | Create time block | ❌ Missing |
| `task:open` | Tasks | Research | Semantic search, open context panel | ❌ Missing |
| `task:created` | Tasks | Calendar | Create soft deadline event | ❌ Missing |
| `task:overdue` | Kernel cron | Shell | Overdue warning notification | ❌ Missing |
| `focus:session-started` | Focus | Tasks | Set task status to "in-progress" | ❌ Missing |
| `focus:session-started` | Focus | Calendar | Create soft "busy" block | ❌ Missing |
| `focus:session-started` | Focus | Research | Surface related chunks | ✅ Listens |
| `focus:session-completed` | Focus | Time-tracking | Create TimeEntry | ✅ Wired |
| `focus:session-completed` | Focus | Tasks | Update actualMinutes | ✅ Wired |
| `focus:session-completed` | Focus | Journal | Append to daily stats block | ✅ Partial |
| `focus:session-completed` | Focus | Planner | Mark linked block as done | ❌ Missing |
| `focus:session-completed` | Focus | Projects | Update project.totalFocusMinutes | ❌ Missing |
| `planner:block-linked-task` | Planner | Calendar | Mirror block as calendar event | ❌ Missing |
| `planner:block-linked-task` | Planner | Tasks | Update task.linkedPlannerBlockIds | ❌ Missing |
| `calendar:event-updated` | Calendar | Tasks | Sync task.dueDate | ❌ Missing |
| `calendar:event-updated` | Calendar | Planner | Update planner block time | ❌ Missing |
| `calendar:event-starting` | Kernel cron | Shell | Prompt focus session start | ❌ Missing |
| `research:linked-to-task` | Research | Tasks | Update task.linkedResearchIds | ❌ Missing |
| `research:linked-to-note` | Research | Notes | Update note.linkedResearchIds | ❌ Missing |
| `research:insight-created` | Research | Notes | Offer "Create note from insight" | ❌ Missing |
| `research:ai-analysis-completed` | Research | Projects | Update project knowledge base | ❌ Missing |
| `journal:entry-created (weekly)` | Journal | Tasks + Focus | Auto-populate weekly review | ❌ Missing |
| `journal:entry-created` | Journal | — | Auto-create if type=daily on day:started | ❌ Missing |
| `habit:checked` | Journal | Focus | Adjust break time reward | ❌ Missing |
| `note:created` | Notes | Projects | Update project.linkedNoteIds | ✅ Wired |
| `note:link-to-task` | Notes | Tasks | Append note to task.linkedNoteIds | ✅ Wired |
| `note:pinned` | Notes | Calendar | Create date marker | ✅ Listens |
| `note:open` | Notes | Research | Surface related highlights | ❌ Missing |
| `project:selected` | Projects | Tasks/Planner/Time | Filter all views to project scope | ❌ Missing |
| `project:created` | Projects | Database | Auto-create Project Tracker table | ❌ Missing |
| `project:created` | Projects | Calendar | Create standup event if in template | ❌ Missing |
| `project:updated (completed)` | Projects | Tasks | Archive incomplete tasks | ❌ Missing |
| `project:updated (completed)` | Projects | Journal | Create wrap-up reflection entry | ❌ Missing |
| `time:entry-created` | Time | Projects | Update project.totalLoggedMinutes | ❌ Missing |
| `time:entry-created` | Time | Journal | Log entry in daily stats block | ❌ Missing |
| `time:timer-started` | Time | Focus | Suggest starting focus session | ❌ Missing |
| `database:row:created` | Database | Tasks | Link row via relation column | ❌ Missing |
| `day:started` | Kernel cron | Journal/Planner | Create daily entry, carry-over blocks | ❌ Missing |
| `search:result-selected` | Shell | All modules | Navigate to correct module | ✅ Wired |
| `ui:notification` | Any | Shell | Route all toasts through one handler | ❌ Missing (standardise) |

---

## Missing IntegrationLayer Handlers — Implementation Reference

### 1. Planner ↔ Tasks

```ts
// task:schedule-in-planner (event exists in bus map, no consumer)
unsubs.push(bus.on("task:schedule-in-planner", ({ task, date, startTime }) => {
  void usePlannerStore.getState().createBlock({
    taskId: task.id,
    title: task.title,
    date: date ?? new Date().toISOString().slice(0, 10),
    startTime: startTime ?? "09:00",
    durationMinutes: task.estimateMinutes ?? 30,
  });
  notify({ type: "info", message: `"${task.title}" added to Planner`, durationMs: 2000 });
}));

// planner:block-linked-task → update task's linkedPlannerBlockIds
unsubs.push(bus.on("planner:block-linked-task", ({ blockId, taskId }) => {
  const task = useTaskStore.getState().getTaskById(taskId);
  if (!task) return;
  void useTaskStore.getState().updateTask(taskId, {
    linkedPlannerBlockIds: [...(task.linkedPlannerBlockIds ?? []), blockId],
  });
}));
```

### 2. Planner ↔ Calendar

```ts
unsubs.push(bus.on("planner:block-linked-task", ({ blockId, taskId, date }) => {
  const block = usePlannerStore.getState().getBlockById(blockId);
  if (!block || !block.startTime) return;
  void useCalendarStore.getState().createEvent({
    title: block.title,
    startAt: `${date}T${block.startTime}`,
    endAt:   `${date}T${block.endTime}`,
    linkedTaskIds: [taskId],
    source: "planner",
  });
}));
```

### 3. Focus → Planner

```ts
unsubs.push(bus.on("focus:session-completed", ({ session }) => {
  if (!session.taskId) return;
  const block = usePlannerStore.getState().blocks.find(
    b => b.taskId === session.taskId && b.date === session.startedAt?.slice(0, 10)
  );
  if (block) void usePlannerStore.getState().completeBlock(block.id);
}));
```

### 4. Research ↔ Notes

```ts
// research:linked-to-note (event exists in bus map, no handler)
unsubs.push(bus.on("research:linked-to-note", ({ noteId, researchEntityId }) => {
  const note = useNoteStore.getState().notes.find(n => n.id === noteId);
  if (!note) return;
  void useNoteStore.getState().updateNote(noteId, {
    linkedResearchIds: [...(note.linkedResearchIds ?? []), researchEntityId],
  });
}));
```

### 5. Research ↔ Tasks

```ts
unsubs.push(bus.on("research:linked-to-task", ({ taskId, researchEntityId }) => {
  const task = useTaskStore.getState().getTaskById(taskId);
  if (!task) return;
  void useTaskStore.getState().updateTask(taskId, {
    linkedResearchIds: [...(task.linkedResearchIds ?? []), researchEntityId],
  });
}));
```

### 6. Journal Weekly Review ↔ Tasks + Focus

```ts
unsubs.push(bus.on("journal:entry-created", ({ entry }) => {
  if (entry.type !== "weekly") return;
  const weekStart = entry.date;
  const completedThisWeek = useTaskStore.getState().tasks.filter(t =>
    t.completedAt && t.completedAt >= weekStart
  );
  completedThisWeek.forEach(t => void useJournalStore.getState().linkTask(entry.id, t.id));

  const focusHours = useFocusStore.getState().sessions
    .filter(s => s.type === "focus" && s.startedAt >= weekStart)
    .reduce((sum, s) => sum + (s.actualMinutes ?? 0), 0) / 60;
  notify({
    type: "info",
    message: `Weekly review populated — ${focusHours.toFixed(1)}h focused, ${completedThisWeek.length} tasks done`,
    durationMs: 5000,
  });
}));
```

### 7. Standardise ui:notification

```ts
// Add one handler in IntegrationLayer; replace all direct notify() calls in module stores
unsubs.push(bus.on("ui:notification", ({ type, message, durationMs }) => {
  notify({ type, message, durationMs });
}));
```

### 8. task:open → Research Semantic Search

```ts
bus.on("task:open", ({ taskId }) => {
  const task = useTaskStore.getState().getTaskById(taskId);
  if (!task) return;
  void useResearchStore.getState().semanticSearch(task.title, 5)
    .then(chunks => {
      if (chunks.length > 0) bus.emit("ui:panel-open", {
        panelId: "research-context",
        props: { chunks, taskId }
      });
    });
});
```

---

## Kernel Additions

### `kernel/cron.ts` — Daily Background Jobs

```ts
// fires at app startup and every 24h
bus.emit("day:started", { date: todayISO });
// fires 30min before any calendar event
bus.emit("calendar:event-starting", { eventId, minutesBefore: 30 });
// fires if a task's dueDate is today
bus.emit("task:due-today", { taskId });
// fires if a task's dueDate has passed
bus.emit("task:overdue", { taskId, daysPast: n });
```

**IntegrationLayer consumers for cron events:**

```ts
bus.on("day:started", () => {
  // Journal: auto-create today's daily entry if not exists
  void useJournalStore.getState().getOrCreateDaily(todayISO);
  // Planner: carry-over unfinished blocks from yesterday
  void usePlannerStore.getState().carryOverIncomplete();
  bus.emit("ui:notification", { type: "info", message: "Good morning! Your day is ready.", durationMs: 4000 });
});

bus.on("task:overdue", ({ taskId, daysPast }) => {
  const task = useTaskStore.getState().getTaskById(taskId);
  if (task) bus.emit("ui:notification", {
    type: "warning",
    message: `"${task.title}" is ${daysPast}d overdue`,
    durationMs: 6000,
  });
});
```

### `kernel/shortcut-registry.ts`

```ts
// Read all module manifest.ts files at boot and register shortcuts globally
import { manifests } from "@/modules/*/manifest.ts"; // via glob import
manifests.forEach(m => m.shortcuts?.forEach(s =>
  registerShortcut(s.keys, () => bus.emit(s.busEvent, s.payload))
));
```

### `kernel/workspace/` — Split Panel Enhancement

- `workspace:split-enabled` event exists in bus; Shell already maps `panels` array
- Add a split icon button in `TabBar.tsx` that emits `workspace:split-enabled`
- Shell adds a second panel entry with a default route, enabling side-by-side views (e.g. Tasks + Notes)

---

## New Event Bus Additions

Add to `ButlerEventMap` in `src/kernel/event-bus/index.ts`:

```ts
// Kernel cron events
"day:started":              { date: string };
"task:due-today":           { taskId: ID };
"task:overdue":             { taskId: ID; daysPast: number };
"calendar:event-starting":  { eventId: ID; minutesBefore: number };

// Habit events (Journal)
"habit:checked":            { habitId: ID; date: string; value: boolean };
"habit:streak-updated":     { habitId: ID; streak: number };

// Focus flow mode
"focus:flow-started":       { taskId?: ID };
"focus:flow-ended":         { durationMinutes: number; taskId?: ID };

// Research AI
"research:semantic-results": { query: string; chunks: ResearchChunk[] };
"research:summary-ready":    { documentId: ID; summary: string };

// Settings
"settings:changed":         { key: string; value: unknown };
"shortcuts:registered":     { moduleId: string; count: number };

// Global today panel
"today:panel-open":         void;
"today:panel-close":        void;

// UI
"ui:panel-open":            { panelId: string; props?: Record<string, unknown> };
```

---

## Shell-Level UX Improvements

### Focus Mini-Player in Sidebar

Add `<FocusMiniPlayer />` to `shell/components/`:

```tsx
// In Sidebar.tsx — below nav items
<FocusMiniPlayer />
// Shows "🍅 18:32" when active; subscribes to focus:tick, focus:session-started, focus:session-completed
// Clicking navigates to /focus via bus.emit("navigate:to", { path: "/focus" })
```

### Global `<TodaySummary />` Panel

Slide-in panel accessible from the sidebar (clock icon) showing:

- Today's overdue tasks (from `useTaskStore`)
- Active focus session or today's total focus time (from `useFocusStore`)
- Today's calendar events (from `useCalendarStore`)
- Today's planner blocks (from `usePlannerStore`)
- Mood from today's journal entry (from `useJournalStore`)

### Live Sidebar Badges

Subscribe to `task:completed` / `task:created` in the sidebar using `useBusEvent` to show a live overdue count badge — no direct store imports in shell.

### Global Command Palette

`command-palette:open` is in the bus map; the actual `<CommandPalette />` component must be in `Shell.tsx`. It should query all stores via `search:open` event.

### UI/UX Global Upgrades

- Dark/light/system theme toggle stored in workspace settings
- Focus mode shell: hides sidebar, shows only the active module full-screen
- Keyboard shortcuts registry powered by all module `manifest.ts` declarations

---

## `src/shared/` — New Components to Build

| Component | Used By | Purpose |
|---|---|---|
| `<RichEditor />` | Notes, Journal | Shared Tiptap instance — already exists in `src/shared/`, just needs wiring |
| `<TaskPicker />` | Focus, Planner, Time-tracking, Calendar | Searchable task selector with project context |
| `<ProjectPicker />` | Focus, Time-tracking, Notes, Journal | Project dropdown with colour dot |
| `<MiniCalendarGrid />` | Database (calendar view), Journal sidebar | Reusable month grid |
| `<DurationInput />` | Tasks (estimate), Focus (timer), Time-tracking | Parses `1h 30m`, `90m`, `1:30` into minutes |
| `<TagInput />` | Notes, Journal, Research | Token-based tag input with autocomplete |
| `<EntityBadge type="task\|note\|project" id />` | All modules | Clickable cross-module reference pill; emits `task:open`, `note:open`, `project:open` on click |

> **`<EntityBadge />`** is the key UX enabler — renders as a small pill like `📋 Fix login bug` and makes every module's detail views feel interconnected without any direct store imports.

---

## Priority Order

| Priority | Item |
|---|---|
| 🔴 Immediate | Notes `events.ts` + `manifest.ts` — module is an island |
| 🔴 Immediate | Wire Tiptap in Journal (`<RichEditor />` already exists in shared) |
| 🔴 Immediate | Standardise `ui:notification` through bus (remove `notify()` from module stores) |
| 🟠 High | `task:schedule-in-planner` → Planner handler |
| 🟠 High | `planner:block-linked-task` → Calendar + Tasks handlers |
| 🟠 High | `focus:session-completed` → Planner mark-done handler |
| 🟠 High | `research:linked-to-task/note` handlers |
| 🟡 Medium | `kernel/cron.ts` daily background jobs |
| 🟡 Medium | `journal:entry-created (weekly)` → weekly review auto-population |
| 🟡 Medium | `<EntityBadge />` shared component |
| 🟡 Medium | Focus mini-player in sidebar |
| 🟢 Later | Research AI pipeline (`embedder`, `retriever`, `summarizer`, `entity-extractor`) |
| 🟢 Later | Database formula + calendar + gallery views |
| 🟢 Later | Settings module implementation |
| 🟢 Later | `<TodaySummary />` global panel |
| 🟢 Later | Split panel UX (workspace) |
