// ============================================================
// JOURNAL MODULE — ROOT (Polished UI)
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

// ── Constants ─────────────────────────────────────────────────

const MOODS: { value: 1 | 2 | 3 | 4 | 5; emoji: string; label: string; color: string }[] = [
  { value: 1, emoji: "😔", label: "Rough",  color: "bg-rose-500/20 text-rose-600 ring-rose-500/30" },
  { value: 2, emoji: "😕", label: "Low",    color: "bg-orange-500/20 text-orange-600 ring-orange-500/30" },
  { value: 3, emoji: "😐", label: "Okay",   color: "bg-yellow-500/20 text-yellow-600 ring-yellow-500/30" },
  { value: 4, emoji: "🙂", label: "Good",   color: "bg-emerald-500/20 text-emerald-600 ring-emerald-500/30" },
  { value: 5, emoji: "😄", label: "Great",  color: "bg-sky-500/20 text-sky-600 ring-sky-500/30" },
];

// Accent strip color per mood value for list item
const MOOD_STRIP: Record<number, string> = {
  1: "bg-rose-400",
  2: "bg-orange-400",
  3: "bg-yellow-400",
  4: "bg-emerald-400",
  5: "bg-sky-400",
};

// Badge color per entry type
const TYPE_BADGE: Record<string, string> = {
  daily:      "bg-violet-500/10 text-violet-600 ring-violet-500/20",
  weekly:     "bg-blue-500/10 text-blue-600 ring-blue-500/20",
  monthly:    "bg-indigo-500/10 text-indigo-600 ring-indigo-500/20",
  gratitude:  "bg-pink-500/10 text-pink-600 ring-pink-500/20",
  reflection: "bg-amber-500/10 text-amber-600 ring-amber-500/20",
};

const ENTRY_TYPES: { value: JournalEntry["type"]; label: string }[] = [
  { value: "daily",      label: "Daily" },
  { value: "weekly",     label: "Weekly" },
  { value: "monthly",    label: "Monthly" },
  { value: "gratitude",  label: "Gratitude" },
  { value: "reflection", label: "Reflection" },
];

const FILTER_NAV_ITEMS = [
  { id: "all", label: "All" },
  ...ENTRY_TYPES.map((t) => ({ id: t.value, label: t.label })),
];

// ── MoodPicker ────────────────────────────────────────────────

function MoodPicker({
  value,
  onChange,
}: {
  value?: 1 | 2 | 3 | 4 | 5;
  onChange: (v: 1 | 2 | 3 | 4 | 5) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {MOODS.map((m) => (
        <button
          key={m.value}
          title={m.label}
          onClick={() => onChange(m.value)}
          className={cn(
            "relative flex flex-col items-center gap-0.5 rounded-xl px-2.5 py-2 text-xs font-medium transition-all duration-150",
            "ring-1 ring-transparent",
            value === m.value
              ? cn(m.color, "ring-1 scale-110 shadow-sm")
              : "text-muted-foreground hover:bg-muted hover:scale-105"
          )}
        >
          <span className="text-base leading-none">{m.emoji}</span>
          <span className="hidden sm:block text-[10px] tracking-wide">{m.label}</span>
        </button>
      ))}
    </div>
  );
}

// ── TagPills ──────────────────────────────────────────────────

function TagPills({
  tags,
  onRemove,
}: {
  tags: string[];
  onRemove: (tag: string) => void;
}) {
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground group"
        >
          <span className="opacity-40">#</span>
          {tag}
          <button
            onClick={() => onRemove(tag)}
            className="ml-0.5 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity text-foreground"
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}

// ── LinkedTasksPanel ──────────────────────────────────────────

