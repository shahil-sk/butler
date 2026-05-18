import { cn } from "@/shared/utils";
import { useShellStore } from "@/shell/store";
import { bus } from "@/kernel/event-bus";
import {
  CheckSquare, FolderKanban, CalendarDays, FileText,
  BookOpen, Timer, Focus, Database, Search, FileSearch,
  PanelLeftClose, PanelLeft, Settings, Plus, Command,
  LayoutDashboard, ChevronRight,
} from "lucide-react";

// ── Nav sections ─────────────────────────────────────────────
const NAV_SECTIONS = [
  {
    label: "Workspace",
    items: [
      { id: "tasks",    label: "Tasks",    icon: CheckSquare,     path: "/tasks" },
      { id: "projects", label: "Projects", icon: FolderKanban,    path: "/projects" },
      { id: "planner",  label: "Planner",  icon: LayoutDashboard, path: "/planner" },
    ],
  },
  {
    label: "Content",
    items: [
      { id: "notes",   label: "Notes",    icon: FileText,   path: "/notes" },
      { id: "journal", label: "Journal",  icon: BookOpen,   path: "/journal" },
      { id: "pdf",     label: "Research", icon: FileSearch, path: "/pdf" },
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

// ── Main sidebar ──────────────────────────────────────────────
export function Sidebar() {
  const { sidebarCollapsed, activeSidebarItem, toggleSidebar, onNavigate, openCommandPalette } =
    useShellStore();

  const navigate = (item: { id: string; label: string; path: string }) => {
    onNavigate(item.path, item.label, item.id);
    bus.emit("navigate:to", { path: item.path });
  };

  const collapsed = sidebarCollapsed;

  return (
    <aside
      className={cn(
        "flex flex-col h-full shrink-0 select-none",
        "transition-[width] duration-200 ease-out",
        "border-r",
        collapsed ? "w-[56px]" : "w-[240px]"
      )}
      style={{
        background: "hsl(var(--sidebar-bg))",
        borderColor: "hsl(var(--sidebar-border))",
      }}
    >
      {/* ── Header ────────────────────────────────────────────── */}
      <div
        className={cn(
          "flex items-center shrink-0 h-[52px] px-3",
          "border-b",
          collapsed ? "justify-center" : "justify-between gap-2"
        )}
        style={{ borderColor: "hsl(var(--sidebar-border))" }}
      >
        {/* Logo + wordmark */}
        <div className={cn("flex items-center gap-2.5 min-w-0", collapsed && "hidden")}>
          <Logomark />
          <div className="min-w-0">
            <p
              className="text-[14px] font-semibold tracking-tight leading-none"
              style={{ color: "hsl(var(--sidebar-fg-active))" }}
            >
              Butler
            </p>
            <p
              className="text-[11px] leading-snug font-normal mt-0.5"
              style={{ color: "hsl(var(--sidebar-fg))" }}
            >
              Personal workspace
            </p>
          </div>
        </div>

        {collapsed && <Logomark />}

        {/* Collapse toggle — only visible when expanded */}
        {!collapsed && (
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-md shrink-0 transition-fast hover:bg-black/5 dark:hover:bg-white/8"
            style={{ color: "hsl(var(--sidebar-fg))" }}
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose size={15} />
          </button>
        )}
      </div>

      {/* ── Expand button (collapsed state) ────────────────────── */}
      {collapsed && (
        <div className="flex justify-center pt-2 pb-1">
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-md transition-fast hover:bg-black/5 dark:hover:bg-white/8"
            style={{ color: "hsl(var(--sidebar-fg))" }}
            title="Expand sidebar"
            aria-label="Expand sidebar"
          >
            <PanelLeft size={15} />
          </button>
        </div>
      )}

      {/* ── Quick actions ───────────────────────────────────────── */}
      <div
        className="flex flex-col gap-0.5 px-2 py-2.5 shrink-0 border-b"
        style={{ borderColor: "hsl(var(--sidebar-border))" }}
      >
        <QuickAction
          icon={<Command size={15} />}
          label="Command Palette"
          shortcut="⌘K"
          collapsed={collapsed}
          onClick={openCommandPalette}
        />
        <QuickAction
          icon={<Search size={15} />}
          label="Search"
          shortcut="⌘/"
          collapsed={collapsed}
          onClick={() => bus.emit("search:open", {})}
        />
        <QuickAction
          icon={<Plus size={15} />}
          label="New Task"
          shortcut="C"
          collapsed={collapsed}
          onClick={() => bus.emit("task:quick-add", {})}
          highlight
        />
      </div>

      {/* ── Navigation ──────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4 scrollbar-none">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            {/* Section label — only in expanded state */}
            {!collapsed && (
              <p
                className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-widest"
                style={{ color: "hsl(var(--sidebar-fg) / 0.55)" }}
              >
                {section.label}
              </p>
            )}

            {/* Divider line in collapsed state */}
            {collapsed && section.label !== NAV_SECTIONS[0].label && (
              <div
                className="mx-3 mb-2"
                style={{
                  height: "1px",
                  background: "hsl(var(--sidebar-border))",
                }}
              />
            )}

            <div className="space-y-px">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeSidebarItem === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(item)}
                    title={collapsed ? item.label : undefined}
                    aria-label={item.label}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "group w-full flex items-center rounded-md transition-fast relative",
                      "text-[13px] font-medium text-left",
                      collapsed
                        ? "justify-center p-2 mx-auto"
                        : "gap-2.5 px-2.5 py-1.5"
                    )}
                    style={{
                      background: isActive
                        ? "hsl(var(--sidebar-primary) / 0.12)"
                        : "transparent",
                      color: isActive
                        ? "hsl(var(--sidebar-fg-active))"
                        : "hsl(var(--sidebar-fg))",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        (e.currentTarget as HTMLButtonElement).style.background =
                          "hsl(var(--sidebar-primary) / 0.06)";
                        (e.currentTarget as HTMLButtonElement).style.color =
                          "hsl(var(--sidebar-fg-active))";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                        (e.currentTarget as HTMLButtonElement).style.color =
                          "hsl(var(--sidebar-fg))";
                      }
                    }}
                  >
                    {/* Active left indicator bar */}
                    {isActive && !collapsed && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[55%] rounded-r-full"
                        style={{ background: "hsl(var(--sidebar-primary))" }}
                      />
                    )}

                    <Icon
                      size={16}
                      className="shrink-0"
                      style={{
                        color: isActive
                          ? "hsl(var(--sidebar-primary))"
                          : "hsl(var(--sidebar-fg))",
                      }}
                    />

                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate leading-snug">{item.label}</span>
                        {/* Subtle chevron on hover to indicate navigability */}
                        <ChevronRight
                          size={12}
                          className="opacity-0 group-hover:opacity-40 shrink-0 transition-fast"
                        />
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <div
        className="px-2 pb-2.5 pt-2 border-t space-y-0.5"
        style={{ borderColor: "hsl(var(--sidebar-border))" }}
      >
        {/* Settings */}
        <QuickAction
          icon={<Settings size={15} />}
          label="Settings"
          collapsed={collapsed}
          onClick={() => bus.emit("navigate:to", { path: "/settings" })}
        />

        {/* User row (expanded only) */}
        {!collapsed && (
          <div
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-md mt-1"
            style={{
              background: "hsl(var(--sidebar-accent, var(--sidebar-border)) / 0.5)",
            }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0"
              style={{
                background:
                  "linear-gradient(135deg, hsl(var(--sidebar-primary)), hsl(260 70% 60%))",
                color: "white",
              }}
            >
              B
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="text-[13px] font-semibold truncate leading-tight"
                style={{ color: "hsl(var(--sidebar-fg-active))" }}
              >
                Butler User
              </p>
              <p
                className="text-[11px] truncate leading-tight mt-0.5"
                style={{ color: "hsl(var(--sidebar-fg))" }}
              >
                Personal workspace
              </p>
            </div>
          </div>
        )}

        {/* Collapsed: just an avatar dot */}
        {collapsed && (
          <div className="flex justify-center py-1">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold"
              style={{
                background:
                  "linear-gradient(135deg, hsl(var(--sidebar-primary)), hsl(260 70% 60%))",
                color: "white",
              }}
              title="Butler User"
            >
              B
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

// ── Logomark ───────────────────────────────────────────────────
function Logomark() {
  return (
    <div
      className="w-7 h-7 rounded-[7px] flex items-center justify-center shrink-0 shadow-sm"
      style={{
        background:
          "linear-gradient(135deg, hsl(var(--sidebar-primary)), hsl(221 85% 45%))",
      }}
    >
      <svg width="13" height="13" viewBox="0 0 12 12" fill="none" aria-hidden>
        <rect x="1" y="1" width="4" height="4" rx="1" fill="white" fillOpacity="0.95" />
        <rect x="7" y="1" width="4" height="4" rx="1" fill="white" fillOpacity="0.95" />
        <rect x="1" y="7" width="4" height="4" rx="1" fill="white" fillOpacity="0.95" />
        <rect x="7" y="7" width="4" height="4" rx="1" fill="white" fillOpacity="0.5" />
      </svg>
    </div>
  );
}

// ── QuickAction button ─────────────────────────────────────────
function QuickAction({
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
      aria-label={label}
      className={cn(
        "w-full flex items-center rounded-md transition-fast",
        "text-[13px] font-medium",
        collapsed ? "justify-center p-2" : "gap-2.5 px-2.5 py-1.5"
      )}
      style={{
        color: highlight
          ? "hsl(var(--sidebar-primary))"
          : "hsl(var(--sidebar-fg))",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background =
          "hsl(var(--sidebar-primary) / 0.06)";
        (e.currentTarget as HTMLButtonElement).style.color = highlight
          ? "hsl(var(--sidebar-primary))"
          : "hsl(var(--sidebar-fg-active))";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "transparent";
        (e.currentTarget as HTMLButtonElement).style.color = highlight
          ? "hsl(var(--sidebar-primary))"
          : "hsl(var(--sidebar-fg))";
      }}
    >
      <span className="shrink-0">{icon}</span>
      {!collapsed && (
        <>
          <span className="flex-1 text-left truncate">{label}</span>
          {shortcut && (
            <span
              className="text-[11px] font-mono px-1 py-0.5 rounded"
              style={{
                background: "hsl(var(--sidebar-border))",
                color: "hsl(var(--sidebar-fg) / 0.7)",
              }}
            >
              {shortcut}
            </span>
          )}
        </>
      )}
    </button>
  );
}
