// ============================================================
// JOURNAL MODULE — ROOT
// Lazy-loaded. Registers manifest on mount.
// ============================================================

import React, { useEffect, useState, useCallback } from "react";
import { RichEditor } from "@/shared/RichEditor";
import { registry } from "@/kernel/router";
import { bus } from "@/kernel/event-bus";
import { useJournalStore } from "./store";
import { setupJournalEventListeners } from "./events";
import { JOURNAL_MANIFEST } from "./manifest";
import { generateId, today, formatDate } from "@/shared/utils";
import type { JournalEntry, ISODate } from "@/shared/types";
import { useTaskStore } from "@/modules/tasks/store";
import { useNoteStore } from "@/modules/notes/store";
import { useProjectStore } from "@/modules/projects/store";
import {
  PageHeader,
  SubNav,
  PrimaryButton,
  GhostButton,
  EmptyState,
  SectionLabel,
  ProjectDot,
  PriorityDot,
} from "@/shared/ui";
import { cn } from "@/shared/utils";

// ── Mood picker ──────────────────────────────────────────────

const MOODS: { value: 1 | 2 | 3 | 4 | 5; emoji: string; label: string }[] = [
  { value: 1, emoji: "😔", label: "Rough" },
  { value: 2, emoji: "😕", label: "Low" },
  { value: 3, emoji: "😐", label: "Okay" },
  { value: 4, emoji: "🙂", label: "Good" },
  { value: 5, emoji: "😄", label: "Great" },
];

const ENTRY_TYPES: { value: JournalEntry["type"]; label: string }[] = [
  { value: "daily",      label: "Daily" },
  { value: "weekly",     label: "Weekly" },
  { value: "monthly",    label: "Monthly" },
  { value: "gratitude",  label: "Gratitude" },
  { value: "reflection", label: "Reflection" },
];

// SubNav items — id is required by SubNav; we derive it from the value field.
const FILTER_NAV_ITEMS = [
  { id: "all",        label: "All" },
  ...ENTRY_TYPES.map((t) => ({ id: t.value, label: t.label })),
];

// ── MoodPicker ───────────────────────────────────────────────

function MoodPicker({
  value,
  onChange,
}: {
  value?: 1 | 2 | 3 | 4 | 5;
  onChange: (v: 1 | 2 | 3 | 4 | 5) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {MOODS.map((m) => (
        <button
          key={m.value}
          title={m.label}
          onClick={() => onChange(m.value)}
          className={cn(
            "flex flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-xs transition-colors",
            value === m.value
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:bg-muted"
          )}
        >
          <span className="text-lg leading-none">{m.emoji}</span>
          <span className="hidden sm:block">{m.label}</span>
        </button>
      ))}
    </div>
  );
}

// ── LinkedTasksPanel ─────────────────────────────────────────

