// ============================================================
// RESEARCH MODULE — ROOT ROUTER (~50 lines)
// ============================================================

import { useEffect } from "react";
import { registry } from "@/kernel/router";
import { bus } from "@/kernel/event-bus";
import { useResearchStore } from "./store";
import { researchManifest } from "./manifest";
import { setupResearchEventListeners } from "./events";
import { SectionLabel } from "@/shared/ui";
import { cn } from "@/shared/utils";
import { Layers, FileText, Share2 } from "lucide-react";

import { ThreadsView }  from "./ui/ThreadsView";
import { SourcesView }  from "./ui/SourcesView";
import { DocumentView } from "./ui/DocumentView";
import { GraphView }    from "./ui/GraphView";

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
