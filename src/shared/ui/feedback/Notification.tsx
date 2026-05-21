import React from "react";
import { cn } from "@/shared/utils";

export interface NotificationProps {
  type?: "info" | "success" | "warning" | "error";
  title?: string;
  message: string;
  onDismiss?: () => void;
  className?: string;
}

const TYPE_STYLES = {
  info:    "bg-blue-50 border-blue-300 text-blue-800 dark:bg-blue-950/50 dark:border-blue-700 dark:text-blue-200",
  success: "bg-green-50 border-green-300 text-green-800 dark:bg-green-950/50 dark:border-green-700 dark:text-green-200",
  warning: "bg-yellow-50 border-yellow-300 text-yellow-800 dark:bg-yellow-950/50 dark:border-yellow-700 dark:text-yellow-200",
  error:   "bg-red-50 border-red-300 text-red-800 dark:bg-red-950/50 dark:border-red-700 dark:text-red-200",
};

export function Notification({ type = "info", title, message, onDismiss, className }: NotificationProps) {
  return (
    <div className={cn("flex items-start gap-3 rounded-lg border px-4 py-3 text-sm", TYPE_STYLES[type], className)}>
      <div className="flex-1">
        {title && <p className="font-semibold mb-0.5">{title}</p>}
        <p>{message}</p>
      </div>
      {onDismiss && (
        <button aria-label="Dismiss" onClick={onDismiss} className="opacity-60 hover:opacity-100">
          ×
        </button>
      )}
    </div>
  );
}
