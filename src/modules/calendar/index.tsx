// @ts-nocheck
// ============================================================
// CALENDAR — Module root  (v3 enhanced)
// New in this revision:
//   - JumpToDate overlay (Cmd/Ctrl+G)
//   - MiniAgendaSidebar on month view
//   - Deadline dots on month cells (via task store)
//   - Event colour-picker in toolbar area shortcut
// ============================================================

import { useEffect, useState } from "react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  format, parseISO,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Calendar, Layers, Search } from "lucide-react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef } from "react";
import { cn } from "@/shared/utils";
import { useCalendarStore } from "./store";
import { MonthGrid }          from "./components/MonthGrid";
import { WeekView }           from "./WeekView";
import { DayView }            from "./DayView";
import { AgendaView }         from "./AgendaView";
import { EventForm }          from "./EventForm";
import { MiniAgendaSidebar }  from "./MiniAgendaSidebar";
import { JumpToDateOverlay, useJumpToDate } from "./JumpToDate";
import { bus }                from "@/kernel/event-bus";
import { useTaskStore }       from "@/modules/tasks/store";
const loadNotes = () => {};

const VIEW_LABELS = { month: "Month", week: "Week", day: "Day", agenda: "Agenda" } as const;

function CalendarHeroHeader({ anchor, eventsCount }: { anchor: Date, eventsCount: number }) {
  const container = useRef<HTMLDivElement>(null);
  
  useGSAP(() => {
    gsap.from(".hero-text", {
      y: 30,
      opacity: 0,
      duration: 1,
      stagger: 0.1,
      ease: "power4.out"
    });
  }, { scope: container });

  return (
    <div ref={container} className="relative w-full px-4 md:px-8 mx-auto pt-4 pb-4 flex flex-col items-center text-center shrink-0">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/20 blur-[120px] rounded-full pointer-events-none -z-10" />
      

      
      <h1 className="hero-text text-3xl md:text-5xl font-black tracking-tighter leading-[0.9] text-foreground w-full mx-auto flex flex-wrap justify-center items-center gap-x-4 gap-y-2">
        <span>You have</span>
        <span className="relative inline-block px-4 py-1 bg-primary text-primary-foreground rounded-full -rotate-2 transform hover:rotate-0 transition-transform duration-500 shadow-xl">
          {eventsCount} events
        </span>
        <span>this {format(anchor, "MMMM")}.</span>
      </h1>
    </div>
  );
}

