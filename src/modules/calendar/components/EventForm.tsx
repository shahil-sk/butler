import { useState, useEffect } from "react";
import { X, Calendar } from "lucide-react";
import { cn } from "@/shared/utils";
import { useCalendarStore } from "../store";

const PRESET_COLORS = [
  "#3b82f6","#8b5cf6","#ec4899","#f97316","#eab308","#22c55e","#14b8a6",
];

export function EventForm() {
  const { eventForm, closeEventForm, createEvent, updateEvent, deleteEvent, calendars } =
    useCalendarStore();

  const { open, prefill, editingId } = eventForm;

  const [title,      setTitle]      = useState("");
  const [startAt,    setStartAt]    = useState("");
  const [endAt,      setEndAt]      = useState("");
  const [allDay,     setAllDay]     = useState(false);
  const [calId,      setCalId]      = useState("default");
  const [color,      setColor]      = useState("");
  const [description,setDescription]= useState("");

  useEffect(() => {
    if (open) {
      setTitle(       prefill.title       ?? "");
      setStartAt(     prefill.startAt     ?? `${new Date().toISOString().slice(0,16)}`);
      setEndAt(       prefill.endAt       ?? `${new Date(Date.now() + 3600000).toISOString().slice(0,16)}`);
      setAllDay(      prefill.allDay      ?? false);
      setCalId(       prefill.calendarId  ?? calendars.find((c) => c.isDefault)?.id ?? "default");
      setColor(       prefill.color       ?? "");
      setDescription( prefill.description ?? "");
    }
  }, [open, prefill]);

  if (!open) return null;

  const submit = async () => {
    if (!title.trim()) return;
    const payload = {
      title: title.trim(), startAt, endAt, allDay,
      calendarId: calId, color: color || undefined, description: description || undefined,
    };
    if (editingId) {
      await updateEvent(editingId, payload);
    } else {
      await createEvent(payload);
    }
    closeEventForm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeEventForm} />

      <div className="relative z-10 w-full max-w-[440px] rounded-xl border border-border bg-popover shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Calendar size={14} className="text-muted-foreground" />
          <h2 className="text-sm font-semibold flex-1">
            {editingId ? "Edit event" : "New event"}
          </h2>
          <button onClick={closeEventForm} className="text-muted-foreground hover:text-foreground transition-fast">
            <X size={14} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* Title */}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
            placeholder="Event title"
            autoFocus
            className="w-full text-sm font-medium bg-transparent outline-none border-b border-border pb-2"
          />

          {/* All day toggle */}
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="rounded"
            />
            All day
          </label>

          {/* Date/time */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Start</label>
              <input
                type={allDay ? "date" : "datetime-local"}
                value={allDay ? startAt.slice(0,10) : startAt}
                onChange={(e) => setStartAt(allDay ? `${e.target.value}T00:00:00` : e.target.value)}
                className="w-full text-xs bg-transparent outline-none border border-border rounded-md px-2 py-1.5 mt-1"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide">End</label>
              <input
                type={allDay ? "date" : "datetime-local"}
                value={allDay ? endAt.slice(0,10) : endAt}
                onChange={(e) => setEndAt(allDay ? `${e.target.value}T23:59:59` : e.target.value)}
                className="w-full text-xs bg-transparent outline-none border border-border rounded-md px-2 py-1.5 mt-1"
              />
            </div>
          </div>

          {/* Calendar */}
          {calendars.length > 1 && (
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Calendar</label>
              <select
                value={calId}
                onChange={(e) => setCalId(e.target.value)}
                className="w-full text-xs bg-transparent outline-none border border-border rounded-md px-2 py-1.5 mt-1"
              >
                {calendars.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Color */}
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1.5">Color</label>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setColor("")}
                className={cn(
                  "w-5 h-5 rounded-full border-2 bg-muted transition-fast",
                  !color ? "border-foreground" : "border-transparent"
                )}
                title="Calendar default"
              />
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "w-5 h-5 rounded-full border-2 transition-fast",
                    color === c ? "border-foreground scale-110" : "border-transparent"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Description */}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className="w-full text-xs bg-transparent outline-none border border-border rounded-md px-2 py-1.5 resize-none text-muted-foreground placeholder:text-muted-foreground/40"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-border">
          {editingId && (
            <button
              onClick={async () => { await deleteEvent(editingId); closeEventForm(); }}
              className="text-xs text-red-500 hover:text-red-600 transition-fast mr-auto"
            >
              Delete
            </button>
          )}
          <button
            onClick={closeEventForm}
            className="px-3 py-1.5 text-xs rounded-md border border-border hover:bg-accent transition-fast"
          >
            Cancel
          </button>
          <button
            onClick={() => void submit()}
            disabled={!title.trim()}
            className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-fast"
          >
            {editingId ? "Save changes" : "Create event"}
          </button>
        </div>
      </div>
    </div>
  );
}
