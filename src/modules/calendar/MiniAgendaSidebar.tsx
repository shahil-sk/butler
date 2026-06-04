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
        "flex flex-col shrink-0 border-l border-border/50 bg-background/50 backdrop-blur-xl transition-all duration-300 overflow-hidden",
        collapsed ? "w-10" : "w-[240px]"
      )}
    >
      {/* Toggle strip */}
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        aria-label={collapsed ? "Expand agenda" : "Collapse agenda"}
        className="flex items-center justify-center h-12 shrink-0 border-b border-border/40 text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all duration-300"
      >
        {collapsed ? <ChevronRight size={14} className="hover:scale-110 transition-transform" /> : <ChevronDown size={14} className="hover:scale-110 transition-transform" />}
        {!collapsed && (
          <span className="ml-2 text-[10px] font-bold uppercase tracking-widest text-foreground">
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
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={cn(
                        "text-[10px] font-bold uppercase tracking-widest",
                        isToday ? "text-primary drop-shadow-sm" : "text-muted-foreground/60"
                      )}
                    >
                      {isToday ? "Today" : format(day, "EEE d")}
                    </span>
                    <span className="text-[10px] font-bold text-muted-foreground/40 tabular-nums">
                      {dayEvents.length}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {dayEvents.map((evt) => {
                      const isTask = isTaskEvent(evt.id);
                      const cal = calendars.find((c) => c.id === evt.calendarId);
                      const color = evt.color ?? cal?.color ?? "#3b82f6";
                      return (
                        <button
                          key={evt.id}
                          type="button"
                          onClick={() => { setActiveDate(dateStr); setView("day"); }}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left hover:bg-muted/40 transition-all duration-300 group hover:translate-x-1"
                        >
                          {isTask ? (
                            <CheckSquare size={10} style={{ color }} className="shrink-0 transition-transform group-hover:scale-110" />
                          ) : (
                            <Circle size={8} style={{ color, fill: color }} className="shrink-0 transition-transform group-hover:scale-110" />
                          )}
                          <span className="text-xs font-bold text-foreground/80 truncate flex-1 group-hover:text-foreground transition-colors">{evt.title}</span>
                          {evt.startAt && (
                            <span className="text-[10px] font-bold text-muted-foreground/50 tabular-nums shrink-0">
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
