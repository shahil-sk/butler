import { Play, Edit2, Trash2, DollarSign } from "lucide-react";
import { ProjectDot } from "@/shared/ui";
import { useTaskStore } from "@/modules/tasks/store";
import { useProjectStore } from "@/modules/projects/store";
import { fmtDuration, fmtTime } from "../utils/formatters";
import type { TimeEntry, ID } from "@/shared/types";

export interface EntryRowProps {
  entry: TimeEntry;
  onEdit: (id: ID) => void;
  onDelete: (id: ID) => void;
  onResume: (entry: TimeEntry) => void;
}

export function EntryRow({ entry, onEdit, onDelete, onResume }: EntryRowProps) {
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
