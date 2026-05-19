// ============================================================
// JOURNAL MODULE — Notes-style layout
// ============================================================

import React, {
  useEffect, useState, useCallback, useMemo, useRef,
} from "react";
import { createPortal } from "react-dom";
import {
  Plus, Search, Tag, Link2, Trash2,
  X, Check, AlignLeft, Clock, PenLine,
} from "lucide-react";
import { RichEditor } from "@/shared/RichEditor";
import { registry } from "@/kernel/router";
import { bus } from "@/kernel/event-bus";
import { useJournalStore } from "./store";
import { setupJournalEventListeners } from "./events";
import { JOURNAL_MANIFEST } from "./manifest";
import { generateId, today, formatDate } from "@/shared/utils";
import type { JournalEntry, ISODate } from "@/shared/types";
import { useTaskStore } from "@/modules/tasks/store";
import { ProjectDot, PriorityDot } from "@/shared/ui";
import { cn } from "@/shared/utils";

// ── Constants ─────────────────────────────────────────────────

const MOODS = [
  { value: 1 as const, emoji: "😔", label: "Rough",  bg: "bg-rose-500/15",    text: "text-rose-500",    dot: "bg-rose-400",    ring: "ring-rose-400/40" },
  { value: 2 as const, emoji: "😕", label: "Low",    bg: "bg-orange-500/15",  text: "text-orange-500",  dot: "bg-orange-400",  ring: "ring-orange-400/40" },
  { value: 3 as const, emoji: "😐", label: "Okay",   bg: "bg-yellow-500/15",  text: "text-yellow-500",  dot: "bg-yellow-400",  ring: "ring-yellow-400/40" },
  { value: 4 as const, emoji: "🙂", label: "Good",   bg: "bg-emerald-500/15", text: "text-emerald-500", dot: "bg-emerald-400", ring: "ring-emerald-400/40" },
  { value: 5 as const, emoji: "😄", label: "Great",  bg: "bg-sky-500/15",     text: "text-sky-500",     dot: "bg-sky-400",     ring: "ring-sky-400/40" },
];

const ENTRY_TYPES: { value: JournalEntry["type"]; label: string; icon: string }[] = [
  { value: "daily",      label: "Daily",      icon: "🌅" },
  { value: "weekly",     label: "Weekly",     icon: "📅" },
  { value: "monthly",    label: "Monthly",    icon: "🗓️" },
  { value: "gratitude",  label: "Gratitude",  icon: "🙏" },
  { value: "reflection", label: "Reflection", icon: "🔍" },
];

const TYPE_STYLE: Record<string, { pill: string }> = {
  daily:      { pill: "bg-violet-500/10 text-violet-600 ring-violet-400/25" },
  weekly:     { pill: "bg-blue-500/10 text-blue-600 ring-blue-400/25" },
  monthly:    { pill: "bg-indigo-500/10 text-indigo-600 ring-indigo-400/25" },
  gratitude:  { pill: "bg-pink-500/10 text-pink-600 ring-pink-400/25" },
  reflection: { pill: "bg-amber-500/10 text-amber-600 ring-amber-400/25" },
};

// View tabs
const VIEW_TABS: { id: JournalEntry["type"] | "all"; label: string }[] = [
  { id: "all",        label: "All" },
  { id: "daily",      label: "Daily" },
  { id: "weekly",     label: "Weekly" },
  { id: "monthly",    label: "Monthly" },
  { id: "gratitude",  label: "Gratitude" },
  { id: "reflection", label: "Reflection" },
];

// ── Helpers ───────────────────────────────────────────────────

function wordCount(jsonStr: string): number {
  try {
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
    const text = extractText(parsed);
    return text.trim() ? text.trim().split(/\s+/).length : 0;
  } catch {
    return 0;
  }
}

function extractText(node: Record<string, unknown>): string {
  if (node.type === "text") return (node.text as string) ?? "";
  if (Array.isArray(node.content)) {
    return (node.content as Record<string, unknown>[]).map(extractText).join(" ");
  }
  return "";
}

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "less than a minute ago";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) {
    const h = Math.floor(diff / 3600);
    return `about ${h} hour${h > 1 ? "s" : ""} ago`;
  }
  const days = Math.floor(diff / 86400);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function entryTitle(entry: JournalEntry): string {
  try {
    const text = extractText(JSON.parse(entry.content) as Record<string, unknown>).trim();
    if (text) return text.slice(0, 60);
  } catch { /* noop */ }
  return formatDate(entry.date);
}

