import { useState, useRef } from "react";
import { useTaskStore } from "@/modules/tasks/store";
import { useCalendarStore } from "@/modules/calendar/store";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { X, Calendar as CalIcon, Clock, CheckSquare, Trash2, ArrowRight } from "lucide-react";
import { cn, today } from "@/shared/utils";
import { format, parseISO } from "date-fns";
import { bus } from "@/kernel/event-bus";

export function TriageModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { tasks, updateTask } = useTaskStore();
  const { events } = useCalendarStore();
  
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const tDay = today();

  const overdueTasks = tasks.filter(t => {
    if (t.status === "done" || t.status === "archived" || t.status === "cancelled") return false;
    const date = t.scheduledAt || t.scheduledDate || t.dueDate;
    if (!date) return false;
    return date.slice(0, 10) < tDay;
  }).sort((a, b) => {
    const dA = a.scheduledAt || a.scheduledDate || a.dueDate || "";
    const dB = b.scheduledAt || b.scheduledDate || b.dueDate || "";
    return dA.localeCompare(dB);
  });

  useGSAP(() => {
    if (isOpen && panelRef.current && overlayRef.current) {
      gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power2.out" });
      gsap.fromTo(panelRef.current, 
        { y: 40, opacity: 0, scale: 0.95 }, 
        { y: 0, opacity: 1, scale: 1, duration: 0.4, ease: "back.out(1.1)" }
      );
    }
  }, [isOpen]);

  const handleClose = () => {
    if (panelRef.current && overlayRef.current) {
      gsap.to(overlayRef.current, { opacity: 0, duration: 0.2 });
      gsap.to(panelRef.current, { 
        y: 20, opacity: 0, scale: 0.95, duration: 0.2, ease: "power2.in",
        onComplete: onClose
      });
    } else {
      onClose();
    }
  };

  const pushToToday = (taskId: string) => {
    updateTask(taskId, { scheduledDate: tDay, scheduledAt: undefined });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-8">
      <div 
        ref={overlayRef}
        onClick={handleClose}
        className="absolute inset-0 bg-background/80 backdrop-blur-xl"
      />
      <div 
        ref={panelRef}
        className="relative w-full max-w-2xl max-h-[85vh] bg-card border border-border/50 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
      >
        <div className="flex-none p-6 border-b border-border/40 flex items-center justify-between bg-card/80 backdrop-blur-xl z-10">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
              Triage
              {overdueTasks.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 text-xs tracking-widest uppercase font-bold">
                  {overdueTasks.length} Missed
                </span>
              )}
            </h2>
            <p className="text-sm text-muted-foreground font-medium">Review and reschedule your missed items.</p>
          </div>
          <button onClick={handleClose} className="p-2 text-muted-foreground hover:bg-muted rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {overdueTasks.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground font-medium">
              You're all caught up! No overdue tasks.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {overdueTasks.map(t => {
                const date = t.scheduledAt || t.scheduledDate || t.dueDate;
                const formattedDate = date ? format(parseISO(date), "MMM do") : "Past";
                return (
                  <div key={t.id} className="group p-4 bg-background border border-border/50 hover:border-red-500/30 rounded-2xl flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between transition-all">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
                        <CalIcon size={14} strokeWidth={3} />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-sm text-foreground truncate cursor-pointer hover:underline" onClick={() => { handleClose(); bus.emit("task:open", { taskId: t.id }); }}>
                          {t.title}
                        </span>
                        <span className="text-xs font-semibold text-red-400 tracking-wider uppercase">
                          Due {formattedDate}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                      <button 
                        onClick={() => pushToToday(t.id)}
                        className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary font-bold text-xs transition-colors hover:text-primary-foreground flex items-center justify-center gap-1.5"
                      >
                        <ArrowRight size={14} /> Today
                      </button>
                      <button 
                        onClick={() => updateTask(t.id, { status: "done" })}
                        className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-500 transition-colors"
                        title="Mark Done"
                      >
                        <CheckSquare size={16} />
                      </button>
                      <button 
                        onClick={() => updateTask(t.id, { status: "cancelled" })}
                        className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors"
                        title="Ditch (Cancel)"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
