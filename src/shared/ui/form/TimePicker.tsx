import React from "react";
import { cn } from "@/shared/utils";

export interface TimePickerProps {
  value?: string; // HH:MM
  onChange: (time: string) => void;
  label?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function TimePicker({ value, onChange, label, error, disabled, className, id }: TimePickerProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-") ?? "time-picker";
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <input
        id={inputId}
        type="time"
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "rounded-md border border-border bg-background px-3 py-2 text-sm",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
          "disabled:cursor-not-allowed disabled:opacity-50",
          error && "border-destructive",
          className
        )}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
