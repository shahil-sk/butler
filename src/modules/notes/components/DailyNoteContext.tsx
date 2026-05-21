// ============================================================
// NOTES — DailyNoteContext
// Shows today's tasks + events inline above the daily note.
// ============================================================

import { useTaskStore } from "@/modules/tasks/store";
import { useCalendarStore } from "@/modules/calendar/store";
import { cn, formatTime, today } from "@/shared/utils";
import { CheckCircle2, Circle, Clock } from "lucide-react";

export function DailyNoteContext() {
  const todayStr    = today();
  const todayTasks  = useTaskStore((s) =>
    s.tasks.filter((t) => t.dueDate === todayStr && t.status !== "cancelled")
  );
  const todayEvents = useCalendarStore((s) =>
    s.events.filter((e) => e.startAt.startsWith(todayStr))
  );

  if (todayTasks.length === 0 && todayEvents.length === 0) return null;

  return (
    <div className="flex gap-px border-b border-border shrink-0 bg-muted/20">

      {/* Tasks column */}
      {todayTasks.length > 0 && (
        <div className="flex-1 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-2">
            Tasks
          </p>
          <div className="space-y-1.5">
            {todayTasks.slice(0, 4).map((t) => (
              <div
                key={t.id}
                onClick={() => {
                  // Open TaskDetail modal in-place — no navigation to /tasks
                  useTaskStore.getState().openTask(t.id);
                }}
                className="flex items-center gap-2 cursor-pointer group"
              >
                {t.status === "done"
                  ? <CheckCircle2 size={11} className="text-green-500 shrink-0" />
                  : <Circle size={11} className="text-muted-foreground/40 shrink-0" />
                }
                <span className={cn(
                  "text-xs truncate group-hover:text-primary transition-fast flex-1",
                  t.status === "done" && "line-through text-muted-foreground/40"
                )}>
                  {t.title}
                </span>
              </div>
            ))}
            {todayTasks.length > 4 && (
              <p className="text-[10px] text-muted-foreground/35 pl-[19px]">
                +{todayTasks.length - 4} more
              </p>
            )}
          </div>
        </div>
      )}

      {/* Events column */}
      {todayEvents.length > 0 && (
        <div className="flex-1 px-4 py-3 border-l border-border/50">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-2">
            Events
          </p>
          <div className="space-y-1.5">
            {todayEvents.slice(0, 4).map((e) => (
              <div key={e.id} className="flex items-center gap-2">
                <Clock size={11} className="text-muted-foreground/40 shrink-0" />
                <span className="text-xs truncate flex-1">{e.title}</span>
                <span className="text-[10px] text-muted-foreground/40 tabular-nums shrink-0">
                  {formatTime(e.startAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
