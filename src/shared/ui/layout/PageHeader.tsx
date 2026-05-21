import { type ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/shared/utils";

export function PageHeader({
  title,
  subtitle,
  count,
  onBack,
  children,
}: {
  title: string;
  subtitle?: string;
  count?: number;
  onBack?: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 px-4 h-[46px] border-b border-border bg-background shrink-0">
      {onBack && (
        <button
          onClick={onBack}
          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-fast -ml-1"
          aria-label="Go back"
        >
          <ChevronLeft size={14} />
        </button>
      )}
      <div className="flex flex-col justify-center min-w-0">
        <h1 className={cn("text-sm font-semibold tracking-tight text-foreground truncate", subtitle && "leading-tight")}>
          {title}
        </h1>
        {subtitle && (
          <p className="text-[10px] text-muted-foreground leading-tight truncate">{subtitle}</p>
        )}
      </div>
      {count != null && (
        <span className="text-xs text-muted-foreground tabular-nums font-medium bg-surface-2 px-1.5 py-0.5 rounded-md shrink-0">
          {count}
        </span>
      )}
      <div className="flex-1" />
      {children && (
        <div className="flex items-center gap-1">{children}</div>
      )}
    </div>
  );
}
