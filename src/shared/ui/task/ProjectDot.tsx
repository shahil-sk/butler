import React from "react";
import { cn } from "@/shared/utils";

export interface ProjectDotProps {
  color: string;
  label?: string;
  className?: string;
  size?: number;
}

export function ProjectDot({ color, label, className, size = 8 }: ProjectDotProps) {
  return (
    <span
      aria-label={label ? `Project: ${label}` : "Project color"}
      className={cn("inline-block rounded-full flex-shrink-0", className)}
      style={{ width: size, height: size, backgroundColor: color }}
    />
  );
}
