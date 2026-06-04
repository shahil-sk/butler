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
export type ProjectStatus = "planning" | "active" | "on_hold" | "completed" | "cancelled" | "archived";
export type FocusState = "idle" | "focusing" | "break" | "paused";

// ── Core Entities ────────────────────────────────────────────

export interface Task {
  id: ID;
  title: string;
  description?: string;        // RichText
  status: TaskStatus;
  priority: Priority;
  projectId?: ID;
  parentTaskId?: ID;           // for subtasks
  labels: string[];
  tags: string[];
  dueDate?: ISODate;
  dueTime?: string;
  startDate?: ISODate;
  scheduledDate?: ISODateTime; // restored
  scheduledAt?: ISODateTime;   // new
  scheduledDuration?: number;
  completedAt?: ISODateTime;
  cancelledAt?: ISODateTime;
  goalId?: ID;
  assigneeId?: ID;
  recurrence?: RecurrenceRule; // restored
  recurrenceRule?: string;     // new string rule
  recurrenceParent?: ID;
  nextOccurrenceAt?: ISODate;
  estimateMinutes?: number;
  actualMinutes?: number;
  energyLevel?: "low" | "medium" | "high";
  context?: string[];
  size?: "xs" | "s" | "m" | "l" | "xl";
  watchers?: ID[];
  attachments?: ID[];
  dependencies: ID[];          // restored
  dependsOn?: ID[];
  blocks?: ID[];
  checklistItems: ChecklistItem[]; // restored
  customFields?: Record<string, unknown>;
  order: number;               // restored
  position: number;
  sectionId?: ID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  createdBy?: ID;
  source?: "manual" | "ai_generated" | "recurring" | "imported" | "email";
  version?: number;

  linkedNoteIds: ID[];         // restored required
  linkedEventIds: ID[];        // restored required
  linkedPlannerBlockIds: ID[]; // restored required
  linkedResearchIds: ID[];     // restored required
}

export interface ChecklistItem {
  id: ID;
  taskId?: ID;
  text: string;                // restored
  checked: boolean;            // restored
  order: number;               // restored
  title?: string;
  done?: boolean;
  position?: number;
  createdAt?: ISODateTime;
}

export interface TaskSection {
  id: ID;
  title: string;
  projectId?: ID;
  color?: string;
  position: number;
  collapsed: boolean;
}

export interface TaskDependency {
  id: ID;
  predecessorId: ID;
  successorId: ID;
  type: "finish_to_start" | "start_to_start" | "finish_to_finish" | "start_to_finish";
  lagDays: number;
  createdAt: ISODateTime;
}

export interface Label {
  id: ID;
  name: string;
  color: string;
  icon?: string;
}

export interface TaskComment {
  id: ID;
  taskId: ID;
  authorId: ID;
  body: string;
  mentions: ID[];
  reactions: Record<string, ID[]>;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  edited: boolean;
}

export interface TaskActivity {
  id: ID;
  taskId: ID;
  actorId: ID;
  event: "created" | "status_changed" | "field_updated" | "comment_added" | "assignee_changed" | "due_date_changed" | "dependency_added" | "moved";
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  occurredAt: ISODateTime;
}

export interface RecurrenceRule {
  frequency: "daily" | "weekly" | "monthly" | "yearly" | "custom";
  interval: number;
  daysOfWeek?: number[];       // 0=Sun … 6=Sat
  dayOfMonth?: number;         // 1..31
  endDate?: ISODate;
  count?: number;
}

export interface ProjectMember {
  id: ID;
  projectId: ID;
  personId: ID;
  role: "owner" | "manager" | "member" | "viewer" | "client";
  joinedAt: ISODateTime;
  invitedBy?: ID;
}

export interface ProjectPhase {
  id: ID;
  projectId: ID;
  name: string;
  startDate: ISODate;
  endDate: ISODate;
  color: string;
  position: number;
}

export interface ProjectNote {
  projectId: ID;
  noteId: ID;
  linkedAt: ISODateTime;
  linkedBy: ID;
  noteType: "general" | "meeting" | "decision" | "spec" | "retrospective";
}

export interface ProjectTemplate {
  id: ID;
  name: string;
  description?: string;
  defaultPhases: Record<string, unknown>; // JSON
  defaultMilestones: Record<string, unknown>; // JSON
  defaultTaskSections: Record<string, unknown>; // JSON
  defaultMemberRoles: Record<string, unknown>; // JSON
  createdAt: ISODateTime;
}

