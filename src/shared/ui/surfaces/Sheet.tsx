import { type ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/shared/utils";

/**
 * Sheet — slides in from bottom or right.
 * Useful for detail panes (e.g. planner block detail, calendar event detail).
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  side = "right",
  width = "w-[400px]",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  side?: "right" | "bottom";
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[150] flex">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={cn(
          "relative z-10 flex flex-col bg-background border-border shadow-xl",
          side === "right" && cn("ml-auto border-l h-full", width),
          side === "bottom" && "mt-auto border-t w-full max-h-[80dvh] rounded-t-2xl"
        )}
      >
        {title && (
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <span className="text-sm font-semibold">{title}</span>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-fast"
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body
  );
}
