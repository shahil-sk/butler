import { cn } from "@/shared/utils";

export function KpiCard({
  label,
  value,
  sub,
  trend,
  className,
}: {
  label: string;
  value: string | number;
  sub?: string;
  trend?: { value: number; label?: string };
  className?: string;
}) {
  const trendPos = trend && trend.value > 0;
  const trendNeg = trend && trend.value < 0;
  return (
    <div className={cn("flex flex-col gap-0.5 px-4 py-3 rounded-xl bg-surface border border-border/60", className)}>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-xl font-bold tabular-nums text-foreground leading-tight">{value}</span>
      {(sub || trend) && (
        <div className="flex items-center gap-1.5 mt-0.5">
          {trend && (
            <span
              className={cn(
                "text-[10px] font-semibold tabular-nums",
                trendPos && "text-green-600",
                trendNeg && "text-red-500",
                !trendPos && !trendNeg && "text-muted-foreground"
              )}
            >
              {trendPos ? "+" : ""}{trend.value}{trend.label ?? "%"}
            </span>
          )}
          {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
        </div>
      )}
    </div>
  );
}
