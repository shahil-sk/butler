// ============================================================
// NOTES MODULE — ROOT  (redesign v5 — modern layout)
// Enhanced:
//   • Collapsible sidebar with smooth animations
//   • Integrated header with better spacing
//   • Improved grid layout for better responsiveness
//   • Modern card-based design throughout
//   • Better visual separation and hierarchy
//   • Optimized for different screen sizes
//   • Floating action buttons for quick access
// ============================================================

import { useEffect, useCallback, useState, useRef, useMemo } from "react";
import {
  BookOpen, Plus, AlignLeft, Calendar, FileText, Pin,
  Search, Tag, X, Star, Download, Columns2, LayoutList,
  Link2, CheckSquare, FolderKanban, ChevronRight, ChevronDown,
  Menu, ChevronLeft,
} from "lucide-react";

import { registry } from "@/kernel/router";
import { useNoteStore } from "./store";
import { NoteList } from "./components/NoteList";
import { NoteEditor } from "./components/NoteEditor";
import { NoteToolbar } from "./components/NoteToolbar";
import { DailyNoteContext } from "./components/DailyNoteContext";
import { cn, getTiptapPlainText } from "@/shared/utils";
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

function wordCount(raw: string) {
  const text = getTiptapPlainText(raw);
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
}
function charCount(raw: string) {
  return getTiptapPlainText(raw).length;
}
function noteToMarkdown(note: Note): string {
  let md = `# ${note.title || "Untitled"}\n\n`;
  md += getTiptapPlainText(note.content ?? "");
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
    <div className="absolute right-0 top-full mt-2 z-50 rounded-xl border border-border shadow-xl p-1 flex flex-col gap-0 min-w-[220px] bg-background animate-in fade-in slide-in-from-top-2 duration-150"
    >
      {TEMPLATES.map((t, idx) => (
        <button key={t.id} onClick={() => onPick(t.content)}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left hover:bg-muted transition-colors duration-150",
            idx !== TEMPLATES.length - 1 && "border-b border-border/50"
          )}>
          <span className="text-lg">{t.emoji}</span>
          <div className="flex-1">
            <span className="font-medium text-foreground">{t.label}</span>
          </div>
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
        getTiptapPlainText(n.content ?? "").toLowerCase().includes(lq)
      )
      .slice(0, 12);
  }, [q, notes]);

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] animate-in fade-in duration-200"
      style={{ background: "hsl(0 0% 0% / 0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-2xl rounded-2xl border border-border shadow-2xl overflow-hidden bg-background animate-in slide-in-from-top-4 duration-300">
        <div className="flex items-center gap-3 px-4 py-4 border-b border-border bg-muted/30">
          <Search size={16} className="text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Search notes by title, tag, or content…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60 font-medium"
          />
          {q && <button onClick={() => setQ("")} className="text-muted-foreground hover:text-foreground transition-colors"><X size={16} /></button>}
          <kbd className="text-[11px] text-muted-foreground/60 font-mono bg-muted px-2 py-1 rounded">Esc</kbd>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {results.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">No notes found</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Try searching with different keywords</p>
            </div>
          ) : (
            results.map((n, idx) => (
              <button key={n.id}
                onClick={() => { onSelect(n.id); onClose(); }}
                className={cn(
                  "w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted transition-colors duration-150",
                  idx !== results.length - 1 && "border-b border-border/30"
                )}>
                <FileText size={16} className="text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{n.title || "Untitled"}</p>
                  {(n.tags ?? []).length > 0 && (
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {(n.tags ?? []).map((t) => (
                        <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">#{t}</span>
                      ))}
                    </div>
                  )}
                  {getTiptapPlainText(n.content ?? "").length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{getTiptapPlainText(n.content ?? "").substring(0, 80)}</p>
                  )}
                </div>
                {n.type === "daily" && <span className="text-xs text-muted-foreground shrink-0 bg-muted px-2 py-1 rounded-full font-medium">daily</span>}
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
    <div className="flex items-center gap-2 px-4 py-3 overflow-x-auto scrollbar-hide border-b border-border shrink-0 bg-muted/20">
      <Tag size={13} className="text-muted-foreground shrink-0" />
      <button
        onClick={() => onSelect(null)}
        className={cn(
          "text-xs px-3 py-1.5 rounded-full font-semibold transition-all duration-150 whitespace-nowrap shrink-0",
          activeTag === null
            ? "bg-primary text-primary-foreground shadow-sm"
            : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
        )}>
        All
      </button>
      {allTags.map((t) => (
        <button key={t}
          onClick={() => onSelect(activeTag === t ? null : t)}
          className={cn(
            "text-xs px-3 py-1.5 rounded-full font-semibold transition-all duration-150 whitespace-nowrap shrink-0",
            activeTag === t
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
          )}>
          #{t}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CONNECTIONS PANEL  (right rail - combined view & link)
// ─────────────────────────────────────────────────────────────

function ConnectionsPanel({ note }: { note: Note }) {
  const allTasks    = useTaskStore((s) => s.tasks);
  const allProjects = useProjectStore((s) => s.projects);
  const [expandTasks, setExpandTasks]    = useState(true);
  const [expandProjects, setExpandProjects] = useState(true);

  // Naive link detection: tasks/projects whose title appears in note content
  const content = note.content ?? "";
  const linkedTasks = allTasks.filter(
    (t) => t.title && getTiptapPlainText(content).toLowerCase().includes(t.title.toLowerCase())
  ).slice(0, 8);
  const linkedProjects = allProjects.filter(
    (p) => p.name && getTiptapPlainText(content).toLowerCase().includes(p.name.toLowerCase())
  ).slice(0, 6);
  
  const totalConnections = linkedTasks.length + linkedProjects.length;

  return (
    <div className="flex flex-col border-l border-border overflow-y-auto shrink-0 bg-gradient-to-b from-muted/10 to-muted/5"
      style={{ width: 280 }}>
      {/* Header */}
      <div className="px-5 py-4 border-b border-border shrink-0 bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Link2 size={14} className="text-primary" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">Connections</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{totalConnections} linked</p>
            </div>
          </div>
          {totalConnections > 0 && (
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary">
              <span className="text-xs font-bold">{totalConnections}</span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {totalConnections === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-4 py-8 text-center">
            <div className="p-2.5 rounded-lg bg-muted/40 mb-2">
              <Link2 size={16} className="text-muted-foreground/50" />
            </div>
            <p className="text-xs font-medium text-muted-foreground">No connections found</p>
            <p className="text-[11px] text-muted-foreground/60 mt-1">Mention tasks or projects in your note</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {/* Tasks Section */}
            {linkedTasks.length > 0 && (
              <div className="px-4 py-3">
                <button
                  onClick={() => setExpandTasks((v) => !v)}
                  className="flex items-center gap-2 text-xs font-bold text-foreground w-full mb-3 transition-colors duration-150 hover:text-primary">
                  {expandTasks ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <div className="p-1 rounded bg-blue-500/10">
                    <CheckSquare size={12} className="text-blue-500" />
                  </div>
                  <span>Tasks</span>
                  <span className="ml-auto text-xs font-semibold bg-blue-500/15 text-blue-600 px-2 py-0.5 rounded-full">{linkedTasks.length}</span>
                </button>
                {expandTasks && (
                  <div className="space-y-2">
                    {linkedTasks.map((t) => (
                      <div key={t.id} className="flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-muted/50 transition-all duration-150 cursor-pointer group">
                        <div className={cn(
                          "w-2 h-2 rounded-full mt-1.5 shrink-0 transition-colors",
                          t.status === "done" ? "bg-emerald-500" : "bg-amber-500"
                        )} />
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "text-xs font-medium leading-tight transition-colors",
                            t.status === "done" ? "line-through text-muted-foreground/60" : "text-foreground group-hover:text-primary"
                          )}>
                            {t.title}
                          </p>
                          {t.status && (
                            <span className="text-[10px] text-muted-foreground/70 mt-1 inline-block capitalize">{t.status}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Projects Section */}
            {linkedProjects.length > 0 && (
              <div className="px-4 py-3">
                <button
                  onClick={() => setExpandProjects((v) => !v)}
                  className="flex items-center gap-2 text-xs font-bold text-foreground w-full mb-3 transition-colors duration-150 hover:text-primary">
                  {expandProjects ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <div className="p-1 rounded bg-purple-500/10">
                    <FolderKanban size={12} className="text-purple-500" />
                  </div>
                  <span>Projects</span>
                  <span className="ml-auto text-xs font-semibold bg-purple-500/15 text-purple-600 px-2 py-0.5 rounded-full">{linkedProjects.length}</span>
                </button>
                {expandProjects && (
                  <div className="space-y-2">
                    {linkedProjects.map((p) => (
                      <div key={p.id} className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-muted/50 transition-all duration-150 cursor-pointer group">
                        <ProjectDot color={p.color} size={12} />
                        <span className="text-xs font-medium truncate text-foreground group-hover:text-primary transition-colors">{p.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
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
    <div className="flex items-center gap-4 px-6 py-2.5 border-b border-border shrink-0 bg-muted/20"
    >
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Words</span>
        <span className="text-sm font-bold text-foreground tabular-nums">{words}</span>
      </div>
      <div className="w-px h-4 bg-border" />
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Characters</span>
        <span className="text-sm font-bold text-foreground tabular-nums">{chars}</span>
      </div>
      <div className="w-px h-4 bg-border" />
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Read time</span>
        <span className="text-sm font-bold text-foreground">~{readMins} min</span>
      </div>
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
  const [showConnections, setShowConnections] = useState(false);
  const [activeTag,    setActiveTag]    = useState<string | null>(null);
  const [showTemplate, setShowTemplate] = useState(false);
  const [sidebarOpen,  setSidebarOpen]  = useState(true);
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

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-6 pt-6 pb-3 shrink-0 border-b border-border/40 bg-background">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg hover:bg-accent/40 transition-all duration-150 text-muted-foreground hover:text-foreground"
            title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
          >
            {sidebarOpen ? <ChevronLeft size={18} /> : <Menu size={18} />}
          </button>
          <div>
            <h1 className="text-[20px] font-bold leading-tight tracking-tight text-gradient">Notes</h1>
            <p className="text-[12px] text-muted-foreground mt-0.5 leading-tight font-medium">{today}</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Search */}
          <button
            onClick={() => setShowSearch(true)}
            title="Search (Cmd+K)"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150">
            <Search size={14} />
            Search
            <kbd className="text-[10px] font-mono text-muted-foreground/50 bg-muted px-1.5 py-0.5 rounded">⌘K</kbd>
          </button>

          <div className="w-px h-5 bg-border mx-1" />

          {/* Today */}
          <button
            onClick={() => void handleTodayNote()}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150">
            <Calendar size={14} />
            Today
          </button>

          <div className="w-px h-5 bg-border mx-1" />

          {/* New note with template picker */}
          <div ref={templateBtnRef} className="relative">
            <button
              onClick={() => setShowTemplate((v) => !v)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-all duration-150 shadow-sm">
              <Plus size={14} />
              New note
            </button>
            {showTemplate && (
              <TemplatePicker
                onPick={(content) => void handleNewNote(content)}
              />
            )}
          </div>
        </div>
      </header>

      {/* ── Filter tabs ────────────────────────────────────────── */}
      <nav className="flex items-center px-6 border-b border-border/50 shrink-0 bg-muted/5 overflow-x-auto scrollbar-hide">
        {FILTER_TABS.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => { setActiveFilter(id as FilterId); setActiveTag(null); }}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wide whitespace-nowrap",
              "border-b-2 -mb-px transition-all duration-150",
              activeFilter === id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border/50",
            )}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </nav>

      {/* ── Tag filter chips ───────────────────────────────────── */}
      <TagFilterBar
        allTags={allTags}
        activeTag={activeTag}
        onSelect={setActiveTag}
      />

      {/* ── Main content area ──────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden gap-0">

        {/* Sidebar - collapsible */}
        <aside
          className={cn(
            "flex flex-col shrink-0 overflow-hidden border-r border-border bg-muted/5 transition-all duration-300 ease-in-out",
            sidebarOpen ? "w-72" : "w-0"
          )}>
          <NoteList tagFilter={activeTag} />
        </aside>

        {/* Editor area */}
        <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
          {openedNote ? (
            <>
              {/* Toolbar row */}
              <div className="flex items-center border-b border-border/50 shrink-0 bg-background">
                <div className="flex-1 min-w-0">
                  <NoteToolbar note={openedNote} />
                </div>
                <div className="flex items-center gap-2 px-4">
                  {/* Export markdown */}
                  <button
                    onClick={() => downloadMarkdown(openedNote)}
                    title="Export as Markdown"
                    className="p-2 rounded-lg hover:bg-muted transition-all duration-150 text-muted-foreground hover:text-foreground hover:shadow-sm">
                    <Download size={16} />
                  </button>
                  
                  <div className="w-px h-6 bg-border/50" />
                  
                  {/* Connections panel toggle */}
                  <button
                    onClick={() => setShowConnections((v) => !v)}
                    title="View connections"
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg font-semibold text-xs transition-all duration-150",
                      showConnections
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}>
                    <Link2 size={14} />
                    <span>Connections</span>
                  </button>
                </div>
              </div>

              {/* Word count */}
              <WordCountBar content={openedNote.content ?? ""} />

              {isDaily && (
                <div className="px-6 py-3 text-xs shrink-0 border-b border-border/50 bg-muted/30 text-muted-foreground">
                  <DailyNoteContext />
                </div>
              )}

              {/* Editor + Linked panel */}
              <div className="flex flex-1 min-h-0 overflow-hidden">
                <div className="flex-1 min-w-0 overflow-hidden">
                  <NoteEditor
                    key={openedNote.id}
                    note={openedNote}
                    className="h-full overflow-y-auto"
                  />
                </div>

                {/* Connections panel - collapsible */}
                {showConnections && <ConnectionsPanel note={openedNote} />}
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
    <div className="flex flex-col items-center justify-center h-full gap-6 select-none px-6">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-primary/10 border border-primary/20">
        <BookOpen size={28} className="text-primary/60" />
      </div>
      <div className="text-center max-w-sm">
        <p className="text-base font-bold text-foreground">No note selected</p>
        <p className="text-sm mt-2 text-muted-foreground">Create a new note or select one from the list to get started.</p>
        <p className="text-xs mt-3 text-muted-foreground/70 font-medium">
          Use <kbd className="font-mono bg-muted px-2 py-1 rounded text-xs">⌘K</kbd> to search all notes
        </p>
      </div>
      <button
        onClick={onNew}
        className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold bg-primary text-primary-foreground hover:opacity-90 transition-all duration-150 shadow-md">
        <Plus size={16} /> Create new note
      </button>
    </div>
  );
}

export default NotesModule;
