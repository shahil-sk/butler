import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/shared/utils";

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
    const GAP = 6;
    const newStyle: React.CSSProperties = {};
    if (align === "right") {
      newStyle.right = window.innerWidth - rect.right;
    } else {
      newStyle.left = rect.left;
    }
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

export function PopoverDivider() {
  return <div className="my-1 mx-2 h-px bg-border/60" />;
}
