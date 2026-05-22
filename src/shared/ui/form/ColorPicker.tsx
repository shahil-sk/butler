import React from "react";
import { cn } from "@/shared/utils";

const DEFAULT_SWATCHES = [
  "#3b82f6", "#8b5cf6", "#10b981", "#f59e0b",
  "#ef4444", "#ec4899", "#06b6d4", "#6b7280",
  "#f97316", "#84cc16", "#14b8a6", "#a855f7",
];

export interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  swatches?: string[];
  label?: string;
  className?: string;
}

export function ColorPicker({ value, onChange, swatches = DEFAULT_SWATCHES, label, className }: ColorPickerProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label && <span className="text-sm font-medium text-foreground">{label}</span>}
      <div className="flex flex-wrap gap-2">
        {swatches.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`Select color ${color}`}
            onClick={() => onChange(color)}
            style={{ backgroundColor: color }}
            className={cn(
              "w-7 h-7 rounded-full border-2 transition-transform hover:scale-110",
              value === color ? "border-foreground scale-110" : "border-transparent"
            )}
          />
        ))}
      </div>
    </div>
  );
}