export interface Project {
  id: ID;
  name: string;
  description?: string; // RichText JSON
  status: ProjectStatus;
  health?: "on_track" | "at_risk" | "off_track";
  priority: "none" | "low" | "medium" | "high" | "critical";
  visibility: "private" | "team" | "public";
  goalId?: ID;
  parentProjectId?: ID;
  startDate?: ISODate;
  targetDate?: ISODate;
  hardDeadline?: ISODate;
  completedAt?: ISODateTime;
  ownerId: ID;
  color: string;
  icon?: string;
  coverImageUrl?: string;
  budgetHours?: number;
  budgetCost?: number;
  currency?: string;
  tags: string[];
  labels: ID[];
  customFields: Record<string, unknown>;
  progressMode: "manual" | "task_based" | "milestone_based";
  progressPercent: number;
  templateId?: ID;
  isTemplate: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  createdBy: ID;
  archivedAt?: ISODateTime;
  
  // Legacy / Temp
  milestones: Milestone[];
  dueDate?: ISODate;
  linkedNoteIds: ID[];
  attachments: ID[];
  order: number;
}

export interface Milestone {
  id: ID;
  projectId: ID;
  title: string;
  description?: string;
  dueDate: ISODate;
  status: "pending" | "at_risk" | "completed" | "missed";
  completedAt?: ISODateTime;
  tasks: ID[];
  dependsOn: ID[];
  calendarEventId?: ID;
  createdAt: ISODateTime;
  
  linkedTaskIds: ID[]; // Legacy
}

export interface Note {
  id: ID;
  title: string;
  content: string;             // tiptap JSON string
  contentText?: string;        // plain text for FTS
  status?: "active" | "archived" | "trashed";
  noteType?: "note" | "daily" | "template" | "meeting" | "literature" | "atomic";
  isDaily?: boolean;
  dailyDate?: ISODate;
  parentId?: ID;
  notebookId?: ID;
  
  // Legacy / Temp fields (keeping for compatibility during transition)
  type: "note" | "daily" | "meeting" | "template";
  date?: ISODate;              // for daily notes
  linkedTaskIds: ID[];
  linkedProjectIds: ID[];
  linkedEventIds: ID[];
  linkedResearchIds: ID[];
  backlinks: ID[];             // legacy backlinks
  
  tags: string[];
  properties?: Record<string, unknown>;
  aliases?: string[];
  
  isPinned: boolean; // legacy
  pinned?: boolean;
  starred?: boolean;
  
  wordCount?: number;
  readingTimeMin?: number;
  
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  lastOpenedAt?: ISODateTime;
  createdBy?: ID;
  
  embedding?: number[];
  embeddingUpdatedAt?: ISODateTime;
}

export interface NoteLink {
  id: ID;
  sourceNoteId: ID;
  targetNoteId?: ID;
  targetRaw: string;
  blockId?: string;
  isEmbed: boolean;
  createdAt: ISODateTime;
}

export interface NoteBlock {
  id: ID;
  noteId: ID;
  blockId: string;
  type: "paragraph" | "heading" | "bullet" | "numbered" | "code" | "quote" | "image" | "embed" | "callout" | "table" | "divider" | "task" | "toggle" | "database_embed";
  content: string;
  position: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Notebook {
  id: ID;
  name: string;
  icon?: string;
  color?: string;
  parentId?: ID;
  position: number;
  createdAt: ISODateTime;
}

export interface NoteVersion {
  id: ID;
  noteId: ID;
  content: string; // RichText JSON
  wordCount: number;
  savedAt: ISODateTime;
  savedBy: ID;
  changeSummary?: string;
}

export interface Attendee {
  id: ID;
  eventId: ID;
  name: string;
  email: string;
  status: "invited" | "accepted" | "declined" | "tentative" | "needs_action";
  isOrganizer: boolean;
  isSelf: boolean;
}

export interface Reminder {
  id: ID;
  eventId: ID;
  method: "notification" | "email";
  minutes: number;
}

export interface CalendarEvent {
  id: ID;
  title: string;
  description?: string;
  status?: "confirmed" | "tentative" | "cancelled" | "completed";
  visibility?: "default" | "private" | "public";
  