// ── MoodPicker ────────────────────────────────────────────────

function MoodPicker({ value, onChange }: {
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
            "flex flex-col items-center gap-0.5 rounded-lg px-3 py-2 transition-all duration-150 ring-1 ring-transparent",
            value === m.value
              ? cn(m.bg, m.text, m.ring, "ring-1 scale-110")
              : "text-muted-foreground/50 hover:bg-muted/70 hover:text-foreground hover:scale-105"
          )}
        >
          <span className="text-xl leading-none">{m.emoji}</span>
          <span className="text-[9px] font-medium tracking-wide opacity-70">{m.label}</span>
        </button>
      ))}
    </div>
  );
}

// ── SidebarEntryItem ──────────────────────────────────────────

function SidebarEntryItem({ entry, isActive, onClick }: {
  entry: JournalEntry;
  isActive: boolean;
  onClick: () => void;
}) {
  const typeInfo = ENTRY_TYPES.find(t => t.value === entry.type)!;
  const title = entryTitle(entry);

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left transition-all duration-150 rounded-md px-3 py-2.5",
        isActive ? "bg-accent text-accent-foreground" : "hover:bg-muted/60"
      )}
    >
      <div className="flex items-start gap-2.5">
        <span className="text-[13px] leading-none mt-0.5 shrink-0">{typeInfo.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium truncate leading-snug text-foreground">
            {title || "Untitled"}
          </p>
          <p className="text-[11px] text-muted-foreground/60 mt-0.5">
            {relativeTime(entry.updatedAt)}
          </p>
        </div>
      </div>
    </button>
  );
}

// ── TagInput ──────────────────────────────────────────────────

function TagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState("");

  const commit = (raw: string) => {
    const tag = raw.trim().replace(/^#/, "");
    if (!tag || tags.includes(tag)) return;
    onChange([...tags, tag]);
    setInput("");
  };

  const remove = (tag: string) => onChange(tags.filter(t => t !== tag));

  return (
    <div className="flex flex-wrap gap-1.5 items-center min-h-[24px]">
      {tags.map(tag => (
        <span key={tag} className="flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground group/tag">
          <span className="opacity-40">#</span>{tag}
          <button onClick={() => remove(tag)} className="opacity-0 group-hover/tag:opacity-70 hover:!opacity-100 transition-opacity ml-0.5">
            <X size={9} />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commit(input); }
          if (e.key === "Backspace" && !input && tags.length) remove(tags[tags.length - 1]);
        }}
        onBlur={() => { if (input) commit(input); }}
        placeholder={tags.length === 0 ? "Add tag…" : "+"}
        className="flex-1 min-w-[80px] bg-transparent text-[12px] text-muted-foreground/50 placeholder:text-muted-foreground/40 focus:outline-none"
      />
    </div>
  );
}

// ── LinkedTasksPanel ──────────────────────────────────────────

