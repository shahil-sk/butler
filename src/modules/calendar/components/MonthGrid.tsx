// ============================================================
// MONTH GRID  (v3 enhanced)
// - Task shadow events (id starts with 'task:') open TaskEventPanel
// - Regular events open EventForm
// - Deadline dot ring: overdue = red, due-today = amber
// - Inline overflow popover (+N more → expands in-cell)
// ============================================================

import { useState } from "react";
import { cn, toISODate } from "@/shared/utils";
import { useCalendarStore } from "../store";
import { useTaskStore } from "@/modules/tasks/store";
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
  const { activeDate, getEventsForDay, calendars, openEventForm, setActiveDate, setView, openContextMenu } = useCalendarStore();
  const tasks = useTaskStore((s) => s.tasks);
  const [taskPanelId, setTaskPanelId] = useState<string | null>(null);
  const [expandedCell, setExpandedCell] = useState<string | null>(null);

  const anchor     = parseISO(activeDate);
  const monthStart = startOfMonth(anchor);
  const monthEnd   = endOfMonth(anchor);
  const gridStart  = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd    = endOfWeek(monthEnd,   { weekStartsOn: 1 });
  const days       = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const todayStr   = toISODate(new Date());

  // Build deadline maps from task store
  const overdueDates = new Set<string>();
  const dueTodayDates = new Set<string>();
  tasks.forEach((t) => {
    if (!t.dueDate || t.status === "done") return;
    if (t.dueDate < todayStr) overdueDates.add(t.dueDate);
    if (t.dueDate === todayStr) dueTodayDates.add(todayStr);
  });

  const handleEventClick = (e: React.MouseEvent, evt: CalendarEvent) => {
    e.stopPropagation();
    if (isTaskEvent(evt)) {
      setTaskPanelId(taskIdFromEvent(evt));
    } else {
      openEventForm(evt, evt.id);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, evt: CalendarEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openContextMenu(e.clientX, e.clientY, evt);
  };

  const handleDrop = (e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    const evtId = e.dataTransfer.getData("text/plain");
    if (!evtId) return;

    if (evtId.startsWith("task:")) {
      const taskId = evtId.replace("task:", "");
      useTaskStore.getState().updateTask(taskId, { dueDate: dateStr });
    } else {
      const evt = useCalendarStore.getState().events.find(x => x.id === evtId);
      if (evt) {
        const timeStart = evt.startAt.slice(10);
        const timeEnd = evt.endAt.slice(10);
        useCalendarStore.getState().updateEvent(evt.id, {
          startAt: `${dateStr}${timeStart}`,
          endAt: `${dateStr}${timeEnd}`,
          startDatetime: `${dateStr}${timeStart}`,
          endDatetime: `${dateStr}${timeEnd}`,
        });
      }
    }
  };

  return (
    <>
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Day cells */}
        <div className="grid grid-cols-7 flex-1 overflow-hidden">
          {days.map((day) => {
            const dateStr    = toISODate(day);
            const isToday    = dateStr === todayStr;
            const isCurMonth = isSameMonth(day, anchor);
            const events     = getEventsForDay(dateStr);
            const isExpanded = expandedCell === dateStr;

            // Sort: tasks first, then regular events
            const sorted = [
              ...events.filter(isTaskEvent),
              ...events.filter((e) => !isTaskEvent(e)),
            ];

            const visibleCount = isExpanded ? sorted.length : 3;
            const overflow     = sorted.length - visibleCount;

            // Deadline ring logic
            const hasOverdue  = overdueDates.has(dateStr);
            const hasDueToday = dueTodayDates.has(dateStr);

            return (
              <div
                key={dateStr}
                onClick={() => {
                  setActiveDate(dateStr);
                  setView("day");
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, dateStr)}
                className={cn(
                  "border-r border-b border-border p-1.5 cursor-pointer transition-fast overflow-hidden",
                  "hover:bg-accent/40",
                  !isCurMonth && "opacity-40"
                )}
              >
                {/* Day number with deadline ring */}
                <div className="flex items-center justify-end mb-1">
                  <span
                    className={cn(
                      "w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium",
                      isToday
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "text-foreground hover:bg-accent",
                      !isToday && hasOverdue  && "ring-2 ring-red-500/60",
                      !isToday && hasDueToday && "ring-2 ring-amber-400/60"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  {/* Overdue indicator dot beside number */}
                  {(hasOverdue || hasDueToday) && !isToday && (
                    <span
                      className={cn(
                        "w-1 h-1 rounded-full ml-0.5",
                        hasOverdue ? "bg-red-500" : "bg-amber-400"
                      )}
                      title={hasOverdue ? "Has overdue tasks" : "Has tasks due today"}
                    />
                  )}
                </div>

                {/* Events */}
                <div className="space-y-0.5">
                  {sorted.slice(0, visibleCount).map((evt) => {
                    const isTask = isTaskEvent(evt);
                    const cal = calendars.find((c) => c.id === evt.calendarId);
                    const color = evt.color ?? cal?.color ?? "#3b82f6";

                    return (
                      <div
                        key={evt.id}
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation();
                          e.dataTransfer.setData("text/plain", evt.id);
                        }}
                        onClick={(e) => handleEventClick(e, evt)}
                        onContextMenu={(e) => handleContextMenu(e, evt)}
                        className={cn(
                          "flex items-center gap-1 px-1 py-0.5 rounded text-[10px] truncate cursor-pointer transition-fast",
                          isTask
                            ? "hover:brightness-95 border border-dashed border-current/30"
                            : "hover:brightness-95",
                          (evt.status === "cancelled" || evt.status === "completed") && "line-through opacity-60"
                        )}
                        style={{ backgroundColor: `${color}20`, color }}
                        title={isTask ? "Click to view/edit task" : evt.title}
                      >
                        {isTask ? (
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

                  {overflow > 0 && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setExpandedCell(isExpanded ? null : dateStr); }}
                      className="text-[10px] text-primary/70 hover:text-primary px-1 transition-fast"
                    >
                      {isExpanded ? "Show less" : `+${overflow} more`}
                    </button>
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
