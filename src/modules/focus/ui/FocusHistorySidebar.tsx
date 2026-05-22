import { useState } from "react";
import { Target, Search, Filter, FileText, ChevronRight, AlertCircle } from "lucide-react";
import { cn } from "@/shared/utils";
import {
  groupSessionsByDate,
  dateLabel,
  sessionLabel,
  stripHtml,
  fmtDateShort,
  formatDuration,
} from "@/shared/formatters";
import { useFocusStore } from "@/modules/focus/store";
import { useProjectStore } from "@/modules/projects/store";
import type { FocusSession } from "@/shared/types";

const MOOD = { 1: "😩", 2: "😕", 3: "😐", 4: "🙂", 5: "😄" } as Record<number, string>;
const MOOD_DESC = { 1: "Terrible", 2: "Rough", 3: "Okay", 4: "Good", 5: "Great" } as Record<number, string>;

function SessionDetail({ session }: { session: FocusSession }) {
  const setMood = useFocusStore((s) => s.setSessionMood);
  return (
    <div className="mt-1.5 flex flex-col gap-2 pb-2">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground/70">
        <span>{session.startedAt ? fmtDateShort(session.startedAt) : "—"}</span>
        <span className="tabular-nums">
          {session.actualMinutes != null ? formatDuration(session.actualMinutes) : "—"}
        </span>
      </div>
      {(session.interruptCount ?? 0) > 0 && (
        <div className="flex items-center gap-1 text-[10px] text-amber-500">
          <AlertCircle size={9} />
          {session.interruptCount} interruption{(session.interruptCount ?? 0) > 1 ? "s" : ""}
        </div>
      )}
      {session.notes && stripHtml(session.notes) && (
        <div className="rounded-md p-2 text-[11px]" style={{ background: "hsl(var(--muted) / 0.5)" }}>
          <div className="flex items-center gap-1 mb-1 text-muted-foreground">
            <FileText size={9} /> Notes
          </div>
          <div
            className="text-foreground/80 leading-snug line-clamp-6 prose prose-xs max-w-none"
            dangerouslySetInnerHTML={{ __html: session.notes }}
          />
        </div>
      )}
      {session.type === "focus" && session.completedAt && (
        <div>
          <p className="text-[10px] text-muted-foreground mb-1">Rate session:</p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((m) => (
              <button
                key={m}
                onClick={() => void setMood(session.id, m as 1 | 2 | 3 | 4 | 5)}
                title={MOOD_DESC[m]}
                className={cn(
                  "text-base w-7 h-7 rounded-md transition-all hover:scale-110 flex items-center justify-center",
                  session.mood === m ? "ring-2 ring-primary" : "hover:bg-muted"
                )}
                style={session.mood === m ? { background: "hsl(var(--primary) / 0.12)" } : {}}
              >
                {MOOD[m]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

type SessionTypeFilter = "all" | "focus" | "short_break" | "long_break";

export function FocusHistorySidebar({ sessions }: { sessions: FocusSession[] }) {
  const projects = useProjectStore((s) => s.projects);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<SessionTypeFilter>("all");
  const [projectFilter, setProjectFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const filtered = sessions.filter((s) => {
    if (typeFilter !== "all" && s.type !== typeFilter) return false;
    if (projectFilter && s.projectId !== projectFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const goal = (s.goal ?? "").toLowerCase();
      const notes = stripHtml(s.notes ?? "").toLowerCase();
      if (!goal.includes(q) && !notes.includes(q)) return false;
    }
    return true;
  });

  const grouped = groupSessionsByDate(filtered);
  const visibleGroups = showAll ? grouped : grouped.slice(0, 7);
  const hasMore = grouped.length > 7;
  const activeProjects = [...new Set(sessions.map((s) => s.projectId).filter(Boolean))];

  return (
    <div
      className="flex flex-col h-full overflow-hidden border-r"
      style={{ width: 230, borderColor: "hsl(var(--border))" }}
    >
      <div className="px-3 py-2.5 border-b shrink-0" style={{ borderColor: "hsl(var(--border))" }}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">History</p>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={cn(
              "p-1 rounded transition-colors text-muted-foreground hover:text-foreground",
              (typeFilter !== "all" || projectFilter) && "text-primary"
            )}
            title="Filters"
          >
            <Filter size={12} />
          </button>
        </div>
        <div className="relative">
          <Search
            size={11}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 pointer-events-none"
          />
          <input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowAll(true);
            }}
            placeholder="Search goals…"
            className="w-full pl-7 pr-2 py-1.5 rounded-md border border-border bg-background text-[11px] placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring/40"
          />
        </div>
        {showFilters && (
          <div className="mt-2 flex flex-col gap-1.5">
            <div className="flex flex-wrap gap-1">
              {(["all", "focus", "short_break", "long_break"] as SessionTypeFilter[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors",
                    typeFilter === t
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t === "all" ? "All" : t === "focus" ? "Focus" : t === "short_break" ? "Short" : "Long"}
                </button>
              ))}
            </div>
            {activeProjects.length > 0 && (
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="w-full bg-background border border-border rounded-md px-2 py-1 text-[11px] focus:outline-none"
              >
                <option value="">All projects</option>
                {activeProjects.map((pid) => {
                  const p = projects.find((x) => x.id === pid);
                  return p ? (
                    <option key={pid} value={pid}>
                      {p.name}
                    </option>
                  ) : null;
                })}
              </select>
            )}
            {(typeFilter !== "all" || projectFilter || searchQuery) && (
              <button
                onClick={() => {
                  setTypeFilter("all");
                  setProjectFilter("");
                  setSearchQuery("");
                }}
                className="text-[10px] text-muted-foreground hover:text-foreground text-left transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center px-3">
            <Target size={22} className="text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">
              {sessions.length === 0 ? "No sessions yet" : "No results"}
            </p>
          </div>
        ) : (
          <>
            {visibleGroups.map(([date, list]) => (
              <div key={date} className="px-3 pt-3 pb-1">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  {dateLabel(date)}
                </p>
                {list.map((s) => {
                  const isOpen = expandedId === s.id;
                  const hasNotes = s.notes && stripHtml(s.notes);
                  const snippet = s.goal
                    ? `"${s.goal.slice(0, 40)}${s.goal.length > 40 ? "…" : ""}"`
                    : null;

                  return (
                    <div key={s.id} className="mb-1">
                      <button
                        onClick={() => setExpandedId(isOpen ? null : s.id)}
                        className={cn(
                          "w-full flex items-start gap-2 py-1.5 px-1.5 rounded-lg text-left transition-colors",
                          isOpen ? "bg-muted" : "hover:bg-muted/50"
                        )}
                      >
                        <div
                          className={cn(
                            "w-1.5 h-1.5 rounded-full mt-1 shrink-0",
                            s.type === "focus"
                              ? "bg-primary"
                              : s.type === "long_break"
                              ? "bg-emerald-500"
                              : "bg-amber-400"
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[11px] font-medium">{sessionLabel(s.type)}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              {s.mood && <span className="text-[10px]">{MOOD[s.mood]}</span>}
                              {hasNotes && <FileText size={8} className="text-muted-foreground/50" />}
                              <span className="text-[10px] text-muted-foreground tabular-nums">
                                {s.actualMinutes ? `${s.actualMinutes}m` : "–"}
                              </span>
                              <ChevronRight
                                size={9}
                                className={cn(
                                  "text-muted-foreground/40 transition-transform",
                                  isOpen && "rotate-90"
                                )}
                              />
                            </div>
                          </div>
                          {snippet && !isOpen && (
                            <p className="text-[10px] text-muted-foreground/70 truncate italic mt-0.5">
                              {snippet}
                            </p>
                          )}
                        </div>
                      </button>
                      {isOpen && (
                        <div className="px-3 pb-1">
                          <SessionDetail session={s} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
            {hasMore && (
              <div className="px-3 pb-3">
                <button
                  onClick={() => setShowAll((v) => !v)}
                  className="w-full text-[11px] text-muted-foreground hover:text-foreground py-1.5 rounded-lg hover:bg-muted transition-colors text-center"
                >
                  {showAll ? "Show less" : `Show ${grouped.length - 7} older days`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
