import { cn, toISODate } from "@/shared/utils";
import { useCalendarStore } from "../store";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, parseISO,
} from "date-fns";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const EVENT_COLORS = [
  "#3b82f6","#8b5cf6","#ec4899","#f97316","#22c55e","#eab308","#14b8a6",
];

export function MonthGrid() {
  const { activeDate, getEventsForDay, openEventForm, setActiveDate, setView } = useCalendarStore();

  const anchor     = parseISO(activeDate);
  const monthStart = startOfMonth(anchor);
  const monthEnd   = endOfMonth(anchor);
  const gridStart  = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd    = endOfWeek(monthEnd,   { weekStartsOn: 1 });
  const days       = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const todayStr   = toISODate(new Date());

  return (
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
                {events.slice(0, 3).map((evt) => {
                  const cal = useCalendarStore.getState().calendars.find((c) => c.id === evt.calendarId);
                  const color = evt.color ?? cal?.color ?? "#3b82f6";
                  return (
                    <div
                      key={evt.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        useCalendarStore.getState().openEventForm(evt, evt.id);
                      }}
                      className="flex items-center gap-1 px-1 py-0.5 rounded text-[10px] truncate cursor-pointer hover:brightness-95 transition-fast"
                      style={{ backgroundColor: `${color}20`, color }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      {evt.title}
                    </div>
                  );
                })}
                {events.length > 3 && (
                  <p className="text-[10px] text-muted-foreground/60 px-1">
                    +{events.length - 3} more
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
