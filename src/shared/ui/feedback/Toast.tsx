import React, { useEffect, useState } from "react";
import { cn } from "@/shared/utils";
import { bus, useBusEvent } from "@/kernel/event-bus";
import type { ID } from "@/shared/types";
import { generateId } from "@/shared/utils";

interface ToastItem {
  id: ID;
  message: string;
  type: "info" | "success" | "warning" | "error";
  durationMs: number;
}

const TYPE_STYLES: Record<ToastItem["type"], string> = {
  success: "bg-green-900/90 border-green-700 text-green-100",
  error:   "bg-red-900/90 border-red-700 text-red-100",
  warning: "bg-yellow-900/90 border-yellow-700 text-yellow-100",
  info:    "bg-zinc-800/90 border-zinc-600 text-zinc-100",
};

function ToastEntry({ item, onDismiss }: { item: ToastItem; onDismiss: (id: ID) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(item.id), item.durationMs);
    return () => clearTimeout(t);
  }, [item.id, item.durationMs, onDismiss]);

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg backdrop-blur-sm",
        "animate-in slide-in-from-bottom-2 fade-in duration-200",
        TYPE_STYLES[item.type]
      )}
    >
      <span className="flex-1">{item.message}</span>
      <button
        aria-label="Dismiss"
        onClick={() => onDismiss(item.id)}
        className="opacity-70 hover:opacity-100 text-current"
      >
        ×
      </button>
    </div>
  );
}

export function ToastProvider() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = (id: ID) => setToasts((prev) => prev.filter((t) => t.id !== id));

  useBusEvent("notify", ({ message, type }) => {
    setToasts((prev) => [
      ...prev,
      { id: generateId(), message, type, durationMs: 3500 },
    ]);
  });

  useBusEvent("ui:notification", ({ id, message, type, durationMs }) => {
    setToasts((prev) => [
      ...prev,
      { id, message, type, durationMs: durationMs ?? 3500 },
    ]);
  });

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]"
    >
      {toasts.map((t) => (
        <ToastEntry key={t.id} item={t} onDismiss={dismiss} />
      ))}
    </div>
  );
}

/** Imperative helper — emit a toast via the event bus from non-React code. */
export const toast = {
  success: (message: string) => bus.emit("notify", { message, type: "success" }),
  error:   (message: string) => bus.emit("notify", { message, type: "error" }),
  warning: (message: string) => bus.emit("notify", { message, type: "warning" }),
  info:    (message: string) => bus.emit("notify", { message, type: "info" }),
};
