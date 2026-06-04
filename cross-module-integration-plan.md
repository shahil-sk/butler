# Cross-Module Integration Plan
## 6 Phases for Flawless, Seamless User Experience

> This plan layer/s on top of the module development phases. Each integration phase runs *after* the relevant modules are individually stable. The goal is not to add features — it is to dissolve the borders between modules so the app feels like one coherent system, not a collection of tools.

---

## Guiding Principle

**The user should never feel like they're switching apps.**

Navigation should feel like moving within one space. Every action in one module should silently propagate to every relevant module. Data is captured once and reflected everywhere. The system anticipates — it connects things the user hasn't had to manually connect.

---

## Integration Phase 1 — The Unified Time Layer
**Runs after:** Master Plan Phase 2 is stable (Tasks, Planner, Calendar, Focus, Time Tracking)

**Theme:** Make time feel like one continuous surface. The user should be able to think about their day in any of these modules and trust that the others stay in sync automatically.

---

### 1.1 Task ↔ Calendar: Bidirectional Time Representation

**Wire these connections:**
- Tasks with a due date appear on the calendar automatically — no manual step, no sync delay.
- A calendar event can be converted to a task (right-click → "Convert to Task") and inherits the event's time range as a scheduled block.
- Dragging a task card on the calendar updates its due date in the task system in real time.
- Completing a task strikes it through on the calendar (configurable: hide entirely or show as struck).
- Tasks that become overdue are highlighted on the calendar with a distinct colour, not silently ignored.

**UX contract:** The calendar is a time-based lens over the task system. It surfaces tasks — it doesn't duplicate them.

---

### 1.2 Planner ↔ Tasks: Drag-to-Schedule as the Primary Capture Loop

**Wire these connections:**
- The Planner sidebar always surfaces today's unscheduled tasks and overdue tasks from the task system.
- Dragging a task into a time block writes `scheduledAt` and `scheduledDuration` back to the task record — the task visually transitions from "unscheduled" to "on the plan."
- Resizing or moving a block in the Planner updates the task's scheduled time live — no save button.
- Completing a task from the Planner view marks it done in the task system. No navigation required.
- Unfinished blocks at day's end surface an "overflow" prompt: reschedule to tomorrow, push to inbox, or mark cancelled.

**UX contract:** Planning and tasking are one workflow presented in two views. The Planner is not a separate tool — it is the scheduling view of the task system.

---

### 1.3 Focus ↔ Planner: Starting a Block Starts a Session

**Wire these connections:**
- Each time block has a "Start Focus" action. Pressing it activates a Pomodoro or deep work session and links the session to the block and its task.
- The active focus session is always visible in the status bar — task name, timer, and a pause/stop control — regardless of which module the user is currently viewing.
- Ending a session marks the time block as done and logs actual duration (if different from planned).
- If focus is running and the user navigates away, a non-intrusive indicator persists. The session is not interrupted.

**UX contract:** Focus sessions are not separate from the plan. They execute the plan. The timer belongs to the block.

---

### 1.4 Focus ↔ Time Tracking: Automatic Logging with Zero Friction

**Wire these connections:**
- Every focus session is automatically written to the time log as a time entry, tagged with the linked task and project.
- No manual entry required. The user can review and correct after the fact, but capture is automatic.
- Idle detection: if the session timer is running but the computer is idle for N minutes, the user is prompted — "Were you working? Adjust the time." The log is not silently inflated.
- The Time Tracking weekly report includes a "Focus sessions" breakdown — how many, average length, which tasks.

**UX contract:** Time tracking is not something the user does. It is something the system records when the user works.

---

### 1.5 Time Tracking ↔ Planner: Planned vs. Actual Feedback Loop

**Wire these connections:**
- At day's end, the Planner view shows each block with two values: planned duration and actual logged time.
- Over- and under-runs are colour-coded (not alarmingly — subtle) so the user can develop better estimation.
- A weekly view shows the cumulative planned vs. actual comparison, helping the user calibrate their planning habits.

**UX contract:** The Planner is not just for planning — it is a retrospective surface too. Looking back at yesterday should take one click.

---

### Phase 1 Acceptance Criteria

