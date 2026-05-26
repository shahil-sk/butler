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
        className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      {/* Outer Shell (Double-Bezel) */}
      <div
        className={cn(
          "relative z-10 w-full p-1.5 bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-[2rem] shadow-premium animate-modal-in flex flex-col",
          maxWidth, maxHeight,
          className
        )}
      >
        {/* Inner Core */}
        <div className="flex-1 flex flex-col bg-background rounded-[calc(2rem-0.375rem)] overflow-hidden shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
          {children}
        </div>
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
          "fixed z-[9999] min-w-[160px] rounded-xl py-1.5 backdrop-blur-xl border animate-fade-in",
          "bg-popover/85 dark:bg-popover/75 border-black/10 dark:border-white/8",
          "shadow-premium",
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
    <div className="flex items-center gap-2 px-6 h-12 border-b border-border/40 bg-background/80 backdrop-blur-md shrink-0">
      <h1 className="text-[13px] font-semibold tracking-tight text-foreground/90 uppercase tracking-wider">{title}</h1>
      {count != null && (
        <span className="text-[10px] text-muted-foreground/80 tabular-nums font-semibold bg-surface-2 px-1.5 py-0.5 rounded-full border border-border/40">
          {count}
        </span>
      )}
      <div className="flex-1" />
      {children && (
        <div className="flex items-center gap-1.5">{children}</div>
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
    <nav className="w-[140px] shrink-0 border-r border-border/30 px-2 py-3 space-y-0.5 overflow-y-auto bg-surface-0/20">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onSelect(item.id)}
          className={cn(
            "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left transition-all duration-300 ease-spring active:scale-[0.97]",
            activeId === item.id
              ? "bg-primary/10 text-primary font-semibold shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
          )}
        >
          <span className="flex-1 truncate-1">{item.label}</span>
          {item.badge != null && item.badge > 0 && (
            <span
              className={cn(
                "inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold tabular-nums",
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
        "flex items-center gap-1 px-4 py-2 border-b border-border/30 bg-background/50 backdrop-blur-xs shrink-0 overflow-x-auto",
        className
      )}
    >
      <div className="flex items-center gap-0.5 p-0.5 bg-muted/40 dark:bg-muted/20 rounded-full border border-border/20">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] whitespace-nowrap transition-all duration-300 ease-spring active:scale-[0.97]",
              activeId === tab.id
                ? "bg-background text-foreground shadow-xs font-semibold border border-border/25 dark:border-white/5"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {tab.count != null && (
              <span className="text-[9px] text-muted-foreground/60 tabular-nums font-bold">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>
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
        "flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold shrink-0 shadow-sm border",
        "bg-primary text-primary-foreground border-primary/20",
        "transition-all duration-300 ease-spring active:scale-[0.95]",
        "hover:opacity-95 hover:shadow-md hover:shadow-primary/10",
        "disabled:opacity-40 disabled:pointer-events-none"
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
        "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ease-spring active:scale-[0.95]",
        danger
          ? "text-red-500 hover:bg-red-500/8 hover:text-red-600"
          : "text-muted-foreground hover:text-foreground hover:bg-accent/80"
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
