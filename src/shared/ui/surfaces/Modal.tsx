import { type ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/shared/utils";

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
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[3px] animate-fade-in"
        onClick={onClose}
      />
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
