import { useTaskStore } from "@/modules/tasks/store";
import { useProjectStore } from "@/modules/projects/store";
import { useNoteStore } from "@/modules/notes/store";
import { bus } from "@/kernel/event-bus";
import { CheckSquare, FolderKanban, FileText, HelpCircle } from "lucide-react";
import { cn } from "@/shared/utils";

interface EntityBadgeProps {
  type: "task" | "note" | "project";
  id: string;
  className?: string;
}

export function EntityBadge({ type, id, className }: EntityBadgeProps) {
  // Select state safely
  const task = useTaskStore((s) => type === "task" ? s.getTaskById(id) : undefined);
  const project = useProjectStore((s) => type === "project" ? s.getProjectById(id) : undefined);
  const note = useNoteStore((s) => type === "note" ? s.getNoteById(id) : undefined);

  let title = "";
  let icon = HelpCircle;
  let colorClass = "";
  let action: (() => void) | null = null;

  if (type === "task") {
    title = task?.title ?? "Unknown Task";
    icon = CheckSquare;
    colorClass = "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-blue-500/25 dark:border-blue-500/15";
    action = () => bus.emit("task:open", { taskId: id });
  } else if (type === "project") {
    title = project?.name ?? "Unknown Project";
    icon = FolderKanban;
    colorClass = "bg-purple-500/10 text-purple-500 hover:bg-purple-500/20 border-purple-500/25 dark:border-purple-500/15";
    action = () => {
      bus.emit("project:open", { projectId: id });
      bus.emit("navigate:to", { path: "/projects" });
    };
  } else if (type === "note") {
    title = note?.title ?? "Unknown Note";
    icon = FileText;
    colorClass = "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-amber-500/25 dark:border-amber-500/15";
    action = () => {
      bus.emit("note:open", { noteId: id });
      bus.emit("navigate:to", { path: "/notes" });
    };
  }

  const Icon = icon;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (action) action();
      }}
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium border transition-colors",
        colorClass,
        className
      )}
    >
      <Icon size={11} className="shrink-0" />
      <span className="truncate max-w-[150px]">{title}</span>
    </button>
  );
}
