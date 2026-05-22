import { useResearchStore } from "../store";
import { PageHeader } from "@/shared/ui";
import { Share2 } from "lucide-react";

export function GraphView() {
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
