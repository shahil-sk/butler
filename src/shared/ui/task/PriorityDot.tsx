import React from "react";
import { cn } from "@/shared/utils";

type Priority = "urgent" | "high" | "medium" | "low" | "none";

export interface PriorityDotProps {
  priority: Priority;
  className?: string;
  size?: number;
}

const COLOR: Record<Priority, string> = {
  urgent: "bg-red-500",
  high:   "bg-orange-500",
  medium: "bg-yellow-500",
  low:    "bg-blue-400",
  none:   "bg-muted-foreground/30",
};

export function PriorityDot({ priority, className, size = 8 }: PriorityDotProps) {
  return (
    <span
      aria-label={`Priority: ${priority}`}
      className={cn("inline-block rounded-full flex-shrink-0", COLOR[priority], className)}
      style={{ width: size, height: size }}
    />
  );
}
