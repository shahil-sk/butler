import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/shared/utils";

/** Right-click context menu — same item structure as Popover. */
export function useContextMenu() {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const open = pos !== null;
  const trigger = (e: React.MouseEvent) => {
    e.preventDefault();
    setPos({ x: e.clientX, y: e.clientY });
  };
  const close = () => setPos(null);
  return { pos, open, trigger, close };
}

export function ContextMenu({
  pos,
  open,
  onClose,
  children,
}: {
  pos: { x: number; y: number } | null;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!open || !pos) return;
    const menuW = menuRef.current?.offsetWidth  ?? 200;
    const menuH = menuRef.current?.offsetHeight ?? 160;
    setStyle({
      left: pos.x + menuW > window.innerWidth  ? pos.x - menuW : pos.x,
      top:  pos.y + menuH > window.innerHeight ? pos.y - menuH : pos.y,
    });
  }, [open, pos]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open || !pos) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9998]" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div
        ref={menuRef}
        className={cn(
          "fixed z-[9999] min-w-[180px] rounded-xl border border-border bg-popover",
          "shadow-[0_8px_30px_-4px_rgb(0_0_0/0.14)] py-1.5 animate-fade-in"
        )}
        style={style}
      >
        {children}
      </div>
    </>,
    document.body
  );
}

/** Same visual style as PopoverItem — use inside ContextMenu or Popover. */
export function ContextMenuItem({
  children,
  onClick,
  danger,
  icon: Icon,
  disabled,
  shortcut,
}: {
  children: ReactNode;
  onClick: () => void;
  danger?: boolean;
  icon?: React.ElementType;
  disabled?: boolean;
  shortcut?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-[7px] text-xs text-left transition-colors duration-100",
        danger
          ? "text-red-500 hover:bg-red-500/10"
          : "text-foreground/80 hover:bg-accent hover:text-foreground",
        "disabled:opacity-40 disabled:pointer-events-none"
      )}
    >
      {Icon && <Icon size={12} className="shrink-0 opacity-70" />}
      <span className="flex-1">{children}</span>
      {shortcut && (
        <span className="text-muted-foreground/50 text-[10px] font-mono">{shortcut}</span>
      )}
    </button>
  );
}

export function ContextMenuDivider() {
  return <div className="my-1 mx-2 h-px bg-border/60" />;
}
