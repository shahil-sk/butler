// ============================================================
// JOURNAL MODULE — Redesigned (modern two-panel + heatmap)
// ============================================================

import React, {
  useEffect, useState, useCallback, useMemo, useRef,
} from "react";
import { createPortal } from "react-dom";
import {
  BookOpen, Plus, Search, Tag, Link2, Trash2,
  ChevronLeft, ChevronRight, CalendarDays, BarChart2,
  X, Check, AlignLeft, Clock,
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

const TYPE_STYLE: Record<string, { pill: string; border: string }> = {
  daily:      { pill: "bg-violet-500/10 text-violet-600 ring-violet-400/25",  border: "border-l-violet-400" },
  weekly:     { pill: "bg-blue-500/10 text-blue-600 ring-blue-400/25",        border: "border-l-blue-400" },
  monthly:    { pill: "bg-indigo-500/10 text-indigo-600 ring-indigo-400/25",  border: "border-l-indigo-400" },
  gratitude:  { pill: "bg-pink-500/10 text-pink-600 ring-pink-400/25",        border: "border-l-pink-400" },
  reflection: { pill: "bg-amber-500/10 text-amber-600 ring-amber-400/25",     border: "border-l-amber-400" },
};

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

function shortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function calMonth(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const days: (Date | null)[] = [];
  const startPad = first.getDay();
  for (let i = 0; i < startPad; i++) days.push(null);
  const last = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= last; d++) days.push(new Date(year, month, d));
  return days;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
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
            "flex flex-col items-center gap-0.5 rounded-xl px-3 py-2 transition-all duration-150 ring-1 ring-transparent",
            value === m.value
              ? cn(m.bg, m.text, m.ring, "ring-1 scale-110 shadow-sm")
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

// ── CalendarHeatmap ───────────────────────────────────────────

function CalendarHeatmap({ entries, activeDate, onDateClick }: {
  entries: JournalEntry[];
  activeDate: ISODate | null;
  onDateClick: (d: ISODate) => void;
}) {
  const nowDate = new Date();
  const [year, setYear] = useState(nowDate.getFullYear());
  const [month, setMonth] = useState(nowDate.getMonth());

  const dateMap = useMemo(() => {
    const map = new Map<string, JournalEntry[]>();
    for (const e of entries) {
      const arr = map.get(e.date) ?? [];
      arr.push(e);
      map.set(e.date, arr);
    }
    return map;
  }, [entries]);

  const days = calMonth(year, month);
  const monthLabel = new Date(year, month).toLocaleDateString("en-IN", {
    month: "long", year: "numeric",
  });

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  return (
    <div className="px-3 py-3 border-b border-border/60">
      <div className="flex items-center justify-between mb-2.5">
        <button onClick={prevMonth} className="p-1 rounded-md hover:bg-muted/60 text-muted-foreground/60 hover:text-foreground transition-colors">
          <ChevronLeft size={13} />
        </button>
        <span className="text-[11px] font-semibold text-foreground/70">{monthLabel}</span>
        <button onClick={nextMonth} className="p-1 rounded-md hover:bg-muted/60 text-muted-foreground/60 hover:text-foreground transition-colors">
          <ChevronRight size={13} />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {["S","M","T","W","T","F","S"].map((d, i) => (
          <span key={i} className="text-center text-[9px] text-muted-foreground/50 font-medium">{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((d, i) => {
          if (!d) return <div key={`pad-${i}`} />;
          const iso = isoDate(d);
          const dayEntries = dateMap.get(iso) ?? [];
          const hasEntry = dayEntries.length > 0;
          const isToday = iso === today();
          const isActive = iso === activeDate;
          const mood = dayEntries[0]?.mood;
          const moodDot = mood ? MOODS.find(m => m.value === mood)?.dot : null;

          return (
            <button
              key={iso}
              onClick={() => hasEntry && onDateClick(iso)}
              title={hasEntry ? `${dayEntries.length} entr${dayEntries.length > 1 ? "ies" : "y"}` : undefined}
              className={cn(
                "relative aspect-square flex items-center justify-center rounded-md text-[10px] font-medium transition-all duration-100",
                hasEntry ? "cursor-pointer" : "cursor-default",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : isToday
                    ? "ring-1 ring-primary/50 text-primary font-bold"
                    : hasEntry
                      ? "bg-muted/60 hover:bg-muted text-foreground"
                      : "text-muted-foreground/40"
              )}
            >
              {d.getDate()}
              {hasEntry && !isActive && moodDot && (
                <span className={cn("absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full", moodDot)} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── StatsBar ──────────────────────────────────────────────────

function StatsBar({ entries }: { entries: JournalEntry[] }) {
  const total = entries.length;
  const thisMonth = entries.filter(e => e.date.startsWith(today().slice(0, 7))).length;
  const moodEntries = entries.filter(e => e.mood);
  const avgMood = moodEntries.length
    ? moodEntries.reduce((s, e) => s + (e.mood ?? 0), 0) / moodEntries.length
    : null;
  const moodEmoji = avgMood != null
    ? MOODS.reduce((prev, curr) =>
        Math.abs(curr.value - avgMood) < Math.abs(prev.value - avgMood) ? curr : prev
      ).emoji
    : "—";

  return (
    <div className="flex items-center border-b border-border/60 bg-muted/10">
      {[
        { label: "Total",      value: String(total),    icon: <BookOpen size={11} /> },
        { label: "This month", value: String(thisMonth), icon: <CalendarDays size={11} /> },
        { label: "Avg mood",   value: moodEmoji,         icon: <BarChart2 size={11} /> },
      ].map((s, i) => (
        <div key={i} className={cn(
          "flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5",
          i < 2 && "border-r border-border/60"
        )}>
          <span className="flex items-center gap-1 text-muted-foreground/60">{s.icon}</span>
          <span className="text-[14px] font-bold text-foreground/80">{s.value}</span>
          <span className="text-[9px] text-muted-foreground/50 font-medium">{s.label}</span>
        </div>
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
  const mood = MOODS.find(m => m.value === entry.mood);
  const typeStyle = TYPE_STYLE[entry.type];
  const words = wordCount(entry.content);

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left group transition-all duration-150 rounded-xl overflow-hidden border-l-2",
        isActive
          ? "bg-primary/8 border-l-primary shadow-sm ring-1 ring-primary/15"
          : cn("border-l-transparent hover:bg-muted/50", `hover:${typeStyle.border}`)
      )}
    >
      <div className="flex items-start gap-2.5 px-3 py-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1.5 mb-0.5">
            <span className={cn("text-[12px] font-semibold truncate", isActive ? "text-primary" : "")}>
              {shortDate(entry.date)}
            </span>
            {mood && <span className="text-[13px] leading-none shrink-0">{mood.emoji}</span>}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={cn("text-[9px] font-medium px-1.5 py-px rounded-full ring-1 capitalize", typeStyle.pill)}>
              {entry.type}
            </span>
            {words > 0 && (
              <span className="text-[9px] text-muted-foreground/50">{words}w</span>
            )}
            {entry.tags.length > 0 && (
              <span className="text-[9px] text-muted-foreground/50 truncate max-w-[80px]">
                #{entry.tags[0]}{entry.tags.length > 1 ? ` +${entry.tags.length - 1}` : ""}
              </span>
            )}
          </div>
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
    <div className="flex flex-wrap gap-1.5 items-center rounded-xl border border-border/60 bg-muted/20 px-3 py-2 min-h-[38px] focus-within:ring-1 focus-within:ring-primary/25 transition-all">
      {tags.map(tag => (
        <span key={tag} className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground group/tag">
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
        placeholder={tags.length === 0 ? "Add tags…" : "+"}
        className="flex-1 min-w-[80px] bg-transparent text-[11px] placeholder:text-muted-foreground/40 focus:outline-none"
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
        <div key={task.id} className="group flex items-center gap-2 rounded-lg px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors">
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
      <div className="w-full max-w-sm bg-background border border-border rounded-2xl shadow-2xl overflow-hidden animate-modal-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
          <h2 className="text-[14px] font-semibold">New Journal Entry</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-muted/60 transition-colors">
            <X size={14} />
          </button>
        </div>
        <div className="px-5 py-4 flex flex-col gap-4">
          {/* Type grid */}
          <div className="grid grid-cols-5 gap-1.5">
            {ENTRY_TYPES.map(t => (
              <button
                key={t.value}
                onClick={() => setType(t.value)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl py-2.5 text-[10px] font-medium transition-all ring-1",
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
          {/* Date */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Date</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
            />
          </div>
          {/* Actions */}
          <div className="flex gap-2 justify-end pt-1">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
              Cancel
            </button>
            <button
              onClick={() => { onCreate(type, date); onClose(); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
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
      {/* Top bar */}
      <div className="shrink-0 flex items-center justify-between gap-4 px-6 py-3.5 border-b border-border/60 bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <span className="text-lg leading-none">{typeInfo.icon}</span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[14px] font-bold">{formatDate(entry.date)}</h2>
              <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full ring-1 capitalize", typeStyle.pill)}>
                {entry.type}
              </span>
            </div>
            <div className="flex items-center gap-2.5 mt-0.5">
              {words > 0 && (
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                  <AlignLeft size={9} />{words} words
                </span>
              )}
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                <Clock size={9} />
                {new Date(entry.updatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>
        </div>
        {/* Delete */}
        {showDeleteConfirm ? (
          <div className="flex items-center gap-1.5 bg-destructive/10 rounded-xl px-2.5 py-1.5">
            <span className="text-[11px] text-destructive font-medium">Delete?</span>
            <button onClick={onDelete} className="px-2 py-0.5 rounded-lg bg-destructive text-destructive-foreground text-[11px] font-semibold">Yes</button>
            <button onClick={() => setShowDeleteConfirm(false)} className="px-2 py-0.5 rounded-lg text-muted-foreground hover:text-foreground text-[11px]">No</button>
          </div>
        ) : (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Delete entry"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {/* Mood bar */}
      <div className="shrink-0 flex items-center justify-between px-6 py-3 border-b border-border/60 bg-muted/10">
        <span className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wide">How are you feeling?</span>
        <MoodPicker value={mood} onChange={handleMoodChange} />
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-8 py-6">
          <RichEditor
            content={entry.content}
            onChange={(json) => onSave({ content: json })}
            placeholder="What's on your mind…"
            resetKey={entry.id}
            minHeight="min-h-[320px]"
            debounceMs={500}
            borderless
            className="flex-1"
          />
        </div>
      </div>

      {/* Metadata drawer */}
      <div className="shrink-0 border-t border-border/60 bg-muted/10 px-6 py-4 flex flex-col gap-3.5">
        <div className="flex items-start gap-3">
          <div className="flex items-center gap-1.5 mt-2 shrink-0 w-20">
            <Tag size={11} className="text-muted-foreground/50" />
            <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide">Tags</span>
          </div>
          <div className="flex-1">
            <TagInput tags={tags} onChange={handleTagsChange} />
          </div>
        </div>
        {entry.linkedTaskIds.length > 0 && (
          <div className="flex items-start gap-3">
            <div className="flex items-center gap-1.5 mt-2 shrink-0 w-20">
              <Link2 size={11} className="text-muted-foreground/50" />
              <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide">Tasks</span>
            </div>
            <div className="flex-1">
              <LinkedTasksPanel taskIds={entry.linkedTaskIds} entryId={entry.id} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── EmptyEditorPlaceholder ────────────────────────────────────

function EmptyEditorPlaceholder({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
      <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center text-3xl">📖</div>
      <div>
        <p className="text-[15px] font-semibold text-foreground/70">No entry selected</p>
        <p className="text-[12px] text-muted-foreground/60 mt-1 max-w-[24ch]">
          Pick a date from the calendar or start a new entry.
        </p>
      </div>
      <button
        onClick={onNew}
        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-[12px] font-semibold hover:bg-primary/90 transition-colors"
      >
        <Plus size={13} />
        New Entry
      </button>
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

  const handleDateClick = useCallback((date: ISODate) => {
    const entry = entries.find(e => e.date === date);
    if (entry) setActiveEntry(entry.id);
  }, [entries, setActiveEntry]);

  return (
    <div className="flex h-full overflow-hidden bg-background">
      {/* ── Sidebar ── */}
      <div className="w-64 shrink-0 border-r border-border/60 flex flex-col bg-muted/10 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-border/60">
          <div className="flex items-center gap-2">
            <BookOpen size={15} className="text-primary" />
            <span className="text-[13px] font-bold">Journal</span>
          </div>
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-semibold hover:bg-primary/90 transition-colors"
          >
            <Plus size={12} />
            New
          </button>
        </div>

        {/* Stats */}
        <StatsBar entries={entries} />

        {/* Calendar heatmap */}
        <CalendarHeatmap
          entries={entries}
          activeDate={activeEntry?.date ?? null}
          onDateClick={handleDateClick}
        />

        {/* Search */}
        <div className="px-3 py-2 border-b border-border/60">
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border/50 focus-within:ring-1 focus-within:ring-primary/25 transition-all">
            <Search size={11} className="text-muted-foreground/50 shrink-0" />
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search entries…"
              className="flex-1 bg-transparent text-[11px] placeholder:text-muted-foreground/40 focus:outline-none"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-muted-foreground/50 hover:text-foreground transition-colors">
                <X size={10} />
              </button>
            )}
          </div>
        </div>

        {/* Type filter pills */}
        <div className="px-3 py-2 flex flex-wrap gap-1 border-b border-border/60">
          {[{ value: "all" as const, label: "All" }, ...ENTRY_TYPES].map(f => (
            <button
              key={f.value}
              onClick={() => setFilterType(f.value as typeof filterType)}
              className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ring-1",
                filterType === f.value
                  ? f.value === "all"
                    ? "bg-foreground/10 text-foreground ring-border"
                    : cn(TYPE_STYLE[f.value]?.pill)
                  : "bg-transparent text-muted-foreground/60 ring-transparent hover:text-foreground hover:bg-muted/50"
              )}
            >
              {"icon" in f ? `${f.icon} ` : ""}{f.label}
            </button>
          ))}
        </div>

        {/* Entry list */}
        <div className="flex-1 overflow-y-auto py-1.5 px-2 flex flex-col gap-0.5">
          {isLoading ? (
            [...Array(4)].map((_, i) => (
              <div key={i} className="h-12 rounded-xl bg-muted/40 animate-pulse" />
            ))
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
              <span className="text-2xl">📭</span>
              <span className="text-[11px] text-muted-foreground/60">
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

      {/* ── Main panel ── */}
      <div className="flex-1 overflow-hidden">
        {activeEntry ? (
          <EntryEditor
            entry={activeEntry}
            onSave={handleUpdate}
            onDelete={handleDelete}
          />
        ) : (
          <EmptyEditorPlaceholder onNew={() => setShowNewModal(true)} />
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
