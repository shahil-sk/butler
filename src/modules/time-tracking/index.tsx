// ============================================================
// TIME TRACKING — MODULE ROOT
// ============================================================

import { useEffect, useState, useCallback, useRef } from "react";
import { Routes, Route, NavLink } from "react-router-dom";
import {
  Timer, Square, Plus, Trash2, Edit2, Check, X,
  BarChart2, Clock, DollarSign, Tag, ChevronDown,
  Calendar, Briefcase, Play,
} from "lucide-react";

import { registry } from "@/kernel/router";
import { bus } from "@/kernel/event-bus";
import { useTimeStore } from "./store";
import { setupTimeEventListeners } from "./events";
import { TIME_MANIFEST } from "./manifest";
import { useTaskStore } from "@/modules/tasks/store";
import { useProjectStore } from "@/modules/projects/store";
import { PageHeader, SubNav, EmptyState, ProjectDot } from "@/shared/ui";
import { formatDate, today } from "@/shared/utils";
import type { TimeEntry, ID } from "@/shared/types";

// ── Helpers ──────────────────────────────────────────────────

function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function groupEntriesByDate(entries: TimeEntry[]): [string, TimeEntry[]][] {
  const map = new Map<string, TimeEntry[]>();
  for (const e of entries) {
    const date = e.startAt.slice(0, 10);
    if (!map.has(date)) map.set(date, []);
    map.get(date)!.push(e);
  }
  return Array.from(map.entries());
}

function totalMinutes(entries: TimeEntry[]): number {
  return entries.reduce((acc, e) => acc + (e.durationMinutes ?? 0), 0);
}

// ── Live timer tick ─────────────────────────────────────────

function useLiveDuration(startAt: string | undefined): string {
  const [elapsed, setElapsed] = useState("0m");
  useEffect(() => {
    if (!startAt) return;
    const tick = () => {
      const mins = Math.floor((Date.now() - new Date(startAt).getTime()) / 60000);
      setElapsed(fmtDuration(mins));
    };
    tick();
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, [startAt]);
  return elapsed;
}

// ── ActiveTimerBar ───────────────────────────────────────────

function ActiveTimerBar() {
  const activeEntry  = useTimeStore((s) => s.entries.find((e) => e.id === s.activeEntryId));
  const stopTimer    = useTimeStore((s) => s.stopTimer);
  const tasks        = useTaskStore((s) => s.tasks);
  const elapsed      = useLiveDuration(activeEntry?.startAt);

  if (!activeEntry) return null;

  const task = activeEntry.taskId ? tasks.find((t) => t.id === activeEntry.taskId) : null;

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-green-500/10 border-b border-green-500/20 text-sm">
      <span className="inline-flex items-center gap-1.5 text-green-600 dark:text-green-400 font-medium">
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        {elapsed}
      </span>
      <span className="text-muted-foreground truncate flex-1">
        {activeEntry.description || task?.title || "Running timer…"}
      </span>
      <button
        onClick={() => stopTimer()}
        className="flex items-center gap-1 px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-medium transition-colors"
      >
        <Square size={11} />
        Stop
      </button>
    </div>
  );
}

// ── EntryForm (inline) ───────────────────────────────────────

interface EntryFormProps {
  initial?: Partial<TimeEntry>;
  onSave: (data: Partial<TimeEntry>) => void;
  onCancel: () => void;
}

