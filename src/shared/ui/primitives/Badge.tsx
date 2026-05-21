import { cn } from "@/shared/utils";

const STATUS_STYLES: Record<string, string> = {
  todo:        "bg-surface-2 text-muted-foreground border-border/60",
  "in-progress": "bg-blue-500/10 text-blue-600 border-blue-500/20",
  done:        "bg-green-500/10 text-green-700 border-green-500/20",
  cancelled:   "bg-muted text-muted-foreground/60 border-border/40 line-through",
  blocked:     "bg-red-500/10 text-red-600 border-red-500/20",
  backlog:     "bg-surface-2 text-muted-foreground border-border/60",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border uppercase tracking-wide",
        STATUS_STYLES[status] ?? "bg-surface-2 text-muted-foreground border-border/60"
      )}
    >
      {status}
    </span>
  );
}

const PRIORITY_BADGE_STYLES: Record<string, string> = {
  urgent: "bg-red-500/10 text-red-600 border-red-500/20",
  high:   "bg-orange-500/10 text-orange-600 border-orange-500/20",
  medium: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  low:    "bg-blue-400/10 text-blue-500 border-blue-400/20",
  none:   "bg-surface-2 text-muted-foreground border-border/60",
};

export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border",
        PRIORITY_BADGE_STYLES[priority] ?? PRIORITY_BADGE_STYLES.none
      )}
    >
      {priority === "none" ? "No priority" : priority}
    </span>
  );
}

export function TagBadge({ label, color }: { label: string; color?: string }) {
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border bg-surface-2 text-muted-foreground border-border/60"
      style={color ? { borderColor: color + "33", backgroundColor: color + "14", color } : undefined}
    >
      {label}
    </span>
  );
}

export function CountBadge({
  count,
  color = "default",
}: {
  count: number;
  color?: "default" | "red" | "blue" | "yellow";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-semibold tabular-nums",
        color === "red"    && "bg-red-500/10 text-red-500",
        color === "blue"   && "bg-blue-500/10 text-blue-500",
        color === "yellow" && "bg-amber-500/10 text-amber-600",
        color === "default" && "bg-surface-3 text-muted-foreground"
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
