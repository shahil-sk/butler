// ============================================================
// RESEARCH MODULE — ROOT
// 3 views: Threads | Sources | Document (reader)
// Routes: /research (threads) | /research/sources | /research/graph
// ============================================================

import { useEffect, useCallback, useState, useRef } from "react";
import { registry } from "@/kernel/router";
import { bus } from "@/kernel/event-bus";
import { useResearchStore } from "./store";
import { researchManifest } from "./manifest";
import { setupResearchEventListeners } from "./events";
import {
  PageHeader,
  FilterBar,
  EmptyState,
  PrimaryButton,
  GhostButton,
  SectionLabel,
  Modal,
} from "@/shared/ui";
import { cn } from "@/shared/utils";
import {
  Brain,
  Layers,
  FileText,
  Share2,
  Plus,
  Search,
  Trash2,
  ExternalLink,
  Tag,
  Link2,
  ChevronRight,
  Globe,
  File,
  BookOpen,
  X,
  AlertCircle,
  Loader2,
  Pencil,
} from "lucide-react";
import type { ResearchSource, ResearchThread } from "@/shared/types";

// ── Module boot ──────────────────────────────────────────────

export function ResearchModule() {
  const { init, activeView, setActiveView } = useResearchStore();

  useEffect(() => {
    registry.register(researchManifest);
    void init();
    const teardown = setupResearchEventListeners();

    const offImport = bus.on("research:open-import" as any, () => {
      setActiveView("sources");
      setTimeout(() => bus.emit("research:trigger-import" as any, {}), 50);
    });
    const offThread = bus.on("research:open-new-thread" as any, () => {
      setActiveView("threads");
      setTimeout(() => bus.emit("research:trigger-new-thread" as any, {}), 50);
    });

    return () => {
      teardown?.();
      offImport();
      offThread();
    };
  }, [init, setActiveView]);

  return (
    <div className="flex h-full min-h-0 overflow-hidden" style={{ background: "hsl(var(--background))" }}>
      <ResearchSubNav activeView={activeView} onSelect={setActiveView} />
      <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
        {activeView === "threads"  && <ThreadsView />}
        {activeView === "sources"  && <SourcesView />}
        {activeView === "document" && <DocumentView />}
        {activeView === "graph"    && <GraphView />}
      </div>
    </div>
  );
}

// ── Sub-nav ───────────────────────────────────────────────────

function ResearchSubNav({
  activeView,
  onSelect,
}: {
  activeView: string;
  onSelect: (v: any) => void;
}) {
  const { threads, sources } = useResearchStore();

  const items = [
    { id: "threads",  label: "Threads",  icon: Layers,   count: threads.length },
    { id: "sources",  label: "Sources",  icon: FileText, count: sources.length },
    { id: "graph",    label: "Graph",    icon: Share2,   count: undefined },
  ] as const;

  return (
    <nav
      className="flex flex-col shrink-0 py-2 px-1.5 gap-px overflow-y-auto"
      style={{ width: 148, borderRight: "1px solid hsl(var(--border))", background: "hsl(var(--surface-1))" }}
    >
      <SectionLabel>Research</SectionLabel>
      {items.map(({ id, label, icon: Icon, count }) => (
        <button
          key={id}
          onClick={() => onSelect(id)}
          className={cn(
            "w-full flex items-center gap-2 px-2.5 py-[6px] rounded-md text-xs text-left transition-fast",
            activeView === id
              ? "bg-primary/[0.08] text-primary font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-accent"
          )}
        >
          <Icon size={13} className="shrink-0" />
          <span className="flex-1 truncate">{label}</span>
          {count != null && count > 0 && (
            <span className="text-[10px] text-muted-foreground/50 tabular-nums">{count}</span>
          )}
        </button>
      ))}
    </nav>
  );
}

// ── THREADS VIEW ──────────────────────────────────────────────