Before moving to Phase 2, every one of these must work without friction:

1. Create a task with a due date → it appears on the calendar immediately.
2. Schedule a task in the Planner → its `scheduledAt` is updated in the task record.
3. Start a focus session from a time block → the timer appears in the status bar.
4. End the session → a time log entry is created automatically.
5. Complete a task from any surface → it's marked done everywhere, with no stale state visible anywhere.

---

---

## Integration Phase 2 — The Living Knowledge Graph
**Runs after:** Master Plan Phase 3 is stable (Notes, Journal, Habits, Search)

**Theme:** Notes, Journal, and Tasks should feel like one interconnected knowledge base. Creating a note from a task, capturing a task from a note, or reviewing the day should never require copy-pasting or manual linking. The knowledge graph grows as the user works.

---

### 2.1 Notes ↔ Tasks: Bidirectional Embedded Context

**Wire these connections:**
- Any task can have notes attached. Opening the task shows the note inline, editable, without navigating to the Notes module.
- Inside any note, typing `/task` brings up a task creation block. The created task is linked to the note and appears in the task inbox.
- Typing `[[` in a note surfaces a search of existing tasks, notes, projects, and goals — not just other notes. The link is live: clicking it opens the source entity in its native view.
- AI can scan a note and extract action items as tasks with one click: "Extract tasks from this note" — no copy-paste, no reformatting.
- When a note is linked to a task, the note's title appears on the task card as a context badge.

**UX contract:** Notes and Tasks are not in separate buckets. A note is context for work. A task is a commitment inside thinking.

---

### 2.2 Journal ↔ Tasks: Automatic Evening Review Population

**Wire these connections:**
- The evening review prompt in the Journal auto-populates with the day's completed tasks, grouped by project.
- Unfinished tasks from today are surfaced in the journal as a section: "Not completed — move, delegate, or let go."
- The user never has to switch to the task view to write their review. The data is already there.
- Mood entries and task completion rate are tracked side by side — the journal begins to show the correlation between busyness and wellbeing without the user explicitly logging it.

**UX contract:** The journal is not a separate writing space. It is the reflective layer of the entire system, auto-loaded with the day's data.

---

### 2.3 Journal ↔ Habits: Streak Data Inside Reflection

**Wire these connections:**
- The journal's weekly review template automatically includes a habit completion table for the week — which habits were kept, which slipped.
- Writing a journal entry for a day where a habit was missed does not require navigating to the Habits module to understand why — the pattern is visible inline.
- The user can check off habits directly from the morning journal prompt, without opening the Habits module.

**UX contract:** The morning and evening rituals (journal + habits) happen in one place. The user should not be bounced between modules for their daily check-in.

---

### 2.4 Notes ↔ Journal: Daily Note is the Journal Entry

**Wire these connections:**
- The Daily Note in the Notes module and the Daily Journal Entry are the same document — same record, two views.
- Opening the journal for a date opens that day's note with journal-specific prompts layered on top.
- Opening the daily note from the Notes module shows the full content including journal prompts.
- There is no duplication, no sync, no import/export. They are one entity with two display modes.

**UX contract:** The user never wonders "should I write this in my journal or my notes?" They write once. The view adapts.

---

### 2.5 Search: One Index, Zero Module Boundaries

**Wire these connections:**
- The global search (Cmd+K or the search bar) returns results from every module — tasks, notes, journal entries, projects, goals, habits, calendar events — in a single ranked list.
- Results show their type (with a small icon) and open directly in the native module view when clicked.
- Search shortcuts work: `@task`, `@note`, `@project` filter by type; `#tag` filters by tag; `/command` surfaces actions.
- Recent searches, recently opened items, and pinned items populate the search panel before the user types anything.
- The search index is updated incrementally in a background thread — there is no "indexing..." state visible to the user during normal use.

**UX contract:** Search is the universal entry point. The user should never need to know which module something lives in — they search and it appears.

---

### Phase 2 Acceptance Criteria

1. Create a task from inside a note → the task appears in the inbox with the note linked.
2. Open the evening journal → it already shows today's completed tasks with no user action.
3. Check off a habit from the morning journal prompt → it registers in the Habits module.
4. Search for any entity across all modules → results appear within 100ms with correct type labels.
5. Open the daily note and the journal for the same day → they show the same document.

