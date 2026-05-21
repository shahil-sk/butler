// ============================================================
// FOCUS + TIME TRACKING — COMBINED MODULE  (redesign v4)
// Fixes: session history search/filter, streak heatmap,
//        window.confirm → in-app modal, reports date-range picker
// ============================================================

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Timer, Square, Plus, Trash2, Edit2, Check,
  BarChart2, Clock, DollarSign, Tag, Play, Pause,
  Zap, Target, ChevronDown, ChevronUp, Moon, ChevronRight,
  FileText, Smile, AlertCircle, Search, Filter, Calendar,
} from "lucide-react";

import { registry } from "@/kernel/router";
import { RichEditor } from "@/shared/RichEditor";

import { focusManifest } from "@/modules/focus/manifest";
import { useFocusStore } from "@/modules/focus/store";
import { useFocusEventListeners } from "@/modules/focus/events";
import { dbLoadSessionsInRange } from "@/modules/focus/db";

import { TIME_MANIFEST } from "@/modules/time-tracking/manifest";
import { useTimeStore } from "@/modules/time-tracking/store";
import { setupTimeEventListeners } from "@/modules/time-tracking/events";

import { useTaskStore } from "@/modules/tasks/store";
import { useProjectStore } from "@/modules/projects/store";
import { useShellStore } from "@/shell/store";
import { EmptyState, ProjectDot } from "@/shared/ui";
import { cn, today } from "@/shared/utils";
import type { FocusSession, TimeEntry, Task } from "@/shared/types";

