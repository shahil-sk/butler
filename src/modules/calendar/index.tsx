import { useState, useMemo, useEffect } from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO, isToday, isValid } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Target, CheckSquare, Clock } from "lucide-react";
import { cn, today } from "@/shared/utils";
import { useTaskStore } from "@/modules/tasks/store";
import { useCalendarStore } from "./store";
import { registry } from "@/kernel/router";
import { manifest as calendarManifest } from "./manifest";
import { bus } from "@/kernel/event-bus";

registry.register(calendarManifest);

function getLocalTaskDateStr(d: string | undefined): string | null {
  if (!d) return null;
  if (d.length === 10) return d;
  try {
    const parsed = new Date(d);
    if (!isValid(parsed)) return d.slice(0, 10);
    return format(parsed, "yyyy-MM-dd");
  } catch {
    return d.slice(0, 10);
  }
}

export function CalendarModule() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  const { tasks, loadTasks, updateTask } = useTaskStore();
  const { events, loadEvents, loadCalendars } = useCalendarStore();

  useEffect(() => {
    void loadTasks();
    void loadCalendars();
  }, []);

  const from = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
  const to = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });

  useEffect(() => {
    void loadEvents(from.toISOString(), to.toISOString());
  }, [currentDate]);

  const days = eachDayOfInterval({ start: from, end: to });

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const handleGoToday = () => {
    const t = new Date();
    setCurrentDate(t);
    setSelectedDate(t);
  };

  // Get items for selected date
  const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
  const itemsForSelectedDate = useMemo(() => {
    const t = tasks.filter(task => {
      const d = task.scheduledAt || task.scheduledDate || task.dueDate;
      return getLocalTaskDateStr(d) === selectedDateStr;
    }).sort((a, b) => {
      const aTime = (a.scheduledAt || "").includes("T") ? a.scheduledAt! : "Z";
      const bTime = (b.scheduledAt || "").includes("T") ? b.scheduledAt! : "Z";
      return aTime.localeCompare(bTime);
    });
    const e = events.filter(evt => getLocalTaskDateStr(evt.startDatetime) === selectedDateStr && !evt.taskId);
    return { tasks: t, events: e };
  }, [tasks, events, selectedDateStr]);

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-hidden selection:bg-primary/20">
      
      {/* Header */}
      <div className="flex-none px-8 py-6 flex items-center justify-between border-b border-border/40 shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <h1 className="text-4xl font-black tracking-tight text-foreground">{format(currentDate, "MMMM")}</h1>
            <span className="text-muted-foreground font-semibold tracking-widest uppercase text-xs">{format(currentDate, "yyyy")}</span>
          </div>
          
          <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-2xl border border-border/50">
            <button onClick={handlePrevMonth} className="p-2 hover:bg-background rounded-xl transition-all hover:shadow-sm"><ChevronLeft size={20} /></button>
            <button onClick={handleGoToday} className="px-4 py-2 text-sm font-bold text-foreground hover:bg-background rounded-xl transition-all hover:shadow-sm">Today</button>
            <button onClick={handleNextMonth} className="p-2 hover:bg-background rounded-xl transition-all hover:shadow-sm"><ChevronRight size={20} /></button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => bus.emit("task:quick-add", { prefill: { scheduledDate: selectedDateStr } })}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-bold text-sm tracking-wide shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
          >
            <Plus size={16} strokeWidth={3} /> New Task
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        
        {/* Calendar Grid */}
        <div className="flex-1 flex flex-col p-8 overflow-hidden">
          <div className="grid grid-cols-7 gap-4 mb-4">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => (
              <div key={day} className="text-center text-[11px] font-bold tracking-widest uppercase text-muted-foreground">
                {day}
              </div>
            ))}
          </div>

          <div 
            className="grid grid-cols-7 gap-3 flex-1 min-h-0"
            style={{ gridTemplateRows: `repeat(${days.length / 7}, minmax(0, 1fr))` }}
          >
            {days.map((day, i) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isSelected = isSameDay(day, selectedDate);
              const isTodayDate = isToday(day);
              
              const dayTasks = tasks.filter(t => {
                const d = t.scheduledAt || t.scheduledDate || t.dueDate;
                return getLocalTaskDateStr(d) === dateStr;
              }).sort((a, b) => {
                const aTime = [a.scheduledAt, a.scheduledDate, a.dueDate].find(d => d?.includes("T")) || "Z";
                const bTime = [b.scheduledAt, b.scheduledDate, b.dueDate].find(d => d?.includes("T")) || "Z";
                return aTime.localeCompare(bTime);
              });
              const dayEvents = events.filter(e => getLocalTaskDateStr(e.startDatetime) === dateStr && !e.taskId);
              
              const totalItems = dayTasks.length + dayEvents.length;

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    "relative flex flex-col items-start p-3 rounded-3xl border transition-all duration-300 text-left overflow-hidden group",
                    isSelected 
                      ? "bg-primary/5 border-primary/30 shadow-[0_8px_30px_rgb(var(--primary)/0.1)] ring-1 ring-primary/20" 
                      : "bg-surface-1/30 border-border/40 hover:bg-surface-2 hover:border-border/80",
                    !isCurrentMonth && "opacity-40 grayscale-[0.5]"
                  )}
                >
                  <div className="flex w-full justify-between items-start mb-2">
                    <span className={cn(
                      "text-lg font-black tracking-tighter w-8 h-8 flex items-center justify-center rounded-full transition-colors",
                      isTodayDate ? "bg-primary text-primary-foreground" : isSelected ? "text-primary" : "text-foreground"
                    )}>
                      {format(day, "d")}
                    </span>
                    
                    {totalItems > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-muted rounded-full text-muted-foreground">
                        {totalItems}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 w-full flex flex-col gap-1 overflow-hidden">
                    {dayEvents.slice(0, 2).map(e => (
                      <div key={e.id} className="w-full truncate text-[11px] font-semibold px-2 py-1 bg-amber-500/10 text-amber-500 rounded-md border border-amber-500/20">
                        {e.title}
                      </div>
                    ))}
                    {dayTasks.slice(0, 3 - Math.min(dayEvents.length, 2)).map(t => (
                      <div key={t.id} className={cn(
                        "w-full truncate text-[11px] font-semibold px-2 py-1 rounded-md border transition-colors flex items-center gap-1.5",
                        t.status === "done" 
                          ? "bg-muted/30 text-muted-foreground border-transparent line-through"
                          : "bg-blue-500/10 text-blue-500 border-blue-500/20"
                      )}>
                        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", t.status === "done" ? "bg-muted-foreground" : "bg-blue-500")} />
                        <span className="truncate">{t.title}</span>
                        {(() => {
                          const timeStr = [t.scheduledAt, t.scheduledDate, t.dueDate].find(d => d?.includes("T"));
                          if (!timeStr) return null;
                          return (
                            <span className="ml-auto text-[9px] opacity-70 shrink-0 font-medium tracking-tighter">
                              {format(parseISO(timeStr), "h:mm")}
                            </span>
                          );
                        })()}
                      </div>
                    ))}
                    {totalItems > 3 && (
                      <div className="text-[10px] font-bold text-muted-foreground px-1 mt-1">
                        + {totalItems - 3} more
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sidebar Schedule */}
        <div className="w-[400px] border-l border-border/40 bg-surface-1/20 flex flex-col shrink-0 overflow-hidden">
          <div className="p-8 border-b border-border/40 bg-background/50 backdrop-blur-xl shrink-0">
            <h2 className="text-2xl font-black tracking-tight">{format(selectedDate, "EEEE")}</h2>
            <p className="text-muted-foreground font-medium tracking-wide">{format(selectedDate, "MMMM do, yyyy")}</p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            
            {/* Events */}
            {itemsForSelectedDate.events.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground flex items-center gap-2">
                  <CalendarIcon size={14} /> Scheduled Events
                </h3>
                <div className="flex flex-col gap-2">
                  {itemsForSelectedDate.events.map(e => (
                    <div key={e.id} className="p-4 bg-background border border-border/50 rounded-2xl flex flex-col gap-1 shadow-sm hover:shadow-md transition-shadow">
                      <span className="font-bold text-sm text-foreground">{e.title}</span>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                        <Clock size={12} />
                        {e.isAllDay ? "All Day" : format(parseISO(e.startDatetime), "h:mm a")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tasks */}
            <div className="space-y-3">
              <h3 className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground flex items-center gap-2">
                <CheckSquare size={14} /> Tasks Due
              </h3>
              {itemsForSelectedDate.tasks.length === 0 ? (
                <div className="p-6 text-center border border-dashed border-border/50 rounded-2xl text-muted-foreground text-sm font-medium">
                  No tasks scheduled.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {itemsForSelectedDate.tasks.map(t => (
                    <div 
                      key={t.id} 
                      onClick={() => bus.emit("task:open", { taskId: t.id })}
                      className={cn(
                        "p-4 bg-background border rounded-2xl flex flex-col gap-2 shadow-sm hover:shadow-md transition-all cursor-pointer group",
                        t.status === "done" ? "border-transparent opacity-50 grayscale" : "border-border/50 hover:border-primary/30"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div 
                          onClick={(e) => {
                            e.stopPropagation();
                            updateTask(t.id, { status: t.status === "done" ? "todo" : "done" });
                          }}
                          className={cn(
                            "w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 transition-colors hover:scale-110",
                            t.status === "done" ? "bg-primary border-primary" : "border-muted-foreground group-hover:border-primary"
                          )} 
                        />
                        <div className="flex flex-col gap-1">
                          <span className={cn("font-bold text-sm", t.status === "done" && "line-through text-muted-foreground")}>{t.title}</span>
                          {(() => {
                            const timeStr = [t.scheduledAt, t.scheduledDate, t.dueDate].find(d => d?.includes("T"));
                            if (!timeStr) return null;
                            return (
                              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-bold">
                                <Clock size={12} />
                                {format(parseISO(timeStr), "h:mm a")}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