  startDatetime: ISODateTime; // backward compat with startAt in some places?
  startAt: ISODateTime;
  endDatetime: ISODateTime;
  endAt: ISODateTime;
  isAllDay: boolean;
  allDay: boolean; // backward compat
  timezone: string;
  
  location?: string;
  locationLat?: number;
  locationLng?: number;
  meetingUrl?: string;
  meetingPassword?: string;
  
  recurrenceRule?: string; // RRULE string
  recurrenceParent?: ID;
  recurrence?: any; // backward compat
  
  calendarId: ID;
  externalId?: string;
  externalSource?: "google" | "outlook" | "ical" | "local";
  
  attendees?: Attendee[];
  reminders?: Reminder[];
  attachments?: ID[];
  
  color?: string;
  category?: "work" | "personal" | "health" | "social" | "travel" | "focus" | "blocked" | "milestone";
  
  taskId?: ID;
  projectId?: ID;
  goalId?: ID;

  linkedTaskIds: ID[];
  linkedNoteIds: ID[];

  isTimeBlock?: boolean; // backward compat
  
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  createdBy?: ID;
}

export interface Calendar {
  id: ID;
  name: string;
  color: string;
  isDefault: boolean;
  isVisible: boolean;
  source: "local" | "google" | "outlook" | "ical_url";
  icalUrl?: string;
  syncToken?: string;
  lastSyncedAt?: ISODateTime;
  createdAt: ISODateTime;
}

export interface FocusSession {
  id: ID;
  type: "pomodoro" | "deep_work" | "break" | "custom" | "focus" | "short_break" | "long_break";
  status: "active" | "paused" | "completed" | "abandoned";
  taskId?: ID;
  timeBlockId?: ID;
  projectId?: ID;
  plannedDuration: number;
  actualDuration?: number;
  workDuration?: number;
  startedAt: ISODateTime;
  endedAt?: ISODateTime;
  pauses: SessionPause[];
  interruptionCount: number;
  idleTimeMinutes?: number;
  flowScore?: number;
  notes?: string;
  accomplishment?: string;
  pomodoroNumber?: number;
  workSetId?: ID;
  tags: string[];
  createdAt: ISODateTime;

  // Legacy fields
  completedAt?: ISODateTime;
  plannedMinutes?: number;
  actualMinutes?: number;
  state?: FocusState;
  goal?: string;
  interruptCount?: number;
  mood?: 1 | 2 | 3 | 4 | 5;
}

export interface SessionPause {
  id: ID;
  sessionId: ID;
  pausedAt: ISODateTime;
  resumedAt?: ISODateTime;
  reason?: "break" | "distraction" | "interruption" | "emergency";
}

export interface PomodoroWorkSet {
  id: ID;
  sessions: ID[]; // FKs to FocusSession
  workSessions: number;
  shortBreakMin: number;
  longBreakMin: number;
  completedAt?: ISODateTime;
  createdAt: ISODateTime;
}

export interface FocusConfig {
  id: ID;
  defaultType: "pomodoro" | "deep_work";
  pomodoroWorkMin: number;
  pomodoroShortBreak: number;
  pomodoroLongBreak: number;
  pomodoroSetCount: number;
  deepWorkDefaultMin: number;
  autoStartBreaks: boolean;
  autoStartNextPomodoro: boolean;
  idleDetectionMin: number;
  blockApps: boolean;
  blockUrls: string[];
  ambientSound?: "none" | "rain" | "forest" | "cafe" | "white_noise" | "brown_noise";
  ambientVolume: number;
  endSound: "bell" | "chime" | "gong" | "none";
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
  isManual?: boolean;
  isBillable: boolean;
  billableRate?: number;
  billableAmount?: number;
  tags: string[];
  category?: "deep_work" | "meeting" | "admin" | "communication" | "research" | "design" | "development" | "review" | "planning" | "other";
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  createdBy?: ID;
}

export interface TimeTrackingSettings {
  id: ID;
  defaultBillable: boolean;
  defaultHourlyRate?: number;
  currency: string;
  roundEntries: "none" | "5min" | "10min" | "15min" | "30min" | "1hour";
  idleDetectionMin: number;
  reminderIntervalMin: number;
  workHoursStart: string; // HH:MM
  workHoursEnd: string;   // HH:MM
}

export interface JournalEntry {
  id: ID;
  date: ISODate;
  type: "daily" | "weekly" | "monthly" | "gratitude" | "reflection";
  content: string;             // tiptap JSON string
  mood?: 1 | 2 | 3 | 4 | 5 | number;
  linkedTaskIds: ID[];
  linkedProjectIds: ID[];
  tags: string[];

