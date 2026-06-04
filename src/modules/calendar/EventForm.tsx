// @ts-nocheck
// ============================================================
// CALENDAR — EventForm  (redesigned to match TaskDetail DNA)
// ============================================================

import { useState, useEffect, useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  X, Calendar, Clock, Repeat, MapPin, Video,
  ArrowRight, Trash2, Layout, Inbox, Link2,
  CheckSquare, Eye, Layers, Timer
} from "lucide-react";
import { cn } from "@/shared/utils";
import { useCalendarStore } from "./store";
import { useTaskStore } from "@/modules/tasks/store";
import { TaskEventPanel } from "./TaskEventPanel";

const PRESET_COLORS = [
  { hex: "#3b82f6", label: "Blue" },
  { hex: "#8b5cf6", label: "Violet" },
  { hex: "#ec4899", label: "Pink" },
  { hex: "#f97316", label: "Orange" },
  { hex: "#eab308", label: "Yellow" },
  { hex: "#22c55e", label: "Green" },
  { hex: "#14b8a6", label: "Teal" },
  { hex: "#ef4444", label: "Red" },
];

const RECUR_OPTIONS = [
  { value: "", label: "Does not repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

export function EventForm() {
  const {
    eventForm, closeEventForm, createEvent, updateEvent, deleteEvent, calendars
  } = useCalendarStore();
  const tasks = useTaskStore((s) => s.tasks);

  const { open, prefill, editingId } = eventForm;

  // ── State ────────────────────────────────────────────────────
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
  const [location,    setLocation]    = useState("");
  const [meetingUrl,  setMeetingUrl]  = useState("");
  const [status,      setStatus]      = useState("confirmed");
  const [visibility,  setVisibility]  = useState("default");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef   = useRef<HTMLDivElement>(null);

  // ── Hooks (always before any early returns) ───────────────────
  useEffect(() => {
    if (open) {
      setTitle(prefill.title ?? "");
      setStartAt(prefill.startAt ?? new Date().toISOString().slice(0, 16));
      setEndAt(prefill.endAt ?? new Date(Date.now() + 3_600_000).toISOString().slice(0, 16));
      setAllDay(prefill.allDay ?? false);
      setCalId(prefill.calendarId ?? calendars.find((c) => c.isDefault)?.id ?? "default");
      setColor(prefill.color ?? "");
      setDescription(prefill.description ?? "");
      setIsTimeBlock(prefill.isTimeBlock ?? false);
      setRecurrence(prefill.recurrence?.frequency ?? "");
      setLinkedTasks(prefill.linkedTaskIds ?? []);
      setLocation(prefill.location ?? "");
      setMeetingUrl(prefill.meetingUrl ?? "");
      setStatus(prefill.status ?? "confirmed");
      setVisibility(prefill.visibility ?? "default");
    }
  }, [open]);

  useGSAP(() => {
    if (open && !editingId?.startsWith("task:") && panelRef.current && overlayRef.current) {
      gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power2.out" });
      gsap.fromTo(panelRef.current,
        { scale: 0.96, opacity: 0, y: 20 },
        { scale: 1, opacity: 1, y: 0, duration: 0.45, ease: "back.out(1.1)" }
      );
    }
  }, [open, editingId]);

  // ── Early returns (AFTER all hooks) ──────────────────────────
  if (!open) return null;
  if (editingId?.startsWith("task:")) {
    return <TaskEventPanel taskId={editingId.replace(/^task:/, "")} onClose={closeEventForm} />;
  }

  // ── Handlers ─────────────────────────────────────────────────
  const handleClose = () => {
    if (panelRef.current && overlayRef.current) {
      gsap.to(overlayRef.current, { opacity: 0, duration: 0.2 });
      gsap.to(panelRef.current, {
        scale: 0.97, opacity: 0, y: 10, duration: 0.2, ease: "power2.in",
        onComplete: closeEventForm,
      });
    } else {
      closeEventForm();
    }
  };

  const handleStartChange = (iso: string) => {
    setStartAt(iso);
    const ns = new Date(iso).getTime();
    const ce = new Date(endAt).getTime();
    if (!isNaN(ns) && (!ce || ce <= ns))
      setEndAt(new Date(ns + 3_600_000).toISOString().slice(0, 16));
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setIsSubmitting(true);
    const toISO = (v: string, fb: string) => v ? (v.includes("T") ? v : `${v}${fb}`) : v;
    const payload = {
      title: title.trim(),
      startAt: toISO(startAt, "T00:00:00"),
      endAt: toISO(endAt, "T23:59:59"),
      allDay,
      calendarId: calId,
      color: color || undefined,
      description: description || undefined,
      location: location || undefined,
      meetingUrl: meetingUrl || undefined,
      status: status as any,
      visibility: visibility as any,
      isTimeBlock,
      recurrence: recurrence ? { frequency: recurrence as any } : undefined,
      linkedTaskIds: linkedTasks,
      linkedNoteIds: [],
    };
    try {
      if (editingId) await updateEvent(editingId, payload);
      else           await createEvent(payload);
      handleClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editingId) return;
    handleClose();
    setTimeout(() => void deleteEvent(editingId), 220);
  };

  const toggleTask = (id: string) =>
    setLinkedTasks((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const openTasks = tasks.filter((t) => t.status !== "done" && t.status !== "archived" && t.status !== "cancelled");
  const selectedColor = color || "#6366f1";

  // Status pill config
  const EVENT_STATUS = [
    { v: "confirmed", label: "Confirmed", cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" },
    { v: "tentative", label: "Tentative", cls: "bg-amber-500/20 text-amber-400 border-amber-500/40" },
    { v: "cancelled", label: "Cancelled", cls: "bg-zinc-500/20 text-zinc-400 border-zinc-500/40" },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8">
      {/* Overlay */}
      <div
        ref={overlayRef}
        onClick={handleClose}
        className="absolute inset-0 bg-background/80 backdrop-blur-xl"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="relative w-full max-w-4xl h-full max-h-[88vh] bg-card border border-border/50 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Accent glow from selected color */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[160px] blur-[80px] rounded-full pointer-events-none -z-10 opacity-30 transition-colors duration-500"
          style={{ backgroundColor: selectedColor }}
        />

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="sticky top-0 z-10 px-8 py-6 bg-card/80 backdrop-blur-md border-b border-border/40 flex flex-col gap-5 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold tracking-wider text-muted-foreground uppercase">
              {editingId ? <Inbox size={16} /> : <Layout size={16} />}
              {editingId ? "Edit Event" : "New Event"}
            </div>
            <div className="flex items-center gap-2">
              {editingId && (
                <button
                  onClick={handleDelete}
                  className="p-2 text-muted-foreground hover:text-destructive transition-colors rounded-full hover:bg-destructive/10"
                >
                  <Trash2 size={18} />
                </button>
              )}
              <button
                onClick={handleClose}
                className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-muted"
              >
                <X size={22} />
              </button>
            </div>
          </div>

          {/* Big title input */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && void handleSubmit()}
            placeholder="What's happening?"
            autoFocus
            className="w-full bg-transparent text-4xl md:text-5xl font-bold tracking-tight text-foreground placeholder:text-muted-foreground/30 focus:outline-none"
          />

          {/* Status pills */}
          <div className="flex items-center gap-1.5 p-1 bg-muted/30 rounded-full border border-border/40 w-fit">
            {EVENT_STATUS.map(({ v, label, cls }) => (
              <button
                key={v}
                onClick={() => setStatus(v)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border border-transparent transition-all duration-200",
                  status === v ? cls : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Body ───────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-8 space-y-10">

          {/* Time section */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-2">
              <Clock size={14} /> When
            </h4>

            <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground cursor-pointer select-none w-fit hover:text-foreground transition-colors">
              <div className={cn(
                "w-8 h-5 rounded-full relative transition-all duration-300 cursor-pointer",
                allDay ? "bg-primary" : "bg-muted border border-border"
              )} onClick={() => setAllDay(v => !v)}>
                <div className={cn(
                  "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-300",
                  allDay ? "left-3.5" : "left-0.5"
                )} />
              </div>
              All day
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-muted/20 border border-border/50 rounded-2xl hover:bg-muted/30 transition-colors space-y-2">
                <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Start</span>
                <input
                  type={allDay ? "date" : "datetime-local"}
                  value={allDay ? startAt.slice(0, 10) : startAt.slice(0, 16)}
                  onChange={(e) => handleStartChange(e.target.value)}
                  className="w-full bg-transparent text-base font-semibold text-foreground focus:outline-none"
                />
              </div>
              <div className="p-4 bg-muted/20 border border-border/50 rounded-2xl hover:bg-muted/30 transition-colors space-y-2">
                <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">End</span>
                <input
                  type={allDay ? "date" : "datetime-local"}
                  value={allDay ? endAt.slice(0, 10) : endAt.slice(0, 16)}
                  onChange={(e) => setEndAt(e.target.value)}
                  className="w-full bg-transparent text-base font-semibold text-foreground focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Bento details grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Color */}
            <div className="p-4 bg-muted/20 border border-border/50 rounded-2xl hover:bg-muted/30 transition-colors space-y-3">
              <h4 className="text-xs font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedColor }} /> Color
              </h4>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setColor("")}
                  className={cn(
                    "w-7 h-7 rounded-full border-[3px] bg-primary/30 transition-all duration-200",
                    !color ? "border-foreground scale-110 shadow-lg" : "border-transparent hover:scale-105"
                  )}
                  title="Default"
                />
                {PRESET_COLORS.map(({ hex, label }) => (
                  <button
                    key={hex}
                    onClick={() => setColor(hex)}
                    className={cn(
                      "w-7 h-7 rounded-full border-[3px] transition-all duration-200",
                      color === hex ? "border-foreground scale-110 shadow-lg" : "border-transparent hover:scale-105"
                    )}
                    style={{ backgroundColor: hex }}
                    title={label}
                  />
                ))}
              </div>
            </div>

            {/* Calendar */}
            <div className="p-4 bg-muted/20 border border-border/50 rounded-2xl hover:bg-muted/30 transition-colors space-y-3">
              <h4 className="text-xs font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-2">
                <Calendar size={14} /> Calendar
              </h4>
              <select
                value={calId}
                onChange={(e) => setCalId(e.target.value)}
                className="w-full bg-background border border-border/50 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
              >
                {calendars.length === 0
                  ? <option value="default">Default</option>
                  : calendars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)
                }
              </select>
            </div>

            {/* Repeat */}
            <div className="p-4 bg-muted/20 border border-border/50 rounded-2xl hover:bg-muted/30 transition-colors space-y-3">
              <h4 className="text-xs font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-2">
                <Repeat size={14} /> Recurrence
              </h4>
              <select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value)}
                className="w-full bg-background border border-border/50 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
              >
                {RECUR_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* Time block toggle */}
            <div className="p-4 bg-muted/20 border border-border/50 rounded-2xl hover:bg-muted/30 transition-colors space-y-3">
              <h4 className="text-xs font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-2">
                <Timer size={14} /> Time Block
              </h4>
              <label className="flex items-center gap-3 cursor-pointer select-none w-fit">
                <div
                  className={cn(
                    "w-10 h-6 rounded-full relative transition-all duration-300 cursor-pointer",
                    isTimeBlock ? "bg-primary" : "bg-muted border border-border"
                  )}
                  onClick={() => setIsTimeBlock(v => !v)}
                >
                  <div className={cn(
                    "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-300",
                    isTimeBlock ? "left-4.5" : "left-0.5"
                  )} />
                </div>
                <span className="text-sm text-muted-foreground">
                  {isTimeBlock ? "This is a focus block" : "Mark as time block"}
                </span>
              </label>
            </div>

            {/* Location */}
            <div className="p-4 bg-muted/20 border border-border/50 rounded-2xl hover:bg-muted/30 transition-colors space-y-3">
              <h4 className="text-xs font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-2">
                <MapPin size={14} /> Location
              </h4>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Address or place"
                className="w-full bg-background border border-border/50 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/40"
              />
            </div>

            {/* Meeting URL */}
            <div className="p-4 bg-muted/20 border border-border/50 rounded-2xl hover:bg-muted/30 transition-colors space-y-3">
              <h4 className="text-xs font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-2">
                <Video size={14} /> Meeting URL
              </h4>
              <input
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
                placeholder="Zoom, Meet, etc."
                className="w-full bg-background border border-border/50 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/40"
              />
            </div>

            {/* Linked tasks — full width */}
            <div className="p-4 md:col-span-2 bg-muted/20 border border-border/50 rounded-2xl hover:bg-muted/30 transition-colors space-y-3">
              <h4 className="text-xs font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-2">
                <CheckSquare size={14} /> Linked Tasks
                {linkedTasks.length > 0 && (
                  <span className="ml-1 px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[10px]">
                    {linkedTasks.length}
                  </span>
                )}
              </h4>
              <div className="flex flex-wrap gap-2">
                {linkedTasks.map((id) => {
                  const t = tasks.find(x => x.id === id);
                  if (!t) return null;
                  return (
                    <div key={id} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-xs text-primary font-medium">
                      {t.title}
                      <button onClick={() => toggleTask(id)} className="hover:text-destructive transition-colors">
                        <X size={12} />
                      </button>
                    </div>
                  );
                })}
                <select
                  value=""
                  onChange={(e) => { if (e.target.value) toggleTask(e.target.value); e.target.value = ""; }}
                  className="bg-background border border-border/50 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 text-muted-foreground min-w-[160px]"
                >
                  <option value="">+ Link a task…</option>
                  {openTasks.filter(t => !linkedTasks.includes(t.id)).map(t => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </div>
            </div>

          </div>

          {/* Description */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-2">
              <Link2 size={14} /> Notes & Context
            </h4>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add notes, agenda, context, or links…"
              rows={4}
              className="w-full bg-muted/10 border border-border/50 rounded-2xl p-5 text-base text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all resize-none leading-relaxed"
            />
          </div>

        </div>

        {/* ── Footer ─────────────────────────────────────────── */}
        <div className="shrink-0 p-6 border-t border-border/40 bg-card/80 backdrop-blur-md">
          <button
            onClick={() => void handleSubmit()}
            disabled={!title.trim() || isSubmitting}
            className="w-full h-14 bg-primary text-primary-foreground font-bold text-lg rounded-2xl flex items-center justify-center gap-2 shadow-[0_8px_32px_-8px_rgba(var(--primary),0.4)] hover:brightness-110 hover:scale-[1.01] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {isSubmitting ? "Saving…" : editingId ? "Save Changes" : "Create Event"}
            {!isSubmitting && <ArrowRight size={20} />}
          </button>
        </div>

      </div>
    </div>
  );
}