function ThreadsView() {
  const {
    threads, sources, isLoading,
    activeThreadId, setActiveThread,
    createThread, deleteThread, updateThread,
  } = useResearchStore();

  const [showNewModal, setShowNewModal] = useState(false);
  const [searchQ, setSearchQ] = useState("");

  useEffect(() => {
    const off = bus.on("research:trigger-new-thread" as any, () => setShowNewModal(true));
    return () => off();
  }, []);

  const filtered = threads.filter(
    (t) => !searchQ || t.title.toLowerCase().includes(searchQ.toLowerCase())
  );

  const activeThread = threads.find((t) => t.id === activeThreadId) ?? null;

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* Thread list */}
      <div
        className="flex flex-col shrink-0 overflow-hidden"
        style={{ width: 260, borderRight: "1px solid hsl(var(--border))" }}
      >
        <PageHeader title="Threads" count={threads.length}>
          <PrimaryButton onClick={() => setShowNewModal(true)}>
            <Plus size={12} /> New
          </PrimaryButton>
        </PageHeader>

        <div className="px-2 py-2 shrink-0" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
          <div className="relative">
            <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search threads…"
              className="w-full pl-7 pr-2.5 py-1.5 text-xs rounded-md bg-surface-2 border border-border/60 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={16} className="text-muted-foreground animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              title="No threads yet"
              subtitle="Threads group sources around a research question."
              action={{ label: "New thread", onClick: () => setShowNewModal(true) }}
            />
          ) : (
            filtered.map((thread) => (
              <ThreadRow
                key={thread.id}
                thread={thread}
                active={thread.id === activeThreadId}
                sourceCount={sources.filter((s) => thread.sourceIds.includes(s.id)).length}
                onClick={() => setActiveThread(thread.id)}
                onDelete={() => void deleteThread(thread.id)}
                onPin={() => void updateThread(thread.id, { isPinned: !thread.isPinned })}
              />
            ))
          )}
        </div>
      </div>

      {/* Thread detail */}
      <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
        {activeThread ? (
          <ThreadDetail thread={activeThread} />
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: "hsl(var(--primary) / 0.08)", border: "1px solid hsl(var(--primary) / 0.14)" }}
            >
              <Brain size={22} style={{ color: "hsl(var(--primary) / 0.7)" }} />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">Select a thread</p>
              <p className="text-xs text-muted-foreground mt-0.5">or create one to start researching</p>
            </div>
          </div>
        )}
      </div>

      <NewThreadModal
        open={showNewModal}
        onClose={() => setShowNewModal(false)}
        onCreate={async (title, desc) => {
          await createThread(title, desc);
          setShowNewModal(false);
        }}
      />
    </div>
  );
}

