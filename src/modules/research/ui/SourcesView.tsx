import { useState, useEffect } from "react";
import { bus } from "@/kernel/event-bus";
import { useResearchStore } from "../store";
import { PageHeader, FilterBar, EmptyState, PrimaryButton } from "@/shared/ui";
import { Plus, Search, Loader2, AlertCircle, ChevronRight, Trash2, Pencil } from "lucide-react";
import { BookOpen, Globe, FileText, File } from "lucide-react";
import { cn } from "@/shared/utils";
import type { ResearchSource } from "@/shared/types";
import { ImportModal } from "../modals/ImportModal";

type SourceFilter = "all" | "pdf" | "url" | "text" | "pending" | "error";

export function SourcesView() {
  const {
    sources, isLoading, isIngesting,
    importSource, deleteSource, updateSourceStatus,
    setActiveSource, setActiveView,
  } = useResearchStore();

  const [filter, setFilter]     = useState<SourceFilter>("all");
  const [showImport, setShowImport] = useState(false);
  const [searchQ, setSearchQ]   = useState("");

  useEffect(() => {
    const off = bus.on("research:trigger-import" as any, () => setShowImport(true));
    return () => off();
  }, []);

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

// Fix #5: SourceCard shows edit button for rename/re-tag
export function SourceCard({
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
  const [editing, setEditing]   = useState(false);
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
            onClick={(e) => { e.stopPropagation(); onRetry!(); }}
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
            onClick={(e) => { e.stopPropagation(); onDelete!(); }}
            className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-fast"
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>
    </div>
  );
}

export function SourceTypeIcon({ type, size = 14 }: { type: string; size?: number }) {
  const icons: Record<string, any> = {
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
