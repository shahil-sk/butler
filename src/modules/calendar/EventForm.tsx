// ============================================================
// CALENDAR — EventForm  (improved)
// Tabbed modal: Details | Links
// Details: dates, all-day, calendar, color, recurrence,
//          time-block toggle, description
// Links: search + checkbox-select tasks + notes
// ============================================================

import { useState, useEffect } from "react";
import { X, Calendar, CheckSquare, FileText, Timer, Repeat, Search } from "lucide-react";
import { cn } from "@/shared/utils";
import { useCalendarStore } from "./store";
import { useTaskStore } from "@/modules/tasks/store";
import { useNoteStore } from "@/modules/notes/store";

const PRESET_COLORS = [
  "#3b82f6","#8b5cf6","#ec4899","#f97316","#eab308","#22c55e","#14b8a6","#ef4444",
];

const RECURRENCE_OPTIONS = [
  { value: "",         label: "Does not repeat" },
  { value: "daily",   label: "Daily"   },
  { value: "weekly",  label: "Weekly"  },
  { value: "monthly", label: "Monthly" },
];

type Tab = "details" | "links";

export function EventForm() {
  const { eventForm, closeEventForm, createEvent, updateEvent, deleteEvent, calendars } =
    useCalendarStore();
  const tasks = useTaskStore((s) => s.tasks);
  const notes = useNoteStore((s) => s.notes);

  const { open, prefill, editingId } = eventForm;

  const [tab,         setTab]         = useState<Tab>("details");
  const [title,       setTitle]       = useState("");
  const [startAt,     setStartAt]     = useState("");
  const [endAt,       setEndAt]       = useState("");
  const [allDay,      setAllDay]      = useState(false);
  const [calId,       setCalId]       = useState("default");
  const [color,       setColor]       = useState("");
  const [description, setDescription] = useState("");
  const [isTimeBlock, setIsTimeBlock] = useState(false);
  const [recurrence,  setRecurrence]  = useState("");
  const [linkedTasks, setLinkedTasks] = useState<string[]>([]);
  const [linkedNotes, setLinkedNotes] = useState<string[]>([]);
  const [taskSearch,  setTaskSearch]  = useState("");
  const [noteSearch,  setNoteSearch]  = useState("");

  useEffect(() => {
    if (open) {
      setTab("details");
      setTitle(       prefill.title         ?? "");
      setStartAt(     prefill.startAt       ?? new Date().toISOString().slice(0, 16));
      setEndAt(       prefill.endAt         ?? new Date(Date.now() + 3_600_000).toISOString().slice(0, 16));
      setAllDay(      prefill.allDay        ?? false);
      setCalId(       prefill.calendarId    ?? calendars.find((c) => c.isDefault)?.id ?? "default");
      setColor(       prefill.color         ?? "");
      setDescription( prefill.description   ?? "");
      setIsTimeBlock( prefill.isTimeBlock   ?? false);
      setRecurrence(  prefill.recurrence?.frequency ?? "");
      setLinkedTasks( prefill.linkedTaskIds ?? []);
      setLinkedNotes( prefill.linkedNoteIds ?? []);
      setTaskSearch(""); setNoteSearch("");
    }
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    if (!title.trim()) return;
    const payload = {
      title: title.trim(), startAt, endAt, allDay,
      calendarId: calId,
      color: color || undefined,
      description: description || undefined,
      isTimeBlock,
      recurrence: recurrence ? { frequency: recurrence as "daily" | "weekly" | "monthly" } : undefined,
      linkedTaskIds: linkedTasks,
      linkedNoteIds: linkedNotes,
    };
    if (editingId) await updateEvent(editingId, payload);
    else           await createEvent(payload);
    closeEventForm();
  };

  const toggleTask = (id: string) =>
    setLinkedTasks((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const toggleNote = (id: string) =>
    setLinkedNotes((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const filteredTasks = tasks
    .filter((t) => t.title.toLowerCase().includes(taskSearch.toLowerCase()))
    .slice(0, 8);
  const filteredNotes = notes
    .filter((n) => (n.title || "Untitled").toLowerCase().includes(noteSearch.toLowerCase()))
    .slice(0, 8);

  const linkCount = linkedTasks.length + linkedNotes.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeEventForm} />
      <div className="relative z-10 w-full max-w-[460px] rounded-xl border border-border bg-popover shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
          <Calendar size={14} className="text-muted-foreground" />
          <h2 className="text-sm font-semibold flex-1">{editingId ? "Edit event" : "New event"}</h2>
          <button onClick={closeEventForm} className="text-muted-foreground hover:text-foreground transition-fast">
            <X size={14} />
          </button>
        </div>

        {/* Title */}
        <div className="px-4 pt-4 pb-2 shrink-0">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) void submit(); }}
            placeholder="Event title"
            autoFocus
            className="w-full text-sm font-medium bg-transparent outline-none border-b border-border pb-2 placeholder:text-muted-foreground/40"
          />
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border shrink-0 px-4">
          {(["details", "links"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "py-2 px-1 mr-4 text-[11px] font-medium border-b-2 -mb-px transition-fast",
                tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t === "links" && linkCount > 0 ? `Links (${linkCount})` : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Tab body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {tab === "details" && (
            <>
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="rounded accent-primary" />
                All day event
              </label>

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

              {calendars.length > 0 && (
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Calendar</label>
                  <select value={calId} onChange={(e) => setCalId(e.target.value)} className="w-full text-xs bg-popover outline-none border border-border rounded-md px-2 py-1.5 mt-1">
                    {calendars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wide block mb-1.5">Color</label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button onClick={() => setColor("")} className={cn("w-5 h-5 rounded-full border-2 bg-muted transition-fast", !color ? "border-foreground" : "border-transparent")} title="Calendar default" />
                  {PRESET_COLORS.map((c) => (
                    <button key={c} onClick={() => setColor(c)} className={cn("w-5 h-5 rounded-full border-2 transition-fast", color === c ? "border-foreground scale-110" : "border-transparent")} style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Repeat</label>
                <div className="flex items-center gap-1.5 mt-1">
                  <Repeat size={12} className="text-muted-foreground/50 shrink-0" />
                  <select value={recurrence} onChange={(e) => setRecurrence(e.target.value)} className="flex-1 text-xs bg-popover outline-none border border-border rounded-md px-2 py-1.5">
                    {RECURRENCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                <input type="checkbox" checked={isTimeBlock} onChange={(e) => setIsTimeBlock(e.target.checked)} className="rounded accent-primary" />
                <Timer size={11} className="text-muted-foreground" />
                <span className="text-muted-foreground">Mark as time block (focus session)</span>
              </label>

              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (optional)"
                rows={2}
                className="w-full text-xs bg-transparent outline-none border border-border rounded-md px-2 py-1.5 resize-none text-muted-foreground placeholder:text-muted-foreground/30"
              />
            </>
          )}

          {tab === "links" && (
            <>
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <CheckSquare size={11} className="text-muted-foreground" />
                  <p className="text-[11px] font-medium text-foreground">Link tasks</p>
                </div>
                <div className="relative mb-2">
                  <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                  <input value={taskSearch} onChange={(e) => setTaskSearch(e.target.value)} placeholder="Search tasks\u2026" className="w-full text-xs pl-6 pr-2 py-1.5 border border-border rounded-md bg-muted/30 outline-none" />
                </div>
                <div className="space-y-0.5 max-h-36 overflow-y-auto">
                  {filteredTasks.map((t) => {
                    const linked = linkedTasks.includes(t.id);
                    return (
                      <button key={t.id} onClick={() => toggleTask(t.id)} className={cn("w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs transition-fast", linked ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent")}>
                        <div className={cn("w-3 h-3 rounded border-2 shrink-0 flex items-center justify-center transition-fast", linked ? "bg-primary border-primary" : "border-border")}>
                          {linked && <div className="w-1.5 h-1.5 bg-white rounded-sm" />}
                        </div>
                        <span className="flex-1 truncate">{t.title}</span>
                        {t.dueDate && <span className="text-[9px] text-muted-foreground tabular-nums shrink-0">{t.dueDate.slice(5)}</span>}
                      </button>
                    );
                  })}
                  {filteredTasks.length === 0 && <p className="text-[11px] text-muted-foreground/40 text-center py-2">No tasks found</p>}
                </div>
              </div>

              <div className="border-t border-border" />

              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <FileText size={11} className="text-muted-foreground" />
                  <p className="text-[11px] font-medium text-foreground">Link notes</p>
                </div>
                <div className="relative mb-2">
                  <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                  <input value={noteSearch} onChange={(e) => setNoteSearch(e.target.value)} placeholder="Search notes\u2026" className="w-full text-xs pl-6 pr-2 py-1.5 border border-border rounded-md bg-muted/30 outline-none" />
                </div>
                <div className="space-y-0.5 max-h-36 overflow-y-auto">
                  {filteredNotes.map((n) => {
                    const linked = linkedNotes.includes(n.id);
                    return (
                      <button key={n.id} onClick={() => toggleNote(n.id)} className={cn("w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs transition-fast", linked ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent")}>
                        <div className={cn("w-3 h-3 rounded border-2 shrink-0 flex items-center justify-center transition-fast", linked ? "bg-primary border-primary" : "border-border")}>
                          {linked && <div className="w-1.5 h-1.5 bg-white rounded-sm" />}
                        </div>
                        <span className="flex-1 truncate">{n.title || "Untitled"}</span>
                        <span className="text-[9px] text-muted-foreground tabular-nums shrink-0">{n.updatedAt?.slice(0,10)}</span>
                      </button>
                    );
                  })}
                  {filteredNotes.length === 0 && <p className="text-[11px] text-muted-foreground/40 text-center py-2">No notes found</p>}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-border shrink-0">
          {editingId && (
            <button onClick={async () => { await deleteEvent(editingId); closeEventForm(); }} className="text-xs text-destructive hover:text-destructive/80 transition-fast mr-auto">
              Delete
            </button>
          )}
          <button onClick={closeEventForm} className="px-3 py-1.5 text-xs rounded-md border border-border hover:bg-accent transition-fast">Cancel</button>
          <button onClick={() => void submit()} disabled={!title.trim()} className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-fast">
            {editingId ? "Save changes" : "Create event"}
          </button>
        </div>
      </div>
    </div>
  );
}