export function CalendarModule() {
  const {
    view, activeDate, showProjectsLayer, contextMenu,
    loadCalendars, loadEvents,
    setView, goNext, goPrev, goToday,
    openEventForm, setShowProjectsLayer, closeContextMenu, deleteEvent
  } = useCalendarStore();

  const loadTasks = useTaskStore((s) => s.loadTasks);
  
  const { open: jumpOpen, setOpen: setJumpOpen } = useJumpToDate();

  const anchor = parseISO(activeDate);
  const from   = startOfMonth(startOfWeek(anchor, { weekStartsOn: 1 }));
  const to     = endOfMonth(endOfWeek(anchor, { weekStartsOn: 1 }));

  useEffect(() => {
    void loadCalendars();
    void (loadTasks as (() => Promise<void>) | undefined)?.();
    void (loadNotes as (() => Promise<void>) | undefined)?.();
  }, []);

  useEffect(() => {
    void loadEvents(from.toISOString(), to.toISOString());
  }, [activeDate, view]);

  useEffect(() => {
    const unsubs = [
      bus.on("task:created",  () => void (loadTasks as any)?.()),
      bus.on("task:updated",  () => void (loadTasks as any)?.()),
      bus.on("task:deleted",  () => void (loadTasks as any)?.()),
      bus.on("note:created",  () => void (loadNotes as any)?.()),
      bus.on("note:updated",  () => void (loadNotes as any)?.()),
      bus.on("note:deleted",  () => void (loadNotes as any)?.()),
      bus.on("calendar:open-for-date", ({ date }: { date: string }) => {
        useCalendarStore.getState().setActiveDate(date);
        useCalendarStore.getState().setView("day");
        openEventForm({ startAt: `${date}T09:00:00`, endAt: `${date}T10:00:00` });
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const headerLabel = (() => {
    if (view === "month") return format(anchor, "MMMM yyyy");
    if (view === "week") {
      const ws = startOfWeek(anchor, { weekStartsOn: 1 });
      const we = endOfWeek(anchor, { weekStartsOn: 1 });
      return `${format(ws, "MMM d")} \u2013 ${format(we, "MMM d, yyyy")}`;
    }
    if (view === "day") return format(anchor, "EEEE, MMMM d, yyyy");
    return format(anchor, "MMMM yyyy");
  })();

  const allEvents = useCalendarStore(s => s.events);
  const eventsCount = allEvents.filter(e => e.startAt >= from.toISOString() && e.startAt <= to.toISOString()).length;

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden relative">

      {/* Glassmorphism Toolbar (View Selector) at the very top */}
      <div className="sticky top-6 mx-auto w-fit z-[80] flex items-center gap-2 p-2 bg-card/70 backdrop-blur-xl border border-border/50 rounded-full shadow-2xl mb-8">
          <div className="flex items-center gap-1 pl-2">
            <button onClick={goPrev} className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-fast" aria-label="Previous">
              <ChevronLeft size={16} />
            </button>
            <button onClick={goNext} className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-fast" aria-label="Next">
              <ChevronRight size={16} />
            </button>
          </div>

          <h2 onClick={goToday} className="text-sm font-semibold hover:text-primary transition-colors hover:cursor-pointer min-w-[120px] text-center">
            {headerLabel}
          </h2>
          
          <div className="w-[1px] h-6 bg-border/60 mx-1" />

          {/* Jump-to-date button */}
          <button
            onClick={() => setJumpOpen(true)}
            title="Jump to date (Ctrl+G)"
            className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-fast"
            aria-label="Jump to date"
          >
            <Search size={16} />
          </button>

          <div className="w-[1px] h-6 bg-border/60 mx-1" />

          {(Object.keys(VIEW_LABELS) as (keyof typeof VIEW_LABELS)[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all",
                view === v
                  ? "bg-foreground text-background shadow-md"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}

          <div className="w-[1px] h-6 bg-border/60 mx-1" />

          <button
            onClick={() => setShowProjectsLayer(!showProjectsLayer)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all",
              showProjectsLayer 
                ? "bg-indigo-500/10 text-indigo-500"
                : "text-muted-foreground hover:bg-muted"
            )}
            title="Toggle Projects layer (milestones)"
          >
            <Layers size={16} />
            Projects
          </button>
        </div>
      
      {/* Hero Header */}
      <CalendarHeroHeader anchor={anchor} eventsCount={eventsCount} />

      {/* Floating Action CTA */}
      <button 
        onClick={() => openEventForm({ startAt: `${activeDate}T09:00:00`, endAt: `${activeDate}T10:00:00` })}
        className="fixed bottom-8 right-8 z-[90] w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-[0_8px_40px_-12px_rgba(0,0,0,0.5)] flex items-center justify-center hover:scale-110 active:scale-95 transition-all duration-300"
        title="New Event"
      >
        <Plus size={28} />
      </button>


      {/* Main content area */}
      <div className="flex flex-col flex-1 min-h-0 w-full mx-auto animate-slide-in" style={{ animationDelay: '400ms', animationFillMode: 'both' }}>
        <div className="flex flex-1 border-t border-border/50 bg-card/30 backdrop-blur-xl overflow-hidden relative">
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden bg-background/50">
            {(view === "month" || view === "week") && (
              <div className="grid grid-cols-7 border-b border-border/50 shrink-0 bg-muted/20">
                {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((d) => (
                  <div key={d} className="py-3 text-center text-xs font-bold tracking-widest uppercase text-muted-foreground/70">{d}</div>
                ))}
              </div>
            )}

            {view === "month"  && <MonthGrid />}
            {view === "week"   && <WeekView />}
            {view === "day"    && <DayView />}
            {view === "agenda" && <AgendaView />}
          </div>

          {/* Mini agenda sidebar — only on month view */}
          {view === "month" && <MiniAgendaSidebar />}
        </div>
      </div>

      <EventForm />

      {/* Jump-to-date overlay */}
      {jumpOpen && <JumpToDateOverlay onClose={() => setJumpOpen(false)} />}
      {/* Context Menu Overlay */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={closeContextMenu}
            onContextMenu={(e) => { e.preventDefault(); closeContextMenu(); }}
          />
          <div
            className="fixed z-50 bg-popover border border-border rounded-md shadow-md text-sm py-1 min-w-[160px] animate-in fade-in zoom-in-95 duration-100"
            style={{
              left: Math.min(contextMenu.x, window.innerWidth - 170),
              top: Math.min(contextMenu.y, window.innerHeight - 100)
            }}
          >
            <button
              className="w-full text-left px-3 py-1.5 hover:bg-accent text-foreground transition-fast flex items-center gap-2 text-[13px]"
              onClick={async () => {
                const { event } = contextMenu;
                closeContextMenu();
                if (event.id.startsWith("task:")) return;
                
                const start = new Date(event.startAt).getTime();
                const end = new Date(event.endAt).getTime();
                const durationMins = Math.max((end - start) / 60000, 15);
                
                await useTaskStore.getState().createTask({
                  title: event.title,
                  description: event.description,
                  scheduledDate: event.startAt.slice(0, 10),
                  scheduledAt: event.startAt,
                  scheduledDuration: durationMins,
                });
                await deleteEvent(event.id);
              }}
            >
              Convert to Task
            </button>
          </div>
        </>
      )}
    </div>
  );
}
