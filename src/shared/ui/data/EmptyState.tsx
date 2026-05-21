import React from "react";
import { cn } from "@/shared/utils";

/** Object shorthand callers can pass instead of a full ReactNode. */
interface ActionObject {
  label: string;
  onClick: () => void;
}

export interface EmptyStateProps {
  title: string;
  /** Primary description text. */
  description?: string;
  /** Alias for description — accepted for backwards-compat. */
  subtitle?: string;
  icon?: React.ReactNode;
  /**
   * Either a ReactNode OR a plain `{ label, onClick }` object.
   * Both forms are accepted so callers don't need updating.
   */
  action?: React.ReactNode | ActionObject;
  className?: string;
}

function isActionObject(v: unknown): v is ActionObject {
  return typeof v === "object" && v !== null && "label" in v && "onClick" in v;
}

export function EmptyState({ title, description, subtitle, icon, action, className }: EmptyStateProps) {
  const desc = description ?? subtitle;

  const actionNode: React.ReactNode = isActionObject(action) ? (
    <button
      type="button"
      onClick={action.onClick}
      className="mt-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
    >
      {action.label}
    </button>
  ) : action as React.ReactNode;

  return (
    <div className={cn("flex flex-col items-center justify-center text-center px-8 py-16 gap-4", className)}>
      {icon && <div className="text-muted-foreground/40 mb-2">{icon}</div>}
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {desc && <p className="text-xs text-muted-foreground max-w-xs">{desc}</p>}
      </div>
      {actionNode && <div className="mt-2">{actionNode}</div>}
    </div>
  );
}
