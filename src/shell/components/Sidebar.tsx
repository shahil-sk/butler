import { useState } from "react";
import { cn } from "@/shared/utils";
import { useShellStore } from "@/shell/store";
import { useTheme } from "@/shell/components/ThemeProvider";
import { bus, useBusEvent } from "@/kernel/event-bus";
import {
  CheckSquare, FolderKanban, CalendarDays,
  Target, Activity, Focus, Timer, Bot,
  Search, Plus, Settings, PanelLeftClose, ChevronRight
} from "lucide-react";

const appIcon = new URL("../../../src-tauri/icons/64x64.png", import.meta.url).href;

const NAV_SECTIONS = [
  {
    label: "Workspace",
    items: [
      { id: "goals",    label: "Goals",    icon: Target,          path: "/goals" },
      { id: "tasks",    label: "Tasks",    icon: CheckSquare,     path: "/tasks" },
      { id: "projects", label: "Projects", icon: FolderKanban,    path: "/projects" },
    ],
  },
  {
    label: "Content",
    items: [
      { id: "habits",   label: "Habits",   icon: Activity,   path: "/habits" },
    ],
  },
  {
    label: "Time",
    items: [
      { id: "calendar",      label: "Calendar", icon: CalendarDays, path: "/calendar" },
      { id: "focus",         label: "Focus",    icon: Focus,        path: "/focus" },
      { id: "time-tracking", label: "Time",     icon: Timer,        path: "/time" },
    ],
  },
  {
    label: "Data",
    items: [
      { id: "ai",       label: "AI",       icon: Bot,      path: "/ai"       },
    ],
  },
];

export function Sidebar() {
  const { sidebarCollapsed, activeSidebarItem, toggleSidebar, onNavigate, openCommandPalette } = useShellStore();
  const { theme, setTheme } = useTheme();

  const navigate = (item: { id: string; label: string; path: string }) => {
    onNavigate(item.path, item.label, item.id);
    bus.emit("navigate:to", { path: item.path });
  };

  return (
    <aside
      className={cn(
        "flex flex-col h-full shrink-0 select-none mac-sidebar-glass border-r transition-[width] duration-300 ease-out",
        sidebarCollapsed ? "w-[68px] items-center" : "w-[240px]"
      )}
    >
      {/* App Header */}
      <div className="flex items-center h-14 w-full px-3 shrink-0">
        <div className={cn("flex items-center w-full", sidebarCollapsed ? "justify-center" : "justify-between")}>
          <div className="flex items-center gap-2">
            <button 
              onClick={sidebarCollapsed ? toggleSidebar : undefined}
              className="outline-none hover:opacity-80 transition-opacity"
            >
              <img src={appIcon} alt="Butler" width={24} height={24} className="rounded-md shadow-sm" draggable={false} />
            </button>
            {!sidebarCollapsed && <span className="text-[14px] font-semibold tracking-tight text-sidebar-fg-active">Butler</span>}
          </div>
          {!sidebarCollapsed && (
            <button
              onClick={toggleSidebar}
              className="p-1 rounded-md text-sidebar-fg hover:bg-surface-2 transition-fast"
            >
              <PanelLeftClose size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-3 pt-2 pb-4 space-y-1 w-full">
        <QuickAction icon={<Plus size={16} />} label="New Task" shortcut="⌘N" collapsed={sidebarCollapsed} highlight onClick={() => bus.emit("task:quick-add", {})} />
        <QuickAction icon={<Search size={16} />} label="Search" shortcut="⌘K" collapsed={sidebarCollapsed} onClick={openCommandPalette} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 space-y-5 w-full scrollbar-none pb-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            {!sidebarCollapsed && (
              <p className="text-[11px] font-medium text-sidebar-fg/60 px-2 mb-1.5 uppercase tracking-wide">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5 w-full">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeSidebarItem === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(item)}
                    title={sidebarCollapsed ? item.label : undefined}
                    className={cn(
                      "w-full flex items-center rounded-lg transition-fast text-[13px] group font-medium",
                      sidebarCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-1.5",
                      isActive
                        ? "bg-primary text-white shadow-sm"
                        : "text-sidebar-fg hover:bg-surface-2 hover:text-sidebar-fg-active"
                    )}
                  >
                    <Icon size={15} strokeWidth={isActive ? 2.5 : 2} className={cn("shrink-0", isActive ? "text-white" : "text-sidebar-fg group-hover:text-sidebar-fg-active")} />
                    {!sidebarCollapsed && (
                      <span className="flex-1 text-left truncate tracking-tight">{item.label}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer Settings & Theme */}
      <div className="px-3 pb-4 pt-2 w-full space-y-1">
        <QuickAction 
          icon={<Settings size={16} />} 
          label="Settings" 
          collapsed={sidebarCollapsed} 
          onClick={() => bus.emit("navigate:to", { path: "/settings" })} 
        />
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className={cn(
            "w-full flex items-center rounded-lg transition-fast text-[13px] font-medium text-sidebar-fg hover:bg-surface-2 hover:text-sidebar-fg-active",
            sidebarCollapsed ? "justify-center p-2.5" : "gap-3 px-3 py-1.5"
          )}
          title="Toggle Theme"
        >
          <div className="w-[16px] h-[16px] rounded-full bg-gradient-to-tr from-sidebar-fg to-transparent border border-sidebar-fg/20 shrink-0" />
          {!sidebarCollapsed && <span className="flex-1 text-left">Theme</span>}
        </button>
      </div>
    </aside>
  );
}

function QuickAction({ icon, label, collapsed, shortcut, onClick, highlight = false }: any) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        "w-full flex items-center rounded-lg transition-fast text-[13px] font-medium group",
        collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-1.5",
        highlight
          ? "bg-surface-1 text-primary border border-border/50 hover:bg-surface-2 shadow-xs"
          : "text-sidebar-fg hover:bg-surface-2 hover:text-sidebar-fg-active"
      )}
    >
      <span className="shrink-0">{icon}</span>
      {!collapsed && (
        <>
          <span className="flex-1 text-left">{label}</span>
          {shortcut && <span className="text-[10px] text-muted-foreground opacity-60 font-medium">{shortcut}</span>}
        </>
      )}
    </button>
  );
}
