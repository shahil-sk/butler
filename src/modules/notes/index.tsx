// ============================================================
// NOTES MODULE — ROOT  (redesign v3)
// New:
//   • Word / char count in toolbar
//   • Tag filter chips + inline tag editor on notes
//   • Cmd/Ctrl-K quick-search overlay (title + tag search)
//   • Linked tasks & projects side-panel (right rail, toggleable)
//   • Markdown export button
//   • Template picker on new-note: Blank / Meeting / 1-on-1 / Brainstorm / Review
//   • “Favorite” star alongside pin
// ============================================================

import { useEffect, useCallback, useState, useRef, useMemo } from "react";
import {
  BookOpen, Plus, AlignLeft, Calendar, FileText, Pin,
  Search, Tag, X, Star, Download, Columns2, LayoutList,
  Link2, CheckSquare, FolderKanban, ChevronRight, ChevronDown,
} from "lucide-react";

import { registry } from "@/kernel/router";
import { useNoteStore } from "./store";
import { NoteList } from "./components/NoteList";
import { NoteEditor } from "./components/NoteEditor";
import { NoteToolbar } from "./components/NoteToolbar";
import { DailyNoteContext } from "./components/DailyNoteContext";
import { cn } from "@/shared/utils";
import { format } from "date-fns";
import type { Note, Task, Project } from "@/shared/types";

import { NOTES_MANIFEST } from "./manifest";
import { setupNotesEventListeners } from "./events";
import { useTaskStore } from "@/modules/tasks/store";
import { useProjectStore } from "@/modules/projects/store";
import { ProjectDot } from "@/shared/ui";

