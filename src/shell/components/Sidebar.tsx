import { cn } from "@/shared/utils";
import { useShellStore } from "@/shell/store";
import { useTheme } from "@/shell/components/ThemeProvider";
import { bus } from "@/kernel/event-bus";
import {
  CheckSquare, FolderKanban, CalendarDays, FileText,
  BookOpen, Timer, Focus, Database, Search, FileSearch,
  PanelLeftClose, PanelLeft, Settings, Plus, Command,
  LayoutDashboard, ChevronRight, Sun, Moon, Monitor,
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
  const { theme, setTheme } = useTheme();

  const navigate = (item: { id: string; label: string; path: string }) => {
    onNavigate(item.path, item.label, item.id);
    bus.emit("navigate:to", { path: item.path });
  };

  const collapsed = sidebarCollapsed;

  return (
    <aside
      className={cn(
        "flex flex-col h-full shrink-0 select-none",
        "transition-[width] duration-[220ms] cubic-bezier(0.16,1,0.3,1)"
      )}
      style={{
        width: collapsed ? 52 : 220,
        background: "hsl(var(--sidebar-bg))",
        borderRight: "1px solid hsl(var(--sidebar-border))",
      }}
    >
      {/* ── Header ───────────────────────────────────────────────── */}
      <div
        className="flex items-center h-12 px-2.5 shrink-0 border-b"
        style={{ borderColor: "hsl(var(--sidebar-border))" }}
      >
        {!collapsed && (
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Logomark />
            <span
              className="text-[13px] font-semibold tracking-tight truncate"
              style={{ color: "hsl(var(--sidebar-fg-active))" }}
            >
              Butler
            </span>
          </div>
        )}
        {collapsed && (
          <div className="flex justify-center w-full">
            <Logomark />
          </div>
        )}
        {!collapsed && (
          <button
            onClick={toggleSidebar}
            aria-label="Collapse sidebar"
            className="p-1.5 rounded-md transition-fast shrink-0"
            style={{ color: "hsl(var(--sidebar-fg))" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "hsl(var(--sidebar-accent))";
              (e.currentTarget as HTMLButtonElement).style.color = "hsl(var(--sidebar-fg-active))";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              (e.currentTarget as HTMLButtonElement).style.color = "hsl(var(--sidebar-fg))";
            }}
          >
            <PanelLeftClose size={15} />
          </button>
        )}
      </div>

      {/* ── Quick actions ─────────────────────────────────────────── */}
      <div
        className="px-2 pt-2 pb-1.5 border-b space-y-0.5"
        style={{ borderColor: "hsl(var(--sidebar-border))" }}
      >
        <QuickAction
          icon={<Plus size={15} />}
          label="New Task"
          collapsed={collapsed}
          shortcut="⌘N"
          highlight
          onClick={() => bus.emit("task:quick-add", {})}
        />
        <QuickAction
          icon={<Search size={15} />}
          label="Search"
          collapsed={collapsed}
          shortcut="⌘K"
          onClick={openCommandPalette}
        />
        {collapsed && (
          <button
            onClick={toggleSidebar}
            aria-label="Expand sidebar"
            className="w-full flex justify-center p-2 rounded-md transition-fast"
            style={{ color: "hsl(var(--sidebar-fg))" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "hsl(var(--sidebar-accent))";
              (e.currentTarget as HTMLButtonElement).style.color = "hsl(var(--sidebar-fg-active))";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              (e.currentTarget as HTMLButtonElement).style.color = "hsl(var(--sidebar-fg))";
            }}
          >
            <PanelLeft size={15} />
          </button>
        )}
      </div>

      {/* ── Nav ──────────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2 space-y-4 min-h-0">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            {!collapsed && (
              <p
                className="text-[10px] font-semibold uppercase tracking-widest px-2.5 mb-1"
                style={{ color: "hsl(var(--sidebar-fg) / 0.5)" }}
              >
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
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
                      "w-full flex items-center rounded-md transition-fast text-[13px] font-medium group",
                      collapsed ? "justify-center p-2" : "gap-2.5 px-2.5 py-1.5"
                    )}
                    style={{
                      background: isActive
                        ? "hsl(var(--sidebar-primary) / 0.14)"
                        : "transparent",
                      color: isActive
                        ? "hsl(var(--sidebar-primary))"
                        : "hsl(var(--sidebar-fg))",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        (e.currentTarget as HTMLButtonElement).style.background =
                          "hsl(var(--sidebar-accent))";
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
                    <Icon size={15} className="shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left truncate">{item.label}</span>
                        <ChevronRight
                          size={11}
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
        {/* Theme toggle — cycles light → dark → system */}
        <ThemeToggle collapsed={collapsed} theme={theme} setTheme={setTheme} />

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
                  "linear-gradient(135deg, hsl(var(--sidebar-primary)), hsl(221 85% 45%))",
                color: "white",
              }}
            >
              B
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="text-[12px] font-semibold truncate leading-tight"
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

// ── ThemeToggle ────────────────────────────────────────────────
function ThemeToggle({
  collapsed,
  theme,
  setTheme,
}: {
  collapsed: boolean;
  theme: "light" | "dark" | "system";
  setTheme: (t: "light" | "dark" | "system") => void;
}) {
  const order: Array<"light" | "dark" | "system"> = ["light", "dark", "system"];
  const next = order[(order.indexOf(theme) + 1) % 3];

  const icon =
    theme === "dark" ? <Moon size={15} /> :
    theme === "system" ? <Monitor size={15} /> :
    <Sun size={15} />;

  const label =
    theme === "dark" ? "Dark mode" :
    theme === "system" ? "System theme" :
    "Light mode";

  return (
    <button
      onClick={() => setTheme(next)}
      title={collapsed ? `${label} — click to cycle` : undefined}
      aria-label={`${label} — click to cycle`}
      className={cn(
        "w-full flex items-center rounded-md transition-fast text-[13px] font-medium",
        collapsed ? "justify-center p-2" : "gap-2.5 px-2.5 py-1.5"
      )}
      style={{ color: "hsl(var(--sidebar-fg))" }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background =
          "hsl(var(--sidebar-primary) / 0.08)";
        (e.currentTarget as HTMLButtonElement).style.color =
          "hsl(var(--sidebar-fg-active))";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "transparent";
        (e.currentTarget as HTMLButtonElement).style.color =
          "hsl(var(--sidebar-fg))";
      }}
    >
      <span className="shrink-0 animate-theme-in" key={theme}>{icon}</span>
      {!collapsed && (
        <span className="flex-1 text-left truncate">{label}</span>
      )}
    </button>
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
