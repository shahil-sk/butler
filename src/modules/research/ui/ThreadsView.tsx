import { useState, useEffect, useRef } from "react";
import { bus } from "@/kernel/event-bus";
import { useResearchStore } from "../store";
import { PageHeader, EmptyState, PrimaryButton, SectionLabel } from "@/shared/ui";
import { cn } from "@/shared/utils";
import { Brain, Plus, Search, Trash2, Tag, Link2 } from "lucide-react";
import { Loader2 } from "lucide-react";
import type { ResearchSource, ResearchThread } from "@/shared/types";
import { SourceCard } from "./SourcesView";
import { GhostButton } from "@/shared/ui";
import { NewThreadModal } from "../modals/NewThreadModal";

export function ThreadsView() {
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
  const { sources, addSourceToThread, removeSourceFromThread } = useResearchStore();
  const threadSources    = sources.filter((s) => thread.sourceIds.includes(s.id));
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

export function SourceTypeIcon({ type, size = 14 }: { type: string; size?: number }) {
  const { FileText, BookOpen, Globe, File } = require("lucide-react");
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
