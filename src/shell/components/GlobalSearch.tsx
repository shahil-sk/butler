import { useCallback, useEffect, useMemo, useRef } from "react";
import { Command } from "cmdk";
import { useShellStore } from "@/shell/store";
import { bus, useBusEvent } from "@/kernel/event-bus";
import {
  Search, CheckSquare, FolderKanban, FileText,
  CalendarDays, BookOpen, Database, History, ArrowRight,
  Timer
} from "lucide-react";
import { cn } from "@/shared/utils";

import { useSearchStore } from "@/modules/search/store";
import { SearchService } from "@/modules/search/service";
import type { SearchResult, RecentItem } from "@/shared/types";
import { useNavigate } from "react-router-dom";

function getIconForType(type: string) {
  switch (type.toLowerCase()) {
    case "task": return CheckSquare;
    case "project": return FolderKanban;
    case "note": return FileText;
    case "event": return CalendarDays;
    case "journal": return BookOpen;
    case "focus_session": return Timer;
    case "document": return FileText;
    case "source":
    case "research_document": return BookOpen;
    default: return Search;
  }
}

export function GlobalSearch() {
  const navigate = useNavigate();
  const {
    globalSearchOpen,
    globalSearchQuery,
    globalSearchMode,
    closeGlobalSearch,
    setGlobalSearchQuery,
  } = useShellStore();

  const { results, recentItems, isSearching, setQuery, loadRecentItems } = useSearchStore();

  useBusEvent("search:open", (payload) => {
    const q = payload && typeof payload.query === "string" ? payload.query : "";
    const m = payload && payload.mode === "link" ? "link" : "navigate";
    useShellStore.getState().openGlobalSearch(q, m);
  });

  // Sync shell store query with search store query
  useEffect(() => {
    if (globalSearchOpen) {
      setQuery(globalSearchQuery);
    }
  }, [globalSearchQuery, globalSearchOpen, setQuery]);

  useEffect(() => {
    if (globalSearchOpen) {
      loadRecentItems();
    }
  }, [globalSearchOpen, loadRecentItems]);

  const onSelectResult = useCallback(
    async (result: SearchResult) => {
      closeGlobalSearch();
      await SearchService.recordItemOpened(result.type, result.id, result.title);
      if (globalSearchMode === "link") {
        bus.emit("editor:insert-link", { result });
      } else {
        bus.emit("search:result-selected", { result });
      }
    },
    [closeGlobalSearch, globalSearchMode]
  );

  const onSelectRecent = useCallback(
    async (item: RecentItem) => {
      closeGlobalSearch();
      const result = { ...item, score: 0, tags: [] } as any;
      if (globalSearchMode === "link") {
        bus.emit("editor:insert-link", { result });
      } else {
        bus.emit("search:result-selected", { result });
      }
    },
    [closeGlobalSearch, globalSearchMode]
  );

  if (!globalSearchOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[14vh]">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[3px]"
        onClick={closeGlobalSearch}
      />

      <div
        className="relative z-10 w-full max-w-[640px] mx-4 rounded-xl border border-border bg-popover overflow-hidden animate-fade-in"
        style={{ boxShadow: "var(--shadow-popover)" }}
      >
        <Command
          value={globalSearchQuery}
          onValueChange={setGlobalSearchQuery}
          className="flex flex-col"
          shouldFilter={false} // We rely on our FTS backend
        >
          <div className="flex items-center gap-2.5 px-4 border-b border-border">
            <Search size={16} className="text-muted-foreground shrink-0" />
            <Command.Input
              placeholder="Search tasks, notes, journals, or type @ to filter..."
              className={cn(
                "flex-1 h-14 bg-transparent text-base outline-none",
                "placeholder:text-muted-foreground/60 font-normal"
              )}
              autoFocus
              value={globalSearchQuery}
              onValueChange={setGlobalSearchQuery}
              onKeyDown={(e) => { if (e.key === "Escape") closeGlobalSearch(); }}
            />
            {isSearching && <span className="text-[10px] uppercase text-muted-foreground animate-pulse">Searching...</span>}
            <kbd className="kbd">esc</kbd>
          </div>

          <Command.List className="max-h-[400px] overflow-y-auto p-2 space-y-1">
            {!globalSearchQuery.trim() ? (
              <>
                <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <History size={12} /> Recent
                </div>
                {recentItems.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    No recent items.
                  </div>
                ) : (
                  recentItems.map((item) => {
                    const Icon = getIconForType(item.entityType);
                    return (
                      <Command.Item
                        key={`recent-${item.entityType}-${item.entityId}`}
                        value={`recent-${item.entityType}-${item.entityId}`}
                        onSelect={() => onSelectRecent(item)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm cursor-pointer",
                          "text-foreground transition-fast",
                          "data-[selected=true]:bg-accent data-[selected=true]:text-foreground",
                          "hover:bg-accent"
                        )}
                      >
                        <span className="text-muted-foreground shrink-0 flex items-center justify-center bg-background/50 p-1.5 rounded-md">
                          <Icon size={14} />
                        </span>
                        <span className="flex-1 font-medium truncate">{item.title}</span>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                          {item.entityType}
                        </span>
                      </Command.Item>
                    );
                  })
                )}
              </>
            ) : (
              <>
                {results.length === 0 && !isSearching && (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    No matching results found for "{globalSearchQuery}".
                  </div>
                )}

                {results.map((r) => {
                  const Icon = getIconForType(r.type);
                  return (
                    <Command.Item
                      key={`search-${r.type}-${r.id}`}
                      value={`search-${r.type}-${r.id}`}
                      onSelect={() => onSelectResult(r)}
                      className={cn(
                        "flex flex-col gap-1 px-3 py-2.5 rounded-lg text-sm cursor-pointer",
                        "text-foreground transition-fast",
                        "data-[selected=true]:bg-accent data-[selected=true]:text-foreground",
                        "hover:bg-accent group"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground shrink-0 flex items-center justify-center bg-background/50 p-1.5 rounded-md group-data-[selected=true]:text-primary group-data-[selected=true]:bg-primary/10">
                          <Icon size={14} />
                        </span>
                        <span className="flex-1 font-medium" dangerouslySetInnerHTML={{ __html: r.title }} />
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                          {r.type}
                        </span>
                      </div>
                      {r.excerpt && (
                        <div 
                          className="text-xs text-muted-foreground line-clamp-1 pl-10"
                          dangerouslySetInnerHTML={{ __html: r.excerpt }}
                        />
                      )}
                    </Command.Item>
                  );
                })}
              </>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
