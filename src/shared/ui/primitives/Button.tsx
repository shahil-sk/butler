import { type ReactNode } from "react";
import { cn } from "@/shared/utils";

export function PrimaryButton({
  onClick,
  children,
  disabled,
  type = "button",
}: {
  onClick?: () => void;
  children: ReactNode;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium shrink-0 transition-fast",
        "bg-primary text-primary-foreground",
        "hover:opacity-90 active:scale-[0.98]",
        "disabled:opacity-40 disabled:pointer-events-none",
        "shadow-sm"
      )}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  onClick,
  children,
  danger,
  title,
  disabled,
}: {
  onClick?: () => void;
  children: ReactNode;
  danger?: boolean;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={cn(
        "flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs transition-fast",
        danger
          ? "text-red-500 hover:bg-red-500/8 hover:text-red-600"
          : "text-muted-foreground hover:text-foreground hover:bg-accent",
        "disabled:opacity-40 disabled:pointer-events-none"
      )}
    >
      {children}
    </button>
  );
}

export function IconButton({
  onClick,
  children,
  title,
  danger,
  active,
  disabled,
}: {
  onClick?: () => void;
  children: ReactNode;
  title?: string;
  danger?: boolean;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      aria-label={title}
      className={cn(
        "p-1.5 rounded-md transition-fast flex items-center justify-center",
        danger
          ? "text-red-500 hover:bg-red-500/10"
          : active
          ? "text-primary bg-primary/10"
          : "text-muted-foreground hover:text-foreground hover:bg-accent",
        "disabled:opacity-40 disabled:pointer-events-none"
      )}
    >
      {children}
    </button>
  );
}

export function DangerButton({
  onClick,
  children,
  disabled,
}: {
  onClick?: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium shrink-0 transition-fast",
        "bg-destructive text-destructive-foreground",
        "hover:opacity-90 active:scale-[0.98]",
        "disabled:opacity-40 disabled:pointer-events-none",
        "shadow-sm"
      )}
    >
      {children}
    </button>
  );
}
