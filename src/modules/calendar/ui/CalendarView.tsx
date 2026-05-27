import React, { useEffect, useState } from "react";
import { useCalendarStore } from "../state/calendarStore";
import { 
  Compass, ChevronLeft, ChevronRight, Plus, 
  Trash2, AlertCircle, Calendar as CalendarIcon, FileText
} from "lucide-react";

export const CalendarView: React.FC = () => {
  const {
    events,
    loading,
    error,
    loadEvents,
    createEvent,
    deleteEvent
  } = useCalendarStore();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"month" | "day">("month");
  
  // Creation modal states
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState(() => {
    return currentDate.toISOString().split("T")[0];
  });
  const [startTimeStr, setStartTimeStr] = useState("09:00");
  const [endTimeStr, setEndTimeStr] = useState("10:00");
  const [isAllDay, setIsAllDay] = useState(false);

  useEffect(() => {
    loadEvents();
  }, []);

  const handlePrev = () => {
    if (viewMode === "month") {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    } else {
      setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() - 1)));
    }
  };

  const handleNext = () => {
    if (viewMode === "month") {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    } else {
      setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() + 1)));
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const baseDate = new Date(eventDate);
    let startTimestamp = 0;
    let endTimestamp = 0;

    if (isAllDay) {
      startTimestamp = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 0, 0, 0).getTime();
      endTimestamp = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 23, 59, 59).getTime();
    } else {
      const startHour = parseInt(startTimeStr.split(":")[0]);
      const startMin = parseInt(startTimeStr.split(":")[1]);
      const endHour = parseInt(endTimeStr.split(":")[0]);
      const endMin = parseInt(endTimeStr.split(":")[1]);

      startTimestamp = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), startHour, startMin).getTime();
      endTimestamp = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), endHour, endMin).getTime();
    }

    await createEvent(title, description || null, startTimestamp, endTimestamp, isAllDay);
    
    // Reset form
    setTitle("");
    setDescription("");
    setIsAllDay(false);
    setShowModal(false);
  };

  // Month Math helpers
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const daysInMonth = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
  const firstDayIndex = getFirstDayOfMonth(currentDate.getFullYear(), currentDate.getMonth());

  // Generate 35 grid cells
  const monthCells: { date: Date | null; dayNum: number | "" }[] = [];
  
  // Empty spaces at start
  for (let i = 0; i < firstDayIndex; i++) {
    monthCells.push({ date: null, dayNum: "" });
  }
  // Days of month
  for (let i = 1; i <= daysInMonth; i++) {
    monthCells.push({ 
      date: new Date(currentDate.getFullYear(), currentDate.getMonth(), i),
      dayNum: i 
    });
  }
  // Empty spaces at end
  while (monthCells.length < 35) {
    monthCells.push({ date: null, dayNum: "" });
  }

  // Format month name
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const getEventsForDate = (d: Date) => {
    const formatted = d.toISOString().split("T")[0];
    return events.filter(e => new Date(e.start_time).toISOString().split("T")[0] === formatted);
  };

  const getDayEvents = () => {
    const formatted = currentDate.toISOString().split("T")[0];
    return events.filter(e => new Date(e.start_time).toISOString().split("T")[0] === formatted);
  };

  return (
    <div className="flex-1 flex flex-col p-6 overflow-hidden h-full">
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <Compass className="w-5 h-5 text-zinc-400" />
            Calendar Grid
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">Visualize your meetings and schedules locally.</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Navigation Controls */}
          <div className="flex items-center gap-2 border border-zinc-850 rounded-lg p-1 bg-zinc-950">
            <button onClick={handlePrev} className="p-1 hover:bg-zinc-850 rounded-md cursor-pointer text-zinc-400">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-zinc-300 px-2 font-semibold font-mono min-w-[100px] text-center">
              {viewMode === "month" 
                ? `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}` 
                : currentDate.toISOString().split("T")[0]}
            </span>
            <button onClick={handleNext} className="p-1 hover:bg-zinc-850 rounded-md cursor-pointer text-zinc-400">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* View Toggles */}
          <div className="bg-zinc-900 border border-zinc-850 p-1 rounded-lg flex items-center text-xs">
            <button
              onClick={() => setViewMode("month")}
              className={`px-3 py-1 rounded-md cursor-pointer ${
                viewMode === "month" ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode("day")}
              className={`px-3 py-1 rounded-md cursor-pointer ${
                viewMode === "day" ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Day
            </button>
          </div>

          {/* Action Trigger */}
          <button
            onClick={() => setShowModal(true)}
            className="bg-zinc-100 hover:bg-zinc-250 text-zinc-950 px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            New Event
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3.5 py-2.5 rounded-xl mb-4 flex items-center gap-2 shrink-0">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Main View frame */}
      <div className="flex-1 overflow-hidden min-h-0 bg-zinc-900/10 border border-zinc-850/40 rounded-2xl flex flex-col p-4">
        {loading && events.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-xs text-zinc-500">Querying calendar...</div>
        ) : viewMode === "month" ? (
          /* Month View Grid */
          <div className="flex-1 flex flex-col min-h-0">
            {/* Days label */}
            <div className="grid grid-cols-7 border-b border-zinc-850 pb-2 shrink-0">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="text-center text-[10px] uppercase font-bold text-zinc-500 font-mono">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid cells */}
            <div className="flex-1 grid grid-cols-7 grid-rows-5 gap-1 mt-2 min-h-0">
              {monthCells.map((cell, idx) => {
                const dayEvents = cell.date ? getEventsForDate(cell.date) : [];
                const isToday = cell.date && cell.date.toDateString() === new Date().toDateString();
                
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      if (cell.date) {
                        setCurrentDate(cell.date);
                        setViewMode("day");
                      }
                    }}
                    className={`border border-zinc-850/45 rounded-xl p-2 flex flex-col min-h-0 cursor-pointer hover:bg-zinc-900/10 transition-colors ${
                      isToday ? "bg-zinc-850/15" : ""
                    }`}
                  >
                    <span className={`text-[10px] font-semibold font-mono self-end ${
                      isToday ? "bg-zinc-200 text-zinc-950 w-5 h-5 rounded-full flex items-center justify-center" : "text-zinc-550"
                    }`}>
                      {cell.dayNum}
                    </span>

                    <div className="flex-1 overflow-y-auto space-y-1 mt-1 pr-0.5">
                      {dayEvents.map((e) => (
                        <div
                          key={e.id}
                          className="bg-zinc-900 border border-zinc-800 text-zinc-300 text-[9px] px-1.5 py-0.5 rounded-md font-medium truncate"
                        >
                          {e.title}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Day View List */
          <div className="flex-1 overflow-y-auto pr-1 space-y-2 min-h-0">
            {getDayEvents().length === 0 ? (
              <div className="h-48 border border-dashed border-zinc-850 rounded-2xl flex items-center justify-center text-center text-xs text-zinc-500">
                No events scheduled for today.
              </div>
            ) : (
              getDayEvents().map((e) => {
                const startStr = e.is_all_day ? "All Day" : new Date(e.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const endStr = e.is_all_day ? "" : " - " + new Date(e.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                return (
                  <div
                    key={e.id}
                    className="flex justify-between p-4 bg-zinc-900/20 border border-zinc-850 rounded-xl hover:border-zinc-800 transition-colors group"
                  >
                    <div className="flex gap-4">
                      <div className="w-20 text-[10px] font-mono text-zinc-500 shrink-0 flex flex-col justify-center">
                        <span className="font-semibold text-zinc-450">{startStr}</span>
                        <span className="text-[9px] text-zinc-650">{endStr}</span>
                      </div>
                      
                      <div className="h-10 w-1 rounded-full bg-zinc-700 shrink-0"></div>
                      
                      <div>
                        <h4 className="text-sm font-semibold text-zinc-200">{e.title}</h4>
                        {e.description && (
                          <p className="text-xs text-zinc-500 flex items-center gap-1.5 mt-1">
                            <FileText className="w-3.5 h-3.5" />
                            {e.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={(evt) => {
                        evt.stopPropagation();
                        deleteEvent(e.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/10 hover:text-red-400 text-zinc-600 rounded-lg transition-all self-center cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Creation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <form onSubmit={handleCreate} className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-md w-full p-5 space-y-4 shadow-2xl text-zinc-150">
            <div>
              <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-zinc-400" />
                Schedule New Event
              </h3>
              <p className="text-[11px] text-zinc-500 mt-0.5">Define your meetings or block time allocations.</p>
            </div>

            <div className="space-y-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-zinc-500 font-semibold uppercase">Event Title</label>
                <input
                  type="text"
                  required
                  className="bg-zinc-950 border border-zinc-850 rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder-zinc-700 focus:outline-hidden"
                  placeholder="e.g. Design review"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-zinc-500 font-semibold uppercase">Description</label>
                <textarea
                  className="bg-zinc-950 border border-zinc-850 rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder-zinc-700 min-h-[60px] focus:outline-hidden"
                  placeholder="Add description notes..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] text-zinc-500 font-semibold uppercase">Date</label>
                  <input
                    type="date"
                    required
                    className="bg-zinc-950 border border-zinc-850 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-hidden"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="isAllDay"
                    className="rounded bg-zinc-950 border-zinc-800 text-zinc-100 cursor-pointer"
                    checked={isAllDay}
                    onChange={(e) => setIsAllDay(e.target.checked)}
                  />
                  <label htmlFor="isAllDay" className="text-xs text-zinc-400 select-none cursor-pointer">All day event</label>
                </div>
              </div>

              {!isAllDay && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-zinc-500 font-semibold uppercase">Start time</label>
                    <input
                      type="time"
                      className="bg-zinc-950 border border-zinc-850 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-hidden"
                      value={startTimeStr}
                      onChange={(e) => setStartTimeStr(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] text-zinc-500 font-semibold uppercase">End time</label>
                    <input
                      type="time"
                      className="bg-zinc-950 border border-zinc-850 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-hidden"
                      value={endTimeStr}
                      onChange={(e) => setEndTimeStr(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-3.5 py-1.5 border border-zinc-800 hover:border-zinc-750 text-xs font-semibold rounded-lg text-zinc-400 hover:text-zinc-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-bold px-4 py-1.5 rounded-lg text-xs cursor-pointer"
              >
                Save Event
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
export default CalendarView;
