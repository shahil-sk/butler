import { type ReactNode } from "react";
import { cn } from "@/shared/utils";

/** Sidebar / inset surface — sits inside a layout region, not a floating overlay. */
export function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col bg-surface border-r border-border overflow-hidden",
        className
      )}
    >
      {children}
    </div>
  );
}