function EntryForm({ initial = {}, onSave, onCancel }: EntryFormProps) {
  const tasks    = useTaskStore((s) => s.tasks);
  const projects = useProjectStore((s) => s.projects);

  const [desc,       setDesc]       = useState(initial.description ?? "");
  const [taskId,     setTaskId]     = useState<ID | "">(initial.taskId ?? "");
  const [projectId,  setProjectId]  = useState<ID | "">(initial.projectId ?? "");
  const [isBillable, setIsBillable] = useState(initial.isBillable ?? false);
  const [startAt,    setStartAt]    = useState(
    initial.startAt ? initial.startAt.slice(0, 16) : new Date().toISOString().slice(0, 16)
  );
  const [endAt,      setEndAt]      = useState(
    initial.endAt ? initial.endAt.slice(0, 16) : ""
  );

  const handleSave = () => {
    onSave({
      description: desc,
      taskId:      taskId || undefined,
      projectId:   projectId || undefined,
      isBillable,
      startAt:     new Date(startAt).toISOString(),
      endAt:       endAt ? new Date(endAt).toISOString() : undefined,
    });
  };

  return (
    <div className="p-4 border-b border-border bg-muted/30 flex flex-col gap-3">
      <input
        autoFocus
        className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        placeholder="What are you working on?"
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSave()}
      />

      <div className="grid grid-cols-2 gap-2">
        <select
          className="bg-background border border-border rounded px-2 py-1.5 text-sm focus:outline-none"
          value={taskId}
          onChange={(e) => setTaskId(e.target.value)}
        >
          <option value="">No task</option>
          {tasks.filter((t) => t.status !== "done" && t.status !== "archived").map((t) => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>

        <select
          className="bg-background border border-border rounded px-2 py-1.5 text-sm focus:outline-none"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        >
          <option value="">No project</option>
          {projects.filter((p) => p.status === "active").map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Start</label>
          <input
            type="datetime-local"
            className="bg-background border border-border rounded px-2 py-1.5 text-sm focus:outline-none"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">End</label>
          <input
            type="datetime-local"
            className="bg-background border border-border rounded px-2 py-1.5 text-sm focus:outline-none"
            value={endAt}
            onChange={(e) => setEndAt(e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <button
            type="button"
            onClick={() => setIsBillable((b) => !b)}
            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
              isBillable
                ? "bg-primary border-primary text-primary-foreground"
                : "border-border"
            }`}
          >
            {isBillable && <Check size={10} />}
          </button>
          <DollarSign size={12} className="text-muted-foreground" />
          Billable
        </label>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm rounded hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1.5 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── EntryRow ────────────────────────────────────────────────

interface EntryRowProps {
  entry: TimeEntry;
  onEdit: (id: ID) => void;
  onDelete: (id: ID) => void;
  onResume: (entry: TimeEntry) => void;
}

function EntryRow({ entry, onEdit, onDelete, onResume }: EntryRowProps) {
  const tasks    = useTaskStore((s) => s.tasks);
  const projects = useProjectStore((s) => s.projects);

  const task    = entry.taskId    ? tasks.find((t)    => t.id === entry.taskId)    : null;
  const project = entry.projectId ? projects.find((p) => p.id === entry.projectId) : null;

  return (
    <div className="group flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors border-b border-border/40 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm truncate">
            {entry.description || <span className="text-muted-foreground italic">No description</span>}
          </span>
          {entry.isBillable && (
            <DollarSign size={11} className="text-emerald-500 shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {project && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <ProjectDot color={project.color} size="xs" />
              {project.name}
            </span>
          )}
          {task && (
            <span className="text-xs text-muted-foreground truncate">· {task.title}</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <span className="text-xs text-muted-foreground tabular-nums">
          {fmtTime(entry.startAt)}
          {entry.endAt ? ` – ${fmtTime(entry.endAt)}` : ""}
        </span>
        <span className="text-sm font-medium tabular-nums w-14 text-right">
          {entry.durationMinutes != null ? fmtDuration(entry.durationMinutes) : "—"}
        </span>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onResume(entry)}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
            title="Resume"
          >
            <Play size={13} />
          </button>
          <button
            onClick={() => onEdit(entry.id)}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            <Edit2 size={13} />
          </button>
          <button
            onClick={() => onDelete(entry.id)}
            className="p-1 rounded hover:bg-muted text-red-400 hover:text-red-500"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── TrackerView ─────────────────────────────────────────────

function TrackerView() {
  const { entries, activeEntryId, startTimer, stopTimer, createEntry, updateEntry, deleteEntry } =
    useTimeStore();

  const [showNewForm, setShowNewForm] = useState(false);
  const [editingId,   setEditingId]   = useState<ID | null>(null);
  const [quickDesc,   setQuickDesc]   = useState("");

  const activeEntry = entries.find((e) => e.id === activeEntryId);
  const completedEntries = entries.filter((e) => e.id !== activeEntryId && e.endAt);
  const grouped = groupEntriesByDate(completedEntries);

  const handleQuickStart = () => {
    startTimer({ description: quickDesc });
    setQuickDesc("");
  };

  const handleSaveNew = async (data: Partial<TimeEntry>) => {
    if (!data.startAt) return;
    await createEntry({ startAt: data.startAt, ...data });
    setShowNewForm(false);
  };

  const handleSaveEdit = async (data: Partial<TimeEntry>) => {
    if (!editingId) return;
    await updateEntry(editingId, data);
    setEditingId(null);
  };

  const handleResume = (entry: TimeEntry) => {
    startTimer({
      description: entry.description,
      taskId:      entry.taskId,
      projectId:   entry.projectId,
      isBillable:  entry.isBillable,
      tags:        entry.tags,
    });
  };

  return (
    <div className="flex flex-col h-full">
      <ActiveTimerBar />

      {/* Quick start row */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <div className="flex-1 relative">
          <input
            className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring pr-10"
            placeholder="What are you working on?"
            value={quickDesc}
            onChange={(e) => setQuickDesc(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleQuickStart()}
          />
        </div>

        {activeEntryId ? (
          <button
            onClick={() => stopTimer()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors shrink-0"
          >
            <Square size={13} />
            Stop
          </button>
        ) : (
          <button
            onClick={handleQuickStart}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium transition-colors shrink-0"
          >
            <Play size={13} />
            Start
          </button>
        )}

        <button
          onClick={() => setShowNewForm((v) => !v)}
          className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
          title="Add manual entry"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Manual entry form */}
      {showNewForm && (
        <EntryForm onSave={handleSaveNew} onCancel={() => setShowNewForm(false)} />
      )}

      {/* Entry list */}
      <div className="flex-1 overflow-y-auto">
        {completedEntries.length === 0 ? (
          <EmptyState
            icon={<Clock size={32} className="text-muted-foreground" />}
            title="No entries yet"
            description="Start a timer or add an entry manually"
          />
        ) : (
          grouped.map(([date, dayEntries]) => (
            <div key={date}>
              <div className="flex items-center justify-between px-4 py-2 bg-muted/20 border-b border-border/60 sticky top-0 z-10">
                <span className="text-xs font-medium text-muted-foreground">
                  {date === today() ? "Today" : formatDate(date)}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {fmtDuration(totalMinutes(dayEntries))}
                </span>
              </div>

              {dayEntries.map((entry) =>
                editingId === entry.id ? (
                  <EntryForm
                    key={entry.id}
                    initial={entry}
                    onSave={handleSaveEdit}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    onEdit={setEditingId}
                    onDelete={deleteEntry}
                    onResume={handleResume}
                  />
                )
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── ReportsView ─────────────────────────────────────────────

type RangePreset = "today" | "week" | "month" | "custom";

function ReportsView() {
  const entries  = useTimeStore((s) => s.entries.filter((e) => e.endAt));
  const projects = useProjectStore((s) => s.projects);
  const tasks    = useTaskStore((s) => s.tasks);

  const [preset,    setPreset]    = useState<RangePreset>("week");
  const [fromDate,  setFromDate]  = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));

  const applyPreset = (p: RangePreset) => {
    setPreset(p);
    const now = new Date();
    if (p === "today") {
      const d = now.toISOString().slice(0, 10);
      setFromDate(d); setToDate(d);
    } else if (p === "week") {
      const from = new Date(now); from.setDate(now.getDate() - 7);
      setFromDate(from.toISOString().slice(0, 10));
      setToDate(now.toISOString().slice(0, 10));
    } else if (p === "month") {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      setFromDate(from.toISOString().slice(0, 10));
      setToDate(now.toISOString().slice(0, 10));
    }
  };

  const filtered = entries.filter(
    (e) => e.startAt.slice(0, 10) >= fromDate && e.startAt.slice(0, 10) <= toDate
  );

  const totalMins    = totalMinutes(filtered);
  const billableMins = totalMinutes(filtered.filter((e) => e.isBillable));

  // By project
  const byProject = new Map<string, number>();
  filtered.forEach((e) => {
    const key = e.projectId ?? "__none__";
    byProject.set(key, (byProject.get(key) ?? 0) + (e.durationMinutes ?? 0));
  });
  const projectRows = Array.from(byProject.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id, mins]) => ({
      project: id !== "__none__" ? projects.find((p) => p.id === id) : null,
      mins,
    }));

  return (
    <div className="p-6 overflow-y-auto h-full">
      {/* Range controls */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {(["today", "week", "month", "custom"] as RangePreset[]).map((p) => (
          <button
            key={p}
            onClick={() => applyPreset(p)}
            className={`px-3 py-1.5 text-sm rounded-md capitalize transition-colors ${
              preset === p
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80"
            }`}
          >
            {p === "week" ? "Last 7 days" : p === "month" ? "This month" : p}
          </button>
        ))}

        {preset === "custom" && (
          <div className="flex items-center gap-2 ml-2">
            <input
              type="date"
              className="bg-background border border-border rounded px-2 py-1 text-sm"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
            <span className="text-muted-foreground text-sm">–</span>
            <input
              type="date"
              className="bg-background border border-border rounded px-2 py-1 text-sm"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Total", value: fmtDuration(totalMins), icon: Clock },
          { label: "Billable", value: fmtDuration(billableMins), icon: DollarSign },
          {
            label: "Entries",
            value: String(filtered.length),
            icon: Tag,
          },
        ].map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="rounded-xl border border-border bg-muted/20 p-4 flex items-start gap-3"
          >
            <div className="p-2 rounded-lg bg-muted">
              <Icon size={14} className="text-muted-foreground" />
            </div>
            <div>
              <div className="text-2xl font-semibold tabular-nums">{value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* By project */}
      <div>
        <h3 className="text-sm font-medium mb-3 text-muted-foreground uppercase tracking-wider">
          By Project
        </h3>
        {projectRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data for this range.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {projectRows.map(({ project, mins }) => (
              <div key={project?.id ?? "none"} className="flex items-center gap-3">
                {project ? (
                  <ProjectDot color={project.color} size="sm" />
                ) : (
                  <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
                )}
                <span className="text-sm flex-1 truncate">
                  {project?.name ?? "No project"}
                </span>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {fmtDuration(mins)}
                </span>
                <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(100, (mins / totalMins) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Module root ──────────────────────────────────────────────

export default function TimeTrackingModule() {
  const { load, isLoaded } = useTimeStore();

  useEffect(() => {
    registry.register(TIME_MANIFEST);
    const unsub = setupTimeEventListeners();
    return unsub;
  }, []);

  useEffect(() => {
    if (!isLoaded) load();
  }, [isLoaded, load]);

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        icon={<Timer size={18} />}
        title="Time Tracking"
        actions={
          <SubNav>
            <NavLink
              to="/time"
              end
              className={({ isActive }) =>
                `subnav-item ${isActive ? "active" : ""}`
              }
            >
              <Clock size={14} /> Tracker
            </NavLink>
            <NavLink
              to="/time/reports"
              className={({ isActive }) =>
                `subnav-item ${isActive ? "active" : ""}`
              }
            >
              <BarChart2 size={14} /> Reports
            </NavLink>
          </SubNav>
        }
      />

      <div className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/"        element={<TrackerView />} />
          <Route path="/reports" element={<ReportsView />} />
        </Routes>
      </div>
    </div>
  );
}
