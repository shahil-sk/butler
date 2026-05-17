import { Clock, CheckCircle2, Circle, Calendar } from "lucide-react";
import { cn, formatDate, today } from "@/shared/utils";
import { useCalendarStore } from "@/modules/calendar/store";
import { useTaskStore } from "@/modules/tasks/store";
import { bus } from "@/kernel/event-bus";

export function DailyNoteContext() {
  const todayStr   = today();
  const events     = useCalendarStore((s) => s.getEventsForDay(todayStr));
  const todayTasks = useTaskStore((s) => s.getTodayTasks());

  if (events.length === 0 && todayTasks.length === 0) return null;

  return (
    <div className="mx-6 mt-4 mb-0 rounded-xl border border-border bg-surface-1 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
        <Calendar size={12} className="text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">
          Today — {formatDate(todayStr)}
        </span>
      </div>

      <div className="flex divide-x divide-border">
        {/* Events */}
        {events.length > 0 && (
          <div className="flex-1 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-2">
              Events
            </p>
            <div className="space-y-1.5">
              {events.slice(0, 4).map((e) => {
                const cal   = useCalendarStore.getState().calendars.find((c) => c.id === e.calendarId);
                const color = e.color ?? cal?.color ?? "#3b82f6";
                return (
                  <div
                    key={e.id}
                    onClick={() => bus.emit("navigate:to", { path: "/calendar" })}
                    className="flex items-center gap-2 cursor-pointer group"
                  >
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-xs truncate group-hover:text-primary transition-fast flex-1">
                      {e.title}
                    </span>
                    {!e.allDay && (
                      <span className="text-[10px] text-muted-foreground/50 tabular-nums shrink-0">
                        {e.startAt.slice(11, 16)}
                      </span>
                    )}
                  </div>
                );
              })}
              {events.length > 4 && (
                <p className="text-[10px] text-muted-foreground/40">+{events.length - 4} more</p>
              )}
            </div>
          </div>
        )}

        {/* Tasks */}
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
                    useTaskStore.getState().openTask(t.id);
                    bus.emit("navigate:to", { path: "/tasks" });
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
                <p className="text-[10px] text-muted-foreground/40">+{todayTasks.length - 4} more</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
