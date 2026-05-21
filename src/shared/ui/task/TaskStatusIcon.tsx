import React from "react";
import { cn } from "@/shared/utils";

type Status = "todo" | "in-progress" | "done" | "cancelled" | "archived";

export interface TaskStatusIconProps {
  status: Status;
  className?: string;
  size?: number;
}

export function TaskStatusIcon({ status, className, size = 16 }: TaskStatusIconProps) {
  if (status === "done") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={cn("text-green-500", className)}>
        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
        <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (status === "cancelled") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={cn("text-muted-foreground", className)}>
        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
        <path d="M5.5 10.5l5-5M10.5 10.5l-5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (status === "in-progress") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={cn("text-blue-500", className)}>
        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" />
        <circle cx="8" cy="8" r="3" fill="currentColor" />
      </svg>
    );
  }
  // todo / archived
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={cn("text-muted-foreground", className)}>
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