---

---

## Integration Phase 3 — The Goal and Project Hierarchy
**Runs after:** Master Plan Phase 4 is stable (Projects, Goals, Documents, Database)

**Theme:** Goals, Projects, Tasks, and Habits should form a coherent hierarchy where progress flows upward automatically. The user defines direction (goals), plans execution (projects), does the work (tasks), and builds supporting behaviours (habits). The system tracks the cascade with no manual updating.

---

### 3.1 Goals ↔ Projects ↔ Tasks: The Cascade

**Wire these connections:**
- Every task can be tagged to a goal, directly or through a project. The goal's progress metric automatically updates as tasks complete.
- Every project is linked to one or more goals. The project's completion contributes to the goal's key results.
- The Goals dashboard shows, for each goal: active projects, aligned tasks due this week, and a progress ring — all live, never manually updated.
- Creating a project prompts: "Which goal does this serve?" — not required, but surfaced. This keeps the goal-work alignment honest.
- A task with no project and no goal can still exist (pure inbox capture). But the system offers a nudge: "This task isn't aligned with any goal — is that intentional?"

**UX contract:** The hierarchy is Goals → Projects → Tasks. Moving up the hierarchy always shows aggregate progress. Moving down always shows the concrete work to be done.

---

### 3.2 Goals ↔ Habits: Consistency as Progress

**Wire these connections:**
- Each goal can list associated habits: behaviours the user wants to sustain as part of achieving the goal.
- The goal dashboard shows habit consistency as a health metric: "You've kept your 'deep work daily' habit 18/21 days this quarter."
- Slipping a habit linked to a goal triggers a gentle nudge in the next journal or morning review: "Your 'Read 30 min/day' habit has slipped 4 days — still aligned with your Learning goal?"
- Habits are not tasks — they don't contribute to the goal's completion percentage, but they are shown as a sustaining signal.

**UX contract:** Goals are not just a checklist of projects. They are a complete picture of direction, execution, and consistency.

---

### 3.3 Projects ↔ Calendar: Milestones as First-Class Events

**Wire these connections:**
- Project milestones are automatically added to the calendar when created — not manually, not via export.
- Moving a milestone on the calendar updates the project's milestone date. Moving it in the project updates the calendar.
- The calendar has a "Projects" layer toggle: off by default (keep the calendar clean), on when the user wants to see deadline pressure across all active projects.
- Upcoming milestones within 7 days surface in the daily morning review with a single line: "Milestone due in 3 days: MVP launch → Project: v1.0"

**UX contract:** The project plan and the calendar are the same truth about time. Milestones do not need to be manually entered in two places.

---

### Phase 3 Acceptance Criteria

1. Complete a task tagged to a goal → the goal's progress ring updates immediately.
2. Create a project milestone → it appears on the calendar without any extra step.
3. The Goals dashboard shows, for each goal: aligned tasks, linked projects, and habit consistency with no stale data.
4. Slip a habit linked to a goal → the relevant nudge surfaces in the next journal or morning review.
5. Toggle the "Projects" calendar layer → milestones from all active projects appear and are bidirectionally editable.

---

---

## Integration Phase 4 — The Project Workspace and Structured Data
**Runs after:** Phase 3 is stable (Goal and Project Hierarchy)

**Theme:** A project should be a complete, self-contained workspace — not just a task list. Documents, structured data, and knowledge graph notes should all live alongside execution, fully interconnected, with no silos between writing, data, and work.

---

### 4.1 Documents ↔ Projects: Structured Knowledge Alongside Execution

**Wire these connections:**
- Each project has a Documents section. Meeting notes created during a project are auto-linked to the project and appear here.
- When opening a project, the user sees: Tasks (Kanban), Notes (graph), Documents (structured writing), Database (project data), Files (attachments) — all scoped to the project, all in one workspace.
- A document inside a project can embed a live task list: `/tasks` block shows the project's open tasks, filterable, and completable without leaving the document.
- Documents can cross-link to notes from the broader knowledge graph — the project workspace is not siloed from personal knowledge.

