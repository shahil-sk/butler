import { ChevronDown } from "lucide-react";
import { cn } from "@/shared/utils";
import type { TaskStatus } from "@/shared/types";

// ─── constants ───────────────────────────────────────────────

export const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "todo",        label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done",        label: "Done" },
  { value: "cancelled",   label: "Cancelled" },
];

// ─── MetaPill ────────────────────────────────────────────────

export function MetaPill({
  icon,
  label,
  btnRef,
  onClick,
  active,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  btnRef?: React.RefObject<HTMLButtonElement>;
  onClick?: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      ref={onClick ? btnRef as React.RefObject<HTMLButtonElement> : undefined}
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-fast min-w-0",
        onClick && "cursor-pointer",
        active
          ? "border-primary/40 bg-primary/6 text-foreground"
          : "border-border bg-muted/30 text-muted-foreground hover:border-border hover:bg-accent hover:text-foreground",
      )}
    >
      <span className="shrink-0 opacity-60">{icon}</span>
      <span className="truncate">{children}</span>
      {onClick && <ChevronDown size={10} className="shrink-0 opacity-40 ml-auto" />}
    </Tag>
  );
}

// ─── StatusChip ──────────────────────────────────────────────

export function StatusChip({
  status,
  btnRef,
  onClick,
}: {
  status: TaskStatus;
  btnRef: React.RefObject<HTMLButtonElement>;
  onClick: () => void;
}) {
  return (
    <button
      ref={btnRef}
      onClick={onClick}
      aria-label={`Status: ${STATUS_OPTIONS.find((o) => o.value === status)?.label ?? "To do"}. Click to change.`}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-semibold transition-fast",
        status === "done"        && "border-emerald-500/30 bg-emerald-500/8  text-emerald-600 dark:text-emerald-400",
        status === "in_progress" && "border-blue-500/30   bg-blue-500/8     text-blue-600    dark:text-blue-400",
        status === "cancelled"   && "border-border        bg-muted/30       text-muted-foreground/50 line-through",
        status === "todo"        && "border-border        bg-muted/30       text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full shrink-0",
          status === "done"        && "bg-emerald-500",
          status === "in_progress" && "bg-blue-500",
          status === "cancelled"   && "bg-muted-foreground/30",
          status === "todo"        && "bg-muted-foreground/50",
        )}
      />
      {STATUS_OPTIONS.find((o) => o.value === status)?.label ?? "To do"}
      <ChevronDown size={9} className="opacity-40" />
    </button>
  );
}