  noteId?: ID;
  status?: "draft" | "complete";
  moodMorning?: number;
  moodEvening?: number;
  energyMorning?: number;
  energyEvening?: number;
  gratitude?: string[];
  wins?: string[];
  challenges?: string[];
  learnings?: string[];
  morningIntention?: string;
  eveningReflection?: string;
  tasksCompleted?: number;
  tasksDeferred?: number;
  focusMinutes?: number;
  habitSummary?: Record<string, boolean>;
  lifeAreaRatings?: Record<string, number>;
  customPrompts?: Record<string, string>;
  wordCount?: number;
  writeStreak?: number;

  createdAt: ISODateTime;
  completedAt?: ISODateTime;
  updatedAt: ISODateTime;
}

export interface SelectOption {
  id: string;
  label: string;
  color: string;
}

export interface DatabaseTable {
  id: ID;
  name: string;
  icon?: string;
  description?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  projectId?: ID;
}

export type DatabaseColumnType = "text" | "number" | "date" | "boolean" | "select" | "multi_select" | "relation" | "url" | "email" | "checkbox";

export interface DatabaseColumn {
  id: ID;
  tableId: ID;
  name: string;
  type: DatabaseColumnType;
  options?: { selectOptions?: SelectOption[] } & Record<string, any>;
  position: number;
  isPrimary: boolean;
  createdAt: ISODateTime;
}

export interface DatabaseRow {
  id: ID;
  tableId: ID;
  position: number;
  cells: Record<ID, unknown>;  // columnId → value
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type DatabaseViewType = "grid" | "kanban" | "calendar" | "gallery";

export interface DatabaseView {
  id: ID;
  tableId: ID;
  name: string;
  type: DatabaseViewType;
  config: Record<string, any>;
  position: number;
  createdAt: ISODateTime;
}

export type FilterOperator = "equals" | "not_equals" | "contains" | "not_contains" | "greater_than" | "less_than" | "gt" | "lt" | "gte" | "lte" | "is_empty" | "is_not_empty";

export interface DatabaseFilter {
  id: ID;
  viewId: ID;
  columnId: ID;
  operator: FilterOperator;
  value: any;
  position: number;
}

export interface DatabaseSort {
  id: ID;
  viewId: ID;
  columnId: ID;
  direction: "asc" | "desc";
  position: number;
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
  | "goal"
  | "database_row"
  | "pdf_annotation"
  | "source"
  | "research_document"
  | "research_chunk"
  | "research_entity"
  | "research_thread"
  | "focus_session";

export interface SearchResult {
  id: ID;
  type: SearchableEntityType;
  title: string;
  excerpt?: string;
  tags?: string[];
  projectId?: ID;
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

// ============================================================================
// Module 02 — Daily Planner
// ============================================================================

export interface TimeBlock {
  id: ID;
  date: ISODate;
  startTime: string; // HH:MM (24h)
  endTime: string;   // HH:MM (24h)
  durationMinutes?: number;
  title?: string;
  color?: string;
  category?: "deep_work" | "shallow_work" | "admin" | "meeting" | "break" | "personal" | "buffer" | "blocked";
  isBreak?: boolean;
  taskId?: ID;
  eventId?: ID;
  note?: string;
  notes?: string;
  isOverflow?: boolean;
  actualStart?: ISODateTime;
  actualEnd?: ISODateTime;
  actualDuration?: number;
  focusSessionId?: ID;
  completed?: boolean;
  isCompleted?: boolean;
  position?: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface DayPlan {
  id: ID;
  date: ISODate; // PK
  status: "draft" | "active" | "completed" | "skipped";
  morningIntention?: string; // RichText
  eveningReflection?: string; // RichText
  energyLevel?: "very_low" | "low" | "medium" | "high" | "very_high";
  moodStart?: number; // 1-10
  moodEnd?: number; // 1-10
  plannedMinutes: number;
  actualMinutes: number;
  tasksPlanned: number;
  tasksCompleted: number;
  overflowCount: number;
  createdAt: ISODateTime;
  completedAt?: ISODateTime;
}

export interface TemplateBlock {
  title: string;
  startTime: string;
  endTime: string;
  color?: string;
  isBreak: boolean;
  notes?: string;
  category?: string;
}

export interface PlannerTemplate {
  id: ID;
  name: string;
  blocks: TemplateBlock[];
  isDefault?: boolean;
  daysOfWeek?: number[]; // 0-6
  createdAt: ISODateTime;
}

// ============================================================================
// Module 08 — Journal System
// ============================================================================



export interface JournalPromptSet {
  id: ID;
  name: string;
  prompts: { key: string; question: string; type: "text" | "rating" | "checklist" | "list" }[];
  isDefault: boolean;
  trigger: "morning" | "evening" | "weekly" | "monthly" | "custom";
}

export interface WeeklyReview {
  id: ID;
  weekStart: ISODate; // Monday
  noteId?: ID;