**UX contract:** A project is a workspace, not just a task list. All work artifacts related to a project — writing, data, tasks, files — live together.

---

### 4.2 Database ↔ Notes ↔ Projects: Structured Data Lives Everywhere

**Wire these connections:**
- Any database view can be embedded inline in a note or document using a `/database` block — the table is live and filterable, not a static screenshot.
- A project can contain its own database (e.g., a feature backlog, a client list, a content calendar) accessible from the project workspace.
- Database records can be linked to tasks: a feature spec row in a database links to the implementation task. Completing the task updates the database record's status.

**UX contract:** Structured data is not locked inside a "Databases" module. It lives wherever it's needed.

---

### Phase 4 Acceptance Criteria

1. Open a project → all tasks, notes, documents, and files are visible in one workspace without navigating away.
2. Embed a database view in a note → the table is live and shows current data.
3. Complete a task linked to a database record → the record's status updates automatically.
4. Create meeting notes inside a project → they appear in the project's Documents section without manual linking.
5. Embed a `/tasks` block in a project document → open tasks are completable without leaving the document.

---

---

## Integration Phase 5 — External Knowledge and Media Integration
**Runs after:** Master Plan Phase 5 is stable (PDF Viewer, File Attachments)

**Theme:** External content — PDFs, files, annotated text — should flow into the system's knowledge graph as naturally as anything the user types directly. Reading something should automatically produce connected knowledge, not isolated files.

---

### 5.1 PDF ↔ Notes: Annotations as Living Knowledge

**Wire these connections:**
- Highlighting text in a PDF creates a note block with the quote, the source citation (filename + page number), and a link back to the exact page in the PDF.
- The user can add a personal note to any highlight inline: "This challenges what I thought about X."
- All highlights from a PDF are collectable into a single "Highlights note" for that document — auto-generated, titled by the PDF's filename, and added to the notes graph.
- Opening the highlights note shows each highlight with a "Jump to PDF" link that opens the PDF at the correct page.
- The PDF's extracted text is indexed for global search — finding a phrase you remember reading finds the PDF and the exact passage.

**UX contract:** PDFs are not read-only file viewers. They are a reading surface that deposits knowledge directly into the graph.

---

### 5.2 PDF ↔ Tasks: Reading as Actionable Work

**Wire these connections:**
- Tasks can link directly to a PDF file. Clicking the task opens the PDF at the last read position.
- Creating a "Read and annotate" task template pre-links to a PDF and sets a time estimate.
- Completing annotations on a PDF can automatically update the linked task's progress (configurable).

**UX contract:** Reading a PDF is a task. The system treats it as one.

---

### 5.3 Files ↔ All Modules: Attachments Without Silos

**Wire these connections:**
- Any file can be attached to a task, a note, a project, or a journal entry from a unified drag-drop interface.
- Files attached to a project appear in the project workspace's Files section, but can also be searched globally.
- Supported file types (images, PDFs, text files) show previews inline in notes and documents — not just as download links.
- Renaming or deleting a file updates all links to it across the system — no broken references.

**UX contract:** Files live in the context of the work they belong to. The user never navigates to a file manager to find something.

---

### 5.4 Search ↔ PDF and Files: Full External Content Indexing

**Wire these connections:**
- PDF text is indexed in the FTS5 search index. Searching for a phrase returns both notes that mention it and PDFs that contain it.
- File metadata (filename, type, attached-to context) is searchable.
- Search results from PDFs show the matched passage in context (2–3 lines) with a "Open PDF at this page" action.

**UX contract:** Once a document enters the system, it is findable. The user never has to remember which file something was in.

---

### Phase 5 Acceptance Criteria

1. Highlight text in a PDF → a note block is created with the quote and source citation.
2. Search for a phrase that appears in a PDF → the PDF appears in search results with a matched passage preview.
3. Attach a file to a project → it appears in the project workspace and in global search.
4. Open a task linked to a PDF → the PDF opens at the correct position.
5. Collect all highlights from a PDF into a note → the note is auto-titled, all highlights linked back to pages.

---

---

