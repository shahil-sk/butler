import React from "react";
import { cn } from "@/shared/utils";

type Color = "primary" | "success" | "warning" | "error" | "muted";
type Size  = "sm" | "md" | "lg";

export interface ProgressBarProps {
  value: number;
  max?: number;
  color?: Color;
  size?: Size;
  className?: string;
  showLabel?: boolean;
  label?: string;
}

const COLOR: Record<Color, string> = {
  primary: "bg-primary",
  success: "bg-green-500",
  warning: "bg-yellow-500",
  error:   "bg-red-500",
  muted:   "bg-muted-foreground/40",
};

const HEIGHT: Record<Size, string> = {
  sm: "h-1",
  md: "h-2",
  lg: "h-3",
};

export function ProgressBar({
  value,
  max = 100,
  color = "primary",
  size = "md",
  className,
  showLabel = false,
  label,
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={cn("w-full", className)}>
      {(showLabel || label) && (
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>{label ?? ""}</span>
          <span className="tabular-nums">{Math.round(pct)}%</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        className={cn("w-full rounded-full bg-muted overflow-hidden", HEIGHT[size])}
      >
        <div
          className={cn("h-full rounded-full transition-all duration-300", COLOR[color])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