  highlight?: string;
  challenge?: string;
  learning?: string;
  intention?: string;

  habitConsistency?: Record<string, { done: number; total: number }>;
  tasksCompleted: number;
  tasksDeferred: number;
  focusHours: number;
  goalProgress?: Record<string, { startPercent: number; endPercent: number }>;
  avgMood?: number;
  avgEnergy?: number;

  lifeAreasSummary?: Record<string, number>;
  
  createdAt: ISODateTime;
  completedAt?: ISODateTime;
}

// ============================================================================
// Module 09 — Habits & Routines
// ============================================================================

export interface Habit {
  id: ID;
  name: string;
  description?: string;
  icon?: string;
  color: string;
  category?: "health" | "learning" | "fitness" | "mindfulness" | "productivity" | "social" | "creative" | "finance" | "custom";

  frequencyType: "daily" | "weekly" | "monthly" | "custom";
  frequencyDays?: number[]; // weekly: [1,3,5], monthly: [1,15]
  customIntervalDays?: number;
  timesPerPeriod: number;
  targetValue?: number;
  targetUnit?: string;

  reminderTime?: string;
  reminderEnabled: boolean;

  linkedGoalId?: ID;
  routineId?: ID;

  startDate: ISODate;
  endDate?: ISODate;
  archivedAt?: ISODateTime;

