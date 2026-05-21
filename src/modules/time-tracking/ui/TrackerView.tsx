import { useState, useEffect } from "react";
import { Square, Plus, Play, Clock } from "lucide-react";
import { EmptyState } from "@/shared/ui";
import { useTimeStore } from "../store";
import { useTaskStore } from "@/modules/tasks/store";
import { fmtDuration, fmtTime, groupEntriesByDate, totalMinutes } from "../utils/formatters";
import { EntryForm } from "./EntryForm";
import { EntryRow } from "./EntryRow";
import { formatDate, today } from "@/shared/utils";
import type { TimeEntry, ID } from "@/shared/types";

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
  const activeEntry = useTimeStore((s) => s.entries.find((e) => e.id === s.activeEntryId));
  const stopTimer   = useTimeStore((s) => s.stopTimer);
  const tasks       = useTaskStore((s) => s.tasks);
  const elapsed     = useLiveDuration(activeEntry?.startAt);

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

// ── TrackerView ─────────────────────────────────────────────

export function TrackerView() {
  const { entries, activeEntryId, startTimer, stopTimer, createEntry, updateEntry, deleteEntry } =
    useTimeStore();

  const [showNewForm, setShowNewForm] = useState(false);
  const [editingId,   setEditingId]   = useState<ID | null>(null);
  const [quickDesc,   setQuickDesc]   = useState("");

  const activeEntry      = entries.find((e) => e.id === activeEntryId);
  const completedEntries = entries.filter((e) => e.id !== activeEntryId && e.endAt);
  const grouped          = groupEntriesByDate(completedEntries);

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
