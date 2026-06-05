import { useEffect } from "react";
import { format } from "date-fns";
import { Timer, Cloud } from "lucide-react";
import { useFocusStore } from "@/modules/focus/store";
import { bus } from "@/kernel/event-bus";

export function StatusBar() {
  const { activeSession, _tick } = useFocusStore();

  return (
    <div className="flex items-center justify-between h-8 px-4 bg-background border-t border-border/80 shrink-0 text-[11px] font-medium text-muted-foreground select-none">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Cloud size={12} className="text-muted-foreground/80" />
          <span>Synced</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        {activeSession && (
          <button 
            onClick={() => bus.emit("navigate:to", { path: "/focus" })}
            className="flex items-center gap-1.5 text-primary animate-pulse"
          >
            <Timer size={12} />
            <span>Flow Engaged</span>
          </button>
        )}
      </div>
    </div>
  );
}