function LinkedTasksPanel({ taskIds }: { taskIds: string[] }) {
  const tasks = useTaskStore((s) => s.tasks);
  const linked = taskIds
    .map((id) => tasks.find((t) => t.id === id))
    .filter(Boolean) as typeof tasks;

  if (linked.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <SectionLabel>Completed Tasks</SectionLabel>
      <div className="flex flex-col gap-1">
        {linked.map((task) => (
          <button
            key={task.id}
            onClick={() => bus.emit("task:open", { taskId: task.id })}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted transition-colors group"
          >
            <PriorityDot priority={task.priority} />
            <span className={cn(
              "flex-1 truncate",
              task.status === "done" && "line-through text-muted-foreground"
            )}>
              {task.title}
            </span>
            {task.projectId && (() => {
              const proj = useProjectStore.getState().getProjectById(task.projectId!);
              return proj ? (
                <span className="text-muted-foreground flex items-center gap-1 shrink-0">
                  <ProjectDot color={proj.color} />
                  <span className="hidden group-hover:inline">{proj.name}</span>
                </span>
              ) : null;
            })()}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── LinkedProjectsPanel ──────────────────────────────────────

function LinkedProjectsPanel({ projectIds }: { projectIds: string[] }) {
  const projects = useProjectStore((s) => s.projects);
  const linked = projectIds
    .map((id) => projects.find((p) => p.id === id))
    .filter(Boolean) as typeof projects;

  if (linked.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <SectionLabel>Projects</SectionLabel>
      <div className="flex flex-col gap-1">
        {linked.map((project) => (
          <button
            key={project.id}
            onClick={() => {
              bus.emit("project:open", { projectId: project.id });
              bus.emit("navigate:to", { path: "/projects" });
            }}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted transition-colors"
          >
            <ProjectDot color={project.color} />
            <span className="flex-1 truncate">{project.name}</span>
            <span className={cn(
              "text-muted-foreground capitalize",
              project.status === "completed" && "text-green-500"
            )}>
              {project.status}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── DailyNoteButton ──────────────────────────────────────────

function DailyNoteButton({ date }: { date: ISODate }) {
  const notes = useNoteStore((s) => s.notes);
  const openNote = useNoteStore((s) => s.openNote);
  const getOrCreateToday = useNoteStore((s) => s.getOrCreateToday);

  const dailyNote = notes.find((n) => n.type === "daily" && n.date === date);

  const handleClick = useCallback(async () => {
    if (dailyNote) {
      openNote(dailyNote.id);
    } else {
      await getOrCreateToday();
      const created = useNoteStore.getState().notes.find(
        (n) => n.type === "daily" && n.date === date
      );
      if (created) openNote(created.id);
    }
    bus.emit("navigate:to", { path: "/notes" });
  }, [dailyNote, openNote, getOrCreateToday, date]);

  return (
    <GhostButton
      onClick={handleClick}
      title={dailyNote ? "Open daily note" : "Create daily note"}
    >
      <span>{dailyNote ? "📝 Daily Note" : "📝 Create Note"}</span>
    </GhostButton>
  );
}

// ── EntryEditor ──────────────────────────────────────────────

function EntryEditor({
  entry,
  onSave,
}: {
  entry: JournalEntry;
  onSave: (changes: Partial<JournalEntry>) => void;
}) {
  const [mood, setMood] = useState(entry.mood);
  const [tags, setTags] = useState(entry.tags.join(", "));

  useEffect(() => {
    setMood(entry.mood);
    setTags(entry.tags.join(", "));
  }, [entry.id]);

  const handleMoodChange = useCallback(
    (v: 1 | 2 | 3 | 4 | 5) => {
      setMood(v);
      onSave({ mood: v });
    },
    [onSave]
  );

  const handleTagsBlur = useCallback(() => {
    onSave({ tags: tags.split(",").map((t) => t.trim()).filter(Boolean) });
  }, [tags, onSave]);

  return (
    <div className="flex flex-col h-full gap-4 p-4">
      {/* Mood */}
      <div className="flex items-center justify-between">
        <SectionLabel>How are you feeling?</SectionLabel>
        <MoodPicker value={mood} onChange={handleMoodChange} />
      </div>

      {/* Rich text editor */}
      <RichEditor
        content={entry.content}
        onChange={(json) => onSave({ content: json })}
        placeholder="Write your thoughts…"
        resetKey={entry.id}
        minHeight="min-h-[240px]"
        className="flex-1"
      />

      {/* Tags */}
      <div className="flex items-center gap-2">
        <SectionLabel className="shrink-0">Tags</SectionLabel>
        <input
          className="flex-1 rounded border bg-background px-2 py-1 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="comma-separated tags"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          onBlur={handleTagsBlur}
        />
      </div>

      <LinkedTasksPanel taskIds={entry.linkedTaskIds} />
      <LinkedProjectsPanel projectIds={entry.linkedProjectIds} />
    </div>
  );
}

// ── EntryListItem ────────────────────────────────────────────

function EntryListItem({
  entry,
  isActive,
  onClick,
}: {
  entry: JournalEntry;
  isActive: boolean;
  onClick: () => void;
}) {
  const mood = MOODS.find((m) => m.value === entry.mood);
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-3 py-2.5 rounded-lg transition-colors",
        isActive ? "bg-primary/10 text-primary" : "hover:bg-muted"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium truncate">
          {formatDate(entry.date)}
        </span>
        {mood && <span title={mood.label}>{mood.emoji}</span>}
      </div>
      <div className="flex items-center gap-1.5 mt-0.5">
        <span className="text-xs text-muted-foreground capitalize">
          {entry.type}
        </span>
        {entry.linkedTaskIds.length > 0 && (
          <span className="text-xs text-muted-foreground">
            · {entry.linkedTaskIds.length} task{entry.linkedTaskIds.length !== 1 ? "s" : ""}
          </span>
        )}
        {entry.tags.length > 0 && (
          <span className="text-xs text-muted-foreground">
            · {entry.tags.slice(0, 2).join(", ")}
          </span>
        )}
      </div>
    </button>
  );
}

// ── NewEntryModal ────────────────────────────────────────────

function NewEntryModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (type: JournalEntry["type"], date: ISODate) => void;
}) {
  const [type, setType] = useState<JournalEntry["type"]>("daily");
  const [date, setDate] = useState(today());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-background rounded-xl shadow-xl w-full max-w-sm p-6 flex flex-col gap-4">
        <h2 className="text-base font-semibold">New Journal Entry</h2>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground">Type</label>
          <select
            className="rounded border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={type}
            onChange={(e) => setType(e.target.value as JournalEntry["type"])}
          >
            {ENTRY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground">Date</label>
          <input
            type="date"
            className="rounded border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div className="flex gap-2 justify-end">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={() => { onCreate(type, date); onClose(); }}>
            Create
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

// ── JournalModule ────────────────────────────────────────────

export default function JournalModule() {
  const {
    entries,
    activeEntryId,
    isLoading,
    loadEntries,
    getOrCreateDaily,
    createEntry,
    updateEntry,
    setActiveEntry,
  } = useJournalStore();

  const [filterType, setFilterType] = useState<JournalEntry["type"] | "all">("all");
  const [showNewModal, setShowNewModal] = useState(false);

  useEffect(() => {
    registry.register(JOURNAL_MANIFEST);
    const cleanup = setupJournalEventListeners();
    return cleanup;
  }, []);

  useEffect(() => {
    void loadEntries().then(() => getOrCreateDaily(today()));
  }, []);

  const activeEntry = entries.find((e) => e.id === activeEntryId) ?? null;

  const filtered = filterType === "all"
    ? entries
    : entries.filter((e) => e.type === filterType);

  const handleCreate = useCallback(
    async (type: JournalEntry["type"], date: ISODate) => {
      await createEntry({ type, date });
    },
    [createEntry]
  );

  const handleUpdate = useCallback(
    (changes: Partial<JournalEntry>) => {
      if (!activeEntryId) return;
      void updateEntry(activeEntryId, changes);
    },
    [activeEntryId, updateEntry]
  );

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 shrink-0 border-r flex flex-col">
        <div className="p-3 border-b">
          <PrimaryButton onClick={() => setShowNewModal(true)}>
            New Entry
          </PrimaryButton>
        </div>

        {/* Type filter — items use `id` as required by SubNav */}
        <div className="p-2 border-b">
          <SubNav
            items={FILTER_NAV_ITEMS}
            activeId={filterType}
            onSelect={(id) => setFilterType(id as typeof filterType)}
          />
        </div>

        {/* Entry list */}
        <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
          {isLoading && (
            <p className="text-xs text-muted-foreground px-2 py-4 text-center">Loading…</p>
          )}
          {!isLoading && filtered.length === 0 && (
            <EmptyState title="No entries yet" subtitle="Start writing today" />
          )}
          {filtered.map((entry) => (
            <EntryListItem
              key={entry.id}
              entry={entry}
              isActive={entry.id === activeEntryId}
              onClick={() => setActiveEntry(entry.id)}
            />
          ))}
        </div>
      </div>

      {/* Editor pane */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeEntry ? (
          <>
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div>
                <PageHeader title={formatDate(activeEntry.date)} />
                <span className="text-xs text-muted-foreground capitalize">
                  {activeEntry.type}
                </span>
              </div>
              {activeEntry.type === "daily" && (
                <DailyNoteButton date={activeEntry.date} />
              )}
            </div>
            <div className="flex-1 overflow-y-auto">
              <EntryEditor
                key={activeEntry.id}
                entry={activeEntry}
                onSave={handleUpdate}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              title="Select an entry"
              subtitle="Or create a new one"
            />
          </div>
        )}
      </div>

      {showNewModal && (
        <NewEntryModal
          onClose={() => setShowNewModal(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}
