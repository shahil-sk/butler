// ============================================================
// SHARED UI PRIMITIVES — import from @/shared/ui
// ============================================================

import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/shared/utils";

// ── Modal (centered popup) ────────────────────────────────────
// Replaces slide panels. Renders into document.body via portal
// so it always sits above everything.

export function Modal({
  open,
  onClose,
  children,
  maxWidth = "max-w-[580px]",
  maxHeight = "max-h-[92dvh]",
  className,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
  maxHeight?: string;
  className?: string;
}) {
  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[3px] animate-fade-in"
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className={cn(
          "relative z-10 w-full flex flex-col",
          "bg-background border border-border rounded-2xl shadow-xl",
          "animate-modal-in overflow-hidden",
          maxWidth, maxHeight,
          className
        )}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

// ── Popover (fixed-positioned dropdown that never clips) ──────
// Renders into body portal. Aligns to an anchor ref.
// Usage:
//   const anchorRef = useRef<HTMLButtonElement>(null);
//   <button ref={anchorRef} onClick={() => setOpen(true)} />
//   <Popover anchor={anchorRef} open={open} onClose={() => setOpen(false)}>
//     ...menu items...
//   </Popover>

export function Popover({
  anchor,
  open,
  onClose,
  children,
  align = "left",
  side = "bottom",
  className,
}: {
  anchor: React.RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  align?: "left" | "right";
  side?: "bottom" | "top";
  className?: string;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!open || !anchor.current) return;
    const rect = anchor.current.getBoundingClientRect();
    const GAP  = 6;
    const newStyle: React.CSSProperties = {};

    // Horizontal alignment
    if (align === "right") {
      newStyle.right = window.innerWidth - rect.right;
    } else {
      newStyle.left = rect.left;
    }

    // Vertical — flip to top if not enough room below
    const spaceBelow = window.innerHeight - rect.bottom;
    const popH = popoverRef.current?.offsetHeight ?? 240;
    if (side === "top" || (spaceBelow < popH + GAP && rect.top > popH + GAP)) {
      newStyle.bottom = window.innerHeight - rect.top + GAP;
    } else {
      newStyle.top = rect.bottom + GAP;
    }

    setStyle(newStyle);
  }, [open, anchor, align, side]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9998]" onClick={onClose} />
      <div
        ref={popoverRef}
        className={cn(
          "fixed z-[9999] min-w-[160px] rounded-xl border border-border bg-popover",
          "shadow-[0_8px_30px_-4px_rgb(0_0_0/0.14),0_2px_8px_-1px_rgb(0_0_0/0.07),0_0_0_1px_rgb(0_0_0/0.05)]",
          "py-1.5 animate-fade-in",
          className
        )}
        style={style}
      >
        {children}
      </div>
    </>,
    document.body
  );
}

// ── PopoverItem ───────────────────────────────────────────────

export function PopoverItem({
  children,
  onClick,
  danger,
  icon: Icon,
  active,
}: {
  children: ReactNode;
  onClick: () => void;
  danger?: boolean;
  icon?: React.ElementType;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-[7px] text-xs text-left transition-colors duration-100",
        danger
          ? "text-red-500 hover:bg-red-500/10"
          : active
            ? "text-primary bg-primary/6"
            : "text-foreground/80 hover:bg-accent hover:text-foreground"
      )}
    >
      {Icon && <Icon size={12} className="shrink-0 opacity-70" />}
      <span className="flex-1">{children}</span>
      {active && <span className="text-primary opacity-60 text-[11px]">✓</span>}
    </button>
  );
}

// ── PopoverDivider ────────────────────────────────────────────

export function PopoverDivider() {
  return <div className="my-1 mx-2 h-px bg-border/60" />;
}

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
