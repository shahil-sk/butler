// ============================================================
// MONTH GRID  (improved)
// - Task shadow events (id starts with 'task:') open TaskEventPanel
// - Regular events open EventForm
// - Task events styled differently: coloured pill + status prefix
// ============================================================

import { useState } from "react";
import { cn, toISODate } from "@/shared/utils";
import { useCalendarStore } from "../store";
import { TaskEventPanel } from "../TaskEventPanel";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, parseISO,
} from "date-fns";
import type { CalendarEvent } from "@/shared/types";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function isTaskEvent(evt: CalendarEvent) {
  return evt.id.startsWith("task:");
}
function taskIdFromEvent(evt: CalendarEvent) {
  return evt.id.replace(/^task:/, "");
}

export function MonthGrid() {
  const { activeDate, getEventsForDay, openEventForm, setActiveDate, setView } = useCalendarStore();
  const [taskPanelId, setTaskPanelId] = useState<string | null>(null);

  const anchor     = parseISO(activeDate);
  const monthStart = startOfMonth(anchor);
  const monthEnd   = endOfMonth(anchor);
  const gridStart  = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd    = endOfWeek(monthEnd,   { weekStartsOn: 1 });
  const days       = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const todayStr   = toISODate(new Date());

  const handleEventClick = (e: React.MouseEvent, evt: CalendarEvent) => {
    e.stopPropagation();
    if (isTaskEvent(evt)) {
      setTaskPanelId(taskIdFromEvent(evt));
    } else {
      openEventForm(evt, evt.id);
    }
  };

  return (
    <>
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-border shrink-0">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2 text-center text-[11px] font-medium text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 flex-1 overflow-hidden">
          {days.map((day) => {
            const dateStr    = toISODate(day);
            const isToday    = dateStr === todayStr;
            const isCurMonth = isSameMonth(day, anchor);
            const events     = getEventsForDay(dateStr);

            // Sort: tasks first, then regular events
            const sorted = [
              ...events.filter(isTaskEvent),
              ...events.filter((e) => !isTaskEvent(e)),
            ];

            return (
              <div
                key={dateStr}
                onClick={() => {
                  setActiveDate(dateStr);
                  setView("day");
                }}
                className={cn(
                  "border-r border-b border-border p-1.5 cursor-pointer transition-fast overflow-hidden",
                  "hover:bg-accent/40",
                  !isCurMonth && "opacity-40"
                )}
              >
                {/* Day number */}
                <div className="flex items-center justify-end mb-1">
                  <span
                    className={cn(
                      "w-6 h-6 flex items-center justify-center rounded-full text-xs",
                      isToday
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "text-foreground hover:bg-accent font-medium"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                </div>

                {/* Events */}
                <div className="space-y-0.5">
                  {sorted.slice(0, 3).map((evt) => {
                    const isTask = isTaskEvent(evt);
                    const cal = useCalendarStore.getState().calendars.find((c) => c.id === evt.calendarId);
                    const color = evt.color ?? cal?.color ?? "#3b82f6";

                    return (
                      <div
                        key={evt.id}
                        onClick={(e) => handleEventClick(e, evt)}
                        className={cn(
                          "flex items-center gap-1 px-1 py-0.5 rounded text-[10px] truncate cursor-pointer transition-fast",
                          isTask
                            ? "hover:brightness-95 border border-dashed border-current/30"
                            : "hover:brightness-95"
                        )}
                        style={{ backgroundColor: `${color}20`, color }}
                        title={isTask ? "Click to view/edit task" : evt.title}
                      >
                        {isTask ? (
                          // Task: show a small checkbox icon
                          <svg width="8" height="8" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0">
                            <rect x="1" y="1" width="10" height="10" rx="2" />
                            <path d="M3.5 6l2 2 3-3" />
                          </svg>
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        )}
                        <span className="truncate">{evt.title}</span>
                      </div>
                    );
                  })}
                  {sorted.length > 3 && (
                    <p className="text-[10px] text-muted-foreground/60 px-1">
                      +{sorted.length - 3} more
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Task detail panel */}
      {taskPanelId && (
        <TaskEventPanel
          taskId={taskPanelId}
          onClose={() => setTaskPanelId(null)}
        />
      )}
    </>
  );
}
