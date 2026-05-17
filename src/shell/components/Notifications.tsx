import { X, Info, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { useShellStore } from "@/shell/store";
import { useBusEvent } from "@/kernel/event-bus";
import { cn } from "@/shared/utils";
import type { Notification } from "@/shell/store";

const ICONS = {
  info:    Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error:   XCircle,
};

const STYLES = {
  info:    "border-blue-500/20 bg-blue-50 text-blue-800 dark:bg-blue-500/[0.08] dark:text-blue-300",
  success: "border-emerald-500/20 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/[0.08] dark:text-emerald-300",
  warning: "border-amber-500/20 bg-amber-50 text-amber-800 dark:bg-amber-500/[0.08] dark:text-amber-300",
  error:   "border-red-500/20 bg-red-50 text-red-800 dark:bg-red-500/[0.08] dark:text-red-300",
};

const ICON_STYLES = {
  info:    "text-blue-500",
  success: "text-emerald-500",
  warning: "text-amber-500",
  error:   "text-red-500",
};

export function Notifications() {
  const { notifications, notify, dismissNotification } = useShellStore();

  useBusEvent("ui:notification", (payload) => {
    notify({
      type: payload.type,
      message: payload.message,
      durationMs: payload.durationMs ?? 4000,
    });
  });

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-full max-w-[340px] pointer-events-none">
      {notifications.map((n) => (
        <Toast key={n.id} notification={n} onDismiss={() => dismissNotification(n.id)} />
      ))}
    </div>
  );
}

function Toast({
  notification,
  onDismiss,
}: {
  notification: Notification;
  onDismiss: () => void;
}) {
  const Icon = ICONS[notification.type];

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-start gap-3 px-3.5 py-3 rounded-lg border",
        "animate-toast-in text-sm font-normal leading-snug",
        STYLES[notification.type]
      )}
      style={{ boxShadow: "var(--shadow-md)" }}
    >
      <Icon size={14} className={cn("shrink-0 mt-0.5", ICON_STYLES[notification.type])} />
      <span className="flex-1">{notification.message}</span>
      <button
        onClick={onDismiss}
        className="shrink-0 p-0.5 rounded opacity-40 hover:opacity-80 transition-fast ml-1"
      >
        <X size={12} />
      </button>
    </div>
  );
}