registry.register(NOTES_MANIFEST);

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}
function wordCount(html: string) {
  const text = stripHtml(html);
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
}
function charCount(html: string) {
  return stripHtml(html).length;
}
function noteToMarkdown(note: Note): string {
  // Minimal html->md conversion good enough for export
  let md = `# ${note.title || "Untitled"}\n\n`;
  md += stripHtml(note.content ?? "");
  return md;
}
function downloadMarkdown(note: Note) {
  const blob = new Blob([noteToMarkdown(note)], { type: "text/markdown" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = `${(note.title || "note").replace(/\s+/g, "-").toLowerCase()}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────
// FILTER TABS
// ─────────────────────────────────────────────────────────────

const FILTER_TABS = [
  { id: "all",     icon: AlignLeft, label: "All"    },
  { id: "note",    icon: FileText,  label: "Notes"  },
  { id: "daily",   icon: Calendar,  label: "Daily"  },
  { id: "pinned",  icon: Pin,       label: "Pinned" },
] as const;
type FilterId = typeof FILTER_TABS[number]["id"];

// ─────────────────────────────────────────────────────────────
// TEMPLATE PICKER
// ─────────────────────────────────────────────────────────────

const TEMPLATES: { id: string; label: string; emoji: string; content: string }[] = [
  { id: "blank",      label: "Blank",        emoji: "🗒",  content: "" },
  { id: "meeting",    label: "Meeting",      emoji: "💬",  content: "<h2>Attendees</h2><ul><li></li></ul><h2>Agenda</h2><ul><li></li></ul><h2>Notes</h2><p></p><h2>Action items</h2><ul><li></li></ul>" },
  { id: "1on1",       label: "1-on-1",       emoji: "🤝",  content: "<h2>Check-in</h2><p></p><h2>Updates</h2><ul><li></li></ul><h2>Blockers</h2><p></p><h2>Next steps</h2><ul><li></li></ul>" },
  { id: "brainstorm", label: "Brainstorm",   emoji: "💡",  content: "<h2>Problem</h2><p></p><h2>Ideas</h2><ul><li></li></ul><h2>Constraints</h2><p></p><h2>Next steps</h2><ul><li></li></ul>" },
  { id: "review",     label: "Weekly review",emoji: "📅",  content: "<h2>What went well</h2><ul><li></li></ul><h2>What could improve</h2><ul><li></li></ul><h2>Next week focus</h2><ul><li></li></ul>" },
];

function TemplatePicker({ onPick }: { onPick: (content: string) => void }) {
  return (
    <div className="absolute right-0 top-full mt-1 z-50 rounded-xl border border-border shadow-lg p-2 flex flex-col gap-0.5 min-w-[180px]"
      style={{ background: "hsl(var(--popover, var(--background)))" }}>
      {TEMPLATES.map((t) => (
        <button key={t.id} onClick={() => onPick(t.content)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left hover:bg-muted transition-colors">
          <span>{t.emoji}</span>
          <span className="font-medium">{t.label}</span>
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// QUICK SEARCH OVERLAY  (Cmd/Ctrl-K)
// ─────────────────────────────────────────────────────────────

function QuickSearchOverlay({
  notes, onSelect, onClose,
}: {
  notes: Note[];
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const inputRef  = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const results = useMemo(() => {
    if (!q.trim()) return notes.slice(0, 12);
    const lq = q.toLowerCase();
    return notes
      .filter((n) =>
        n.title?.toLowerCase().includes(lq) ||
        (n.tags ?? []).some((t) => t.toLowerCase().includes(lq)) ||
        stripHtml(n.content ?? "").toLowerCase().includes(lq)
      )
      .slice(0, 12);
  }, [q, notes]);

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      style={{ background: "hsl(0 0% 0% / 0.45)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg rounded-2xl border border-border shadow-2xl overflow-hidden"
        style={{ background: "hsl(var(--background))" }}>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Search size={15} className="text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search notes by title, tag, or content…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
          />
          {q && <button onClick={() => setQ("")} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>}
          <kbd className="text-[10px] text-muted-foreground/50 font-mono ml-1">Esc</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {results.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No notes found</div>
          ) : (
            results.map((n) => (
              <button key={n.id}
                onClick={() => { onSelect(n.id); onClose(); }}
                className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted transition-colors border-b border-border/50 last:border-0">
                <FileText size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{n.title || "Untitled"}</p>
                  {(n.tags ?? []).length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {(n.tags ?? []).map((t) => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">#{t}</span>
                      ))}
                    </div>
                  )}
                </div>
                {n.type === "daily" && <span className="text-[10px] text-muted-foreground shrink-0">daily</span>}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TAG FILTER BAR
// ─────────────────────────────────────────────────────────────

function TagFilterBar({
  allTags, activeTag, onSelect,
}: {
  allTags: string[];
  activeTag: string | null;
  onSelect: (t: string | null) => void;
}) {
  if (allTags.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 px-4 py-2 overflow-x-auto scrollbar-hide border-b border-border shrink-0">
      <Tag size={11} className="text-muted-foreground shrink-0" />
      <button
        onClick={() => onSelect(null)}
        className={cn(
          "text-[11px] px-2 py-0.5 rounded-full font-medium transition-colors whitespace-nowrap shrink-0",
          activeTag === null
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:text-foreground"
        )}>
        All
      </button>
      {allTags.map((t) => (
        <button key={t}
          onClick={() => onSelect(activeTag === t ? null : t)}
          className={cn(
            "text-[11px] px-2 py-0.5 rounded-full font-medium transition-colors whitespace-nowrap shrink-0",
            activeTag === t
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground"
          )}>
          #{t}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// LINKED CONTEXT PANEL  (right rail)
// ─────────────────────────────────────────────────────────────

function LinkedContextPanel({ note }: { note: Note }) {
  const allTasks    = useTaskStore((s) => s.tasks);
  const allProjects = useProjectStore((s) => s.projects);
  const [expandTasks, setExpandTasks]    = useState(true);
  const [expandProjects, setExpandProjects] = useState(true);

  // Naive link detection: tasks/projects whose title appears in note content
  const content = note.content ?? "";
  const linkedTasks = allTasks.filter(
    (t) => t.title && stripHtml(content).toLowerCase().includes(t.title.toLowerCase())
  ).slice(0, 6);
  const linkedProjects = allProjects.filter(
    (p) => p.name && stripHtml(content).toLowerCase().includes(p.name.toLowerCase())
  ).slice(0, 4);

  return (
    <div className="flex flex-col border-l border-border overflow-y-auto shrink-0"
      style={{ width: 220, background: "hsl(var(--muted) / 0.15)" }}>
      <div className="px-3 py-3 border-b border-border shrink-0">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <Link2 size={10} /> Linked
        </p>
      </div>

      {/* Tasks */}
      <div className="px-3 py-2">
        <button
          onClick={() => setExpandTasks((v) => !v)}
          className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground w-full mb-1.5 transition-colors">
          {expandTasks ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          <CheckSquare size={10} /> Tasks ({linkedTasks.length})
        </button>
        {expandTasks && (
          linkedTasks.length === 0
            ? <p className="text-[11px] text-muted-foreground/60 italic">None detected</p>
            : linkedTasks.map((t) => (
              <div key={t.id} className="flex items-start gap-1.5 py-1">
                <div className={cn("w-1.5 h-1.5 rounded-full mt-1 shrink-0",
                  t.status === "done" ? "bg-emerald-500" : "bg-border")} />
                <span className={cn("text-[11px] leading-tight", t.status === "done" && "line-through text-muted-foreground")}>
                  {t.title}
                </span>
              </div>
            ))
        )}
      </div>

      <div className="h-px bg-border mx-3" />

      {/* Projects */}
      <div className="px-3 py-2">
        <button
          onClick={() => setExpandProjects((v) => !v)}
          className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground w-full mb-1.5 transition-colors">
          {expandProjects ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          <FolderKanban size={10} /> Projects ({linkedProjects.length})
        </button>
        {expandProjects && (
          linkedProjects.length === 0
            ? <p className="text-[11px] text-muted-foreground/60 italic">None detected</p>
            : linkedProjects.map((p) => (
              <div key={p.id} className="flex items-center gap-1.5 py-1">
                <ProjectDot color={p.color} size={8} />
                <span className="text-[11px] truncate">{p.name}</span>
              </div>
            ))
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// WORD COUNT BAR  (below toolbar)
// ─────────────────────────────────────────────────────────────

function WordCountBar({ content }: { content: string }) {
  const words = wordCount(content);
  const chars = charCount(content);
  const readMins = Math.max(1, Math.round(words / 200));
  return (
    <div className="flex items-center gap-3 px-6 py-1.5 border-b border-border shrink-0"
      style={{ background: "hsl(var(--muted) / 0.2)" }}>
      <span className="text-[11px] text-muted-foreground">
        <span className="font-medium text-foreground tabular-nums">{words}</span> words
      </span>
      <span className="text-[11px] text-muted-foreground">
        <span className="font-medium text-foreground tabular-nums">{chars}</span> chars
      </span>
      <span className="text-[11px] text-muted-foreground">
        ~{readMins} min read
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODULE ROOT
// ─────────────────────────────────────────────────────────────

export function NotesModule() {
  const {
    notes,
    loadNotes, openNoteId, getNoteById,
    createNote, openNote, getOrCreateToday,
    activeFilter, setActiveFilter,
  } = useNoteStore();

  const [showSearch,   setShowSearch]   = useState(false);
  const [showLinked,   setShowLinked]   = useState(false);
  const [activeTag,    setActiveTag]    = useState<string | null>(null);
  const [showTemplate, setShowTemplate] = useState(false);
  const templateBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadNotes();
    const cleanup = setupNotesEventListeners();
    return cleanup;
  }, [loadNotes]);

  // Cmd/Ctrl-K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowSearch((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const openedNote = openNoteId ? getNoteById(openNoteId) : null;
  const isDaily    = openedNote?.type === "daily";
  const today      = format(new Date(), "EEEE, MMMM d");

  // Collect all tags across all notes
  const allTags = useMemo(() => {
    const set = new Set<string>();
    (notes ?? []).forEach((n) => (n.tags ?? []).forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [notes]);

  const handleNewNote = useCallback(async (templateContent?: string) => {
    const note = await createNote(templateContent ? { content: templateContent } : undefined);
    openNote(note.id);
    setShowTemplate(false);
  }, [createNote, openNote]);

  const handleTodayNote = useCallback(async () => {
    const note = await getOrCreateToday();
    openNote(note.id);
  }, [getOrCreateToday, openNote]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">

      {/* Quick search overlay */}
      {showSearch && (
        <QuickSearchOverlay
          notes={notes ?? []}
          onSelect={(id) => openNote(id)}
          onClose={() => setShowSearch(false)}
        />
      )}

      {/* ── Row 1: Header ─────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 pt-6 pb-3 shrink-0">
        <div>
          <h1 className="text-[18px] font-bold leading-tight tracking-tight">Notes</h1>
          <p className="text-[12px] text-muted-foreground mt-0.5 leading-tight">{today}</p>
        </div>

        <div className="flex items-center gap-1">
          {/* Search */}
          <button
            onClick={() => setShowSearch(true)}
            title="Search (Cmd+K)"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            <Search size={13} />
            Search
            <kbd className="text-[10px] font-mono text-muted-foreground/40 ml-0.5">⌘K</kbd>
          </button>

          <div className="w-px h-4 bg-border" />

          {/* Today */}
          <button
            onClick={() => void handleTodayNote()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
            <Calendar size={13} />
            Today
          </button>

          <div className="w-px h-4 bg-border" />

          {/* New note with template picker */}
          <div ref={templateBtnRef} className="relative">
            <button
              onClick={() => setShowTemplate((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
              <Plus size={13} />
              New note
            </button>
            {showTemplate && (
              <TemplatePicker
                onPick={(content) => void handleNewNote(content)}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Row 2: Filter tabs ─────────────────────────────────── */}
      <div className="flex items-center px-6 border-b border-border shrink-0">
        {FILTER_TABS.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => { setActiveFilter(id as FilterId); setActiveTag(null); }}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-3 text-[13px] font-medium",
              "border-b-2 -mb-px transition-colors",
              activeFilter === id
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
            )}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Tag filter chips ─────────────────────────────────── */}
      <TagFilterBar
        allTags={allTags}
        activeTag={activeTag}
        onSelect={setActiveTag}
      />

      {/* ── Body: sidebar + editor + linked panel ──────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Note list sidebar */}
        <aside
          className="flex flex-col shrink-0 overflow-hidden border-r border-border bg-[hsl(var(--surface-1))]"
          style={{ width: 252 }}>
          {/* Pass tagFilter down — NoteList already accepts a filter prop in v3 */}
          <NoteList tagFilter={activeTag} />
        </aside>

        {/* Editor area */}
        <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
          {openedNote ? (
            <>
              {/* Toolbar row with export + linked toggle appended */}
              <div className="flex items-center border-b border-border shrink-0">
                <div className="flex-1 min-w-0">
                  <NoteToolbar note={openedNote} />
                </div>
                {/* Export markdown */}
                <button
                  onClick={() => downloadMarkdown(openedNote)}
                  title="Export as Markdown"
                  className="p-2 mx-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shrink-0">
                  <Download size={14} />
                </button>
                {/* Toggle linked panel */}
                <button
                  onClick={() => setShowLinked((v) => !v)}
                  title="Linked tasks & projects"
                  className={cn(
                    "p-2 mx-1 rounded transition-colors shrink-0",
                    showLinked ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}>
                  <Link2 size={14} />
                </button>
              </div>

              {/* Word count */}
              <WordCountBar content={openedNote.content ?? ""} />

              {isDaily && (
                <div className="px-6 py-2 text-xs shrink-0 border-b border-border bg-muted/35 text-muted-foreground">
                  <DailyNoteContext />
                </div>
              )}

              <div className="flex flex-1 min-h-0 overflow-hidden">
                <div className="flex-1 min-w-0 overflow-hidden">
                  <NoteEditor
                    key={openedNote.id}
                    note={openedNote}
                    className="h-full overflow-y-auto"
                  />
                </div>

                {/* Linked context panel */}
                {showLinked && <LinkedContextPanel note={openedNote} />}
              </div>
            </>
          ) : (
            <EmptyEditor onNew={() => void handleNewNote()} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────

function EmptyEditor({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 select-none px-6">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-primary/8 border border-primary/14">
        <BookOpen size={24} className="text-primary/70" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-foreground">Open a note</p>
        <p className="text-xs mt-1 text-muted-foreground">Pick from the list, or start a new one.</p>
        <p className="text-[11px] mt-1.5 text-muted-foreground/60">
          <kbd className="font-mono">⌘K</kbd> to search
        </p>
      </div>
      <button
        onClick={onNew}
        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity">
        <Plus size={14} /> New note
      </button>
    </div>
  );
}

export default NotesModule;
