// ============================================================
// BUTLER — SHARED TYPES
// Single source of truth. All modules import from here.
// Never import from other modules' stores or components.
// ============================================================

// ── Primitives ───────────────────────────────────────────────

export type ID = string; // nanoid, 21 chars
export type ISODate = string; // "2024-01-15"
export type ISODateTime = string; // "2024-01-15T09:00:00Z"
export type Milliseconds = number;

// ── Priority / Status enums ──────────────────────────────────

export type Priority = "none" | "low" | "medium" | "high" | "urgent";
export type TaskStatus = "todo" | "in_progress" | "done" | "cancelled" | "archived";
export type ProjectStatus = "active" | "on_hold" | "completed" | "archived";
export type FocusState = "idle" | "focusing" | "break" | "paused";

// ── Core Entities ────────────────────────────────────────────

export interface Task {
  id: ID;
  title: string;
  description?: string;        // markdown
  status: TaskStatus;
  priority: Priority;
  projectId?: ID;
  parentTaskId?: ID;           // for subtasks
  labels: string[];
  tags: string[];
  dueDate?: ISODate;
  startDate?: ISODate;
  scheduledDate?: ISODate;
  completedAt?: ISODateTime;
  estimateMinutes?: number;
  actualMinutes?: number;      // from time tracking
  recurrence?: RecurrenceRule;
  dependencies: ID[];          // task IDs this task depends on
  checklistItems: ChecklistItem[];
  linkedNoteIds: ID[];
  linkedEventIds: ID[];
  order: number;               // for manual sorting
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface ChecklistItem {
  id: ID;
  text: string;
  checked: boolean;
  order: number;
}

export interface RecurrenceRule {
  frequency: "daily" | "weekly" | "monthly" | "yearly" | "custom";
  interval: number;
  daysOfWeek?: number[];       // 0=Sun … 6=Sat
  endDate?: ISODate;
  count?: number;
}

export interface Project {
  id: ID;
  name: string;
  description?: string;
  status: ProjectStatus;
  color: string;               // hex
  icon?: string;               // lucide icon name
  startDate?: ISODate;
  dueDate?: ISODate;
  milestones: Milestone[];
  linkedNoteIds: ID[];
  order: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Milestone {
  id: ID;
  projectId: ID;
  title: string;
  dueDate?: ISODate;
  completedAt?: ISODateTime;
  linkedTaskIds: ID[];
}

export interface Note {
  id: ID;
  title: string;
  content: string;             // tiptap JSON string
  type: "note" | "daily" | "meeting" | "template";
  date?: ISODate;              // for daily notes
  linkedTaskIds: ID[];
  linkedProjectIds: ID[];
  linkedEventIds: ID[];
  backlinks: ID[];             // note IDs that link to this note
  tags: string[];
  isPinned: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface CalendarEvent {
  id: ID;
  title: string;
  description?: string;
  startAt: ISODateTime;
  endAt: ISODateTime;
  allDay: boolean;
  color?: string;
  calendarId: ID;
  linkedTaskIds: ID[];
  linkedNoteIds: ID[];
  isTimeBlock: boolean;        // time-blocked from planner
  recurrence?: RecurrenceRule;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Calendar {
  id: ID;
  name: string;
  color: string;
  isDefault: boolean;
  isVisible: boolean;
  source: "local" | "google" | "ical";
  sourceUrl?: string;
}

export interface FocusSession {
  id: ID;
  taskId?: ID;
  projectId?: ID;
  type: "focus" | "short_break" | "long_break";
  plannedMinutes: number;
  actualMinutes?: number;
  state: FocusState;
  startedAt?: ISODateTime;
  completedAt?: ISODateTime;
  notes?: string;
  goal?: string;              // intention set before starting
  interruptCount?: number;    // times paused manually during session
  mood?: 1 | 2 | 3 | 4 | 5; // post-session self-rating
  createdAt: ISODateTime;
}

export interface TimeEntry {
  id: ID;
  taskId?: ID;
  projectId?: ID;
  focusSessionId?: ID;
  description?: string;
  startAt: ISODateTime;
  endAt?: ISODateTime;
  durationMinutes?: number;
  isBillable: boolean;
  tags: string[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface JournalEntry {
  id: ID;
  date: ISODate;
  type: "daily" | "weekly" | "monthly" | "gratitude" | "reflection";
  content: string;             // tiptap JSON string
  mood?: 1 | 2 | 3 | 4 | 5;
  linkedTaskIds: ID[];
  linkedProjectIds: ID[];
  tags: string[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface DatabaseTable {
  id: ID;
  name: string;
  description?: string;
  schema: DatabaseColumn[];
  linkedProjectId?: ID;
  linkedNoteId?: ID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface DatabaseColumn {
  id: ID;
  name: string;
  type: "text" | "number" | "date" | "boolean" | "select" | "multi_select" | "relation" | "url" | "email";
  options?: string[];          // for select / multi_select
  relationTableId?: ID;        // for relation
  isRequired: boolean;
  order: number;
}

export interface DatabaseRow {
  id: ID;
  tableId: ID;
  cells: Record<ID, unknown>;  // columnId → value
  order: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface PdfDocument {
  id: ID;
  title: string;
  filePath: string;            // Tauri asset path
  totalPages: number;
  currentPage: number;
  annotations: PdfAnnotation[];
  linkedNoteIds: ID[];
  linkedTaskIds: ID[];
  tags: string[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface PdfAnnotation {
  id: ID;
  documentId: ID;
  page: number;
  type: "highlight" | "note" | "underline";
  content: string;
  color: string;
  position: { x: number; y: number; width: number; height: number };
  linkedNoteId?: ID;
  createdAt: ISODateTime;
}

// ── Workspace / Shell ────────────────────────────────────────

export interface WorkspaceLayout {
  id: ID;
  name: string;
  sidebarWidth: number;
  panels: PanelConfig[];
  activePanelId?: ID;
  isDefault: boolean;
}

export interface PanelConfig {
  id: ID;
  moduleId: string;
  routePath: string;
  width?: number;
  isSplit: boolean;
}

export interface AppSettings {
  theme: "light" | "dark" | "system";
  accentColor: string;
  fontSize: "sm" | "md" | "lg";
  sidebarCollapsed: boolean;
  defaultView: string;         // module route
  autoSaveIntervalMs: number;
  focusModePomodoroMinutes: number;
  focusModeShortBreakMinutes: number;
  focusModeLongBreakMinutes: number;
  focusModeSessionsBeforeLongBreak: number;
}

// ── Search ───────────────────────────────────────────────────

export type SearchableEntityType =
  | "task"
  | "project"
  | "note"
  | "event"
  | "journal"
  | "database_row"
  | "pdf_annotation"
  | "research_document"
  | "research_chunk"
  | "research_entity"
  | "research_thread";

export interface SearchResult {
  id: ID;
  type: SearchableEntityType;
  title: string;
  excerpt?: string;
  score: number;
  updatedAt: ISODateTime;
}

// ── Activity log ─────────────────────────────────────────────

export interface ActivityLog {
  id: ID;
  entityType: SearchableEntityType;
  entityId: ID;
  action: "created" | "updated" | "deleted" | "moved" | "completed" | "archived";
  diff?: Record<string, { before: unknown; after: unknown }>;
  createdAt: ISODateTime;
}

// ── Module manifest ──────────────────────────────────────────

export interface ModuleManifest {
  id: string;
  name: string;
  icon: string;               // lucide icon name
  routes: ModuleRoute[];
  commands: Command[];
  shortcuts: Shortcut[];
  sidebarOrder: number;
  isEnabled: boolean;
}

export interface ModuleRoute {
  path: string;
  label: string;
  icon?: string;
}

export interface Command {
  id: string;
  label: string;
  shortcut?: string;
  group: string;
  action: string;             // event name to emit
}

export interface Shortcut {
  keys: string;               // e.g. "cmd+k", "g t"
  action: string;             // event name to emit
  description: string;
  global: boolean;
}

// ============================================================
// RESEARCH MODULE TYPES
// Migration version: 110
// ============================================================

export type ResearchSourceType =
  | "pdf"
  | "web"
  | "markdown"
  | "text"
  | "image"
  | "youtube"
  | "code_snippet"
  | "screenshot";

export type ResearchProcessingStatus =
  | "pending"
  | "parsing"
  | "chunking"
  | "indexing"
  | "ai_analysis"
  | "completed"
  | "failed";

export type ResearchChunkType =
  | "paragraph"
  | "heading"
  | "code"
  | "quote"
  | "table"
  | "image_caption"
  | "citation"
  | "equation";

export type ResearchRelationType =
  | "RELATED_TO"
  | "SUPPORTS"
  | "CONTRADICTS"
  | "DERIVED_FROM"
  | "MENTIONS"
  | "REFERENCES"
  | "LINKED_TASK"
  | "LINKED_PROJECT"
  | "LINKED_NOTE";

/** Raw ingested source — before any processing */
export interface ResearchSource {
  id: ID;
  type: ResearchSourceType;
  title: string;
  url?: string;                // web / youtube
  filePath?: string;           // pdf / image / local file
  rawContent?: string;         // text / markdown / code snippet
  mimeType?: string;
  sizeBytes?: number;
  processingStatus: ResearchProcessingStatus;
  errorMessage?: string;       // populated on failure
  threadIds: ID[];             // which research threads contain this source
  tags: string[];
  importedAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** Parsed, cleaned representation of a source — one per source */
export interface ResearchDocument {
  id: ID;
  sourceId: ID;
  title: string;
  authors?: string[];
  publishedDate?: ISODate;
  language?: string;
  abstract?: string;
  totalChunks: number;
  totalPages?: number;         // PDF only
  wordCount?: number;
  processingVersion: string;   // bump when pipeline changes
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** Atomic unit of knowledge — paragraph / heading / code etc. */
export interface ResearchChunk {
  id: ID;
  documentId: ID;
  sourceId: ID;
  type: ResearchChunkType;
  content: string;
  order: number;               // position within document
  pageNumber?: number;         // PDF only
  sectionTitle?: string;
  embeddingId?: string;        // FK → research_embeddings
  semanticTags?: string[];
  entities?: string[];         // entity names (denormalised for speed)
  importanceScore?: number;    // 0–1, AI-assigned
  summary?: string;            // AI-generated chunk summary
  createdAt: ISODateTime;
}

/** Vector embedding stub — model + vector stored separately */
export interface ResearchEmbedding {
  id: ID;
  chunkId: ID;
  model: string;               // e.g. "text-embedding-3-small"
  dimensions: number;
  vector: number[];            // stored as JSON array for now; swap to sqlite-vss later
  createdAt: ISODateTime;
}

/** Named entity extracted from a chunk */
export interface ResearchEntity {
  id: ID;
  documentId: ID;
  chunkId?: ID;
  name: string;
  type: "person" | "organization" | "concept" | "technology" | "location" | "event" | "other";
  aliases?: string[];
  description?: string;
  importanceScore?: number;
  createdAt: ISODateTime;
}

/** Knowledge graph edge */
export interface ResearchRelation {
  id: ID;
  fromId: ID;                  // entity / document / chunk / task / note / project id
  fromType: string;            // "entity" | "document" | "chunk" | "task" | "note" | "project"
  toId: ID;
  toType: string;
  relationType: ResearchRelationType;
  weight?: number;             // 0–1 confidence
  context?: string;            // sentence that implied this relation
  createdAt: ISODateTime;
}

/** Text highlight on a document chunk */
export interface ResearchHighlight {
  id: ID;
  documentId: ID;
  chunkId: ID;
  sourceId: ID;
  text: string;                // highlighted text
  color: string;               // hex
  pageNumber?: number;
  position?: { start: number; end: number }; // char offsets in chunk
  note?: string;               // inline annotation on highlight
  linkedNoteId?: ID;
  linkedTaskId?: ID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** Standalone annotation on a document */
export interface ResearchAnnotation {
  id: ID;
  documentId: ID;
  chunkId?: ID;
  sourceId: ID;
  type: "note" | "question" | "action" | "contradiction" | "definition";
  content: string;
  pageNumber?: number;
  position?: { start: number; end: number };
  linkedNoteId?: ID;
  linkedTaskId?: ID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** Academic / web citation */
export interface ResearchCitation {
  id: ID;
  documentId: ID;
  chunkId?: ID;
  raw: string;                 // original citation text
  title?: string;
  authors?: string[];
  year?: number;
  url?: string;
  doi?: string;
  linkedSourceId?: ID;         // if citation resolved to another source in DB
  createdAt: ISODateTime;
}

/**
 * Contextual knowledge container.
 * Threads group sources, highlights, notes, tasks around a topic.
 */
export interface ResearchThread {
  id: ID;
  title: string;
  description?: string;
  color?: string;
  sourceIds: ID[];
  highlightIds: ID[];
  annotationIds: ID[];
  linkedNoteIds: ID[];
  linkedTaskIds: ID[];
  linkedProjectIds: ID[];
  aiSummary?: string;
  unresolvedQuestions: string[];
  recentInsights: string[];
  tags: string[];
  isPinned: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** AI-generated insight from documents / chunks */
export interface ResearchInsight {
  id: ID;
  documentId?: ID;
  threadId?: ID;
  chunkIds: ID[];              // source chunks that produced this insight
  type: "summary" | "contradiction" | "gap" | "connection" | "hypothesis" | "action_item";
  content: string;
  confidence?: number;         // 0–1
  linkedTaskId?: ID;
  linkedNoteId?: ID;
  aiModel?: string;
  createdAt: ISODateTime;
}

/** AI-generated question for review / spaced repetition */
export interface ResearchQuestion {
  id: ID;
  documentId?: ID;
  threadId?: ID;
  chunkId?: ID;
  question: string;
  answer?: string;
  type: "comprehension" | "application" | "analysis" | "flashcard";
  difficulty?: 1 | 2 | 3 | 4 | 5;
  reviewedAt?: ISODateTime;
  createdAt: ISODateTime;
}

/** Async AI processing job */
export interface ResearchAiJob {
  id: ID;
  sourceId: ID;
  jobType:
    | "parse"
    | "chunk"
    | "embed"
    | "entity_extract"
    | "summarize"
    | "cite_extract"
    | "insight_generate"
    | "question_generate"
    | "graph_link";
  status: "queued" | "running" | "completed" | "failed";
  progress?: number;           // 0–100
  errorMessage?: string;
  startedAt?: ISODateTime;
  completedAt?: ISODateTime;
  createdAt: ISODateTime;
}

/** Cross-module link: research ↔ task / note / project / event */
export interface ResearchLink {
  id: ID;
  researchEntityType: "source" | "document" | "chunk" | "highlight" | "annotation" | "thread" | "insight";
  researchEntityId: ID;
  linkedEntityType: "task" | "note" | "project" | "event";
  linkedEntityId: ID;
  createdAt: ISODateTime;
}
