import { cn } from "@/shared/utils";
import { useShellStore } from "@/shell/store";
import { bus } from "@/kernel/event-bus";
import {
  CheckSquare, FolderKanban, CalendarDays, FileText,
  BookOpen, Timer, Focus, Database, Search, FileSearch,
  PanelLeftClose, PanelLeft, Settings, Plus, Command,
} from "lucide-react";

const NAV_ITEMS = [
  { id: "tasks",         label: "Tasks",    icon: CheckSquare,  path: "/tasks" },
  { id: "projects",      label: "Projects", icon: FolderKanban, path: "/projects" },
  { id: "planner",       label: "Planner",  icon: CalendarDays, path: "/planner" },
  { id: "notes",         label: "Notes",    icon: FileText,     path: "/notes" },
  { id: "calendar",      label: "Calendar", icon: CalendarDays, path: "/calendar" },
  { id: "journal",       label: "Journal",  icon: BookOpen,     path: "/journal" },
  { id: "focus",         label: "Focus",    icon: Focus,        path: "/focus" },
  { id: "time-tracking", label: "Time",     icon: Timer,        path: "/time" },
  { id: "database",      label: "Database", icon: Database,     path: "/database" },
  { id: "pdf",           label: "Research", icon: FileSearch,   path: "/pdf" },
];

export function Sidebar() {
  const { sidebarCollapsed, activeSidebarItem, toggleSidebar, onNavigate, openCommandPalette } =
    useShellStore();

  const navigate = (item: (typeof NAV_ITEMS)[number]) => {
    onNavigate(item.path, item.label, item.id);
    bus.emit("navigate:to", { path: item.path });
  };

  return (
    <aside
      className={cn(
        "flex flex-col h-full border-r border-border shrink-0",
        "bg-surface-1 transition-[width] duration-200 ease-out",
        sidebarCollapsed ? "w-[52px]" : "w-[220px]"
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center h-[46px] px-2.5 border-b border-border shrink-0",
          sidebarCollapsed ? "justify-center" : "justify-between"
        )}
      >
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2 pl-0.5">
            {/* Logomark */}
            <div className="w-5 h-5 rounded-[5px] bg-primary flex items-center justify-center shrink-0">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <rect x="1" y="1" width="3.5" height="3.5" rx="0.75" fill="white" fillOpacity="0.9" />
                <rect x="6.5" y="1" width="3.5" height="3.5" rx="0.75" fill="white" fillOpacity="0.9" />
                <rect x="1" y="6.5" width="3.5" height="3.5" rx="0.75" fill="white" fillOpacity="0.9" />
                <rect x="6.5" y="6.5" width="3.5" height="3.5" rx="0.75" fill="white" fillOpacity="0.45" />
              </svg>
            </div>
            <span className="font-semibold text-sm tracking-tight text-foreground">Butler</span>
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className={cn(
            "p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-fast",
            sidebarCollapsed && "mx-auto"
          )}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed
            ? <PanelLeft size={14} />
            : <PanelLeftClose size={14} />
          }
        </button>
      </div>

      {/* Quick actions */}
      <div className="flex flex-col gap-0.5 p-1.5 border-b border-border shrink-0">
        <SidebarButton
          icon={<Command size={13} />}
          label="Command Palette"
          collapsed={sidebarCollapsed}
          shortcut="⌘K"
          onClick={openCommandPalette}
        />
        <SidebarButton
          icon={<Search size={13} />}
          label="Search"
          collapsed={sidebarCollapsed}
          shortcut="⌘/"
          onClick={() => bus.emit("search:open", {})}
        />
        <SidebarButton
          icon={<Plus size={13} />}
          label="New Task"
          collapsed={sidebarCollapsed}
          shortcut="C"
          onClick={() => bus.emit("task:quick-add", {})}
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-1.5 space-y-px">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeSidebarItem === item.id;

          return (
            <button
              key={item.id}
              onClick={() => navigate(item)}
              title={sidebarCollapsed ? item.label : undefined}
              className={cn(
                "w-full flex items-center gap-2.5 rounded-md text-sm transition-fast text-left",
                sidebarCollapsed ? "justify-center p-1.5" : "px-2.5 py-[6px]",
                isActive
                  ? "bg-primary/[0.08] text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <Icon
                size={14}
                className={cn("shrink-0 transition-fast", isActive ? "text-primary" : "")}
              />
              {!sidebarCollapsed && (
                <span className="truncate-1">{item.label}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-1.5 border-t border-border shrink-0">
        <SidebarButton
          icon={<Settings size={13} />}
          label="Settings"
          collapsed={sidebarCollapsed}
          onClick={() => bus.emit("navigate:to", { path: "/settings" })}
        />
      </div>
    </aside>
  );
}

function SidebarButton({
  icon,
  label,
  collapsed,
  shortcut,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  collapsed: boolean;
  shortcut?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        "w-full flex items-center gap-2.5 rounded-md text-sm transition-fast",
        "text-muted-foreground hover:text-foreground hover:bg-accent",
        collapsed ? "justify-center p-1.5" : "px-2.5 py-[6px]"
      )}
    >
      <span className="shrink-0">{icon}</span>
      {!collapsed && (
        <>
          <span className="flex-1 text-left truncate-1">{label}</span>
          {shortcut && <span className="kbd">{shortcut}</span>}
        </>
      )}
    </button>
  );
}
