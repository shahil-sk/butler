// ============================================================
// DateTimePicker — shared component
//
// Renders two clearly-labelled, fully-styled inputs:
//   • A <input type="date"> for the calendar date
//   • A <input type="time"> for the clock time (hidden when timeDisabled)
//
// Value contract: ISO-8601 datetime string ("YYYY-MM-DDTHH:mm")
// or date-only string ("YYYY-MM-DD") when timeDisabled=true.
//
// The component keeps them in sync and calls onChange with a
// fresh ISO string whenever either field changes.
// ============================================================

import { useId } from "react";
import { Calendar, Clock } from "lucide-react";
import { cn } from "@/shared/utils";

interface DateTimePickerProps {
  /** ISO-8601 string: "YYYY-MM-DDTHH:mm" or "YYYY-MM-DD" */
  value: string;
  onChange: (iso: string) => void;
  /** When true only the date field is shown (all-day events, task due dates) */
  timeDisabled?: boolean;
  /** Optional label shown above the fields */
  label?: string;
  className?: string;
  disabled?: boolean;
  /** Minimum selectable date (YYYY-MM-DD) */
  min?: string;
}

function split(iso: string): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  if (iso.includes("T")) {
    const [date, rawTime] = iso.split("T");
    return { date, time: rawTime.slice(0, 5) };
  }
  return { date: iso.slice(0, 10), time: "" };
}

export function DateTimePicker({
  value,
  onChange,
  timeDisabled = false,
  label,
  className,
  disabled = false,
  min,
}: DateTimePickerProps) {
  const id = useId();
  const { date, time } = split(value);

  const handleDateChange = (newDate: string) => {
    if (timeDisabled) {
      onChange(newDate);
    } else {
      const t = time || "00:00";
      onChange(`${newDate}T${t}`);
    }
  };

  const handleTimeChange = (newTime: string) => {
    const d = date || new Date().toISOString().slice(0, 10);
    onChange(`${d}T${newTime}`);
  };

  const inputBase = cn(
    "w-full py-1.5 text-xs rounded-md border border-border",
    "bg-transparent outline-none transition-fast",
    "focus:border-primary focus:ring-1 focus:ring-primary/30",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    "[color-scheme:dark]"
  );

  return (
    <div className={cn("space-y-1", className)}>
      {label && (
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      )}
      <div className="flex gap-1.5">
        {/* Date */}
        <div className="relative flex-1">
          <Calendar
            size={11}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/60 pointer-events-none"
          />
          <input
            id={`${id}-date`}
            type="date"
            value={date}
            min={min}
            disabled={disabled}
            onChange={(e) => handleDateChange(e.target.value)}
            className={cn(inputBase, "pl-6 pr-2")}
          />
        </div>

        {/* Time (hidden for all-day / date-only) */}
        {!timeDisabled && (
          <div className="relative w-[92px] shrink-0">
            <Clock
              size={11}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/60 pointer-events-none"
            />
            <input
              id={`${id}-time`}
              type="time"
              value={time}
              disabled={disabled}
              onChange={(e) => handleTimeChange(e.target.value)}
              className={cn(inputBase, "pl-6 pr-1")}
            />
          </div>
        )}
      </div>
    </div>
  );
}
