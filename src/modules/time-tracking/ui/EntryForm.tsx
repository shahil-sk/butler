import { useState } from "react";
import { Check, DollarSign } from "lucide-react";
import { useTaskStore } from "@/modules/tasks/store";
import { useProjectStore } from "@/modules/projects/store";
import type { TimeEntry, ID } from "@/shared/types";

export interface EntryFormProps {
  initial?: Partial<TimeEntry>;
  onSave: (data: Partial<TimeEntry>) => void;
  onCancel: () => void;
}

export function EntryForm({ initial = {}, onSave, onCancel }: EntryFormProps) {
  const tasks    = useTaskStore((s) => s.tasks);
  const projects = useProjectStore((s) => s.projects);

  const [desc,       setDesc]       = useState(initial.description ?? "");
  const [taskId,     setTaskId]     = useState<ID | "">(initial.taskId ?? "");
  const [projectId,  setProjectId]  = useState<ID | "">(initial.projectId ?? "");
  const [isBillable, setIsBillable] = useState(initial.isBillable ?? false);
  const [startAt,    setStartAt]    = useState(
    initial.startAt ? initial.startAt.slice(0, 16) : new Date().toISOString().slice(0, 16)
  );
  const [endAt, setEndAt] = useState(
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