function LinkedTasksPanel({ taskIds, entryId }: { taskIds: string[]; entryId: string }) {
  const tasks = useTaskStore(s => s.tasks);
  const { unlinkTask } = useJournalStore();
  const linked = taskIds.map(id => tasks.find(t => t.id === id)).filter(Boolean) as typeof tasks;

  if (linked.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      {linked.map(task => (
        <div key={task.id} className="group flex items-center gap-2 rounded-md px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors">
          <PriorityDot priority={task.priority} />
          <button
            onClick={() => bus.emit("task:open", { taskId: task.id })}
            className={cn("flex-1 text-left text-[12px] font-medium truncate", task.status === "done" && "line-through text-muted-foreground")}
          >
            {task.title}
          </button>
          <button
            onClick={() => void unlinkTask(entryId, task.id)}
            className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
            title="Unlink task"
          >
            <X size={11} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ── NewEntryModal ─────────────────────────────────────────────

function NewEntryModal({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (type: JournalEntry["type"], date: ISODate) => void;
}) {
  const [type, setType] = useState<JournalEntry["type"]>("daily");
  const [date, setDate] = useState(today());

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-[3px]"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm bg-background border border-border rounded-xl shadow-2xl overflow-hidden animate-modal-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
          <h2 className="text-[14px] font-semibold">New Journal Entry</h2>
          <button onClick={onClose} className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-muted/60 transition-colors">
            <X size={14} />
          </button>
        </div>
        <div className="px-5 py-4 flex flex-col gap-4">
          <div className="grid grid-cols-5 gap-1.5">
            {ENTRY_TYPES.map(t => (
              <button
                key={t.value}
                onClick={() => setType(t.value)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg py-2.5 text-[10px] font-medium transition-all ring-1",
                  type === t.value
                    ? cn(TYPE_STYLE[t.value].pill, "ring-current/30 scale-[1.04]")
                    : "bg-muted/40 text-muted-foreground ring-transparent hover:bg-muted"
                )}
              >
                <span className="text-lg leading-none">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
            />
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
              Cancel
            </button>
            <button
              onClick={() => { onCreate(type, date); onClose(); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Check size={13} />
              Create Entry
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── EntryEditor ───────────────────────────────────────────────

function EntryEditor({ entry, onSave, onDelete }: {
  entry: JournalEntry;
  onSave: (changes: Partial<JournalEntry>) => void;
  onDelete: () => void;
}) {
  const [mood, setMood] = useState(entry.mood);
  const [tags, setTags] = useState(entry.tags);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    setMood(entry.mood);
    setTags(entry.tags);
    setShowDeleteConfirm(false);
  }, [entry.id]);

  const words = wordCount(entry.content);
  const typeInfo = ENTRY_TYPES.find(t => t.value === entry.type)!;
  const typeStyle = TYPE_STYLE[entry.type];

  const handleMoodChange = useCallback((v: 1 | 2 | 3 | 4 | 5) => {
    setMood(v);
    onSave({ mood: v });
  }, [onSave]);

  const handleTagsChange = useCallback((t: string[]) => {
    setTags(t);
    onSave({ tags: t });
  }, [onSave]);

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Title + meta row ── */}
      <div className="shrink-0 px-8 pt-8 pb-0">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-[26px] font-bold leading-tight tracking-tight text-foreground">
            {formatDate(entry.date)}
          </h1>
          {/* Right: meta + actions */}
          <div className="flex items-center gap-1.5 mt-1.5 shrink-0">
            {words > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground/50">
                <AlignLeft size={10} />{words}w
              </span>
            )}
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground/50 mr-1">
              <Clock size={10} />
              {new Date(entry.updatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded ring-1 capitalize", typeStyle.pill)}>
              {typeInfo.icon} {entry.type}
            </span>
            {showDeleteConfirm ? (
              <div className="flex items-center gap-1 bg-destructive/10 rounded-md px-2 py-1 ml-1">
                <span className="text-[11px] text-destructive font-medium">Delete?</span>
                <button onClick={onDelete} className="px-1.5 py-0.5 rounded bg-destructive text-destructive-foreground text-[11px] font-semibold">Yes</button>
                <button onClick={() => setShowDeleteConfirm(false)} className="px-1.5 py-0.5 rounded text-muted-foreground hover:text-foreground text-[11px]">No</button>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-1.5 rounded-md text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Delete entry"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Tag row — inline, no border box */}
        <div className="flex items-center gap-1.5 mt-2 mb-3">
          <Tag size={11} className="text-muted-foreground/40 shrink-0" />
          <TagInput tags={tags} onChange={handleTagsChange} />
        </div>
      </div>

      {/* ── Mood row ── */}
      <div className="shrink-0 flex items-center gap-3 px-8 py-2 border-b border-border/40">
        <span className="text-[11px] text-muted-foreground/50 font-medium shrink-0">Mood</span>
        <MoodPicker value={mood} onChange={handleMoodChange} />
      </div>

      {/* ── Rich editor ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-8 py-5">
          <RichEditor
            content={entry.content}
            onChange={(json) => onSave({ content: json })}
            placeholder="Write something, or type / for commands…"
            resetKey={entry.id}
            minHeight="min-h-[320px]"
            debounceMs={500}
            borderless
            className="flex-1"
          />
        </div>
      </div>

      {/* ── Linked tasks — only if present ── */}
      {entry.linkedTaskIds.length > 0 && (
        <div className="shrink-0 border-t border-border/50 bg-muted/10 px-8 py-3 flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <Link2 size={11} className="text-muted-foreground/50" />
            <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide">Linked tasks</span>
          </div>
          <LinkedTasksPanel taskIds={entry.linkedTaskIds} entryId={entry.id} />
        </div>
      )}
    </div>
  );
}

// ── EmptyEditorPlaceholder ────────────────────────────────────

function EmptyEditorPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
      <PenLine size={32} className="text-muted-foreground/20" />
      <div>
        <p className="text-[14px] font-semibold text-foreground/60">No entry selected</p>
        <p className="text-[12px] text-muted-foreground/40 mt-1 max-w-[26ch]">
          Pick an entry from the list or create a new one.
        </p>
      </div>
    </div>
  );
}

// ── JournalModule ─────────────────────────────────────────────

export default function JournalModule() {
  const {
    entries, activeEntryId, isLoading,
    loadEntries, getOrCreateDaily, createEntry, updateEntry, deleteEntry, setActiveEntry,
  } = useJournalStore();

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<JournalEntry["type"] | "all">("all");
  const [showNewModal, setShowNewModal] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    registry.register(JOURNAL_MANIFEST);
    const cleanup = setupJournalEventListeners();
    return cleanup;
  }, []);

  useEffect(() => {
    void loadEntries().then(() => getOrCreateDaily(today()));
  }, []);

  const activeEntry = entries.find(e => e.id === activeEntryId) ?? null;

  const filtered = useMemo(() => {
    let list = filterType === "all" ? entries : entries.filter(e => e.type === filterType);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        formatDate(e.date).toLowerCase().includes(q) ||
        e.tags.some(t => t.toLowerCase().includes(q)) ||
        e.type.includes(q)
      );
    }
    return list;
  }, [entries, filterType, search]);

  const handleCreate = useCallback(async (type: JournalEntry["type"], date: ISODate) => {
    await createEntry({ type, date });
  }, [createEntry]);

  const handleUpdate = useCallback((changes: Partial<JournalEntry>) => {
    if (!activeEntryId) return;
    void updateEntry(activeEntryId, changes);
  }, [activeEntryId, updateEntry]);

  const handleDelete = useCallback(async () => {
    if (!activeEntryId) return;
    await deleteEntry(activeEntryId);
  }, [activeEntryId, deleteEntry]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">

      {/* ── Row 1: Title + action ── */}
      <div className="flex items-center justify-between px-6 pt-6 pb-3 shrink-0">
        <div>
          <h1 className="text-[18px] font-bold leading-tight tracking-tight">Journal</h1>
          <p className="text-[12px] text-muted-foreground mt-0.5 leading-tight">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-[12px] font-semibold hover:bg-primary/90 transition-colors"
        >
          <Plus size={13} />
          New entry
        </button>
      </div>

      {/* ── Row 2: View switcher tabs ── */}
      <div className="flex items-center px-6 border-b border-border shrink-0">
        {VIEW_TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setFilterType(id)}
            className={cn(
              "inline-flex items-center px-3 py-3 text-[13px] font-medium",
              "border-b-2 -mb-px transition-colors",
              filterType === id
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Two-panel body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* List panel */}
        <div className="w-[260px] shrink-0 border-r border-border/60 flex flex-col overflow-hidden">

          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-2.5 shrink-0">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              Entries
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => searchRef.current?.focus()}
                className="p-1 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-muted/60 transition-colors"
                title="Search"
              >
                <Search size={13} />
              </button>
              <button
                onClick={() => setShowNewModal(true)}
                className="p-1 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-muted/60 transition-colors"
                title="New entry"
              >
                <Plus size={13} />
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="px-3 pb-2 shrink-0">
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-muted/40 border border-border/40 focus-within:ring-1 focus-within:ring-primary/25 transition-all">
              <Search size={11} className="text-muted-foreground/40 shrink-0" />
              <input
                ref={searchRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search…"
                className="flex-1 bg-transparent text-[12px] placeholder:text-muted-foreground/40 focus:outline-none"
              />
              {search && (
                <button onClick={() => setSearch("")} className="text-muted-foreground/40 hover:text-foreground transition-colors">
                  <X size={10} />
                </button>
              )}
            </div>
          </div>

          {/* Entry list */}
          <div className="flex-1 overflow-y-auto px-2 py-1 flex flex-col gap-0.5">
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <div key={i} className="h-14 rounded-md bg-muted/40 animate-pulse mx-1" />
              ))
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
                <span className="text-2xl">📭</span>
                <span className="text-[11px] text-muted-foreground/50 italic">
                  {search ? "No matching entries" : "No entries yet"}
                </span>
              </div>
            ) : (
              filtered.map(e => (
                <SidebarEntryItem
                  key={e.id}
                  entry={e}
                  isActive={e.id === activeEntryId}
                  onClick={() => setActiveEntry(e.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Editor panel */}
        <div className="flex-1 overflow-hidden">
          {activeEntry ? (
            <EntryEditor
              entry={activeEntry}
              onSave={handleUpdate}
              onDelete={handleDelete}
            />
          ) : (
            <EmptyEditorPlaceholder />
          )}
        </div>
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
