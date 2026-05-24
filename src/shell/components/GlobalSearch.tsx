import { useCallback, useMemo } from "react";
import { Command } from "cmdk";
import { useShellStore } from "@/shell/store";
import { bus, useBusEvent } from "@/kernel/event-bus";
import {
  Search, CheckSquare, FolderKanban, FileText,
  CalendarDays, BookOpen, Database
} from "lucide-react";
import { cn } from "@/shared/utils";

import { useTaskStore } from "@/modules/tasks/store";
import { useProjectStore } from "@/modules/projects/store";
import { useNoteStore } from "@/modules/notes/store";
import { useCalendarStore } from "@/modules/calendar/store";
import { useJournalStore } from "@/modules/journal/store";

import type { SearchResult, SearchableEntityType } from "@/shared/types";

function getIconForType(type: SearchableEntityType) {
  switch (type) {
    case "task": return CheckSquare;
    case "project": return FolderKanban;
    case "note": return FileText;
    case "event": return CalendarDays;
    case "journal": return BookOpen;
    case "database_row": return Database;
    default: return Search;
  }
}

export function GlobalSearch() {
  const {
    globalSearchOpen,
    globalSearchQuery,
    closeGlobalSearch,
    setGlobalSearchQuery,
  } = useShellStore();

  useBusEvent("search:open", ({ query }) => {
    useShellStore.getState().openGlobalSearch(query);
  });

  const tasks = useTaskStore((s) => s.tasks);
  const projects = useProjectStore((s) => s.projects);
  const notes = useNoteStore((s) => s.notes);
  const events = useCalendarStore((s) => s.events);
  const journalEntries = useJournalStore((s) => s.entries);

  const results = useMemo(() => {
    const q = globalSearchQuery.toLowerCase().trim();
    if (!q) return [];

    const matched: SearchResult[] = [];

    tasks.forEach((t) => {
      if (t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q)) {
        matched.push({ id: t.id, type: "task", title: t.title, score: 1, updatedAt: t.updatedAt });
      }
    });

    projects.forEach((p) => {
      if (p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q)) {
        matched.push({ id: p.id, type: "project", title: p.name, score: 1, updatedAt: p.updatedAt });
      }
    });

    notes.forEach((n) => {
      if (n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)) {
        matched.push({ id: n.id, type: "note", title: n.title, score: 1, updatedAt: n.updatedAt });
      }
    });

    events.forEach((e) => {
      if (e.title.toLowerCase().includes(q) || e.description?.toLowerCase().includes(q)) {
        matched.push({ id: e.id, type: "event", title: e.title, score: 1, updatedAt: e.updatedAt });
      }
    });

    journalEntries.forEach((e) => {
      if (e.content.toLowerCase().includes(q)) {
        matched.push({ id: e.id, type: "journal", title: `Journal Entry (${e.date})`, score: 1, updatedAt: e.updatedAt });
      }
    });

    // Sort by updated descending
    matched.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    return matched.slice(0, 50);
  }, [globalSearchQuery, tasks, projects, notes, events, journalEntries]);

  const onSelect = useCallback(
    (result: SearchResult) => {
      closeGlobalSearch();
      bus.emit("search:result-selected", { result });
    },
    [closeGlobalSearch]
  );

  if (!globalSearchOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[14vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[3px]"
        onClick={closeGlobalSearch}
      />

      {/* Palette */}
      <div
        className="relative z-10 w-full max-w-[640px] mx-4 rounded-xl border border-border bg-popover overflow-hidden animate-fade-in"
        style={{ boxShadow: "var(--shadow-popover)" }}
      >
        <Command
          value={globalSearchQuery}
          onValueChange={setGlobalSearchQuery}
          className="flex flex-col"
          shouldFilter={false} // We already filtered manually
        >
          {/* Search input */}
          <div className="flex items-center gap-2.5 px-4 border-b border-border">
            <Search size={16} className="text-muted-foreground shrink-0" />
            <Command.Input
              placeholder="Search across all your tasks, notes, projects..."
              className={cn(
                "flex-1 h-14 bg-transparent text-base outline-none",
                "placeholder:text-muted-foreground/60 font-normal"
              )}
              autoFocus
              value={globalSearchQuery}
              onValueChange={setGlobalSearchQuery}
              onKeyDown={(e) => { if (e.key === "Escape") closeGlobalSearch(); }}
            />
            <kbd className="kbd">esc</kbd>
          </div>

          <Command.List className="max-h-[400px] overflow-y-auto p-2 space-y-1">
            {globalSearchQuery && results.length === 0 && (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No matching results found for "{globalSearchQuery}".
              </div>
            )}
            
            {!globalSearchQuery && (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Type to start searching...
              </div>
            )}

            {results.map((r) => {
              const Icon = getIconForType(r.type);
              return (
                <Command.Item
                  key={`${r.type}-${r.id}`}
                  value={`${r.type}-${r.id}`}
                  onSelect={() => onSelect(r)}
                  className={cn(
                    "flex flex-col gap-0.5 px-3 py-2.5 rounded-lg text-sm cursor-pointer",
                    "text-foreground transition-fast",
                    "data-[selected=true]:bg-accent data-[selected=true]:text-foreground",
                    "hover:bg-accent"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground shrink-0 flex items-center justify-center bg-background/50 p-1.5 rounded-md">
                      <Icon size={14} />
                    </span>
                    <span className="flex-1 font-medium">{r.title}</span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                      {r.type}
                    </span>
                  </div>
                </Command.Item>
              );
            })}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