// Fix #12: replaced <span onClick> with <button> for a11y
function ThreadRow({
  thread, active, sourceCount, onClick, onDelete, onPin,
}: {
  thread: ResearchThread;
  active: boolean;
  sourceCount: number;
  onClick: () => void;
  onDelete: () => void;
  onPin: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex flex-col gap-0.5 px-3 py-2.5 text-left transition-fast group",
        active
          ? "bg-primary/[0.07] border-l-2 border-primary"
          : "border-l-2 border-transparent hover:bg-accent"
      )}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        {thread.isPinned && <span className="text-amber-400 text-[10px]" aria-hidden>★</span>}
        <span className={cn("text-xs font-medium truncate flex-1", active ? "text-primary" : "text-foreground")}>
          {thread.title}
        </span>
        <span className="opacity-0 group-hover:opacity-100 transition-fast flex items-center gap-0.5">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onPin(); }}
            aria-label={thread.isPinned ? "Unpin thread" : "Pin thread"}
            className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
          >
            <span className="text-[10px]" aria-hidden>{thread.isPinned ? "★" : "☆"}</span>
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            aria-label="Delete thread"
            className="p-0.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500"
          >
            <Trash2 size={10} />
          </button>
        </span>
      </div>
      <div className="flex items-center gap-2">
        {thread.tags.slice(0, 2).map((tag) => (
          <span key={tag} className="text-[10px] text-muted-foreground/60 bg-surface-2 px-1.5 py-0.5 rounded-full">
            {tag}
          </span>
        ))}
        {sourceCount > 0 && (
          <span className="text-[10px] text-muted-foreground/50 tabular-nums ml-auto">
            {sourceCount} source{sourceCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>
    </button>
  );
}

function ThreadDetail({ thread }: { thread: ResearchThread }) {
  const { sources, addSourceToThread, removeSourceFromThread, updateThread } = useResearchStore();
  const threadSources = sources.filter((s) => thread.sourceIds.includes(s.id));
  const availableSources = sources.filter((s) => !thread.sourceIds.includes(s.id));

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <PageHeader title={thread.title}>
        {availableSources.length > 0 && (
          <AddSourceDropdown
            sources={availableSources}
            onAdd={(id) => void addSourceToThread(thread.id, id)}
          />
        )}
      </PageHeader>

      {thread.description && (
        <p className="px-5 py-3 text-xs text-muted-foreground leading-relaxed shrink-0"
          style={{ borderBottom: "1px solid hsl(var(--border))" }}>
          {thread.description}
        </p>
      )}

      <div className="flex-1 overflow-y-auto">
        <SectionLabel>Sources ({threadSources.length})</SectionLabel>

        {threadSources.length === 0 ? (
          <div className="px-5 py-4 text-xs text-muted-foreground">
            No sources yet. Add sources to build your research thread.
          </div>
        ) : (
          <div className="px-3 pb-3 space-y-1">
            {threadSources.map((src) => (
              // Fix #1: pass onRemove to compact SourceCard
              <SourceCard
                key={src.id}
                source={src}
                compact
                onDelete={() => void removeSourceFromThread(thread.id, src.id)}
              />
            ))}
          </div>
        )}

        {thread.tags.length > 0 && (
          <>
            <SectionLabel>Tags</SectionLabel>
            <div className="px-4 pb-3 flex flex-wrap gap-1.5">
              {thread.tags.map((tag) => (
                <span key={tag} className="flex items-center gap-1 text-[11px] text-muted-foreground bg-surface-2 border border-border/60 px-2 py-0.5 rounded-full">
                  <Tag size={9} /> {tag}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AddSourceDropdown({ sources, onAdd }: { sources: ResearchSource[]; onAdd: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <GhostButton onClick={() => setOpen((v) => !v)}>
        <Link2 size={11} /> Add source
      </GhostButton>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-64 rounded-xl border border-border bg-popover shadow-lg py-1.5 max-h-60 overflow-y-auto">
          {sources.map((src) => (
            <button
              key={src.id}
              type="button"
              onClick={() => { onAdd(src.id); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-accent transition-fast"
            >
              <SourceTypeIcon type={src.type} size={11} />
              <span className="flex-1 truncate text-foreground/80">{src.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── SOURCES VIEW ─────────────────────────────────────────────

type SourceFilter = "all" | "pdf" | "url" | "text" | "pending" | "error";

function SourcesView() {
  const {
    sources, isLoading, isIngesting,
    importSource, deleteSource, updateSourceStatus,
    setActiveSource, setActiveView,
  } = useResearchStore();

  const [filter, setFilter] = useState<SourceFilter>("all");
  const [showImport, setShowImport] = useState(false);
  const [searchQ, setSearchQ] = useState("");

  useEffect(() => {
    const off = bus.on("research:trigger-import" as any, () => setShowImport(true));
    return () => off();
  }, []);

  // Fix #6: filter and searchQ are combined — both apply independently
  const filtered = sources.filter((s) => {
    const matchesFilter =
      filter === "all"     ? true :
      filter === "pending" ? ["pending", "processing"].includes(s.processingStatus) :
      filter === "error"   ? s.processingStatus === "error" :
      s.type === filter;
    const matchesSearch = !searchQ || s.title.toLowerCase().includes(searchQ.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const tabs = [
    { id: "all",     label: "All",     count: sources.length },
    { id: "pdf",     label: "PDF",     count: sources.filter((s) => s.type === "pdf").length },
    { id: "url",     label: "Web",     count: sources.filter((s) => s.type === "url").length },
    { id: "text",    label: "Text",    count: sources.filter((s) => s.type === "text").length },
    { id: "pending", label: "Pending", count: sources.filter((s) => ["pending","processing"].includes(s.processingStatus)).length },
    { id: "error",   label: "Error",   count: sources.filter((s) => s.processingStatus === "error").length },
  ] satisfies { id: SourceFilter; label: string; count: number }[];

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <PageHeader title="Sources" count={sources.length}>
        <PrimaryButton onClick={() => setShowImport(true)}>
          <Plus size={12} /> Import
        </PrimaryButton>
      </PageHeader>

      <FilterBar
        tabs={tabs}
        activeId={filter}
        onSelect={(id) => setFilter(id as SourceFilter)}
      />

      <div className="px-3 py-2 shrink-0" style={{ borderBottom: "1px solid hsl(var(--border))" }}>
        <div className="relative">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
          <input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="Search sources…"
            className="w-full pl-7 pr-2.5 py-1.5 text-xs rounded-md bg-surface-2 border border-border/60 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={18} className="text-muted-foreground animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No sources"
            subtitle="Import PDFs, web pages, or paste text to start building your knowledge base."
            action={{ label: "Import source", onClick: () => setShowImport(true) }}
          />
        ) : (
          filtered.map((src) => (
            <SourceCard
              key={src.id}
              source={src}
              // Fix #7: pass sourceId to setActiveSource, then navigate
              onOpen={() => { setActiveSource(src.id); setActiveView("document"); }}
              onDelete={() => void deleteSource(src.id)}
              onRetry={
                src.processingStatus === "error"
                  ? () => void updateSourceStatus(src.id, "pending")
                  : undefined
              }
            />
          ))
        )}
      </div>

      <ImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImport={async (input) => {
          await importSource(input);
          setShowImport(false);
        }}
        isIngesting={isIngesting}
      />
    </div>
  );
}

// Fix #5: SourceCard now shows edit button for rename/re-tag
function SourceCard({
  source,
  compact,
  onOpen,
  onDelete,
  onRetry,
}: {
  source: ResearchSource;
  compact?: boolean;
  onOpen?: () => void;
  onDelete?: () => void;
  onRetry?: () => void;
}) {
  const { updateSource } = useResearchStore();
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(source.title);
  const isError   = source.processingStatus === "error";
  const isPending = source.processingStatus === "pending" || source.processingStatus === "processing";

  const saveEdit = async () => {
    if (editTitle.trim() && editTitle.trim() !== source.title) {
      await updateSource(source.id, { title: editTitle.trim() });
    }
    setEditing(false);
  };

  return (
    <div
      className={cn(
        "group flex items-start gap-3 rounded-lg border border-border/60 bg-surface-1 transition-fast",
        compact ? "px-3 py-2" : "px-4 py-3",
        onOpen && !editing && "hover:bg-accent cursor-pointer"
      )}
      onClick={!editing ? onOpen : undefined}
    >
      <div className="shrink-0 mt-0.5">
        <SourceTypeIcon type={source.type} size={compact ? 13 : 15} />
      </div>

      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            autoFocus
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={() => void saveEdit()}
            onKeyDown={(e) => {
              if (e.key === "Enter") void saveEdit();
              if (e.key === "Escape") { setEditTitle(source.title); setEditing(false); }
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full text-xs px-1.5 py-0.5 rounded border border-primary/40 bg-surface-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        ) : (
          <p className={cn("font-medium truncate text-foreground", compact ? "text-[11px]" : "text-xs")}>
            {source.title}
          </p>
        )}
        {!compact && (
          <div className="flex items-center gap-2 mt-0.5">
            {source.url && (
              <span className="text-[10px] text-muted-foreground/60 truncate max-w-[200px]">{source.url}</span>
            )}
            {source.sizeBytes && (
              <span className="text-[10px] text-muted-foreground/40">{formatBytes(source.sizeBytes)}</span>
            )}
          </div>
        )}
        {isError && source.errorMessage && (
          <p className="text-[10px] text-red-400 mt-0.5 truncate">{source.errorMessage}</p>
        )}
        {source.tags.length > 0 && !compact && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {source.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-[10px] text-muted-foreground/60 bg-surface-2 px-1.5 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {isPending && <Loader2 size={11} className="text-primary animate-spin" />}
        {isError   && <AlertCircle size={11} className="text-red-400" />}
        {isError && onRetry && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRetry(); }}
            className="text-[10px] text-primary hover:underline"
          >
            Retry
          </button>
        )}
        {!compact && !editing && (
          <button
            type="button"
            aria-label="Rename source"
            onClick={(e) => { e.stopPropagation(); setEditing(true); }}
            className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-accent text-muted-foreground hover:text-foreground transition-fast"
          >
            <Pencil size={11} />
          </button>
        )}
        {onOpen && !editing && (
          <ChevronRight size={12} className="text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-fast" />
        )}
        {onDelete && (
          <button
            type="button"
            aria-label="Delete source"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-fast"
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>
    </div>
  );
}

function SourceTypeIcon({ type, size = 14 }: { type: string; size?: number }) {
  const icons: Record<string, typeof FileText> = {
    pdf:   BookOpen,
    url:   Globe,
    text:  FileText,
    file:  File,
    note:  BookOpen,
    video: File,
  };
  const Icon = icons[type] ?? FileText;
  return <Icon size={size} className="text-muted-foreground/70" />;
}

// ── DOCUMENT VIEW ─────────────────────────────────────────────

function DocumentView() {
  const {
    // Fix #7: use activeSourceId to look up doc by sourceId
    activeSourceId, documents, sources,
    chunks, highlights, annotations,
    sidebarTab, setSidebarTab,
    loadDocumentChunks, loadHighlights, loadAnnotations,
    createHighlight, deleteHighlight,
    createAnnotation, deleteAnnotation, updateAnnotation,
    setActiveView,
  } = useResearchStore();

  const source   = sources.find((s) => s.id === activeSourceId) ?? null;
  const document = source ? documents.find((d) => d.sourceId === source.id) ?? null : null;

  useEffect(() => {
    if (!document) return;
    void loadDocumentChunks(document.id);
    void loadHighlights(document.id);
    void loadAnnotations(document.id);
  }, [document?.id, loadDocumentChunks, loadHighlights, loadAnnotations]);

  if (!source) {
    return (
      <EmptyState
        title="No document open"
        subtitle="Select a source from the Sources view to read it."
        action={{ label: "Go to Sources", onClick: () => setActiveView("sources") }}
      />
    );
  }

  if (!document) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-3 px-8 text-center">
        <Loader2 size={18} className="text-muted-foreground animate-spin" />
        <p className="text-xs text-muted-foreground">Processing source — document not ready yet.</p>
        <GhostButton onClick={() => setActiveView("sources")}>Back to Sources</GhostButton>
      </div>
    );
  }

  const sideTabs = [
    { id: "info",        label: "Info" },
    { id: "highlights",  label: `Highlights${highlights.length > 0 ? ` (${highlights.length})` : ""}` },
    { id: "annotations", label: `Notes${annotations.length > 0 ? ` (${annotations.length})` : ""}` },
  ] as const;

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* Reader */}
      <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
        <div
          className="flex items-center gap-2 px-4 h-[46px] shrink-0"
          style={{ borderBottom: "1px solid hsl(var(--border))" }}
        >
          <button
            type="button"
            onClick={() => setActiveView("sources")}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-fast"
            aria-label="Back to sources"
          >
            <X size={13} />
          </button>
          <span className="text-xs font-medium text-foreground truncate flex-1">{document.title}</span>
          {source.url && (
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-accent transition-fast"
              aria-label="Open original"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink size={12} />
            </a>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {chunks.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Loader2 size={18} className="text-muted-foreground animate-spin" />
              <p className="text-xs text-muted-foreground">Processing document…</p>
            </div>
          ) : (
            chunks.map((chunk) => {
              const chunkHighlights = highlights.filter((h) => h.chunkId === chunk.id);
              return (
                // Fix #9: capture selected text via window.getSelection()
                <ChunkBlock
                  key={chunk.id}
                  content={chunk.content}
                  sectionTitle={chunk.sectionTitle}
                  pageNumber={chunk.pageNumber}
                  hasHighlights={chunkHighlights.length > 0}
                  onHighlight={(selectedText) =>
                    void createHighlight({
                      documentId: document.id,
                      chunkId: chunk.id,
                      sourceId: source.id,
                      text: selectedText || chunk.content.slice(0, 200),
                    })
                  }
                />
              );
            })
          )}
        </div>
      </div>

      {/* Right sidebar */}
      <div
        className="flex flex-col shrink-0 overflow-hidden"
        style={{ width: 260, borderLeft: "1px solid hsl(var(--border))", background: "hsl(var(--surface-1))" }}
      >
        <div
          className="flex shrink-0 gap-0.5 px-1.5 py-1.5"
          style={{ borderBottom: "1px solid hsl(var(--border))" }}
        >
          {sideTabs.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setSidebarTab(id as any)}
              className={cn(
                "flex-1 py-1 px-1 text-[10px] rounded transition-fast",
                sidebarTab === id
                  ? "bg-primary/[0.08] text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {sidebarTab === "info" && (
            <DocInfoPanel document={document} source={source} />
          )}
          {sidebarTab === "highlights" && (
            <HighlightsPanel highlights={highlights} onDelete={deleteHighlight} />
          )}
          {sidebarTab === "annotations" && (
            // Fix #8: pass documentId/sourceId so AnnotationsPanel can open inline draft
            <AnnotationsPanel
              annotations={annotations}
              documentId={document.id}
              sourceId={source.id}
              onDelete={deleteAnnotation}
              onUpdate={updateAnnotation}
              onAdd={createAnnotation}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Fix #9: ChunkBlock captures window.getSelection() text
function ChunkBlock({
  content, sectionTitle, pageNumber, hasHighlights, onHighlight,
}: {
  content: string;
  sectionTitle?: string;
  pageNumber?: number;
  hasHighlights: boolean;
  onHighlight: (selectedText: string) => void;
}) {
  const handleHighlight = () => {
    const sel = window.getSelection();
    const selectedText = sel ? sel.toString().trim() : "";
    onHighlight(selectedText);
    sel?.removeAllRanges();
  };

  return (
    <div className={cn(
      "group relative rounded-lg px-4 py-3 transition-fast",
      hasHighlights
        ? "bg-amber-500/[0.06] border border-amber-500/20"
        : "bg-surface-1 border border-border/40 hover:border-border"
    )}>
      {sectionTitle && (
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-1.5">
          {sectionTitle}{pageNumber != null ? ` · p.${pageNumber}` : ""}
        </p>
      )}
      <p className="text-xs leading-relaxed text-foreground/80">{content}</p>
      <button
        type="button"
        onClick={handleHighlight}
        aria-label="Highlight this chunk"
        title="Select text then click to highlight"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded bg-amber-400/20 text-amber-600 hover:bg-amber-400/40 transition-fast text-[10px]"
      >
        ★
      </button>
    </div>
  );
}

function DocInfoPanel({ document, source }: { document: any; source: ResearchSource }) {
  return (
    <div className="px-4 py-3 space-y-3">
      {document.abstract && (
        <div>
          <SectionLabel>Abstract</SectionLabel>
          <p className="text-xs text-muted-foreground leading-relaxed px-3">{document.abstract}</p>
        </div>
      )}
      <div>
        <SectionLabel>Details</SectionLabel>
        <dl className="px-3 space-y-1.5">
          {document.authors?.length > 0 && (
            <InfoRow label="Authors" value={document.authors.join(", ")} />
          )}
          {document.publishedDate && (
            <InfoRow label="Published" value={document.publishedDate} />
          )}
          {document.totalPages && (
            <InfoRow label="Pages" value={String(document.totalPages)} />
          )}
          <InfoRow label="Status" value={source.processingStatus} />
          {source.sizeBytes && (
            <InfoRow label="Size" value={formatBytes(source.sizeBytes)} />
          )}
        </dl>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-[10px] text-muted-foreground/50 w-16 shrink-0">{label}</dt>
      <dd className="text-[10px] text-foreground/70 flex-1 truncate">{value}</dd>
    </div>
  );
}

function HighlightsPanel({
  highlights,
  onDelete,
}: {
  highlights: any[];
  onDelete: (id: string) => void;
}) {
  if (highlights.length === 0) {
    return (
      <EmptyState
        title="No highlights"
        subtitle="Select text in a chunk then click ★ to highlight."
      />
    );
  }
  return (
    <div className="px-3 py-2 space-y-2">
      {highlights.map((h) => (
        <div
          key={h.id}
          className="group rounded-md border border-amber-500/20 bg-amber-500/[0.05] px-3 py-2"
        >
          <p className="text-[11px] text-foreground/80 leading-relaxed line-clamp-3">{h.text}</p>
          {h.note && (
            <p className="text-[10px] text-muted-foreground mt-1 italic">{h.note}</p>
          )}
          <button
            type="button"
            onClick={() => onDelete(h.id)}
            className="mt-1.5 opacity-0 group-hover:opacity-100 text-[10px] text-red-400 hover:text-red-500 transition-fast"
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}

// Fix #8: inline draft editor — no empty DB write on create
function AnnotationsPanel({
  annotations,
  documentId,
  sourceId,
  onDelete,
  onUpdate,
  onAdd,
}: {
  annotations: any[];
  documentId: string;
  sourceId: string;
  onDelete: (id: string) => void;
  onUpdate: (id: string, content: string) => Promise<void>;
  onAdd: (input: any) => Promise<any>;
}) {
  const [draft, setDraft] = useState("");
  const [showDraft, setShowDraft] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const draftRef = useRef<HTMLTextAreaElement>(null);

  const submitDraft = async () => {
    if (!draft.trim()) { setShowDraft(false); return; }
    await onAdd({ documentId, sourceId, type: "note", content: draft.trim() });
    setDraft("");
    setShowDraft(false);
  };

  const submitEdit = async (id: string) => {
    await onUpdate(id, editContent);
    setEditingId(null);
  };

  useEffect(() => {
    if (showDraft) setTimeout(() => draftRef.current?.focus(), 30);
  }, [showDraft]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 pt-2 pb-1 shrink-0 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">Notes</span>
        <button
          type="button"
          onClick={() => setShowDraft(true)}
          className="text-[10px] text-primary hover:underline"
        >
          + Add note
        </button>
      </div>

      {showDraft && (
        <div className="px-3 pb-2 shrink-0">
          <textarea
            ref={draftRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a note…"
            rows={3}
            className="w-full px-2.5 py-2 text-xs rounded-lg border border-primary/40 bg-surface-2 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
          />
          <div className="flex gap-1.5 mt-1.5 justify-end">
            <button type="button" onClick={() => setShowDraft(false)} className="text-[10px] text-muted-foreground hover:text-foreground">Cancel</button>
            <button type="button" onClick={() => void submitDraft()} className="text-[10px] text-primary font-medium hover:underline">Save</button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 py-1 space-y-2">
        {annotations.length === 0 && !showDraft ? (
          <p className="text-xs text-muted-foreground/60 py-4 text-center">No notes yet.</p>
        ) : (
          annotations.map((a) => (
            <div key={a.id} className="group rounded-md border border-border/60 bg-surface-2 px-3 py-2">
              {editingId === a.id ? (
                <>
                  <textarea
                    autoFocus
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={3}
                    className="w-full px-2 py-1.5 text-xs rounded border border-primary/40 bg-surface-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
                  />
                  <div className="flex gap-1.5 mt-1 justify-end">
                    <button type="button" onClick={() => setEditingId(null)} className="text-[10px] text-muted-foreground">Cancel</button>
                    <button type="button" onClick={() => void submitEdit(a.id)} className="text-[10px] text-primary font-medium">Save</button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[11px] text-foreground/80 leading-relaxed">
                    {a.content || <em className="text-muted-foreground/40">Empty note</em>}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 opacity-0 group-hover:opacity-100 transition-fast">
                    <span className="text-[10px] text-muted-foreground/40">{a.type}</span>
                    <button
                      type="button"
                      onClick={() => { setEditingId(a.id); setEditContent(a.content); }}
                      className="text-[10px] text-primary hover:underline ml-auto"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(a.id)}
                      className="text-[10px] text-red-400 hover:text-red-500"
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── GRAPH VIEW (stub) ─────────────────────────────────────────

function GraphView() {
  const { sources, threads } = useResearchStore();
  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <PageHeader title="Knowledge Graph" />
      <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center px-8">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: "hsl(var(--primary) / 0.08)", border: "1px solid hsl(var(--primary) / 0.14)" }}
        >
          <Share2 size={24} style={{ color: "hsl(var(--primary) / 0.7)" }} />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Knowledge Graph</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-[260px] leading-relaxed">
            Visual graph of sources, threads, and their connections. Coming in Phase 2 with the AI layer.
          </p>
        </div>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span className="tabular-nums"><strong className="text-foreground">{sources.length}</strong> sources</span>
          <span className="tabular-nums"><strong className="text-foreground">{threads.length}</strong> threads</span>
        </div>
      </div>
    </div>
  );
}

// ── MODALS ────────────────────────────────────────────────────

function NewThreadModal({
  open, onClose, onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (title: string, desc?: string) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [desc, setDesc]   = useState("");
  const [busy, setBusy]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) { setTitle(""); setDesc(""); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [open]);

  const submit = async () => {
    if (!title.trim()) return;
    setBusy(true);
    await onCreate(title.trim(), desc.trim() || undefined);
    setBusy(false);
  };

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-[440px]">
      <div className="px-5 pt-5 pb-4 flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">New research thread</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Group sources around a research question or topic.</p>
        </div>
        <div className="space-y-3">
          <input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void submit()}
            placeholder="Thread title…"
            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface-2 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Description (optional)…"
            rows={2}
            className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface-2 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
          />
        </div>
        <div className="flex justify-end gap-2">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={() => void submit()} disabled={!title.trim() || busy}>
            {busy ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
            Create thread
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

// Fix #10: PDF file picker wired to Tauri dialog:open
function ImportModal({
  open, onClose, onImport, isIngesting,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (input: any) => Promise<void>;
  isIngesting: boolean;
}) {
  const [type, setType]       = useState<"url" | "text" | "pdf">("url");
  const [title, setTitle]     = useState("");
  const [url, setUrl]         = useState("");
  const [text, setText]       = useState("");
  const [filePath, setFilePath] = useState("");
  const [tags, setTags]       = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTitle(""); setUrl(""); setText(""); setFilePath(""); setTags("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const pickPdf = async () => {
    try {
      // Tauri v2: @tauri-apps/plugin-dialog
      const { open: tauriOpen } = await import("@tauri-apps/plugin-dialog");
      const selected = await tauriOpen({
        filters: [{ name: "PDF", extensions: ["pdf"] }],
        multiple: false,
      });
      if (selected && typeof selected === "string") {
        setFilePath(selected);
        if (!title) setTitle(selected.split("/").pop()?.replace(".pdf", "") ?? "");
      }
    } catch {
      // Tauri dialog not available in dev browser — ignore
    }
  };

  const submit = async () => {
    if (!title.trim()) return;
    await onImport({
      type,
      title: title.trim(),
      url:        type === "url"  ? url.trim()      : undefined,
      rawContent: type === "text" ? text.trim()     : undefined,
      filePath:   type === "pdf"  ? filePath.trim() : undefined,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
    });
  };

  const sourceTypes = [
    { id: "url",  label: "Web URL",  icon: Globe },
    { id: "text", label: "Text",     icon: FileText },
    { id: "pdf",  label: "PDF",      icon: BookOpen },
  ] as const;

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-[480px]">
      <div className="px-5 pt-5 pb-4 flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Import source</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Add a source to your research knowledge base.</p>
        </div>

        <div className="flex gap-1.5">
          {sourceTypes.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setType(id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs border transition-fast",
                type === id
                  ? "border-primary/40 bg-primary/[0.08] text-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <Icon size={11} /> {label}
            </button>
          ))}
        </div>

        <div className="space-y-2.5">
          <input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title…"
            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface-2 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
          {type === "url" && (
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface-2 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          )}
          {type === "text" && (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste text content…"
              rows={5}
              className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface-2 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
            />
          )}
          {type === "pdf" && (
            <button
              type="button"
              onClick={() => void pickPdf()}
              className="w-full flex items-center justify-center gap-2 h-20 rounded-lg border-2 border-dashed border-border text-xs text-muted-foreground hover:border-primary/40 hover:text-primary transition-fast"
            >
              <BookOpen size={14} />
              {filePath ? filePath.split("/").pop() : "Click to pick PDF file…"}
            </button>
          )}
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Tags (comma-separated)…"
            className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface-2 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>

        <div className="flex justify-end gap-2">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={() => void submit()} disabled={!title.trim() || isIngesting}>
            {isIngesting ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
            Import
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}

// ── Helpers ───────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
