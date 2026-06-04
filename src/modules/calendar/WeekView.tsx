// ============================================================
// CALENDAR — WeekView
// 7-column timed grid (00:00–23:00). Events are positioned
// absolutely by start/end time. Current time indicator on today.
// All-day row at top. Click slot → opens EventForm prefilled.
// ============================================================

import { useRef, useEffect } from "react";
import {
  startOfWeek, endOfWeek, eachDayOfInterval, format, parseISO,
} from "date-fns";
import { cn, toISODate } from "@/shared/utils";
import { useCalendarStore } from "./store";
import { useTaskStore } from "@/modules/tasks/store";

const HOURS  = Array.from({ length: 24 }, (_, i) => i);
const CELL_H = 56;

function timeToY(isoTime: string): number {
  const d = new Date(isoTime);
  return (d.getHours() + d.getMinutes() / 60) * CELL_H;
}
function durationH(startAt: string, endAt: string): number {
  return Math.max((new Date(endAt).getTime() - new Date(startAt).getTime()) / 3_600_000, 0.25);
}

export function WeekView() {
  const { activeDate, getEventsInRange, openEventForm, calendars, openContextMenu, updateEvent } = useCalendarStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  const anchor    = parseISO(activeDate);
  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });
  const weekEnd   = endOfWeek(anchor,   { weekStartsOn: 1 });
  const days      = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const todayStr  = toISODate(new Date());

  const allEvents = getEventsInRange(
    `${toISODate(weekStart)}T00:00:00`,
    `${toISODate(weekEnd)}T23:59:59`,
  );
  const timedEvents  = allEvents.filter((e) => !e.allDay);
  const allDayEvents = allEvents.filter((e) =>  e.allDay);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: CELL_H * 7, behavior: "instant" });
  }, []);

  const now    = new Date();
  const nowY   = (now.getHours() + now.getMinutes() / 60) * CELL_H;

  const handleContextMenu = (e: React.MouseEvent, evt: any) => {
    e.preventDefault();
    e.stopPropagation();
    openContextMenu(e.clientX, e.clientY, evt);
  };

  const handleDrop = (e: React.DragEvent, ds: string, h?: number) => {
    e.preventDefault();
    const evtId = e.dataTransfer.getData("text/plain");
    if (!evtId) return;

    if (evtId.startsWith("task:")) {
      const taskId = evtId.replace("task:", "");
      useTaskStore.getState().updateTask(taskId, { dueDate: ds });
    } else {
      const evt = useCalendarStore.getState().events.find(x => x.id === evtId);
      if (evt) {
        const timeStart = evt.startAt.slice(11);
        const timeEnd = evt.endAt.slice(11);
        if (h !== undefined) {
          const startHH = String(h).padStart(2, "0");
          const duration = durationH(evt.startAt, evt.endAt);
          const endH = Math.floor(h + duration);
          const endM = Math.round((h + duration - endH) * 60);
          const endHH = String(endH).padStart(2, "0");
          const endMM = String(endM).padStart(2, "0");
          updateEvent(evt.id, {
            startAt: `${ds}T${startHH}:00:00`,
            endAt: `${ds}T${endHH}:${endMM}:00`,
            startDatetime: `${ds}T${startHH}:00:00`,
            endDatetime: `${ds}T${endHH}:${endMM}:00`,
          });
        } else {
          updateEvent(evt.id, {
            startAt: `${ds}T${timeStart}`,
            endAt: `${ds}T${timeEnd}`,
            startDatetime: `${ds}T${timeStart}`,
            endDatetime: `${ds}T${timeEnd}`,
          });
        }
      }
    }
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden border-t border-border">
      {/* All-day row */}
      <div className="flex shrink-0 border-b border-border">
        <div className="w-12 shrink-0 text-[10px] text-muted-foreground flex items-center justify-center border-r border-border py-1.5">
          all day
        </div>
        {days.map((day) => {
          const ds   = toISODate(day);
          const evts = allDayEvents.filter((e) => e.startAt.startsWith(ds));
          return (
            <div key={ds} className="flex-1 border-r border-border px-0.5 py-1 min-h-[28px] space-y-0.5">
              {evts.map((e) => {
                const cal   = calendars.find((c) => c.id === e.calendarId);
                const color = e.color ?? cal?.color ?? "#3b82f6";
                return (
                  <div
                    key={e.id}
                    draggable
                    onDragStart={(ev) => {
                      ev.stopPropagation();
                      ev.dataTransfer.setData("text/plain", e.id);
                    }}
                    onClick={() => openEventForm(e, e.id)}
                    onContextMenu={(ev) => handleContextMenu(ev, e)}
                    className={cn("text-[10px] px-2 py-0.5 rounded-md truncate cursor-pointer font-bold transition-all hover:scale-[1.02] shadow-sm mb-1", e.status === "completed" && "line-through opacity-60")}
                    style={{ backgroundColor: `${color}25`, color, border: `1px solid ${color}30` }}
                  >
                    {e.title}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Scrollable timed grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto relative">
        <div className="flex">
          {/* Time gutter */}
          <div className="w-12 shrink-0 border-r border-border">
            {HOURS.map((h) => (
              <div key={h} className="relative border-b border-border/40" style={{ height: CELL_H }}>
                <span className="absolute -top-2 right-2 text-[10px] tabular-nums text-muted-foreground/60 select-none">
                  {h === 0 ? "" : `${String(h).padStart(2, "0")}:00`}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          <div className="flex flex-1 relative">
            {days.map((day) => {
              const ds      = toISODate(day);
              const isToday = ds === todayStr;
              const dayEvts = timedEvents.filter((e) => e.startAt.slice(0, 10) === ds);

              return (
                <div
                  key={ds}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDrop(e, ds)}
                  className={cn(
                    "flex-1 relative border-r border-border/40",
                    isToday && "bg-primary/[0.02]"
                  )}
                >
                  {HOURS.map((h) => (
                    <div
                      key={h}
                      className="absolute w-full border-b border-border/30 cursor-pointer hover:bg-accent/30 transition-fast"
                      style={{ top: h * CELL_H, height: CELL_H }}
                      onClick={() => {
                        const iso = `${ds}T${String(h).padStart(2, "0")}:00:00`;
                        const end = `${ds}T${String(h + 1).padStart(2, "0")}:00:00`;
                        openEventForm({ startAt: iso, endAt: end });
                      }}
                    />
                  ))}

                  {isToday && (
                    <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: nowY }}>
                      <div className="flex items-center">
                        <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 shrink-0" />
                        <div className="flex-1 h-px bg-red-500" />
                      </div>
                    </div>
                  )}

                  {dayEvts.map((evt) => {
                    const cal    = calendars.find((c) => c.id === evt.calendarId);
                    const color  = evt.color ?? cal?.color ?? "#3b82f6";
                    const top    = timeToY(evt.startAt);
                    const height = durationH(evt.startAt, evt.endAt) * CELL_H;
                    return (
                      <div
                        key={evt.id}
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation();
                          e.dataTransfer.setData("text/plain", evt.id);
                        }}
                        onClick={(e) => { e.stopPropagation(); openEventForm(evt, evt.id); }}
                        onContextMenu={(e) => handleContextMenu(e, evt)}
                        className="absolute left-1 right-1 rounded-lg overflow-hidden cursor-pointer z-10 px-2 py-1 transition-all hover:brightness-110 hover:shadow-md hover:scale-[1.02] hover:z-20 backdrop-blur-sm shadow-sm"
                        style={{
                          top,
                          height: Math.max(height, 24),
                          backgroundColor: `${color}25`,
                          border: `1px solid ${color}40`,
                          borderLeft: `4px solid ${color}`,
                          color,
                        }}
                      >
                        <p className={cn("text-xs font-bold leading-tight truncate drop-shadow-sm", evt.status === "completed" && "line-through opacity-50")}>{evt.title}</p>
                        {height > 30 && (
                          <p className="text-[9px] opacity-70 tabular-nums">
                            {evt.startAt.slice(11, 16)}&ndash;{evt.endAt.slice(11, 16)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
