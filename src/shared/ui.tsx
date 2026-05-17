// ============================================================
// SHARED UI PRIMITIVES — import from @/shared/ui
// ============================================================

import { type ReactNode } from "react";
import { cn } from "@/shared/utils";

// ── PageHeader ───────────────────────────────────────────────

export function PageHeader({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 px-4 h-[46px] border-b border-border bg-background shrink-0">
      <h1 className="text-sm font-semibold tracking-tight text-foreground">{title}</h1>
      {count != null && (
        <span className="text-xs text-muted-foreground tabular-nums font-medium bg-surface-2 px-1.5 py-0.5 rounded-md">
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

// ── SubNav ───────────────────────────────────────────────────

export interface SubNavItem {
  id: string;
  label: string;
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
      {items.map((item) => (
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
          <span className="flex-1 truncate-1">{item.label}</span>
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
      ))}
    </nav>
  );
}

// ── FilterBar ────────────────────────────────────────────────

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

// ── ToolbarSeparator ─────────────────────────────────────────

export function ToolbarSeparator() {
  return <div className="w-px h-3.5 bg-border mx-0.5 shrink-0" />;
}

// ── ViewSwitcher ─────────────────────────────────────────────

export interface ViewOption<T extends string> {
  value: T;
  icon: React.ElementType;
  label: string;
}

export function ViewSwitcher<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ViewOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-surface-2 border border-border/60 shrink-0">
      {options.map(({ value: v, icon: Icon, label }) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          title={label}
          className={cn(
            "p-1.5 rounded transition-fast",
            value === v
              ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Icon size={12} />
        </button>
      ))}
    </div>
  );
}

// ── PrimaryButton ────────────────────────────────────────────

export function PrimaryButton({
  onClick,
  children,
  disabled,
}: {
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
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

// ── GhostButton ──────────────────────────────────────────────

export function GhostButton({
  onClick,
  children,
  danger,
  title,
}: {
  onClick: () => void;
  children: ReactNode;
  danger?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs transition-fast",
        danger
          ? "text-red-500 hover:bg-red-500/8 hover:text-red-600"
          : "text-muted-foreground hover:text-foreground hover:bg-accent"
      )}
    >
      {children}
    </button>
  );
}

// ── EmptyState ───────────────────────────────────────────────

export function EmptyState({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-1.5 text-center px-8 py-16">
      <p className="text-sm font-medium text-foreground tracking-tight">{title}</p>
      {subtitle && (
        <p className="text-xs text-muted-foreground max-w-[220px] leading-relaxed">{subtitle}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-3 px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-fast"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// ── ProjectDot ───────────────────────────────────────────────

export function ProjectDot({
  color,
  size = 8,
  title,
}: {
  color: string;
  size?: number;
  title?: string;
}) {
  return (
    <span
      className="shrink-0 rounded-full inline-block ring-1 ring-black/10"
      style={{ width: size, height: size, backgroundColor: color }}
      title={title}
    />
  );
}

// ── PriorityDot ──────────────────────────────────────────────

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#ef4444",
  high:   "#f97316",
  medium: "#eab308",
  low:    "#60a5fa",
  none:   "transparent",
};

export function PriorityDot({ priority }: { priority: string }) {
  if (priority === "none") return null;
  return (
    <span
      className="shrink-0 rounded-full inline-block"
      style={{ width: 6, height: 6, backgroundColor: PRIORITY_COLORS[priority] }}
      title={priority}
    />
  );
}

// ── SectionLabel ─────────────────────────────────────────────

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50 select-none">
      {children}
    </p>
  );
}
