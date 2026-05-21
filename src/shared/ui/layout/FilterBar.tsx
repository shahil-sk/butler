import { cn } from "@/shared/utils";

export interface FilterTab {
  id: string;
  label: string;
  count?: number;
}

export function FilterBar({
  tabs,
  activeId,
  onSelect,
  className,
}: {
  tabs: FilterTab[];
  activeId: string;
  onSelect: (id: string) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-0.5 px-3 py-1.5 border-b border-border bg-background shrink-0 overflow-x-auto",
        className
      )}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onSelect(tab.id)}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs whitespace-nowrap transition-fast",
            activeId === tab.id
              ? "bg-primary/[0.08] text-primary font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-accent"
          )}
        >
          {tab.label}
          {tab.count != null && (
            <span className="text-[10px] text-muted-foreground/50 tabular-nums font-medium">
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
