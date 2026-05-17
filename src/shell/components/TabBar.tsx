import { X, Pin, SplitSquareHorizontal } from "lucide-react";
import { cn } from "@/shared/utils";
import { useShellStore, type Tab, type SplitPanel } from "@/shell/store";
import { bus } from "@/kernel/event-bus";

export function TabBar({ panel }: { panel: SplitPanel }) {
  const { closeTab, setActiveTab, pinTab, splitPanel, closePanel, panels } = useShellStore();

  if (panel.tabs.length === 0) return null;

  return (
    <div className="flex items-center h-[38px] border-b border-border bg-surface-1 shrink-0 overflow-hidden">
      {/* Tabs */}
      <div className="flex items-center flex-1 min-w-0 overflow-x-auto scrollbar-none">
        {panel.tabs.map((tab) => (
          <TabItem
            key={tab.id}
            tab={tab}
            isActive={panel.activeTabId === tab.id}
            panelId={panel.id}
            onActivate={() => {
              setActiveTab(tab.id, panel.id);
              bus.emit("navigate:to", { path: tab.path });
            }}
            onClose={(e) => { e.stopPropagation(); closeTab(tab.id, panel.id); }}
            onPin={(e) => { e.stopPropagation(); pinTab(tab.id, panel.id); }}
          />
        ))}
      </div>

      {/* Panel actions */}
      <div className="flex items-center gap-0.5 px-1.5 shrink-0 border-l border-border/60 ml-auto">
        {panels.length < 3 && (
          <button
            onClick={() => splitPanel(panel.id)}
            className="p-1.5 rounded text-muted-foreground/60 hover:text-foreground hover:bg-accent transition-fast"
            title="Split panel"
          >
            <SplitSquareHorizontal size={12} />
          </button>
        )}
        {panels.length > 1 && (
          <button
            onClick={() => closePanel(panel.id)}
            className="p-1.5 rounded text-muted-foreground/60 hover:text-foreground hover:bg-accent transition-fast"
            title="Close panel"
          >
            <X size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

function TabItem({
  tab,
  isActive,
  onActivate,
  onClose,
  onPin,
}: {
  tab: Tab;
  isActive: boolean;
  panelId: string;
  onActivate: () => void;
  onClose: (e: React.MouseEvent) => void;
  onPin: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      onClick={onActivate}
      className={cn(
        "group relative flex items-center gap-1.5 h-[38px] px-3 min-w-0 max-w-[160px]",
        "text-xs cursor-pointer select-none shrink-0",
        "border-r border-border/60 transition-fast",
        isActive
          ? "bg-background text-foreground"
          : "text-muted-foreground hover:text-foreground hover:bg-surface-2/60"
      )}
    >
      {/* Active indicator bar */}
      {isActive && (
        <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-t-full" />
      )}

      {/* Dirty dot */}
      {tab.isDirty && (
        <span className="w-[5px] h-[5px] rounded-full bg-amber-400 shrink-0" />
      )}

      {/* Pin */}
      {tab.isPinned && (
        <Pin size={9} className="shrink-0 text-muted-foreground/50 rotate-45" />
      )}

      <span className="truncate-1 font-normal">{tab.label}</span>

      {/* Close */}
      {!tab.isPinned && (
        <button
          onClick={onClose}
          className={cn(
            "ml-auto p-0.5 rounded shrink-0 transition-fast",
            "opacity-0 group-hover:opacity-100",
            "text-muted-foreground hover:text-foreground hover:bg-surface-3"
          )}
        >
          <X size={10} />
        </button>
      )}
    </div>
  );
}
