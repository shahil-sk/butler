import { useEffect } from "react";
import { useResearchStore } from "../store";
import { EmptyState, GhostButton, SectionLabel } from "@/shared/ui";
import { cn } from "@/shared/utils";
import { X, ExternalLink, Loader2 } from "lucide-react";
import { HighlightsPanel } from "./HighlightsPanel";
import { AnnotationsPanel } from "./AnnotationsPanel";

function DocInfoPanel({ document, source }: { document: any; source: any }) {
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

export function DocumentView() {
  const {
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
