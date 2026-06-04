import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Timer, CheckSquare, Cloud, CloudOff, Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { useTaskStore } from "@/modules/tasks/store";
import { useFocusStore } from "@/modules/focus/store";
import { bus } from "@/kernel/event-bus";
import { cn } from "@/shared/utils";

export function StatusBar() {
  const { tasks } = useTaskStore();
  const { activeSession, secondsLeft } = useFocusStore();
  const [now, setNow] = useState(new Date());
  const [syncStatus, setSyncStatus] = useState<"synced" | "syncing" | "offline">("synced");

  // Keep clock updated
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Today's tasks count
  const todayStr = format(now, "yyyy-MM-dd");
  const todayTasks = tasks.filter(t => t.dueDate === todayStr && t.status !== "archived");
  const completedToday = todayTasks.filter(t => t.status === "done").length;
  
  // Fake sync status for realism
  useEffect(() => {
    const unsubStart = bus.on("sync:start" as any, () => setSyncStatus("syncing"));
    const unsubEnd = bus.on("sync:end" as any, () => setSyncStatus("synced"));
    const unsubError = bus.on("sync:error" as any, () => setSyncStatus("offline"));

    return () => {
      unsubStart();
      unsubEnd();
      unsubError();
    };
  }, []);

  return (
    <div className="flex items-center justify-between h-7 px-3 border-t border-border/40 bg-surface-1/50 shrink-0 text-[10px] font-medium text-muted-foreground select-none">
      <div className="flex items-center gap-4">
        {/* Sync Status */}
        <div className="flex items-center gap-1.5" title="Sync Status">
          {syncStatus === "syncing" ? (
            <Loader2 size={11} className="animate-spin text-blue-500" />
          ) : syncStatus === "offline" ? (
            <CloudOff size={11} className="text-red-500" />
          ) : (
            <Cloud size={11} className="text-emerald-500" />
          )}
          <span className="uppercase tracking-widest opacity-80">{syncStatus}</span>
        </div>

        {/* Date */}
        <div className="flex items-center gap-1.5 opacity-80" title="Current Date">
          <CalendarIcon size={11} />
          <span>{format(now, "EEE, MMM d")}</span>
        </div>
        
        {/* Today's Tasks */}
        <div className="flex items-center gap-1.5" title="Today's Tasks">
          <CheckSquare size={11} className={completedToday === todayTasks.length && todayTasks.length > 0 ? "text-emerald-500" : "opacity-80"} />
          <span className="tabular-nums opacity-80">{completedToday}/{todayTasks.length}</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Active Focus Session */}
        {activeSession && (
          <button 
            onClick={() => bus.emit("navigate:to", { path: "/focus" })}
            className="flex items-center gap-1.5 text-primary hover:text-primary/80 transition-colors bg-primary/10 px-2 py-0.5 rounded-sm"
          >
            <Timer size={11} className="animate-pulse" />
            <span className="uppercase tracking-widest tabular-nums">
              {Math.floor(secondsLeft / 60).toString().padStart(2, "0")}:
              {(secondsLeft % 60).toString().padStart(2, "0")}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
