import { cn } from "@/shared/utils";
import { useShellStore } from "@/shell/store";
import { bus } from "@/kernel/event-bus";
import {
  CheckSquare, FolderKanban, CalendarDays, FileText,
  BookOpen, Timer, Focus, Database, Search, FileSearch,
  PanelLeftClose, PanelLeft, Settings, Plus, Command,
  LayoutDashboard,
} from "lucide-react";

// ── Nav sections ─────────────────────────────────────────
const NAV_SECTIONS = [
  {
    label: "Workspace",
    items: [
      { id: "tasks",    label: "Tasks",    icon: CheckSquare,    path: "/tasks" },
      { id: "projects", label: "Projects", icon: FolderKanban,   path: "/projects" },
      { id: "planner",  label: "Planner",  icon: LayoutDashboard, path: "/planner" },
    ],
  },
  {
    label: "Content",
    items: [
      { id: "notes",   label: "Notes",    icon: FileText,    path: "/notes" },
      { id: "journal", label: "Journal",  icon: BookOpen,    path: "/journal" },
      { id: "pdf",     label: "Research", icon: FileSearch,  path: "/pdf" },
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
      { id: "database", label: "Database", icon: Database, path: "/database" },
    ],
  },
];

export function Sidebar() {
  const { sidebarCollapsed, activeSidebarItem, toggleSidebar, onNavigate, openCommandPalette } =
    useShellStore();

  const navigate = (item: { id: string; label: string; path: string }) => {
    onNavigate(item.path, item.label, item.id);
    bus.emit("navigate:to", { path: item.path });
  };

  return (
    <aside
      className={cn(
        "flex flex-col h-full shrink-0",
        "transition-[width] duration-200 ease-out",
        "border-r",
        sidebarCollapsed ? "w-[52px]" : "w-[228px]"
      )}
      style={{
        background: "hsl(var(--sidebar-bg))",
        borderColor: "hsl(var(--sidebar-border))",
      }}
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <div
        className={cn(
          "flex items-center h-[48px] px-2.5 shrink-0",
          "border-b",
          sidebarCollapsed ? "justify-center" : "justify-between"
        )}
        style={{ borderColor: "hsl(var(--sidebar-border))" }}
      >
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2.5 pl-0.5">
            {/* Logomark */}
            <div
              className="w-6 h-6 rounded-[6px] flex items-center justify-center shrink-0 shadow-sm"
              style={{
                background: "linear-gradient(135deg, hsl(var(--sidebar-primary)), hsl(221 85% 45%))",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <rect x="1" y="1" width="4" height="4" rx="1" fill="white" fillOpacity="0.95" />
                <rect x="7" y="1" width="4" height="4" rx="1" fill="white" fillOpacity="0.95" />
                <rect x="1" y="7" width="4" height="4" rx="1" fill="white" fillOpacity="0.95" />
                <rect x="7" y="7" width="4" height="4" rx="1" fill="white" fillOpacity="0.5" />
              </svg>
            </div>
            <div className="flex flex-col gap-0">
              <span
                className="font-semibold text-[13px] tracking-tight leading-none"
                style={{ color: "hsl(var(--sidebar-fg-active))" }}
              >
                Butler
              </span>
              <span
                className="text-[9px] leading-tight font-medium tracking-widest uppercase"
                style={{ color: "hsl(var(--sidebar-fg))" }}
              >
                workspace
              </span>
            </div>
          </div>
        )}

        {sidebarCollapsed && (
          <div
            className="w-6 h-6 rounded-[6px] flex items-center justify-center shrink-0 shadow-sm"
            style={{
              background: "linear-gradient(135deg, hsl(var(--sidebar-primary)), hsl(221 85% 45%))",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="1" y="1" width="4" height="4" rx="1" fill="white" fillOpacity="0.95" />
              <rect x="7" y="1" width="4" height="4" rx="1" fill="white" fillOpacity="0.95" />
              <rect x="1" y="7" width="4" height="4" rx="1" fill="white" fillOpacity="0.95" />
              <rect x="7" y="7" width="4" height="4" rx="1" fill="white" fillOpacity="0.5" />
            </svg>
          </div>
        )}

        <button
          onClick={toggleSidebar}
          className={cn(
            "p-1.5 rounded-md transition-fast",
            sidebarCollapsed && "mt-2 mx-auto"
          )}
          style={{
            color: "hsl(var(--sidebar-fg))",
          }}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed
            ? <PanelLeft size={14} />
            : <PanelLeftClose size={14} />
          }
        </button>
      </div>

      {/* ── Quick actions ───────────────────────────────────── */}
      <div
        className="flex flex-col gap-0.5 p-2 shrink-0 border-b"
        style={{ borderColor: "hsl(var(--sidebar-border))" }}
      >
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
          highlight
        />
      </div>

      {/* ── Navigation ─────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-3">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            {!sidebarCollapsed && (
              <p
                className="px-2 mb-1 text-[9px] font-semibold uppercase tracking-widest"
                style={{ color: "hsl(var(--sidebar-fg) / 0.5)" }}
              >
                {section.label}
              </p>
            )}
            <div className="space-y-px">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeSidebarItem === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(item)}
                    title={sidebarCollapsed ? item.label : undefined}
                    className={cn(
                      "w-full flex items-center gap-2.5 rounded-md text-[13px] font-medium transition-fast text-left relative",
                      sidebarCollapsed ? "justify-center p-1.5" : "px-2.5 py-[5px]"
                    )}
                    style={{
                      background: isActive ? "hsl(var(--sidebar-primary) / 0.15)" : "transparent",
                      color: isActive
                        ? "hsl(var(--sidebar-fg-active))"
                        : "hsl(var(--sidebar-fg))",
                    }}
                  >
                    {/* Active left indicator */}
                    {isActive && !sidebarCollapsed && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[60%] rounded-r-full"
                        style={{ background: "hsl(var(--sidebar-primary))" }}
                      />
                    )}
                    <Icon
                      size={14}
                      className="shrink-0 transition-fast"
                      style={{ color: isActive ? "hsl(var(--sidebar-primary))" : undefined }}
                    />
                    {!sidebarCollapsed && (
                      <span className="truncate-1">{item.label}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Footer ─────────────────────────────────────────── */}
      <div
        className="p-2 border-t space-y-px"
        style={{ borderColor: "hsl(var(--sidebar-border))" }}
      >
        <SidebarButton
          icon={<Settings size={13} />}
          label="Settings"
          collapsed={sidebarCollapsed}
          onClick={() => bus.emit("navigate:to", { path: "/settings" })}
        />

        {/* User avatar row */}
        {!sidebarCollapsed && (
          <div
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-md mt-1"
            style={{ background: "hsl(var(--sidebar-accent))" }}
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
              style={{
                background: "linear-gradient(135deg, hsl(var(--sidebar-primary)), hsl(260 70% 60%))",
                color: "white",
              }}
            >
              B
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="text-[11px] font-semibold truncate-1 leading-none mb-0.5"
                style={{ color: "hsl(var(--sidebar-fg-active))" }}
              >
                Butler User
              </p>
              <p
                className="text-[9px] truncate-1 leading-none"
                style={{ color: "hsl(var(--sidebar-fg))" }}
              >
                Personal workspace
              </p>
            </div>
          </div>
        )}
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
  highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  collapsed: boolean;
  shortcut?: string;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        "w-full flex items-center gap-2.5 rounded-md text-[13px] font-medium transition-fast",
        collapsed ? "justify-center p-1.5" : "px-2.5 py-[5px]"
      )}
      style={{
        color: highlight ? "hsl(var(--sidebar-primary))" : "hsl(var(--sidebar-fg))",
      }}
    >
      <span className="shrink-0">{icon}</span>
      {!collapsed && (
        <>
          <span className="flex-1 text-left truncate-1">{label}</span>
          {shortcut && <span className="kbd" style={{ opacity: 0.6 }}>{shortcut}</span>}
        </>
      )}
    </button>
  );
}