function LinkedTasksPanel({ taskIds }: { taskIds: string[] }) {
  const tasks = useTaskStore((s) => s.tasks);
  const linked = taskIds
    .map((id) => tasks.find((t) => t.id === id))
    .filter(Boolean) as typeof tasks;

  if (linked.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <SectionLabel>Linked Tasks</SectionLabel>
      <div className="flex flex-col gap-0.5">
        {linked.map((task) => (
          <button
            key={task.id}
            onClick={() => bus.emit("task:open", { taskId: task.id })}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs hover:bg-muted transition-colors group"
          >
            <PriorityDot priority={task.priority} />
            <span
              className={cn(
                "flex-1 truncate font-medium",
                task.status === "done" && "line-through text-muted-foreground"
              )}
            >
              {task.title}
            </span>
            {task.projectId && (() => {
              const proj = useProjectStore.getState().getProjectById(task.projectId!);
              return proj ? (
                <span className="flex items-center gap-1 text-muted-foreground shrink-0">
                  <ProjectDot color={proj.color} />
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                    {proj.name}
                  </span>
                </span>
              ) : null;
            })()}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── LinkedProjectsPanel ───────────────────────────────────────

function LinkedProjectsPanel({ projectIds }: { projectIds: string[] }) {
  const projects = useProjectStore((s) => s.projects);
  const linked = projectIds
    .map((id) => projects.find((p) => p.id === id))
    .filter(Boolean) as typeof projects;

  if (linked.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <SectionLabel>Linked Projects</SectionLabel>
      <div className="flex flex-col gap-0.5">
        {linked.map((project) => (
          <button
            key={project.id}
            onClick={() => {
              bus.emit("project:open", { projectId: project.id });
              bus.emit("navigate:to", { path: "/projects" });
            }}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs hover:bg-muted transition-colors"
          >
            <ProjectDot color={project.color} />
            <span className="flex-1 truncate font-medium">{project.name}</span>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ring-1 ring-transparent",
                project.status === "completed"
                  ? "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {project.status}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── DailyNoteButton ───────────────────────────────────────────

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
      const created = useNoteStore
        .getState()
        .notes.find((n) => n.type === "daily" && n.date === date);
      if (created) openNote(created.id);
    }
    bus.emit("navigate:to", { path: "/notes" });
  }, [dailyNote, openNote, getOrCreateToday, date]);

  return (
    <GhostButton
      onClick={handleClick}
      title={dailyNote ? "Open daily note" : "Create daily note"}
      className="gap-1.5 text-xs"
    >
      <span className="text-sm">📝</span>
      <span>{dailyNote ? "Daily Note" : "Add Note"}</span>
    </GhostButton>
  );
}

// ── EntryEditor ───────────────────────────────────────────────
// Uses RichEditor with `borderless` — the host container already
// provides the border/rounded chrome, so we avoid double borders.

function EntryEditor({
  entry,
  onSave,
}: {
  entry: JournalEntry;
  onSave: (changes: Partial<JournalEntry>) => void;
}) {
  const [mood, setMood] = useState(entry.mood);
  const [tags, setTags] = useState<string[]>(entry.tags);
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    setMood(entry.mood);
    setTags(entry.tags);
    setTagInput("");
  }, [entry.id]);

  const handleMoodChange = useCallback(
    (v: 1 | 2 | 3 | 4 | 5) => {
      setMood(v);
      onSave({ mood: v });
    },
    [onSave]
  );

  const commitTag = useCallback(
    (raw: string) => {
      const tag = raw.trim().replace(/^#/, "");
      if (!tag || tags.includes(tag)) return;
      const next = [...tags, tag];
      setTags(next);
      onSave({ tags: next });
    },
    [tags, onSave]
  );

  const handleTagKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        commitTag(tagInput);
        setTagInput("");
      } else if (e.key === "Backspace" && tagInput === "" && tags.length > 0) {
        const next = tags.slice(0, -1);
        setTags(next);
        onSave({ tags: next });
      }
    },
    [tagInput, tags, commitTag, onSave]
  );

  const handleTagBlur = useCallback(() => {
    if (tagInput.trim()) {
      commitTag(tagInput);
      setTagInput("");
    }
  }, [tagInput, commitTag]);

  const removeTag = useCallback(
    (tag: string) => {
      const next = tags.filter((t) => t !== tag);
      setTags(next);
      onSave({ tags: next });
    },
    [tags, onSave]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Mood row */}
      <div className="px-6 py-4 border-b flex items-center justify-between gap-4">
        <span className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
          How are you feeling?
        </span>
        <MoodPicker value={mood} onChange={handleMoodChange} />
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">
        {/*
          borderless={true}  — The px-6 py-5 container is the chrome; no extra border needed.
          resetKey={entry.id} — Resets editor state when switching between journal entries.
          debounceMs={600}    — Slightly tighter debounce for journal (feels more responsive).
        */}
        <RichEditor
          content={entry.content}
          onChange={(json) => onSave({ content: json })}
          placeholder="What's on your mind…"
          resetKey={entry.id}
          minHeight="min-h-[280px]"
          debounceMs={600}
          borderless
          className="flex-1"
        />

        {/* Tags */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
            Tags
          </span>
          <div
            className={cn(
              "flex flex-wrap gap-1.5 rounded-lg border bg-background px-3 py-2 min-h-[38px]",
              "focus-within:ring-2 focus-within:ring-ring/30 transition-shadow"
            )}
          >
            <TagPills tags={tags} onRemove={removeTag} />
            <input
              className="flex-1 min-w-[120px] bg-transparent text-xs placeholder:text-muted-foreground/60 focus:outline-none"
              placeholder={tags.length === 0 ? "Add tags — press Enter or comma" : "Add more…"}
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              onBlur={handleTagBlur}
            />
          </div>
        </div>

        {/* Linked items */}
        <LinkedTasksPanel taskIds={entry.linkedTaskIds} />
        <LinkedProjectsPanel projectIds={entry.linkedProjectIds} />
      </div>
    </div>
  );
}

// ── EntryListItem ─────────────────────────────────────────────

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
  const moodStrip = entry.mood ? MOOD_STRIP[entry.mood] : null;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-xl transition-all duration-150 overflow-hidden",
        "flex items-stretch",
        isActive
          ? "bg-primary/8 ring-1 ring-primary/20 shadow-sm"
          : "hover:bg-muted/60"
      )}
    >
      {/* Mood accent strip */}
      <div
        className={cn(
          "w-1 shrink-0 rounded-l-xl transition-colors",
          moodStrip ?? "bg-transparent"
        )}
      />
      <div className="flex-1 px-3 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span
              className={cn(
                "text-sm font-semibold truncate leading-tight",
                isActive ? "text-primary" : "text-foreground"
              )}
            >
              {formatDate(entry.date)}
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={cn(
                  "inline-block rounded-full px-2 py-px text-[10px] font-medium capitalize ring-1",
                  TYPE_BADGE[entry.type] ?? "bg-muted text-muted-foreground ring-transparent"
                )}
              >
                {entry.type}
              </span>
              {entry.linkedTaskIds.length > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  {entry.linkedTaskIds.length} task{entry.linkedTaskIds.length !== 1 ? "s" : ""}
                </span>
              )}
              {entry.tags.length > 0 && (
                <span className="text-[10px] text-muted-foreground truncate">
                  #{entry.tags.slice(0, 2).join(" #")}
                </span>
              )}
            </div>
          </div>
          {mood && (
            <span className="text-base leading-none shrink-0 mt-0.5" title={mood.label}>
              {mood.emoji}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ── NewEntryModal ─────────────────────────────────────────────

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden border border-border/50">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">New Entry</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        <div className="px-6 pb-6 flex flex-col gap-4">
          {/* Type — pill selector */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Type
            </label>
            <div className="flex flex-wrap gap-1.5">
              {ENTRY_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium ring-1 transition-all",
                    type === t.value
                      ? cn(TYPE_BADGE[t.value], "scale-105")
                      : "bg-muted/50 text-muted-foreground ring-transparent hover:bg-muted"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Date
            </label>
            <input
              type="date"
              className={cn(
                "rounded-lg border bg-background px-3 py-2 text-sm",
                "focus:outline-none focus:ring-2 focus:ring-ring/30 transition-shadow"
              )}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-1">
            <GhostButton onClick={onClose}>Cancel</GhostButton>
            <PrimaryButton
              onClick={() => {
                onCreate(type, date);
                onClose();
              }}
            >
              Create Entry
            </PrimaryButton>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── JournalModule ─────────────────────────────────────────────

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

  const filtered =
    filterType === "all" ? entries : entries.filter((e) => e.type === filterType);

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
      {/* ── Sidebar ── */}
      <div className="w-68 shrink-0 border-r flex flex-col bg-muted/20">
        {/* New entry button */}
        <div className="p-3 border-b">
          <PrimaryButton
            className="w-full justify-center gap-1.5"
            onClick={() => setShowNewModal(true)}
          >
            <span className="text-base leading-none">+</span>
            New Entry
          </PrimaryButton>
        </div>

        {/* Type filter */}
        <div className="px-2 pt-2 pb-1 border-b">
          <SubNav
            items={FILTER_NAV_ITEMS}
            activeId={filterType}
            onSelect={(id) => setFilterType(id as typeof filterType)}
          />
        </div>

        {/* Entry count */}
        {!isLoading && filtered.length > 0 && (
          <div className="px-4 py-2">
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
              {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
            </span>
          </div>
        )}

        {/* Entry list */}
        <div className="flex-1 overflow-y-auto px-2 pb-2 flex flex-col gap-1">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <span className="text-xs text-muted-foreground animate-pulse">Loading…</span>
            </div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div className="py-8">
              <EmptyState title="No entries yet" subtitle="Start writing today" />
            </div>
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

      {/* ── Editor pane ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {activeEntry ? (
          <>
            {/* Editor header */}
            <div className="px-6 py-4 border-b flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <h1 className="text-lg font-semibold leading-tight truncate">
                    {formatDate(activeEntry.date)}
                  </h1>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-px text-[11px] font-medium capitalize ring-1",
                        TYPE_BADGE[activeEntry.type] ??
                          "bg-muted text-muted-foreground ring-transparent"
                      )}
                    >
                      {activeEntry.type}
                    </span>
                    {activeEntry.updatedAt && (
                      <span className="text-[11px] text-muted-foreground/60">
                        Saved
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {activeEntry.type === "daily" && (
                  <DailyNoteButton date={activeEntry.date} />
                )}
              </div>
            </div>

            {/* Editor body */}
            <div className="flex-1 overflow-y-auto">
              <EntryEditor
                key={activeEntry.id}
                entry={activeEntry}
                onSave={handleUpdate}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
            <span className="text-4xl opacity-30">📖</span>
            <EmptyState
              title="Select an entry"
              subtitle="Choose one from the sidebar or create something new"
            />
          </div>
        )}
      </div>

      {/* Modal */}
      {showNewModal && (
        <NewEntryModal
          onClose={() => setShowNewModal(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}
