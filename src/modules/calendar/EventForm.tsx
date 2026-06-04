// @ts-nocheck
// ============================================================
// CALENDAR — EventForm
//
// Guard: if editingId starts with 'task:', renders TaskEventPanel
// instead — task-owned shadow events should not be edited here.
//
// WHAT "LINKS" DOES:
// The Links tab stores linkedTaskIds / linkedNoteIds as JSON
// arrays in calendar_events. Linked items surface in DayView's
// right sidebar so you see event + related context together.
// Tasks with due/scheduled dates already appear via sync;
// linking is for manual context (meeting notes, focus tasks).
// ============================================================

import { useState, useEffect, useRef } from "react";
import { X, Calendar, CheckSquare, FileText, Timer, Repeat, Search } from "lucide-react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { cn } from "@/shared/utils";
import { useCalendarStore } from "./store";
import { useTaskStore } from "@/modules/tasks/store";
import { TaskEventPanel } from "./TaskEventPanel";
import { DateTimePicker } from "./DateTimePicker";
const notes: any[] = [];

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

  const [location,    setLocation]    = useState("");
  const [meetingUrl,  setMeetingUrl]  = useState("");
  const [status,      setStatus]      = useState("");
  const [visibility,  setVisibility]  = useState("");

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
      setLocation(    prefill.location ?? "");
      setMeetingUrl(  prefill.meetingUrl ?? "");
      setStatus(      prefill.status ?? "confirmed");
      setVisibility(  prefill.visibility ?? "default");
      setTaskSearch(""); setNoteSearch("");
    }
  }, [open]);

  if (!open) return null;

  if (editingId?.startsWith("task:")) {
    const taskId = editingId.replace(/^task:/, "");
    return <TaskEventPanel taskId={taskId} onClose={closeEventForm} />;
  }

  const handleStartChange = (iso: string) => {
    setStartAt(iso);
    // Auto-advance end by 1 h if end is now before new start
    const newStart = new Date(iso).getTime();
    const curEnd   = new Date(endAt).getTime();
    if (!isNaN(newStart) && (!curEnd || curEnd <= newStart)) {
      setEndAt(new Date(newStart + 3_600_000).toISOString().slice(0, 16));
    }
  };

  const submit = async () => {
    if (!title.trim()) return;
    const toISO = (v: string, fb: string) =>
      v ? (v.includes("T") ? v : `${v}${fb}`) : v;
    const payload = {
      title:         title.trim(),
      startAt:       toISO(startAt, "T00:00:00"),
      endAt:         toISO(endAt,   "T23:59:59"),
      allDay,
      calendarId:    calId,
      color:         color || undefined,
      description:   description || undefined,
      location:      location || undefined,
      meetingUrl:    meetingUrl || undefined,
      status:        status as any,
      visibility:    visibility as any,
      isTimeBlock,
      recurrence:    recurrence ? { frequency: recurrence as "daily" | "weekly" | "monthly" } : undefined,
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

  const container = useRef<HTMLDivElement>(null);
  
  useGSAP(() => {
    if (open && !editingId?.startsWith("task:")) {
      gsap.from(".modal-overlay", { opacity: 0, duration: 0.3, ease: "power2.out" });
      gsap.from(".modal-content", {
        y: 40,
        opacity: 0,
        scale: 0.95,
        duration: 0.4,
        ease: "back.out(1.1)"
      });
    }
  }, [open, editingId]);

  return (
    <div ref={container} className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="modal-overlay absolute inset-0 bg-background/60 backdrop-blur-md" onClick={closeEventForm} />
      
      <div className="modal-content relative z-10 w-full max-w-[480px] rounded-[2rem] border border-border/50 bg-card/60 backdrop-blur-2xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] flex flex-col max-h-[90vh] overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[150px] bg-primary/20 blur-[60px] rounded-full pointer-events-none -z-10" />

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-border/30 shrink-0">
          <Calendar size={14} className="text-muted-foreground" />
          <h2 className="text-sm font-semibold flex-1">{editingId ? "Edit event" : "New event"}</h2>
          <button onClick={closeEventForm} className="text-muted-foreground hover:text-foreground transition-fast">
            <X size={14} />
          </button>
        </div>

        <div className="px-6 pt-6 pb-2 shrink-0">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) void submit(); }}
            placeholder="Event title"
            autoFocus
            className="w-full text-2xl font-bold bg-transparent outline-none pb-2 placeholder:text-muted-foreground/30 transition-all border-b-2 border-transparent focus:border-primary/30"
          />
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border/30 shrink-0 px-6 gap-6">
          {(["details", "links"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "py-3 px-1 text-xs font-bold uppercase tracking-wider border-b-2 -mb-px transition-all duration-300",
                tab === t 
                  ? "border-primary text-primary" 
                  : "border-transparent text-muted-foreground/60 hover:text-foreground"
              )}
            >
              {t === "links" && linkCount > 0 ? `Links (${linkCount})` : t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          {tab === "details" && (
            <>
              <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground transition-fast">
                <input
                  type="checkbox"
                  checked={allDay}
                  onChange={(e) => setAllDay(e.target.checked)}
                  className="rounded accent-primary"
                />
                All day event
              </label>

              {/* Split date + time pickers */}
              <div className="grid grid-cols-2 gap-3">
                <DateTimePicker
                  label="Start"
                  value={allDay ? startAt.slice(0, 10) : startAt}
                  timeDisabled={allDay}
                  onChange={handleStartChange}
                />
                <DateTimePicker
                  label="End"
                  value={allDay ? endAt.slice(0, 10) : endAt}
                  timeDisabled={allDay}
                  min={allDay ? startAt.slice(0, 10) : undefined}
                  onChange={setEndAt}
                />
              </div>

              {calendars.length > 0 && (
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">Calendar</label>
                  <select
                    value={calId}
                    onChange={(e) => setCalId(e.target.value)}
                    className="w-full text-sm bg-muted/30 outline-none border border-border/50 rounded-xl px-3 py-2.5 transition-all focus:border-primary/50 focus:bg-background/80"
                  >
                    {calendars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">Color</label>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setColor("")}
                    className={cn("w-7 h-7 rounded-full border-[3px] bg-muted transition-all duration-300", !color ? "border-foreground scale-110 shadow-lg" : "border-transparent hover:scale-105")}
                    title="Calendar default"
                  />
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={cn("w-7 h-7 rounded-full border-[3px] transition-all duration-300", color === c ? "border-foreground scale-110 shadow-lg" : "border-transparent hover:scale-105")}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">Repeat</label>
                <div className="flex items-center gap-2 relative">
                  <Repeat size={14} className="absolute left-3 text-muted-foreground/50 pointer-events-none" />
                  <select
                    value={recurrence}
                    onChange={(e) => setRecurrence(e.target.value)}
                    className="w-full text-sm bg-muted/30 outline-none border border-border/50 rounded-xl pl-9 pr-3 py-2.5 transition-all focus:border-primary/50 focus:bg-background/80"
                  >
                    {RECURRENCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground transition-fast mt-2">
                <input
                  type="checkbox"
                  checked={isTimeBlock}
                  onChange={(e) => setIsTimeBlock(e.target.checked)}
                  className="rounded accent-primary"
                />
                <Timer size={14} className="text-muted-foreground/60" />
                Time block
              </label>

              {/* Status & Visibility */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full text-sm bg-muted/30 outline-none border border-border/50 rounded-xl px-3 py-2.5 transition-all focus:border-primary/50"
                  >
                    <option value="confirmed">Confirmed</option>
                    <option value="tentative">Tentative</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">Visibility</label>
                  <select
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value)}
                    className="w-full text-sm bg-muted/30 outline-none border border-border/50 rounded-xl px-3 py-2.5 transition-all focus:border-primary/50"
                  >
                    <option value="default">Default</option>
                    <option value="private">Private</option>
                    <option value="public">Public</option>
                  </select>
                </div>
              </div>

              {/* Location & Meeting */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">Location</label>
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Address or place"
                    className="w-full text-sm bg-muted/30 outline-none border border-border/50 rounded-xl px-3 py-2.5 transition-all focus:border-primary/50 placeholder:text-muted-foreground/40"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">Meeting URL</label>
                  <input
                    value={meetingUrl}
                    onChange={(e) => setMeetingUrl(e.target.value)}
                    placeholder="Zoom, Meet, etc."
                    className="w-full text-sm bg-muted/30 outline-none border border-border/50 rounded-xl px-3 py-2.5 transition-all focus:border-primary/50 placeholder:text-muted-foreground/40"
                  />
                </div>
              </div>

              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description (optional)"
                rows={3}
                className="w-full text-sm bg-muted/30 outline-none border border-border/50 rounded-xl px-3 py-3 resize-none text-muted-foreground placeholder:text-muted-foreground/40 transition-all focus:border-primary/50 focus:bg-background/80"
              />
            </>
          )}

          {tab === "links" && (
            <>
              <div className="rounded-lg bg-muted/40 border border-border/60 px-3 py-2.5 text-[11px] text-muted-foreground leading-relaxed">
                <p className="font-medium text-foreground mb-1">What does linking do?</p>
                Linked tasks and notes are <strong>associated</strong> with this calendar event.
                They appear in the <strong>Day view sidebar</strong> when you view this event,
                so you can see related context without switching modules.
                <br /><br />
                Tasks with a due/scheduled date already appear on the calendar automatically —
                linking is for <em>manual context</em> (e.g. link meeting notes to a meeting event,
                or link the tasks you plan to tackle during a focus block).
              </div>

              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <CheckSquare size={11} className="text-muted-foreground" />
                  <p className="text-[11px] font-medium text-foreground">Link tasks</p>
                </div>
                <div className="relative mb-2">
                  <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                  <input
                    value={taskSearch}
                    onChange={(e) => setTaskSearch(e.target.value)}
                    placeholder="Search tasks…"
                    className="w-full text-xs pl-6 pr-2 py-1.5 border border-border rounded-md bg-muted/30 outline-none"
                  />
                </div>
                <div className="space-y-0.5 max-h-36 overflow-y-auto">
                  {filteredTasks.map((t) => {
                    const linked = linkedTasks.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        onClick={() => toggleTask(t.id)}
                        className={cn(
                          "w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs transition-fast",
                          linked ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent"
                        )}
                      >
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
                  <input
                    value={noteSearch}
                    onChange={(e) => setNoteSearch(e.target.value)}
                    placeholder="Search notes…"
                    className="w-full text-xs pl-6 pr-2 py-1.5 border border-border rounded-md bg-muted/30 outline-none"
                  />
                </div>
                <div className="space-y-0.5 max-h-36 overflow-y-auto">
                  {filteredNotes.map((n) => {
                    const linked = linkedNotes.includes(n.id);
                    return (
                      <button
                        key={n.id}
                        onClick={() => toggleNote(n.id)}
                        className={cn(
                          "w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs transition-fast",
                          linked ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent"
                        )}
                      >
                        <div className={cn("w-3 h-3 rounded border-2 shrink-0 flex items-center justify-center transition-fast", linked ? "bg-primary border-primary" : "border-border")}>
                          {linked && <div className="w-1.5 h-1.5 bg-white rounded-sm" />}
                        </div>
                        <span className="flex-1 truncate">{n.title || "Untitled"}</span>
                        <span className="text-[9px] text-muted-foreground tabular-nums shrink-0">{n.updatedAt?.slice(0, 10)}</span>
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
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border/30 bg-muted/10 shrink-0">
          <div className="flex gap-2">
            {editingId && (
              <>
                <button
                  onClick={async () => {
                    const evt = useCalendarStore.getState().events.find(e => e.id === editingId);
                    if (evt) {
                      const est = Math.max(15, (new Date(evt.endAt).getTime() - new Date(evt.startAt).getTime()) / 60000);
                      await useTaskStore.getState().createTask({
                        title: evt.title,
                        description: evt.description,
                        dueDate: evt.startAt.slice(0, 10),
                        estimateMinutes: Math.round(est),
                      });
                      await deleteEvent(editingId);
                      closeEventForm();
                    }
                  }}
                  className="px-4 py-2 text-xs font-bold text-primary bg-primary/10 rounded-full hover:bg-primary/20 transition-all"
                >
                  Convert to Task
                </button>
                <button
                  onClick={async () => { await deleteEvent(editingId); closeEventForm(); }}
                  className="px-4 py-2 text-xs font-bold text-destructive bg-destructive/10 rounded-full hover:bg-destructive/20 transition-all"
                >
                  Delete
                </button>
              </>
            )}
          </div>
          
          <div className="flex gap-2">
            <button onClick={closeEventForm} className="px-5 py-2 text-xs font-bold rounded-full hover:bg-accent transition-fast">Cancel</button>
            <button
              onClick={() => void submit()}
              disabled={!title.trim()}
              className="px-6 py-2 text-xs font-bold rounded-full bg-primary text-primary-foreground hover:brightness-110 disabled:opacity-40 transition-all shadow-md shadow-primary/20"
            >
              {editingId ? "Save changes" : "Create event"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
