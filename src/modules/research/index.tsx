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
} from "lucide-react";
import type { ResearchSource, ResearchThread } from "@/shared/types";

// ── Module boot ──────────────────────────────────────────────

export function ResearchModule() {
  const { init, activeView, setActiveView } = useResearchStore();

  useEffect(() => {
    registry.register(researchManifest);
    void init();
    const teardown = setupResearchEventListeners();

    // Command palette hooks
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
      {/* ── Left sub-nav ──────────────────────────────────── */}
      <ResearchSubNav activeView={activeView} onSelect={setActiveView} />

      {/* ── Main area ─────────────────────────────────────── */}
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

  // Listen for command-palette trigger
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

        {/* Search */}
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

        {/* List */}
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

      {/* New thread modal */}
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
      onClick={onClick}
      className={cn(
        "w-full flex flex-col gap-0.5 px-3 py-2.5 text-left transition-fast group",
        active
          ? "bg-primary/[0.07] border-l-2 border-primary"
          : "border-l-2 border-transparent hover:bg-accent"
      )}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        {thread.isPinned && <span className="text-amber-400 text-[10px]">★</span>}
        <span className={cn("text-xs font-medium truncate flex-1", active ? "text-primary" : "text-foreground")}>
          {thread.title}
        </span>
        <span className="opacity-0 group-hover:opacity-100 transition-fast flex items-center gap-0.5">
          <span
            onClick={(e) => { e.stopPropagation(); onPin(); }}
            className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
            title={thread.isPinned ? "Unpin" : "Pin"}
          >
            <span className="text-[10px]">{thread.isPinned ? "★" : "☆"}</span>
          </span>
          <span
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-0.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500"
            title="Delete thread"
          >
            <Trash2 size={10} />
          </span>
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
  const { sources, addSourceToThread, updateThread } = useResearchStore();
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
              <SourceCard key={src.id} source={src} compact />
            ))}
          </div>
        )}

        {/* Tags */}
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
        <div
          className="absolute right-0 top-full mt-1 z-50 w-64 rounded-xl border border-border bg-popover shadow-lg py-1.5 max-h-60 overflow-y-auto"
        >
          {sources.map((src) => (
            <button
              key={src.id}
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
    setActiveDocument, setActiveView,
  } = useResearchStore();

  const [filter, setFilter] = useState<SourceFilter>("all");
  const [showImport, setShowImport] = useState(false);
  const [searchQ, setSearchQ] = useState("");

  useEffect(() => {
    const off = bus.on("research:trigger-import" as any, () => setShowImport(true));
    return () => off();
  }, []);

  const filtered = sources.filter((s) => {
    if (filter === "pending") return s.processingStatus === "pending" || s.processingStatus === "processing";
    if (filter === "error")   return s.processingStatus === "error";
    if (filter !== "all")     return s.type === filter;
    if (searchQ)              return s.title.toLowerCase().includes(searchQ.toLowerCase());
    return true;
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

      {/* Search */}
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

      {/* List */}
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
              onOpen={() => { setActiveDocument(src.id); setActiveView("document"); }}
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
  const isError   = source.processingStatus === "error";
  const isPending = source.processingStatus === "pending" || source.processingStatus === "processing";

  return (
    <div
      className={cn(
        "group flex items-start gap-3 rounded-lg border border-border/60 bg-surface-1 transition-fast",
        compact ? "px-3 py-2" : "px-4 py-3",
        onOpen && "hover:bg-accent cursor-pointer"
      )}
      onClick={onOpen}
    >
      <div className="shrink-0 mt-0.5">
        <SourceTypeIcon type={source.type} size={compact ? 13 : 15} />
      </div>

      <div className="flex-1 min-w-0">
        <p className={cn("font-medium truncate text-foreground", compact ? "text-[11px]" : "text-xs")}>
          {source.title}
        </p>
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

      {/* Status + actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {isPending && <Loader2 size={11} className="text-primary animate-spin" />}
        {isError   && <AlertCircle size={11} className="text-red-400" />}
        {isError && onRetry && (
          <button
            onClick={(e) => { e.stopPropagation(); onRetry(); }}
            className="text-[10px] text-primary hover:underline"
          >
            Retry
          </button>
        )}
        {onOpen && (
          <ChevronRight size={12} className="text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-fast" />
        )}
        {onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-fast"
            title="Delete source"
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
    activeDocumentId, documents, sources,
    chunks, highlights, annotations,
    sidebarTab, setSidebarTab,
    loadDocumentChunks, loadHighlights, loadAnnotations,
    createHighlight, deleteHighlight,
    createAnnotation, deleteAnnotation,
    setActiveView,
  } = useResearchStore();

  const document = documents.find((d) => d.id === activeDocumentId) ?? null;
  const source   = document ? sources.find((s) => s.id === document.sourceId) : null;

  useEffect(() => {
    if (!activeDocumentId) return;
    void loadDocumentChunks(activeDocumentId);
    void loadHighlights(activeDocumentId);
    void loadAnnotations(activeDocumentId);
  }, [activeDocumentId, loadDocumentChunks, loadHighlights, loadAnnotations]);

  if (!document || !source) {
    return (
      <EmptyState
        title="No document open"
        subtitle="Select a source from the Sources view to read it."
        action={{ label: "Go to Sources", onClick: () => setActiveView("sources") }}
      />
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
        {/* Doc header */}
        <div
          className="flex items-center gap-2 px-4 h-[46px] shrink-0"
          style={{ borderBottom: "1px solid hsl(var(--border))" }}
        >
          <button
            onClick={() => setActiveView("sources")}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-fast"
            title="Back to sources"
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
              title="Open original"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink size={12} />
            </a>
          )}
        </div>

        {/* Chunks */}
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
                <ChunkBlock
                  key={chunk.id}
                  content={chunk.content}
                  sectionTitle={chunk.sectionTitle}
                  pageNumber={chunk.pageNumber}
                  hasHighlights={chunkHighlights.length > 0}
                  onHighlight={() =>
                    void createHighlight({
                      documentId: document.id,
                      chunkId: chunk.id,
                      sourceId: source.id,
                      text: chunk.content.slice(0, 200),
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
        {/* Sidebar tabs */}
        <div
          className="flex shrink-0 gap-0.5 px-1.5 py-1.5"
          style={{ borderBottom: "1px solid hsl(var(--border))" }}
        >
          {sideTabs.map(({ id, label }) => (
            <button
              key={id}
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
            <AnnotationsPanel
              annotations={annotations}
              onDelete={deleteAnnotation}
              onAdd={() =>
                void createAnnotation({
                  documentId: document.id,
                  sourceId: source.id,
                  type: "note",
                  content: "",
                })
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ChunkBlock({
  content, sectionTitle, pageNumber, hasHighlights, onHighlight,
}: {
  content: string;
  sectionTitle?: string;
  pageNumber?: number;
  hasHighlights: boolean;
  onHighlight: () => void;
}) {
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
        onClick={onHighlight}
        title="Highlight this chunk"
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
        subtitle="Click ★ on any chunk to highlight it."
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

function AnnotationsPanel({
  annotations,
  onDelete,
  onAdd,
}: {
  annotations: any[];
  onDelete: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-3 pt-2 pb-1 shrink-0 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">Notes</span>
        <button
          onClick={onAdd}
          className="text-[10px] text-primary hover:underline"
        >
          + Add note
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-1 space-y-2">
        {annotations.length === 0 ? (
          <p className="text-xs text-muted-foreground/60 py-4 text-center">No notes yet.</p>
        ) : (
          annotations.map((a) => (
            <div key={a.id} className="group rounded-md border border-border/60 bg-surface-2 px-3 py-2">
              <p className="text-[11px] text-foreground/80 leading-relaxed">{a.content || <em className="text-muted-foreground/40">Empty note</em>}</p>
              <div className="flex items-center gap-2 mt-1.5 opacity-0 group-hover:opacity-100 transition-fast">
                <span className="text-[10px] text-muted-foreground/40">{a.type}</span>
                <button
                  onClick={() => onDelete(a.id)}
                  className="text-[10px] text-red-400 hover:text-red-500 ml-auto"
                >
                  Delete
                </button>
              </div>
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

function ImportModal({
  open, onClose, onImport, isIngesting,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (input: any) => Promise<void>;
  isIngesting: boolean;
}) {
  const [type, setType]   = useState<"url" | "text" | "pdf">("url");
  const [title, setTitle] = useState("");
  const [url, setUrl]     = useState("");
  const [text, setText]   = useState("");
  const [tags, setTags]   = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTitle(""); setUrl(""); setText(""); setTags("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const submit = async () => {
    if (!title.trim()) return;
    await onImport({
      type,
      title: title.trim(),
      url:        type === "url"  ? url.trim()  : undefined,
      rawContent: type === "text" ? text.trim() : undefined,
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

        {/* Type selector */}
        <div className="flex gap-1.5">
          {sourceTypes.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
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
            <div className="flex items-center justify-center h-20 rounded-lg border-2 border-dashed border-border text-xs text-muted-foreground">
              PDF file picker — wire to Tauri `dialog:open` in events.ts
            </div>
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