  difficulty?: "easy" | "medium" | "hard";
  cue?: string;
  craving?: string;
  reward?: string;
  notes?: string;

  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface HabitLog {
  id: ID;
  habitId: ID;
  date: ISODate;
  status: "done" | "skipped" | "missed" | "partial";
  value?: number;
  note?: string;
  loggedAt: ISODateTime;
  source: "manual" | "journal" | "planner" | "ai_detected";
}

export interface Routine {
  id: ID;
  name: string;
  type: "morning" | "evening" | "custom";
  habitIds: ID[]; // Ordered list
  triggerTime?: string;
  durationMin?: number;
  days: number[]; // 0-6
  active: boolean;
  createdAt: ISODateTime;
}

export interface HabitStreak {
  habitId: ID;
  streakType: "current" | "longest";
  count: number;
  startDate: ISODate;
  endDate?: ISODate;
  lastUpdated: ISODateTime;
}

export interface MoodDataPoint {
  id: ID;
  recordedAt: ISODateTime;
  mood: number; // 1-10
  energy?: number; // 1-10
  note?: string;
  source: "morning_journal" | "evening_journal" | "manual" | "checkin";
}

// ============================================================================
// Module 11 — Search System
// ============================================================================

export interface SearchHistoryEntry {
  id: ID;
  query: string;
  resultCount: number;
  selectedEntityType?: string;
  selectedEntityId?: ID;
  searchedAt: ISODateTime;
}

export interface RecentItem {
  entityType: string;
  entityId: ID;
  openedAt: ISODateTime;
  title: string;
}

export interface CommandResult {
  id: string;
  title: string;
  action: () => void;
  icon?: string;
  module: string;
}

// ============================================================
// GOAL TYPES (Module 10)
// ============================================================

export type GoalStatus = "draft" | "active" | "achieved" | "abandoned" | "paused";
export type GoalHorizon = "lifetime" | "annual" | "quarterly" | "monthly" | "weekly";
export type GoalArea = "work" | "health" | "learning" | "relationships" | "finance" | "creativity" | "personal_growth" | "family" | "community" | "custom";
export type GoalProgressType = "manual" | "task_based" | "key_result_based" | "habit_based";
export type GoalReviewCadence = "weekly" | "biweekly" | "monthly" | "quarterly";

export interface Goal {
  id: ID;
  title: string;
  description?: string; // RichText
  status: GoalStatus;
  horizon: GoalHorizon;
  parentGoalId?: ID;
  area?: GoalArea;
  startDate?: ISODate;
  targetDate?: ISODate;
  achievedAt?: ISODateTime;
  abandonedAt?: ISODateTime;
  progressType: GoalProgressType;
  progressPercent: number;
  progressNotes?: string;
  motivation?: string;
  outcome?: string;
  obstacles: string[];
  tags: string[];
  color?: string;
  icon?: string;
  reviewCadence?: GoalReviewCadence;
  nextReviewDate?: ISODate;
  lastReviewedAt?: ISODateTime;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  createdBy: ID;
}

export type KeyResultMetricType = "boolean" | "numeric" | "percentage" | "currency";
export type GoalConfidence = "low" | "medium" | "high";

export interface KeyResult {
  id: ID;
  goalId: ID;
  title: string;
  description?: string;
  metricType: KeyResultMetricType;
  startValue?: number;
  targetValue: number;
  currentValue: number;
  unit?: string;
  confidence?: GoalConfidence;
  dueDate?: ISODate;
  completedAt?: ISODateTime;
  position: number;
}

export interface GoalCheckIn {
  id: ID;
  goalId: ID;
  checkInDate: ISODate;
  progressPercent: number;
  confidence: GoalConfidence;
  notes?: string; // RichText
  keyResultUpdates: Record<string, number>; // JSON
  mood?: number; // 1-10
  calendarEventId?: ID;
  createdAt: ISODateTime;
}

export interface GoalLink {
  goalId: ID;
  entityType: "project" | "habit" | "note" | "task";
  entityId: ID;
  linkStrength: "primary" | "supporting";
  createdAt: ISODateTime;
}

// ── AI Assistant (Module 12) ──────────────────────────────────

export type AIProvider = "local_ollama" | "lm_studio" | "openai" | "anthropic" | "gemini";
export type AIContextType = "task" | "note" | "project" | "goal" | "planner" | "journal" | "global";
export type AIActionType =
  | "task_created"
  | "task_extracted"
  | "note_summarised"
  | "plan_proposed"
  | "schedule_suggested"
  | "connection_suggested"
  | "prompt_generated"
  | "insight_generated"
  | "task_breakdown"
  | "meeting_processed";

export interface AIMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: ISODateTime;
}

export interface AIConversation {
  id: ID;
  contextType: AIContextType;
  contextId?: ID;
  title?: string;
  messages: AIMessage[];
  model: string;
  provider: AIProvider;
  tokensUsed: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface AIAction {
  id: ID;
  actionType: AIActionType;
  inputContext: Record<string, unknown>;
  output: Record<string, unknown>;
  accepted?: boolean;
  acceptedAt?: ISODateTime;
  createdAt: ISODateTime;
}

export interface AIConfig {
  id: ID;
  provider: AIProvider;
  localModel?: string;
  localBaseUrl?: string;
  openaiKey?: string;
  anthropicKey?: string;
  geminiKey?: string;
  embeddingModel: string;
  enabledFeatures: string[];
  maxTokens: number;
  temperature: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface ParsedTask {
  title: string;
  dueDate?: ISODate;
  dueTime?: string;
  priority?: Priority;
  projectName?: string;
  tags?: string[];
  estimateMinutes?: number;
  description?: string;
}

export interface TaskBreakdown {
  taskId: ID;
  subtasks: Array<{ title: string; estimateMinutes?: number; description?: string }>;
}

export interface MeetingNoteResult {
  summary: string;
  decisions: string[];
  actionItems: Array<{ title: string; assignee?: string; dueDate?: ISODate }>;
  openQuestions: string[];
  followUpDates: Array<{ description: string; date: ISODate }>;
}

export interface JournalPrompt {
  question: string;
  context: string;
}

export interface GoalHealthReport {
  summary: string;
  trajectory: "on_track" | "at_risk" | "stalled";
  suggestedAction: string;
}

