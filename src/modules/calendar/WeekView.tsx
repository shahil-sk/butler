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
  const { activeDate, getEventsInRange, openEventForm, calendars } = useCalendarStore();
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

  return (
    <div className="flex flex-col flex-1 overflow-hidden border-t border-border">
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
                    onClick={() => openEventForm(e, e.id)}
                    className="text-[10px] px-1 rounded truncate cursor-pointer"
                    style={{ backgroundColor: `${color}25`, color }}
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
                        onClick={(e) => { e.stopPropagation(); openEventForm(evt, evt.id); }}
                        className="absolute left-0.5 right-0.5 rounded overflow-hidden cursor-pointer z-10 px-1 py-0.5 transition-fast hover:brightness-95"
                        style={{
                          top,
                          height: Math.max(height, 20),
                          backgroundColor: `${color}22`,
                          borderLeft: `2.5px solid ${color}`,
                          color,
                        }}
                      >
                        <p className="text-[10px] font-medium leading-tight truncate">{evt.title}</p>
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
