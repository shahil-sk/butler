import { useEffect, useRef } from "react";
import { bus } from "@/kernel/event-bus";
import { useShellStore } from "@/shell/store";

export function useAutosave() {
  const { settings } = useShellStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const ms = settings.autoSaveIntervalMs;
    intervalRef.current = setInterval(() => {
      bus.emit("sync:autosave", undefined);
    }, ms);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [settings.autoSaveIntervalMs]);
}