registry.register(focusManifest);
registry.register(TIME_MANIFEST);

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function formatSecs(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}
function fmtDuration(m: number) {
  if (m <= 0) return "0m";
  const h = Math.floor(m / 60), r = m % 60;
  return h === 0 ? `${r}m` : r === 0 ? `${h}h` : `${h}h ${r}m`;
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function isOverdue(t: Task) { return !!t.dueDate && t.dueDate < new Date().toISOString().slice(0, 10); }
function totalMins(es: TimeEntry[]) { return es.reduce((a, e) => a + (e.durationMinutes ?? 0), 0); }
function groupByDate(es: TimeEntry[]): [string, TimeEntry[]][] {
  const m = new Map<string, TimeEntry[]>();
  for (const e of es) { const d = e.startAt.slice(0, 10); if (!m.has(d)) m.set(d, []); m.get(d)!.push(e); }
  return Array.from(m.entries());
}
function groupSessionsByDate(sessions: FocusSession[]): [string, FocusSession[]][] {
  const m = new Map<string, FocusSession[]>();
  for (const s of sessions) {
    const d = s.startedAt?.slice(0, 10) ?? s.createdAt.slice(0, 10);
    if (!m.has(d)) m.set(d, []);
    m.get(d)!.push(s);
  }
  return Array.from(m.entries()).sort((a, b) => b[0].localeCompare(a[0]));
}
function dateLabel(d: string) {
  const t = new Date().toISOString().slice(0, 10);
  const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  return d === t ? "Today" : d === y ? "Yesterday" : new Date(d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
function sessionLabel(type: FocusSession["type"]) {
  return type === "focus" ? "Focus" : type === "long_break" ? "Long Break" : "Short Break";
}
function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
}
// ISO date string for N days ago
function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

const MOOD = { 1: "😩", 2: "😕", 3: "😐", 4: "🙂", 5: "😄" } as Record<number, string>;
const MOOD_DESC = { 1: "Terrible", 2: "Rough", 3: "Okay", 4: "Good", 5: "Great" } as Record<number, string>;

// ─────────────────────────────────────────────────────────────────────────────
// SEGMENT CONTROL
// ─────────────────────────────────────────────────────────────────────────────

type Tab = "focus" | "tracker" | "reports";
const TABS: { id: Tab; label: string; Icon: React.FC<{ size?: number; className?: string }> }[] = [
  { id: "focus",   label: "Focus",   Icon: Target },
  { id: "tracker", label: "Tracker", Icon: Clock },
  { id: "reports", label: "Reports", Icon: BarChart2 },
];

function SegmentControl({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="flex items-center rounded-lg p-0.5 gap-0.5" style={{ background: "hsl(var(--muted))" }}>
      {TABS.map(({ id, label, Icon }) => (
        <button key={id} onClick={() => onChange(id)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150 select-none",
            active === id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}>
          <Icon size={13} />
          {label}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE DURATION HOOK  (ticks every second for running timers)
// ─────────────────────────────────────────────────────────────────────────────

function useLiveDuration(startAt?: string, stopped = false): string {
  const [elapsed, setElapsed] = useState("0m");
  useEffect(() => {
    if (!startAt || stopped) return;
    const tick = () => {
      const mins = Math.floor((Date.now() - new Date(startAt).getTime()) / 60000);
      const secs = Math.floor((Date.now() - new Date(startAt).getTime()) / 1000) % 60;
      setElapsed(mins > 0 ? fmtDuration(mins) : `${secs}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startAt, stopped]);
  return elapsed;
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVE TIMER BANNER
// ─────────────────────────────────────────────────────────────────────────────

function ActiveTimerBanner({ onJump }: { onJump: () => void }) {
  const activeEntry = useTimeStore((s) => s.entries.find((e) => e.id === s.activeEntryId));
  const stopTimer   = useTimeStore((s) => s.stopTimer);
  const tasks       = useTaskStore((s) => s.tasks);
  const projects    = useProjectStore((s) => s.projects);
  const elapsed     = useLiveDuration(activeEntry?.startAt, !activeEntry);

  if (!activeEntry) return null;

  const task    = activeEntry.taskId    ? tasks.find((t)    => t.id === activeEntry.taskId)    : null;
  const project = activeEntry.projectId ? projects.find((p) => p.id === activeEntry.projectId) : null;

  return (
    <div
      className="flex items-center gap-2.5 px-4 py-2 text-xs border-b shrink-0"
      style={{ background: "hsl(142 65% 44% / 0.07)", borderColor: "hsl(142 65% 44% / 0.18)" }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse" style={{ background: "hsl(142 65% 44%)" }} />
      <span className="font-bold tabular-nums w-10 shrink-0" style={{ color: "hsl(142 65% 34%)" }}>{elapsed}</span>
      {project && <ProjectDot color={project.color} size={8} title={project.name} />}
      <button onClick={onJump} className="flex-1 text-left truncate text-muted-foreground hover:text-foreground transition-colors">
        {activeEntry.description || task?.title || "Running timer…"}
        {task && <span className="text-muted-foreground/50 ml-1 hidden sm:inline">· {task.title}</span>}
      </button>
      <button onClick={() => void stopTimer()}
        className="flex items-center gap-1 px-2.5 py-1 rounded-md font-semibold transition-colors shrink-0"
        style={{ background: "hsl(var(--destructive) / 0.08)", color: "hsl(var(--destructive))" }}
        onMouseEnter={e => (e.currentTarget.style.background = "hsl(var(--destructive) / 0.16)")}
        onMouseLeave={e => (e.currentTarget.style.background = "hsl(var(--destructive) / 0.08)")}>
        <Square size={10} /> Stop
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STREAK HEATMAP  (14-day chain)  — Gap #2
// ─────────────────────────────────────────────────────────────────────────────

function StreakHeatmap({ sessions, currentStreak }: { sessions: FocusSession[]; currentStreak: number }) {
  // Build a set of ISO dates that have at least one completed focus session
  const activeDays = new Set(
    sessions
      .filter((s) => s.type === "focus" && s.completedAt)
      .map((s) => (s.startedAt ?? s.createdAt).slice(0, 10))
  );

  // Last 14 days, oldest first
  const days = Array.from({ length: 14 }, (_, i) => daysAgo(13 - i));

  return (
    <div className="flex flex-col items-center gap-1.5">
      {/* Chain cells */}
      <div className="flex items-center gap-[3px]">
        {days.map((d, i) => {
          const hasSession = activeDays.has(d);
          const isToday = d === new Date().toISOString().slice(0, 10);
          return (
            <div
              key={d}
              title={`${dateLabel(d)}${hasSession ? " · focus day" : ""}`}
              className="relative group"
            >
              <div
                className={cn(
                  "w-4 h-4 rounded-sm transition-all",
                  hasSession
                    ? "bg-primary"
                    : "bg-border",
                  isToday && "ring-1 ring-primary ring-offset-1 ring-offset-background"
                )}
                style={hasSession ? { opacity: 0.6 + 0.4 * ((i + 1) / 14) } : { opacity: 0.3 }}
              />
              {/* Connector line between cells */}
              {i < 13 && hasSession && activeDays.has(days[i + 1]) && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 h-0.5 bg-primary"
                  style={{ left: "100%", width: 3, opacity: 0.5 }}
                />
              )}
            </div>
          );
        })}
      </div>
      {/* Streak label */}
      <div className="flex items-center gap-1">
        <span className={cn(
          "text-base font-semibold tabular-nums",
          currentStreak >= 3 ? "text-primary" : "text-muted-foreground"
        )}>{currentStreak}d</span>
        <span className="text-xs text-muted-foreground">streak</span>
        {currentStreak >= 3 && <span className="text-xs">🔥</span>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FOCUS HISTORY SIDEBAR  — Gap #1: search + filter
// ─────────────────────────────────────────────────────────────────────────────

function SessionDetail({ session }: { session: FocusSession }) {
  const setMood = useFocusStore((s) => s.setSessionMood);
  return (
    <div className="mt-1.5 flex flex-col gap-2 pb-2">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground/70">
        <span>{session.startedAt ? fmtDateShort(session.startedAt) : "—"}</span>
        <span className="tabular-nums">{session.actualMinutes != null ? fmtDuration(session.actualMinutes) : "—"}</span>
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
            {[1,2,3,4,5].map((m) => (
              <button key={m}
                onClick={() => void setMood(session.id, m as 1|2|3|4|5)}
                title={MOOD_DESC[m]}
                className={cn(
                  "text-base w-7 h-7 rounded-md transition-all hover:scale-110 flex items-center justify-center",
                  session.mood === m ? "ring-2 ring-primary" : "hover:bg-muted"
                )}
                style={session.mood === m ? { background: "hsl(var(--primary) / 0.12)" } : {}}>
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

function FocusHistorySidebar({ sessions }: { sessions: FocusSession[] }) {
  const projects = useProjectStore((s) => s.projects);

  const [expandedId,   setExpandedId]   = useState<string | null>(null);
  const [showAll,      setShowAll]      = useState(false);
  const [searchQuery,  setSearchQuery]  = useState("");
  const [typeFilter,   setTypeFilter]   = useState<SessionTypeFilter>("all");
  const [projectFilter,setProjectFilter]= useState("");
  const [showFilters,  setShowFilters]  = useState(false);

  // Apply filters
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
    <div className="flex flex-col h-full overflow-hidden border-r" style={{ width: 230, borderColor: "hsl(var(--border))" }}>
      {/* Header */}
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
        {/* Search */}
        <div className="relative">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 pointer-events-none" />
          <input
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setShowAll(true); }}
            placeholder="Search goals…"
            className="w-full pl-7 pr-2 py-1.5 rounded-md border border-border bg-background text-[11px] placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring/40"
          />
        </div>
        {/* Filter panel */}
        {showFilters && (
          <div className="mt-2 flex flex-col gap-1.5">
            {/* Type filter */}
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
            {/* Project filter */}
            {activeProjects.length > 0 && (
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="w-full bg-background border border-border rounded-md px-2 py-1 text-[11px] focus:outline-none"
              >
                <option value="">All projects</option>
                {activeProjects.map((pid) => {
                  const p = projects.find((x) => x.id === pid);
                  return p ? <option key={pid} value={pid}>{p.name}</option> : null;
                })}
              </select>
            )}
            {/* Clear filters */}
            {(typeFilter !== "all" || projectFilter || searchQuery) && (
              <button
                onClick={() => { setTypeFilter("all"); setProjectFilter(""); setSearchQuery(""); }}
                className="text-[10px] text-muted-foreground hover:text-foreground text-left transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Session list */}
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
                  const isOpen   = expandedId === s.id;
                  const hasNotes = s.notes && stripHtml(s.notes);
                  const snippet  = s.goal ? `"${s.goal.slice(0, 40)}${s.goal.length > 40 ? "…" : ""}"` : null;

                  return (
                    <div key={s.id} className="mb-1">
                      <button
                        onClick={() => setExpandedId(isOpen ? null : s.id)}
                        className={cn(
                          "w-full flex items-start gap-2 py-1.5 px-1.5 rounded-lg text-left transition-colors",
                          isOpen ? "bg-muted" : "hover:bg-muted/50"
                        )}
                      >
                        <div className={cn("w-1.5 h-1.5 rounded-full mt-1 shrink-0",
                          s.type === "focus" ? "bg-primary" : s.type === "long_break" ? "bg-emerald-500" : "bg-amber-400"
                        )} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[11px] font-medium">{sessionLabel(s.type)}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              {s.mood && <span className="text-[10px]">{MOOD[s.mood]}</span>}
                              {hasNotes && <FileText size={8} className="text-muted-foreground/50" />}
                              <span className="text-[10px] text-muted-foreground tabular-nums">
                                {s.actualMinutes ? `${s.actualMinutes}m` : "–"}
                              </span>
                              <ChevronRight size={9} className={cn(
                                "text-muted-foreground/40 transition-transform",
                                isOpen && "rotate-90"
                              )} />
                            </div>
                          </div>
                          {snippet && !isOpen && (
                            <p className="text-[10px] text-muted-foreground/70 truncate italic mt-0.5">{snippet}</p>
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

// ─────────────────────────────────────────────────────────────────────────────
// MOOD CARD
// ─────────────────────────────────────────────────────────────────────────────

function MoodCard({ sessionId, mood }: { sessionId: string; mood?: number }) {
  const setMood   = useFocusStore((s) => s.setSessionMood);
  const clearLast = useFocusStore((s) => s.clearLastCompleted);
  const [sel, setSel] = useState<number | null>(mood ?? null);

  function pick(m: number) {
    setSel(m);
    void setMood(sessionId, m as 1|2|3|4|5);
    setTimeout(clearLast, 800);
  }

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-xs p-4 rounded-xl border"
      style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}>
      <p className="text-sm font-medium">How was that session?</p>
      <div className="flex gap-1.5">
        {[1,2,3,4,5].map((m) => (
          <button key={m} onClick={() => pick(m)} title={MOOD_DESC[m]}
            className={cn("text-xl w-9 h-9 rounded-lg transition-all hover:scale-110 flex items-center justify-center",
              sel === m ? "ring-2 ring-primary" : "hover:bg-muted"
            )}
            style={sel === m ? { background: "hsl(var(--primary) / 0.12)" } : {}}>
            {MOOD[m]}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        {sel && <p className="text-[11px] text-muted-foreground">{MOOD_DESC[sel]} · saved</p>}
        <button onClick={clearLast}
          className="text-[11px] text-muted-foreground/60 hover:text-foreground transition-colors">
          Dismiss
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RING TIMER
// ─────────────────────────────────────────────────────────────────────────────

function RingTimer({ secondsLeft, totalSeconds, state }: {
  secondsLeft: number; totalSeconds: number; state: FocusSession["state"] | "idle";
}) {
  const r = 100, circ = 2 * Math.PI * r;
  const progress = totalSeconds > 0 ? (totalSeconds - secondsLeft) / totalSeconds : 0;
  const offset   = circ * (1 - progress);
  const ringColor =
    state === "break"    ? "hsl(142 65% 44%)"    :
    state === "paused"   ? "hsl(38 92% 52%)"     :
    state === "focusing" ? "hsl(var(--primary))"  :
    "hsl(var(--border))";
  const stateText =
    state === "idle"     ? "ready"    :
    state === "focusing" ? "focusing" :
    state === "paused"   ? "paused"   : "on break";

  return (
    <div className="relative flex items-center justify-center" style={{ width: 240, height: 240 }}>
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 240 240">
        <circle cx="120" cy="120" r={r} fill="none" strokeWidth="8" stroke="hsl(var(--border))" />
        <circle cx="120" cy="120" r={r} fill="none" strokeWidth="8"
          stroke={ringColor} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s linear, stroke 0.4s ease" }}
        />
      </svg>
      <div className="flex flex-col items-center select-none z-10">
        <span className="text-5xl font-mono font-semibold tabular-nums leading-none tracking-tight">
          {formatSecs(secondsLeft)}
        </span>
        <span className="text-xs text-muted-foreground mt-2 tracking-widest uppercase">{stateText}</span>
      </div>
    </div>
  );
}

function PillButtons({ label, value, options, onChange, disabled }: {
  label: string; value: number; options: number[]; onChange: (v: number) => void; disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="flex gap-1">
        {options.map((o) => (
          <button key={o} disabled={disabled} onClick={() => onChange(o)}
            className={cn(
              "px-2.5 py-1 rounded-md text-xs font-medium transition-all",
              value === o
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/70 disabled:opacity-40"
            )}>
            {o}m
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FOCUS TAB
// ─────────────────────────────────────────────────────────────────────────────

function FocusTab() {
  useFocusEventListeners();

  const load        = useFocusStore((s) => s.load);
  const sessions    = useFocusStore((s) => s.sessions);
  const active      = useFocusStore((s) => s.activeSession);
  const secsLeft    = useFocusStore((s) => s.secondsLeft);
  const doneCount   = useFocusStore((s) => s.completedFocusCount);
  const lastDone    = useFocusStore((s) => s.lastCompletedSession);
  const pendingGoal = useFocusStore((s) => s.pendingGoal);
  const stats       = useFocusStore((s) => s.stats);
  const startFocus  = useFocusStore((s) => s.startFocus);
  const pause       = useFocusStore((s) => s.pause);
  const resume      = useFocusStore((s) => s.resume);
  const cancel      = useFocusStore((s) => s.cancel);
  const startBreak  = useFocusStore((s) => s.startBreak);
  const skipBreak   = useFocusStore((s) => s.skipBreak);
  const setTaskId   = useFocusStore((s) => s.setTaskId);
  const setProjectId = useFocusStore((s) => s.setProjectId);
  const setGoal     = useFocusStore((s) => s.setGoal);
  const setNotes    = useFocusStore((s) => s.setSessionNotes);
  const clearLast   = useFocusStore((s) => s.clearLastCompleted);

  const tasks        = useTaskStore((s) => s.tasks);
  const loadTasks    = useTaskStore((s) => s.loadTasks);
  const projects     = useProjectStore((s) => s.projects);
  const loadProjects = useProjectStore((s) => s.loadProjects);
  const settings     = useShellStore((s) => s.settings);

  const [focusMins,      setFocusMins]      = useState(() => settings?.focusModePomodoroMinutes   ?? 25);
  const [shortBreakMins, setShortBreakMins] = useState(() => settings?.focusModeShortBreakMinutes ?? 5);
  const [longBreakMins,  setLongBreakMins]  = useState(() => settings?.focusModeLongBreakMinutes  ?? 15);
  const sessionsBeforeLong = settings?.focusModeSessionsBeforeLongBreak ?? 4;

  const [selTask,    setSelTask]    = useState("");
  const [selProject, setSelProject] = useState("");
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => { void load(); void loadTasks(); void loadProjects(); }, [load, loadTasks, loadProjects]);
  useEffect(() => {
    if (active?.taskId)    setSelTask(active.taskId);
    if (active?.projectId) setSelProject(active.projectId);
  }, [active?.taskId, active?.projectId]);

  const state      = active?.state ?? "idle";
  const isIdle     = !active || state === "idle";
  const isFocusing = state === "focusing";
  const isPaused   = state === "paused";
  const isBreak    = state === "break";
  const totalSecs  = active ? active.plannedMinutes * 60 : focusMins * 60;
  const dispSecs   = isIdle ? focusMins * 60 : secsLeft;

  const showBreakOffer = !!lastDone && lastDone.type === "focus" && isIdle;
  const showMoodRater  = !!lastDone && lastDone.type !== "focus" && isIdle;

  const openTasks = tasks
    .filter((t) => t.status !== "done" && t.status !== "archived" && t.status !== "cancelled")
    .sort((a, b) => {
      if (isOverdue(a) !== isOverdue(b)) return isOverdue(a) ? -1 : 1;
      const w: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };
      return (w[a.priority] ?? 4) - (w[b.priority] ?? 4);
    });

  function handleTaskChange(id: string) {
    setSelTask(id);
    if (active) setTaskId(id || undefined);
    const t = id ? tasks.find((x) => x.id === id) : null;
    const pid = t?.projectId ?? "";
    setSelProject(pid);
    if (active) setProjectId(pid || undefined);
  }

  function handleStart() {
    void startFocus({
      taskId:    selTask    || undefined,
      projectId: selProject || undefined,
      config: { focusMinutes: focusMins, shortBreakMinutes: shortBreakMins, longBreakMinutes: longBreakMins, sessionsBeforeLongBreak: sessionsBeforeLong },
    });
  }

  function handleBreakAfterFocus() {
    const isLong = doneCount > 0 && (doneCount % sessionsBeforeLong) === 0;
    if (isLong) startBreak("long_break", longBreakMins);
    else        startBreak("short_break", shortBreakMins);
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left: history sidebar */}
      <FocusHistorySidebar sessions={sessions} />

      {/* Right: main timer area */}
      <div className="flex-1 flex flex-col items-center justify-start overflow-y-auto py-8 px-6 gap-5">

        {/* Stats row — streak replaced with heatmap */}
        <div className="flex items-center gap-5 flex-wrap justify-center">
          {[
            { label: "Today",    value: `${stats.todayMinutes}m`,                  chip: stats.todaySessions > 0 ? `${stats.todaySessions} sessions` : undefined },
            { label: "Week",     value: `${stats.weekMinutes}m`,                   chip: undefined },
            { label: "All time", value: `${Math.round(stats.totalMinutes / 60)}h`, chip: undefined },
          ].map(({ label, value, chip }) => (
            <div key={label} className="flex items-baseline gap-1.5">
              <span className="text-base font-semibold tabular-nums">{value}</span>
              <span className="text-xs text-muted-foreground">{label}</span>
              {chip && <span className="text-[10px] text-muted-foreground/60">({chip})</span>}
            </div>
          ))}
          {/* Streak heatmap inline */}
          <StreakHeatmap sessions={sessions} currentStreak={stats.currentStreak} />
        </div>

        {/* Ring timer */}
        <RingTimer secondsLeft={dispSecs} totalSeconds={totalSecs} state={state} />

        {/* Pomodoro dots */}
        <div className="flex gap-2">
          {Array.from({ length: sessionsBeforeLong }).map((_, i) => (
            <div key={i} className={cn("w-2 h-2 rounded-full transition-colors",
              i < (doneCount % sessionsBeforeLong) ? "bg-primary" : "bg-border"
            )} />
          ))}
        </div>

        {/* ── IDLE ── */}
        {isIdle && !showBreakOffer && !showMoodRater && (
          <div className="flex flex-col items-center gap-4 w-full max-w-sm">
            <input
              value={pendingGoal ?? ""}
              onChange={(e) => setGoal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleStart()}
              placeholder="What's your intention for this session?"
              className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
            <div className="grid grid-cols-2 gap-2 w-full">
              <select value={selTask} onChange={(e) => handleTaskChange(e.target.value)}
                className="bg-background border border-border rounded-lg px-2 py-2 text-sm focus:outline-none truncate">
                <option value="">— No task —</option>
                {openTasks.map((t) => <option key={t.id} value={t.id}>{isOverdue(t) ? "⚠ " : ""}{t.title}</option>)}
              </select>
              <select value={selProject} onChange={(e) => setSelProject(e.target.value)}
                className="bg-background border border-border rounded-lg px-2 py-2 text-sm focus:outline-none truncate">
                <option value="">— No project —</option>
                {projects.filter((p) => p.status === "active").map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <button onClick={() => setShowConfig((v) => !v)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors self-start">
              {showConfig ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              Timer settings
            </button>
            {showConfig && (
              <div className="flex flex-col gap-3 w-full p-3 rounded-xl border" style={{ background: "hsl(var(--muted) / 0.3)", borderColor: "hsl(var(--border))" }}>
                <PillButtons label="Focus"       value={focusMins}      options={[15,20,25,30,45,60]} onChange={setFocusMins}      disabled={false} />
                <PillButtons label="Short break" value={shortBreakMins} options={[3,5,10]}            onChange={setShortBreakMins} disabled={false} />
                <PillButtons label="Long break"  value={longBreakMins}  options={[10,15,20,30]}       onChange={setLongBreakMins}  disabled={false} />
              </div>
            )}
            <button onClick={handleStart}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity">
              Start Focus
            </button>
          </div>
        )}

        {/* ── FOCUSING ── */}
        {isFocusing && (
          <div className="flex flex-col items-center gap-4 w-full max-w-sm">
            {active?.goal && <p className="text-sm text-muted-foreground italic text-center">"{active.goal}"</p>}
            {(active?.interruptCount ?? 0) > 0 && (
              <p className="text-xs text-amber-500">{active!.interruptCount} interruption{(active!.interruptCount ?? 0) > 1 ? "s" : ""}</p>
            )}
            <div className="w-full">
              <label className="text-xs text-muted-foreground mb-1 block">Session notes</label>
              <RichEditor
                content={active?.notes ?? ""}
                onChange={(v) => setNotes(v)}
                placeholder="Capture thoughts mid-session…"
                className="min-h-[60px] text-sm"
              />
            </div>
            <div className="flex gap-2 w-full">
              <button onClick={pause}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-border hover:bg-muted transition-colors text-sm font-medium">
                <Pause size={13} /> Pause
              </button>
              <button onClick={() => void cancel()}
                className="flex-1 py-2.5 rounded-lg border text-sm font-medium hover:bg-destructive/10 transition-colors"
                style={{ borderColor: "hsl(var(--destructive) / 0.4)", color: "hsl(var(--destructive))" }}>
                Stop
              </button>
            </div>
          </div>
        )}

        {/* ── PAUSED ── */}
        {isPaused && (
          <div className="flex flex-col items-center gap-3 w-full max-w-sm">
            {active?.notes && stripHtml(active.notes) && (
              <div className="w-full rounded-lg p-3 text-xs" style={{ background: "hsl(var(--muted) / 0.5)" }}>
                <p className="text-muted-foreground mb-1 text-[10px] uppercase tracking-wider">Notes so far</p>
                <div dangerouslySetInnerHTML={{ __html: active.notes }} className="prose prose-xs max-w-none line-clamp-4" />
              </div>
            )}
            <div className="flex gap-2 w-full">
              <button onClick={resume}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
                <Play size={13} /> Resume
              </button>
              <button onClick={() => void cancel()}
                className="flex-1 py-2.5 rounded-xl border text-sm font-medium hover:bg-destructive/10 transition-colors"
                style={{ borderColor: "hsl(var(--destructive) / 0.4)", color: "hsl(var(--destructive))" }}>
                Stop
              </button>
            </div>
          </div>
        )}

        {/* ── BREAK ── */}
        {isBreak && (
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-muted-foreground">
              {active?.type === "long_break" ? "☕ Long break — you earned it" : "🍃 Short break"}
            </p>
            <button onClick={skipBreak}
              className="px-6 py-2 rounded-lg border border-border hover:bg-muted transition-colors text-sm">
              Skip break
            </button>
          </div>
        )}

        {/* ── POST-FOCUS: break offer ── */}
        {showBreakOffer && (
          <div className="flex flex-col items-center gap-3 p-5 rounded-2xl border w-full max-w-xs text-center"
            style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}>
            <p className="font-semibold">Session complete 🎉</p>
            <p className="text-xs text-muted-foreground">
              {doneCount > 0 && (doneCount % sessionsBeforeLong) === 0 ? "You've earned a long break" : "Take a short break"}
            </p>
            <div className="flex gap-2 w-full">
              <button onClick={handleBreakAfterFocus}
                className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
                Start break
              </button>
              <button onClick={clearLast}
                className="flex-1 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">
                Skip
              </button>
            </div>
          </div>
        )}

        {/* ── POST-BREAK: mood ── */}
        {showMoodRater && lastDone && <MoodCard sessionId={lastDone.id} mood={lastDone.mood} />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TRACKER TAB
// ─────────────────────────────────────────────────────────────────────────────

function EntryForm({ initial = {}, onSave, onCancel }: {
  initial?: Partial<TimeEntry>;
  onSave: (data: Partial<TimeEntry>) => void;
  onCancel: () => void;
}) {
  const tasks    = useTaskStore((s) => s.tasks);
  const projects = useProjectStore((s) => s.projects);
  const [desc,      setDesc]      = useState(initial.description ?? "");
  const [taskId,    setTaskId]    = useState(initial.taskId ?? "");
  const [projectId, setProjectId] = useState(initial.projectId ?? "");
  const [billable,  setBillable]  = useState(initial.isBillable ?? false);
  const [startAt,   setStartAt]   = useState(() => {
    if (initial.startAt) return initial.startAt.slice(0, 16);
    return new Date().toISOString().slice(0, 16);
  });
  const [endAt, setEndAt] = useState(() => {
    if (initial.endAt) return initial.endAt.slice(0, 16);
    const d = new Date(initial.startAt ?? Date.now());
    d.setHours(d.getHours() + 1);
    return d.toISOString().slice(0, 16);
  });

  const durationPreview = (() => {
    try {
      const diff = Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000);
      return diff > 0 ? fmtDuration(diff) : null;
    } catch { return null; }
  })();

  const save = () => onSave({
    description: desc, taskId: taskId || undefined, projectId: projectId || undefined,
    isBillable: billable,
    startAt: new Date(startAt).toISOString(),
    endAt:   endAt ? new Date(endAt).toISOString() : undefined,
  });

  return (
    <div className="border-b shrink-0" style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--muted) / 0.2)" }}>
      <div className="p-3 flex flex-col gap-2.5">
        <input autoFocus value={desc} onChange={(e) => setDesc(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
          placeholder="What are you working on?" />
        <div className="grid grid-cols-2 gap-2">
          <select value={taskId} onChange={(e) => setTaskId(e.target.value)}
            className="bg-background border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none">
            <option value="">No task</option>
            {tasks.filter((t) => t.status !== "done" && t.status !== "archived").map((t) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)}
            className="bg-background border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none">
            <option value="">No project</option>
            {projects.filter((p) => p.status === "active").map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Start</label>
            <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 flex items-center justify-between">
              End
              {durationPreview && <span className="text-primary font-semibold tabular-nums">{durationPreview}</span>}
            </label>
            <input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none" />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => setBillable((b) => !b)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors select-none">
            <div className={cn("w-4 h-4 rounded border flex items-center justify-center transition-colors",
              billable ? "bg-primary border-primary text-primary-foreground" : "border-border")}>
              {billable && <Check size={10} />}
            </div>
            <DollarSign size={11} /> Billable
          </button>
          <div className="flex gap-2">
            <button onClick={onCancel} className="px-3 py-1.5 text-sm rounded-lg hover:bg-muted transition-colors">Cancel</button>
            <button onClick={save} className="px-3 py-1.5 text-sm rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity font-medium">Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EntryRow({ entry, onEdit, onDelete, onResume }: {
  entry: TimeEntry; onEdit: (id: string) => void; onDelete: (id: string) => void; onResume: (e: TimeEntry) => void;
}) {
  const tasks    = useTaskStore((s) => s.tasks);
  const projects = useProjectStore((s) => s.projects);
  const task     = entry.taskId    ? tasks.find((t)    => t.id === entry.taskId)    : null;
  const project  = entry.projectId ? projects.find((p) => p.id === entry.projectId) : null;
  const isRunning = !entry.endAt;
  const liveDur   = useLiveDuration(entry.startAt, !isRunning);

  const isCancelledTask = task && (task.status === "cancelled" || task.status === "archived");

  return (
    <div className="group flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors border-b last:border-0"
      style={{ borderColor: "hsl(var(--border) / 0.5)" }}>
      {isRunning && (
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={cn("text-sm truncate leading-tight", isCancelledTask && "opacity-50")}>
            {entry.description || <span className="text-muted-foreground italic">No description</span>}
          </span>
          {entry.isBillable && <DollarSign size={10} className="text-emerald-500 shrink-0" />}
          {entry.focusSessionId && (
            <span className="text-[9px] px-1 py-0.5 rounded shrink-0 text-muted-foreground"
              style={{ background: "hsl(var(--primary) / 0.07)" }}>Focus</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {project && <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><ProjectDot color={project.color} size={8} />{project.name}</span>}
          {task && (
            <span className={cn("text-[11px] truncate", isCancelledTask ? "text-muted-foreground/40 line-through" : "text-muted-foreground/70")}>
              · {task.title}
              {isCancelledTask && <span className="ml-1 text-[10px]">(cancelled)</span>}
            </span>
          )}
          <span className="text-[11px] text-muted-foreground/50 ml-auto hidden sm:block">
            {fmtTime(entry.startAt)}{entry.endAt ? `–${fmtTime(entry.endAt)}` : " (running)"}
          </span>
        </div>
      </div>
      <span className={cn("text-sm font-semibold tabular-nums w-12 text-right shrink-0", isRunning && "text-emerald-600")}>
        {isRunning ? liveDur : (entry.durationMinutes ? fmtDuration(entry.durationMinutes) : "—")}
      </span>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => onResume(entry)} title="Resume"
          className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          <Play size={12} />
        </button>
        <button onClick={() => onEdit(entry.id)} title="Edit"
          className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          <Edit2 size={12} />
        </button>
        <button onClick={() => onDelete(entry.id)} title="Delete"
          className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-destructive">
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

function TrackerTab() {
  useEffect(() => { setupTimeEventListeners(); }, []);

  const entries       = useTimeStore((s) => s.entries);
  const activeEntryId = useTimeStore((s) => s.activeEntryId);
  const startTimer    = useTimeStore((s) => s.startTimer);
  const stopTimer     = useTimeStore((s) => s.stopTimer);
  const addEntry      = useTimeStore((s) => s.createEntry);
  const updateEntry   = useTimeStore((s) => s.updateEntry);
  const deleteEntry   = useTimeStore((s) => s.deleteEntry);
  const load          = useTimeStore((s) => s.load);
  const tasks         = useTaskStore((s) => s.tasks);
  const loadTasks     = useTaskStore((s) => s.loadTasks);
  const loadProjects  = useProjectStore((s) => s.loadProjects);

  const [showForm,  setShowForm]  = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [todayOnly, setTodayOnly] = useState(true);
  const [quickDesc, setQuickDesc] = useState("");
  const [quickTask, setQuickTask] = useState("");

  useEffect(() => { void load(); void loadTasks(); void loadProjects(); }, [load, loadTasks, loadProjects]);

  const completed   = entries.filter((e) => e.endAt);
  const running     = entries.find((e) => e.id === activeEntryId && !e.endAt);
  const shown       = todayOnly ? completed.filter((e) => e.startAt.startsWith(today())) : completed;
  const grouped     = groupByDate([...shown].sort((a, b) => b.startAt.localeCompare(a.startAt)));
  const activeEntry = running;

  function handleQuickStart() {
    const task = quickTask ? tasks.find((t) => t.id === quickTask) : null;
    void startTimer({
      description: quickDesc || task?.title || undefined,
      taskId:      quickTask || undefined,
    });
    setQuickDesc(""); setQuickTask("");
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b shrink-0" style={{ borderColor: "hsl(var(--border))" }}>
        <input
          value={quickDesc} onChange={(e) => setQuickDesc(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !activeEntry) handleQuickStart(); }}
          placeholder="What are you working on?"
          disabled={!!activeEntry}
          className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 disabled:opacity-50"
        />
        <select value={quickTask} onChange={(e) => setQuickTask(e.target.value)}
          disabled={!!activeEntry}
          className="bg-background border border-border rounded-lg px-2 py-2 text-sm focus:outline-none max-w-[140px] disabled:opacity-50 hidden sm:block">
          <option value="">No task</option>
          {tasks.filter((t) => t.status !== "done" && t.status !== "archived").map((t) => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>
        {!activeEntry ? (
          <button onClick={handleQuickStart}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity shrink-0">
            <Play size={13} /> Start
          </button>
        ) : (
          <button onClick={() => void stopTimer()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold shrink-0 transition-colors"
            style={{ background: "hsl(var(--destructive) / 0.08)", color: "hsl(var(--destructive))" }}
            onMouseEnter={e => (e.currentTarget.style.background = "hsl(var(--destructive) / 0.16)")}
            onMouseLeave={e => (e.currentTarget.style.background = "hsl(var(--destructive) / 0.08)")}>
            <Square size={13} /> Stop
          </button>
        )}
        <button onClick={() => { setShowForm((v) => !v); setEditingId(null); }}
          className={cn("p-2 rounded-lg border transition-colors shrink-0",
            showForm ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted")}
          title="Add manual entry">
          <Plus size={15} />
        </button>
      </div>

      {showForm && !editingId && (
        <EntryForm
          onSave={(data) => { void addEntry({ startAt: data.startAt!, ...data }); setShowForm(false); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {activeEntry && (
        <EntryRow
          entry={activeEntry}
          onEdit={(id) => { setEditingId(id); setShowForm(false); }}
          onDelete={(id) => void deleteEntry(id)}
          onResume={() => {/* already running */}}
        />
      )}

      <div className="flex items-center gap-1.5 px-4 py-2 border-b shrink-0" style={{ borderColor: "hsl(var(--border))" }}>
        <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ background: "hsl(var(--muted))" }}>
          <button onClick={() => setTodayOnly(true)}
            className={cn("px-3 py-1 rounded-md text-xs font-medium transition-all",
              todayOnly ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            Today
          </button>
          <button onClick={() => setTodayOnly(false)}
            className={cn("px-3 py-1 rounded-md text-xs font-medium transition-all",
              !todayOnly ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            All
          </button>
        </div>
        {shown.length > 0 && (
          <span className="ml-auto text-xs font-semibold tabular-nums text-muted-foreground">
            {fmtDuration(totalMins(shown))}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {editingId && (
          <EntryForm
            initial={entries.find((e) => e.id === editingId)}
            onSave={(data) => { void updateEntry(editingId, data); setEditingId(null); }}
            onCancel={() => setEditingId(null)}
          />
        )}
        {grouped.length === 0 && !activeEntry ? (
          <EmptyState icon={<Clock size={26} />} title="No entries yet" description="Start a timer or add an entry manually." />
        ) : (
          grouped.map(([date, dayEntries]) => (
            <div key={date}>
              <div className="flex items-center justify-between px-4 py-2 sticky top-0 z-10 border-b"
                style={{ background: "hsl(var(--background))", borderColor: "hsl(var(--border))" }}>
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{dateLabel(date)}</span>
                <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">{fmtDuration(totalMins(dayEntries))}</span>
              </div>
              {dayEntries.map((e) => (
                <EntryRow key={e.id} entry={e}
                  onEdit={(id) => { setEditingId(id); setShowForm(false); }}
                  onDelete={(id) => void deleteEntry(id)}
                  onResume={(entry) => void startTimer({
                    description: entry.description,
                    taskId:      entry.taskId,
                    projectId:   entry.projectId,
                  })}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORTS TAB — Gap #4: date range picker
// ─────────────────────────────────────────────────────────────────────────────

type RangePreset = "7d" | "30d" | "90d" | "custom";

const RANGE_PRESETS: { id: RangePreset; label: string }[] = [
  { id: "7d",  label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
  { id: "custom", label: "Custom" },
];

function presetToDates(preset: RangePreset): { from: string; to: string } {
  const to = new Date().toISOString().slice(0, 10);
  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
  const from = daysAgo(days - 1);
  return { from, to };
}

function ReportsTab() {
  const storeEntries = useTimeStore((s) => s.entries);
  const projects     = useProjectStore((s) => s.projects);
  const tasks        = useTaskStore((s) => s.tasks);

  // ── Date range state ──
  const [preset,     setPreset]     = useState<RangePreset>("7d");
  const [customFrom, setCustomFrom] = useState(daysAgo(29));
  const [customTo,   setCustomTo]   = useState(new Date().toISOString().slice(0, 10));

  // ── Range-filtered focus sessions (from DB) ──
  const [rangeSessions, setRangeSessions] = useState<FocusSession[]>([]);
  const [loadingRange,  setLoadingRange]  = useState(false);

  const activeFrom = preset === "custom" ? customFrom : presetToDates(preset).from;
  const activeTo   = preset === "custom" ? customTo   : presetToDates(preset).to;

  useEffect(() => {
    setLoadingRange(true);
    dbLoadSessionsInRange(activeFrom, activeTo)
      .then(setRangeSessions)
      .catch(console.error)
      .finally(() => setLoadingRange(false));
  }, [activeFrom, activeTo]);

  // ── Filter time entries by active range ──
  const completed = storeEntries.filter(
    (e) => e.endAt && e.durationMinutes &&
    e.startAt.slice(0, 10) >= activeFrom &&
    e.startAt.slice(0, 10) <= activeTo
  );

  // Bar chart: bucket by day across active range
  const dayCount = Math.round(
    (new Date(activeTo).getTime() - new Date(activeFrom).getTime()) / 86400000
  ) + 1;

  // For ranges > 14 days, bucket into weeks
  const useWeekly = dayCount > 14;

  const chartBuckets = (() => {
    if (!useWeekly) {
      return Array.from({ length: dayCount }, (_, i) => {
        const d = new Date(new Date(activeFrom).getTime() + i * 86400000).toISOString().slice(0, 10);
        const mins = completed.filter((e) => e.startAt.slice(0, 10) === d).reduce((a, e) => a + (e.durationMinutes ?? 0), 0);
        const focusMins = rangeSessions
          .filter((s) => s.type === "focus" && (s.startedAt ?? s.createdAt).slice(0, 10) === d)
          .reduce((a, s) => a + (s.actualMinutes ?? 0), 0);
        return { label: new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" }), mins, focusMins };
      });
    }
    // Weekly bucketing
    const weeks: { label: string; mins: number; focusMins: number }[] = [];
    let cursor = new Date(activeFrom);
    const end  = new Date(activeTo);
    while (cursor <= end) {
      const weekStart = cursor.toISOString().slice(0, 10);
      const weekEnd   = new Date(Math.min(cursor.getTime() + 6 * 86400000, end.getTime())).toISOString().slice(0, 10);
      const mins = completed
        .filter((e) => e.startAt.slice(0, 10) >= weekStart && e.startAt.slice(0, 10) <= weekEnd)
        .reduce((a, e) => a + (e.durationMinutes ?? 0), 0);
      const focusMins = rangeSessions
        .filter((s) => s.type === "focus" && (s.startedAt ?? s.createdAt).slice(0, 10) >= weekStart && (s.startedAt ?? s.createdAt).slice(0, 10) <= weekEnd)
        .reduce((a, s) => a + (s.actualMinutes ?? 0), 0);
      weeks.push({
        label: new Date(weekStart).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        mins,
        focusMins,
      });
      cursor = new Date(cursor.getTime() + 7 * 86400000);
    }
    return weeks;
  })();

  const maxMins = Math.max(...chartBuckets.map((b) => b.mins), 60);

  // By project (range-filtered)
  const byProject = projects
    .map((p) => {
      const mins = completed.filter((e) => e.projectId === p.id).reduce((a, e) => a + (e.durationMinutes ?? 0), 0);
      return { ...p, mins };
    })
    .filter((p) => p.mins > 0)
    .sort((a, b) => b.mins - a.mins);

  const totalTracked  = completed.reduce((a, e) => a + (e.durationMinutes ?? 0), 0);
  const billable      = completed.filter((e) => e.isBillable).reduce((a, e) => a + (e.durationMinutes ?? 0), 0);
  const totalFocusMins = rangeSessions
    .filter((s) => s.type === "focus" && s.completedAt)
    .reduce((a, s) => a + (s.actualMinutes ?? 0), 0);

  return (
    <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">

      {/* ── Date range picker ── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {RANGE_PRESETS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setPreset(id)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                preset === id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
          <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
            {new Date(activeFrom).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            {" – "}
            {new Date(activeTo).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
        </div>
        {/* Custom date inputs */}
        {preset === "custom" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customFrom}
              max={customTo}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="bg-background border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <input
              type="date"
              value={customTo}
              min={customFrom}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setCustomTo(e.target.value)}
              className="bg-background border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
          </div>
        )}
      </div>

      {/* ── KPI row ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Tracked",     value: fmtDuration(totalTracked) },
          { label: "Focus time",  value: fmtDuration(totalFocusMins) },
          { label: "Billable",    value: fmtDuration(billable) },
        ].map(({ label, value }) => (
          <div key={label} className="flex flex-col gap-1 p-4 rounded-xl border"
            style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}>
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className="text-xl font-semibold tabular-nums">{value}</span>
          </div>
        ))}
      </div>

      {/* ── Bar chart ── */}
      <div className="rounded-xl border p-4" style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {useWeekly ? "Weekly" : "Daily"} tracked time
          </p>
          {loadingRange && (
            <span className="text-[10px] text-muted-foreground animate-pulse">Loading…</span>
          )}
        </div>
        <div className="flex items-end gap-1.5 h-24 overflow-x-auto">
          {chartBuckets.map(({ label, mins, focusMins }) => (
            <div key={label} className="flex-1 min-w-[20px] flex flex-col items-center gap-1">
              <span className="text-[9px] text-muted-foreground tabular-nums">{mins > 0 ? fmtDuration(mins) : ""}</span>
              <div className="w-full flex flex-col items-stretch rounded-sm overflow-hidden" style={{ height: `${Math.max((mins / maxMins) * 80, mins > 0 ? 4 : 0)}px`, minHeight: mins > 0 ? 4 : 0 }}>
                {/* Focus minutes portion (stacked on top in primary color) */}
                {focusMins > 0 && mins > 0 && (
                  <div style={{ flex: focusMins, background: "hsl(var(--primary))" }} />
                )}
                {/* Remaining tracked time */}
                {(mins - focusMins) > 0 && (
                  <div style={{ flex: Math.max(mins - focusMins, 0), background: "hsl(var(--primary) / 0.3)" }} />
                )}
                {focusMins === 0 && mins > 0 && (
                  <div style={{ flex: 1, background: "hsl(var(--primary) / 0.3)" }} />
                )}
              </div>
              <span className="text-[9px] text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
        {/* Legend */}
        <div className="flex items-center gap-3 mt-3">
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="w-2 h-2 rounded-sm inline-block" style={{ background: "hsl(var(--primary))" }} /> Focus
          </span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="w-2 h-2 rounded-sm inline-block" style={{ background: "hsl(var(--primary) / 0.3)" }} /> Tracked
          </span>
        </div>
      </div>

      {/* ── By project ── */}
      {byProject.length > 0 && (
        <div className="rounded-xl border p-4" style={{ background: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">By project</p>
          <div className="flex flex-col gap-2">
            {byProject.map((p) => (
              <div key={p.id} className="flex items-center gap-3">
                <ProjectDot color={p.color} size={8} />
                <span className="text-sm flex-1 truncate">{p.name}</span>
                <span className="text-xs font-semibold tabular-nums text-muted-foreground">{fmtDuration(p.mins)}</span>
                <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: "hsl(var(--muted))" }}>
                  <div className="h-full rounded-full" style={{
                    width: `${(p.mins / (byProject[0]?.mins ?? 1)) * 100}%`,
                    background: p.color ?? "hsl(var(--primary))",
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {completed.length === 0 && (
        <EmptyState icon={<BarChart2 size={26} />} title="No data for this period" description="Track time or complete focus sessions to see reports here." />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT MODULE
// ─────────────────────────────────────────────────────────────────────────────

export default function FocusModule() {
  const [tab, setTab] = useState<Tab>("focus");

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ActiveTimerBanner onJump={() => setTab("tracker")} />
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0"
        style={{ borderColor: "hsl(var(--border))" }}>
        <SegmentControl active={tab} onChange={setTab} />
      </div>
      {tab === "focus"   && <FocusTab />}
      {tab === "tracker" && <TrackerTab />}
      {tab === "reports" && <ReportsTab />}
    </div>
  );
}