## Integration Phase 6 — The Intelligent Layer
**Runs after:** Master Plan Phase 6 is stable (AI Assistant, local model configured)

**Theme:** AI should feel like a background intelligence that already knows your system — not a chatbot you have to explain yourself to. Every module should benefit from AI without the user having to navigate to an AI panel. AI augments; it never replaces user agency.

---

### 6.1 AI ↔ Tasks: Intelligent Capture and Scheduling

**Wire these connections:**
- Natural language task creation everywhere: "tomorrow: review Q3 report before 2pm" → creates a task with due date, time, and a priority inferred from context. No form required.
- AI reviews the task inbox daily (in background) and can suggest: "These 3 tasks have no due date or project — would you like me to schedule them based on your open time blocks?"
- Task breakdown: selecting any task and pressing "Break down" sends it to AI, which returns 3–7 subtasks as a proposal. The user accepts, edits, or dismisses — never automatic.
- Conflict detection: if the day's scheduled tasks exceed realistic working hours, AI flags it in the morning review: "You've planned 9.5 hours of work in a 7-hour day. Want me to suggest what to reschedule?"

**UX contract:** AI makes capture faster and scheduling smarter. It never rearranges the user's plan without explicit approval.

---

### 6.2 AI ↔ Notes: Connection Discovery and Summarisation

**Wire these connections:**
- When a note is saved, AI runs a background similarity check and surfaces: "This note might be related to: [Note title], [Note title]." The user clicks to create the link or dismisses.
- "Summarise this note" produces a 3–5 sentence summary at the top of the note, collapsible, tagged as AI-generated. It stays in sync when the note is substantially edited.
- "Extract tasks" scans the note for action language and proposes tasks in a review pane — the user confirms each one.
- Meeting notes: pasting a meeting transcript and pressing "Process meeting" produces: summary, key decisions, action items (as tasks), and open questions — all in the right places.

**UX contract:** AI surfaces connections the user would miss. It never silently modifies notes — every AI-generated element is labelled and dismissible.

---

### 6.3 AI ↔ Daily Planner: Smart Day Design

**Wire these connections:**
- "Plan my day" button in the morning review calls AI with: today's unscheduled tasks, their priorities, energy-level data from preferences, and calendar events already blocking time. AI proposes a time-blocked day.
- The proposal is presented as a drag-and-drop-ready plan — the user accepts the full plan, edits blocks individually, or dismisses.
- AI learns from corrections: if the user consistently moves deep work to mornings and admin to afternoons, future proposals reflect that.
- When the user adds a new urgent task mid-day, AI can suggest: "This may push your 3pm review. Want to reschedule it?"

**UX contract:** AI proposes plans; the user approves them. The user is never surprised by changes to their schedule.

---

### 6.4 AI ↔ Journal: Personalised Reflection Prompts

**Wire these connections:**
- The evening journal prompt is not static. AI generates it each day based on: what the user accomplished, what they deferred, current goal progress, and mood trends.
- A week of consecutive high-task-completion days → AI notes it positively. A week of deferred tasks + low mood → AI asks: "You've rescheduled the same 4 tasks 5 days in a row. Is something making those harder than expected?"
- Weekly review auto-summary: AI generates a one-paragraph summary of the week — what was done, what slipped, habit consistency, mood trend — as a starting point for the user's own reflection.

**UX contract:** Prompts feel personal, not generic. AI uses the system's data to ask questions worth answering.

---

### 6.5 AI ↔ Goals: Progress Insight and Alignment Checks

**Wire these connections:**
- Monthly, AI generates a goal health report: for each active goal, it shows trajectory (on track / at risk / stalled) based on task completion rate, project progress, and habit consistency.
- "At risk" goals surface a gentle suggestion: "Your 'Write the book' goal has had 0 tasks completed this month. Would you like to schedule 30 minutes this week?"
- Goal-task alignment check: AI periodically reviews all tasks and flags those that don't map to any active goal — not to delete them, but to prompt: "Is this still worth doing?"

**UX contract:** AI acts as a quiet accountability partner, not a performance scorekeeper. It asks questions; the user decides.

---

### 6.6 AI ↔ Search: Semantic Understanding

