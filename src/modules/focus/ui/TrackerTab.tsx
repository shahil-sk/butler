import { useEffect, useState } from "react";
import { Plus, DollarSign, Check, Play, Square, Edit2, Trash2 } from "lucide-react";
import { cn } from "@/shared/utils";
import { today } from "@/shared/utils";
import {
  formatDuration,
  fmtTime,
  groupByDate,
  dateLabel,
  totalMins,
} from "@/shared/formatters";
import { EmptyState, ProjectDot } from "@/shared/ui";
import { useTimeStore } from "@/modules/time-tracking/store";
import { useTaskStore } from "@/modules/tasks/store";
import { useProjectStore } from "@/modules/projects/store";
import type { TimeEntry } from "@/shared/types";
import { Clock } from "lucide-react";

// ── useLiveDuration hook ─────────────────────────────────────────────────────
function useLiveDuration(startAt?: string, stopped = false): string {
  const [elapsed, setElapsed] = useState("0m");
  useEffect(() => {
    if (!startAt || stopped) return;
    const tick = () => {
      const mins = Math.floor((Date.now() - new Date(startAt).getTime()) / 60000);
      const secs = Math.floor((Date.now() - new Date(startAt).getTime()) / 1000) % 60;
      setElapsed(mins > 0 ? formatDuration(mins) : `${secs}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startAt, stopped]);
  return elapsed;
}

// ── EntryForm ────────────────────────────────────────────────────────────────
export function EntryForm({
  initial = {},
  onSave,
  onCancel,
}: {
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
      return diff > 0 ? formatDuration(diff) : null;
    } catch { return null; }
  })();

  const save = () =>
    onSave({
      description: desc,
      taskId: taskId || undefined,
      projectId: projectId || undefined,
      isBillable: billable,
      startAt: new Date(startAt).toISOString(),
      endAt: endAt ? new Date(endAt).toISOString() : undefined,
    });

  return (
    <div
      className="border-b shrink-0"
      style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--muted) / 0.2)" }}
    >
      <div className="p-3 flex flex-col gap-2.5">
        <input
          autoFocus value={desc} onChange={(e) => setDesc(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
          placeholder="What are you working on?"
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            value={taskId} onChange={(e) => setTaskId(e.target.value)}
            className="bg-background border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none"
          >
            <option value="">No task</option>
            {tasks.filter((t) => t.status !== "done" && t.status !== "archived").map((t) => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
          <select
            value={projectId} onChange={(e) => setProjectId(e.target.value)}
            className="bg-background border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none"
          >
            <option value="">No project</option>
            {projects.filter((p) => p.status === "active").map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Start</label>
            <input
              type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 flex items-center justify-between">
              End
              {durationPreview && (
                <span className="text-primary font-semibold tabular-nums">{durationPreview}</span>
              )}
            </label>
            <input
              type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none"
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <button
            type="button" onClick={() => setBillable((b) => !b)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors select-none"
          >
            <div
              className={cn(
                "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                billable ? "bg-primary border-primary text-primary-foreground" : "border-border"
              )}
            >
              {billable && <Check size={10} />}
            </div>
            <DollarSign size={11} /> Billable
          </button>
          <div className="flex gap-2">
            <button onClick={onCancel} className="px-3 py-1.5 text-sm rounded-lg hover:bg-muted transition-colors">
              Cancel
            </button>
            <button
              onClick={save}
              className="px-3 py-1.5 text-sm rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity font-medium"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── EntryRow ─────────────────────────────────────────────────────────────────
export function EntryRow({
  entry,
  onEdit,
  onDelete,
  onResume,
}: {
  entry: TimeEntry;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onResume: (e: TimeEntry) => void;
}) {
  const tasks    = useTaskStore((s) => s.tasks);
  const projects = useProjectStore((s) => s.projects);
  const task     = entry.taskId    ? tasks.find((t)    => t.id === entry.taskId)    : null;
  const project  = entry.projectId ? projects.find((p) => p.id === entry.projectId) : null;
  const isRunning = !entry.endAt;
  const liveDur   = useLiveDuration(entry.startAt, !isRunning);
  const isCancelledTask = task && (task.status === "cancelled" || task.status === "archived");

  return (
    <div
      className="group flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors border-b last:border-0"
      style={{ borderColor: "hsl(var(--border) / 0.5)" }}
    >
      {isRunning && (
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={cn("text-sm truncate leading-tight", isCancelledTask && "opacity-50")}>
            {entry.description || (
              <span className="text-muted-foreground italic">No description</span>
            )}
          </span>
          {entry.isBillable && <DollarSign size={10} className="text-emerald-500 shrink-0" />}
          {entry.focusSessionId && (
            <span
              className="text-[9px] px-1 py-0.5 rounded shrink-0 text-muted-foreground"
              style={{ background: "hsl(var(--primary) / 0.07)" }}
            >
              Focus
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {project && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <ProjectDot color={project.color} size={8} />{project.name}
            </span>
          )}
          {task && (
            <span
              className={cn(
                "text-[11px] truncate",
                isCancelledTask ? "text-muted-foreground/40 line-through" : "text-muted-foreground/70"
              )}
            >
              · {task.title}
              {isCancelledTask && <span className="ml-1 text-[10px]">(cancelled)</span>}
            </span>
          )}
          <span className="text-[11px] text-muted-foreground/50 ml-auto hidden sm:block">
            {fmtTime(entry.startAt)}{entry.endAt ? `–${fmtTime(entry.endAt)}` : " (running)"}
          </span>
        </div>
      </div>
      <span
        className={cn(
          "text-sm font-semibold tabular-nums w-12 text-right shrink-0",
          isRunning && "text-emerald-600"
        )}
      >
        {isRunning ? liveDur : entry.durationMinutes ? formatDuration(entry.durationMinutes) : "—"}
      </span>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onResume(entry)} title="Resume"
          className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        >
          <Play size={12} />
        </button>
        <button
          onClick={() => onEdit(entry.id)} title="Edit"
          className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        >
          <Edit2 size={12} />
        </button>
        <button
          onClick={() => onDelete(entry.id)} title="Delete"
          className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-destructive"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

// ── TrackerTab (exported) ─────────────────────────────────────────────────────
export function TrackerTab() {
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
      taskId: quickTask || undefined,
    });
    setQuickDesc(""); setQuickTask("");
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div
        className="flex items-center gap-2 px-4 py-2.5 border-b shrink-0"
        style={{ borderColor: "hsl(var(--border))" }}
      >
        <input
          value={quickDesc} onChange={(e) => setQuickDesc(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !activeEntry) handleQuickStart(); }}
          placeholder="What are you working on?"
          disabled={!!activeEntry}
          className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 disabled:opacity-50"
        />
        <select
          value={quickTask} onChange={(e) => setQuickTask(e.target.value)}
          disabled={!!activeEntry}
          className="bg-background border border-border rounded-lg px-2 py-2 text-sm focus:outline-none max-w-[140px] disabled:opacity-50 hidden sm:block"
        >
          <option value="">No task</option>
          {tasks.filter((t) => t.status !== "done" && t.status !== "archived").map((t) => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>
        {!activeEntry ? (
          <button
            onClick={handleQuickStart}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity shrink-0"
          >
            <Play size={13} /> Start
          </button>
        ) : (
          <button
            onClick={() => void stopTimer()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold shrink-0 transition-colors"
            style={{ background: "hsl(var(--destructive) / 0.08)", color: "hsl(var(--destructive))" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "hsl(var(--destructive) / 0.16)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "hsl(var(--destructive) / 0.08)")}
          >
            <Square size={13} /> Stop
          </button>
        )}
        <button
          onClick={() => { setShowForm((v) => !v); setEditingId(null); }}
          className={cn(
            "p-2 rounded-lg border transition-colors shrink-0",
            showForm ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"
          )}
          title="Add manual entry"
        >
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
          onResume={() => { /* already running */ }}
        />
      )}

      <div
        className="flex items-center gap-1.5 px-4 py-2 border-b shrink-0"
        style={{ borderColor: "hsl(var(--border))" }}
      >
        <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ background: "hsl(var(--muted))" }}>
          <button
            onClick={() => setTodayOnly(true)}
            className={cn(
              "px-3 py-1 rounded-md text-xs font-medium transition-all",
              todayOnly ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Today
          </button>
          <button
            onClick={() => setTodayOnly(false)}
            className={cn(
              "px-3 py-1 rounded-md text-xs font-medium transition-all",
              !todayOnly ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            All
          </button>
        </div>
        {shown.length > 0 && (
          <span className="ml-auto text-xs font-semibold tabular-nums text-muted-foreground">
            {formatDuration(totalMins(shown))}
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
          <EmptyState
            icon={<Clock size={26} />}
            title="No entries yet"
            description="Start a timer or add an entry manually."
          />
        ) : (
          grouped.map(([date, dayEntries]) => (
            <div key={date}>
              <div
                className="flex items-center justify-between px-4 py-2 sticky top-0 z-10 border-b"
                style={{ background: "hsl(var(--background))", borderColor: "hsl(var(--border))" }}
              >
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {dateLabel(date)}
                </span>
                <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
                  {formatDuration(totalMins(dayEntries))}
                </span>
              </div>
              {dayEntries.map((e) => (
                <EntryRow
                  key={e.id} entry={e}
                  onEdit={(id) => { setEditingId(id); setShowForm(false); }}
                  onDelete={(id) => void deleteEntry(id)}
                  onResume={(entry) =>
                    void startTimer({
                      description: entry.description,
                      taskId: entry.taskId,
                      projectId: entry.projectId,
                    })
                  }
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
