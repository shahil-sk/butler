import { cn } from "@/shared/utils";

export interface SubNavItem {
  id: string;
  label: string;
  icon?: React.ElementType;
  badge?: number;
  badgeColor?: "red" | "blue" | "yellow";
}

export function SubNav({
  items,
  activeId,
  onSelect,
}: {
  items: SubNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <nav className="w-[140px] shrink-0 border-r border-border px-1.5 py-2 space-y-px overflow-y-auto">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={cn(
              "w-full flex items-center gap-1.5 px-2.5 py-[6px] rounded-md text-xs text-left transition-fast",
              activeId === item.id
                ? "bg-primary/[0.08] text-primary font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
          >
            {Icon && <Icon size={12} className="shrink-0" />}
            <span className="flex-1 truncate">{item.label}</span>
            {item.badge != null && item.badge > 0 && (
              <span
                className={cn(
                  "inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-semibold tabular-nums",
                  item.badgeColor === "red"    && "bg-red-500/10 text-red-500",
                  item.badgeColor === "blue"   && "bg-blue-500/10 text-blue-500",
                  item.badgeColor === "yellow" && "bg-amber-500/10 text-amber-600",
                  !item.badgeColor             && "bg-surface-3 text-muted-foreground"
                )}
              >
                {item.badge > 99 ? "99+" : item.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
