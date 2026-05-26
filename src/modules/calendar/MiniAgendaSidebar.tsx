// ============================================================
// MINI AGENDA SIDEBAR — collapsible 7-day look-ahead
// Renders beside MonthGrid as a right-rail panel.
// ============================================================

import { useMemo, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { ChevronRight, ChevronDown, Circle, CheckSquare, CalendarDays } from "lucide-react";
import { cn, toISODate } from "@/shared/utils";
import { useCalendarStore } from "./store";

function isTaskEvent(id: string) {
  return id.startsWith("task:");
}

export function MiniAgendaSidebar() {
  const { activeDate, getEventsForDay, calendars, setActiveDate, setView } = useCalendarStore();
  const [collapsed, setCollapsed] = useState(false);

  const days = useMemo(() => {
    const anchor = parseISO(activeDate);
    return Array.from({ length: 7 }, (_, i) => addDays(anchor, i));
  }, [activeDate]);

  const todayStr = toISODate(new Date());

  const items = useMemo(() =>
    days.flatMap((day) => {
      const dateStr = toISODate(day);
      return getEventsForDay(dateStr).map((evt) => ({ day, dateStr, evt }));
    })
  , [days, getEventsForDay]);

  return (
    <div
      className={cn(
        "flex flex-col shrink-0 border-l border-border transition-all duration-200 overflow-hidden",
        collapsed ? "w-8" : "w-[220px]"
      )}
      style={{ background: "hsl(var(--surface-1))" }}
    >
      {/* Toggle strip */}
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        aria-label={collapsed ? "Expand agenda" : "Collapse agenda"}
        className="flex items-center justify-center h-[38px] shrink-0 border-b border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-fast"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        {!collapsed && (
          <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            Next 7 days
          </span>
        )}
      </button>

      {!collapsed && (
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
              <CalendarDays size={18} className="text-muted-foreground/30" />
              <p className="text-[11px] text-muted-foreground/50">Nothing scheduled</p>
            </div>
          ) : (
            days.map((day) => {
              const dateStr = toISODate(day);
              const dayEvents = getEventsForDay(dateStr);
              if (dayEvents.length === 0) return null;

              const isToday = dateStr === todayStr;
              return (
                <div key={dateStr}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span
                      className={cn(
                        "text-[10px] font-semibold uppercase tracking-wider",
                        isToday ? "text-primary" : "text-muted-foreground/60"
                      )}
                    >
                      {isToday ? "Today" : format(day, "EEE d")}
                    </span>
                    <span className="text-[9px] text-muted-foreground/40 tabular-nums">
                      {dayEvents.length}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.map((evt) => {
                      const isTask = isTaskEvent(evt.id);
                      const cal = calendars.find((c) => c.id === evt.calendarId);
                      const color = evt.color ?? cal?.color ?? "#3b82f6";
                      return (
                        <button
                          key={evt.id}
                          type="button"
                          onClick={() => { setActiveDate(dateStr); setView("day"); }}
                          className="w-full flex items-center gap-1.5 px-1.5 py-1 rounded text-left hover:bg-accent transition-fast"
                        >
                          {isTask ? (
                            <CheckSquare size={9} style={{ color }} className="shrink-0" />
                          ) : (
                            <Circle size={7} style={{ color, fill: color }} className="shrink-0" />
                          )}
                          <span className="text-[10px] text-foreground/80 truncate flex-1">{evt.title}</span>
                          {evt.startAt && (
                            <span className="text-[9px] text-muted-foreground/50 tabular-nums shrink-0">
                              {format(parseISO(evt.startAt), "h:mm")}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
