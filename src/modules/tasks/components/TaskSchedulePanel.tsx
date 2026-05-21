import { X, CalendarClock } from "lucide-react";

export function TaskSchedulePanel({
  isCreating,
  scheduleDate, scheduleTime,
  scheduledDate, scheduledTime,
  taskScheduledDate,
  onDateChange, onTimeChange,
  onClose, onConfirm, onClearExisting,
}: {
  isCreating: boolean;
  scheduleDate: string; scheduleTime: string;
  scheduledDate?: string; scheduledTime?: string;
  taskScheduledDate?: string;
  onDateChange: (v: string) => void;
  onTimeChange: (v: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  onClearExisting: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      />
      <div className="relative z-10 bg-popover border border-border rounded-2xl shadow-2xl p-5 w-80 animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold">
            {isCreating ? "Schedule task" : "Schedule to calendar"}
          </p>
          <button
            onClick={onClose}
            className="p-1 rounded text-muted-foreground hover:text-foreground transition-fast"
          >
            <X size={13} />
          </button>
        </div>

        {/* existing badge */}
        {!isCreating && taskScheduledDate && (
          <div className="flex items-center gap-2 mb-3 px-2.5 py-2 rounded-lg bg-primary/8 text-primary text-xs font-medium">
            <CalendarClock size={12} />
            <span className="flex-1">Scheduled: {taskScheduledDate}</span>
            <button onClick={onClearExisting} className="text-muted-foreground hover:text-red-500 transition-fast">
              <X size={11} />
            </button>
          </div>
        )}
        {isCreating && scheduledDate && (
          <div className="flex items-center gap-2 mb-3 px-2.5 py-2 rounded-lg bg-primary/8 text-primary text-xs font-medium">
            <CalendarClock size={12} />
            <span className="flex-1">{scheduledDate} · {scheduledTime ?? "09:00"}</span>
            <button onClick={onClearExisting} className="text-muted-foreground hover:text-red-500 transition-fast">
              <X size={11} />
            </button>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-[11px] text-muted-foreground mb-1">Date</label>
            <input
              type="date"
              value={scheduleDate}
              min={new Date().toISOString().split("T")[0]}
              onChange={(e) => onDateChange(e.target.value)}
              className="w-full text-sm bg-muted/40 rounded-lg px-3 py-2 outline-none border border-border focus:border-primary/50"
            />
          </div>
          <div>
            <label className="block text-[11px] text-muted-foreground mb-1">Time</label>
            <input
              type="time"
              value={scheduleTime}
              onChange={(e) => onTimeChange(e.target.value)}
              className="w-full text-sm bg-muted/40 rounded-lg px-3 py-2 outline-none border border-border focus:border-primary/50"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={onClose}
            className="flex-1 px-3 py-2 rounded-lg text-xs border border-border text-muted-foreground hover:bg-accent transition-fast"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-3 py-2 rounded-lg text-xs bg-primary text-primary-foreground hover:bg-primary/90 font-semibold transition-fast"
          >
            {isCreating ? "Set schedule" : "Add to calendar"}
          </button>
        </div>
      </div>
    </div>
  );
}
