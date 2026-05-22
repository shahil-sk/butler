import React from "react";
import { cn } from "@/shared/utils";

export interface DatePickerProps {
  value?: string; // ISO date YYYY-MM-DD
  onChange: (date: string) => void;
  label?: string;
  error?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function DatePicker({ value, onChange, label, error, min, max, disabled, className, id }: DatePickerProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-") ?? "date-picker";
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <input
        id={inputId}
        type="date"
        value={value ?? ""}
        min={min}
        max={max}
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