**Wire these connections:**
- Global search supports natural language queries: "notes about productivity from last month", "tasks I deferred more than 3 times", "what did I write about X project?"
- AI-powered semantic search finds conceptually related results, not just keyword matches. Searching "burnout" returns notes that discuss overwhelm, overcommitment, and energy depletion even if the word "burnout" never appears.
- Command palette accepts natural language: "show me everything about the Q4 launch" → AI assembles a scoped view across tasks, notes, calendar events, and files related to Q4 launch.

**UX contract:** The user never has to know the exact word they used or which module something lives in. They search how they think.

---

### 6.7 AI Design Constraints — What It Must Never Do

These constraints are non-negotiable for a trustworthy, calm system:

- **Never modify data silently.** Every AI action that creates, updates, or deletes an entity must be presented as a proposal and require explicit user confirmation.
- **Never block the UI.** All AI inference runs in a background worker. The app is fully usable while AI is processing.
- **Never require AI to function.** Every module works completely without AI. AI is an enhancement layer, not core infrastructure.
- **Always label AI-generated content.** Summaries, proposed tasks, suggested links — all carry a subtle "AI" badge. The user always knows what they wrote vs. what AI generated.
- **Never access module internals directly.** AI receives module-defined context objects. It never reads raw database tables or bypasses the module API.

---

### Phase 6 Acceptance Criteria

1. Type "finish report by Friday" in the command palette → a task is created with correct due date and appears in the inbox.
2. Press "Plan my day" → AI proposes a time-blocked schedule in the Planner as a reviewable proposal (not auto-applied).
3. Open the evening journal → the reflection prompt references something that actually happened today.
4. Search "notes about focus" → returns semantically related notes even if they don't use the word "focus."
5. All AI features work as enhancements: disabling AI leaves every module fully functional with no broken states.

---

---

## Cross-Phase Principles

These apply across all six integration phases and should be enforced in every integration implementation review:

### Principle 1: Single Source of Truth
Every piece of data lives in exactly one module. Other modules access it via the module's public API. There is no duplication of records between modules — only references.

### Principle 2: Propagation is Silent, Results are Visible
When completing a task updates a goal's progress, the update happens without the user seeing a loading state or needing to refresh. The result (updated progress ring) is visible immediately; the plumbing is invisible.

### Principle 3: Integrations are Opt-Out, Not Opt-In
Cross-module behaviours are active by default — tasks appear on the calendar, focus sessions log to time tracking, AI surfaces related notes. The user can disable individual integrations from Settings, but they should not have to enable them to experience a cohesive system.

### Principle 4: No Integration Should Require Navigation
Every cross-module action should be completable from where the user already is. Completing a task from a note, checking a habit from the journal, seeing goal progress from the task list — these require zero navigation.

### Principle 5: The Status Bar is the Persistent Integration Surface
The status bar shows: active focus timer (always), today's task count, current date, and sync status. It is visible in every module. It is the thread of continuity across all module views.

### Principle 6: Integration Errors Are Recoverable and Visible
If a cross-module write fails (e.g., a time log fails to save after a focus session), the user sees a non-blocking notification and can retry. The primary module's state is never corrupted by a failed integration.

---

## Integration Testing Strategy

For each integration point, three tests are required before shipping:

1. **Happy path** — the normal flow works end to end.
2. **Stale state** — completing the action in one module, then checking the other module reflects it without a refresh.
3. **Disconnected state** — one module's data is missing or corrupted; the other module degrades gracefully without crashing.

---

## Summary: What the User Actually Feels

After all six phases, using the app should feel like this:

- You open the app in the morning. Your journal is pre-loaded with today's scheduled tasks and a habit check-in. You check off your habits, review your plan, and drag one task to a different time block.
- You start a time block. The focus timer starts automatically. You work.
- You read a PDF. You highlight a passage. Without opening the Notes module, a note exists in your graph with the quote and the source.
- You finish a task. Your project's progress bar moves. Your goal's ring advances slightly. The journal tonight will mention it.
- You search for something you vaguely remember. You find it, from whatever module it lived in, in under a second.

**The system works for you. You don't work to maintain the system.**
