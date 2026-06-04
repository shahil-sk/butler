import { X, SplitSquareHorizontal } from "lucide-react";
import { cn } from "@/shared/utils";
import { useShellStore, type Tab, type SplitPanel } from "@/shell/store";
import { bus } from "@/kernel/event-bus";

export function TabBar({ panel }: { panel: SplitPanel }) {
  const { closeTab, setActiveTab, splitPanel, closePanel, panels } = useShellStore();

  if (panel.tabs.length === 0) return null;

  return (
    <div className="flex items-center h-[42px] px-2 bg-background border-b border-border/80 shrink-0">
      <div className="flex items-center flex-1 min-w-0 overflow-x-auto scrollbar-none gap-1.5 pt-1">
        {panel.tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id, panel.id);
              bus.emit("navigate:to", { path: tab.path });
            }}
            className={cn(
              "group relative flex items-center gap-2 h-[30px] px-3 rounded-md text-[13px] cursor-pointer select-none shrink-0 transition-fast",
              panel.activeTabId === tab.id
                ? "bg-surface-2 text-foreground font-medium shadow-xs"
                : "text-muted-foreground hover:bg-surface-1 hover:text-foreground"
            )}
          >
            {tab.isDirty && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />}
            <span className="truncate-1">{tab.label}</span>
            <button
              onClick={(e) => { e.stopPropagation(); closeTab(tab.id, panel.id); }}
              className="ml-1 p-0.5 rounded-sm opacity-0 group-hover:opacity-100 hover:bg-border/60 transition-fast text-muted-foreground"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1 pl-2 ml-auto">
        {panels.length < 3 && (
          <button onClick={() => splitPanel(panel.id)} className="p-1.5 rounded-md text-muted-foreground hover:bg-surface-2 transition-fast">
            <SplitSquareHorizontal size={14} />
          </button>
        )}
        {panels.length > 1 && (
          <button onClick={() => closePanel(panel.id)} className="p-1.5 rounded-md text-muted-foreground hover:bg-surface-2 transition-fast">
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
