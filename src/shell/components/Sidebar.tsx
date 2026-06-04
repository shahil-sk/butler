import { useState } from "react";
import { cn } from "@/shared/utils";
import { useShellStore } from "@/shell/store";
import { useTheme } from "@/shell/components/ThemeProvider";
import { bus, useBusEvent } from "@/kernel/event-bus";
import {
  CheckSquare, FolderKanban, CalendarDays, FileText,
  BookOpen, Timer, Focus, Database, Search, FileSearch,
  PanelLeftClose, Settings, Plus, Activity,
  LayoutDashboard, ChevronRight, Sun, Moon, Monitor, Target, Bot
} from "lucide-react";

// Tauri app icon — resolved by Vite at build time
const appIcon = new URL("../../../src-tauri/icons/64x64.png", import.meta.url).href;

// ── Nav sections ─────────────────────────────────────────────
const NAV_SECTIONS = [
  {
    label: "Workspace",
    items: [
      { id: "goals",    label: "Goals",    icon: Target,          path: "/goals" },
      { id: "tasks",    label: "Tasks",    icon: CheckSquare,     path: "/tasks" },
      { id: "projects", label: "Projects", icon: FolderKanban,    path: "/projects" },
      { id: "planner",  label: "Planner",  icon: LayoutDashboard, path: "/planner" },
    ],
  },
  {
    label: "Content",
    items: [
      { id: "notes",    label: "Notes",    icon: FileText,   path: "/notes" },
      { id: "journal",  label: "Journal",  icon: BookOpen,   path: "/journal" },
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

        {/* When collapsed, logo itself is the expand trigger */}
        {collapsed && (
          <div className="flex justify-center w-full">
            <button
              onClick={toggleSidebar}
              aria-label="Expand sidebar"
              title="Expand sidebar"
              className="rounded-[7px] transition-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{
                lineHeight: 0,
                transition: "transform 200ms cubic-bezier(0.16,1,0.3,1), opacity 200ms",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.opacity = "0.75";
                (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.08)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.opacity = "1";
                (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
              }}
            >
              <Logomark />
            </button>
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
                      "w-full flex items-center rounded-lg transition-all duration-300 ease-spring active:scale-[0.97] text-[13px] font-medium group",
                      collapsed ? "justify-center p-2.5" : "gap-2.5 px-2.5 py-1.5",
                      isActive
                        ? "bg-sidebar-primary/10 text-sidebar-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                        : "text-sidebar-fg hover:bg-sidebar-accent hover:text-sidebar-fg-active"
                    )}
                  >
                    <Icon size={14} className="shrink-0 transition-transform duration-300 group-hover:scale-110" />
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left truncate">{item.label}</span>
                        {item.id === "tasks" && <OverdueBadge />}
                        <ChevronRight
                          size={11}
                          className="opacity-0 group-hover:opacity-40 shrink-0 transition-all duration-300 translate-x-[-2px] group-hover:translate-x-0"
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

      <FocusMiniPlayer collapsed={collapsed} />

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
            className="p-1 bg-black/10 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-[1.25rem] mt-2 shrink-0 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]"
          >
            <div
              className="flex items-center gap-2.5 px-2 py-1.5 rounded-[calc(1.25rem-0.25rem)] bg-sidebar-accent/50 shadow-sm"
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
                  className="text-[12px] font-semibold truncate leading-tight text-sidebar-fg-active"
                >
                  Butler User
                </p>
                <p
                  className="text-[10px] truncate leading-tight mt-0.5 text-sidebar-fg/80"
                >
                  Personal workspace
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Collapsed: just an avatar dot */}
        {collapsed && (
          <div className="flex justify-center py-1">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shadow-md"
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

// ── Logomark — uses actual app icon from src-tauri/icons/32x32.png ──────
function Logomark() {
  return (
    <img
      src={appIcon}
      alt="Butler"
      width={28}
      height={28}
      className="shrink-0 rounded-[7px] shadow-sm"
      draggable={false}
    />
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
        "w-full flex items-center rounded-lg transition-all duration-300 ease-spring active:scale-[0.97] text-[13px] font-medium",
        collapsed ? "justify-center p-2" : "gap-2.5 px-2.5 py-1.5",
        "text-sidebar-fg hover:bg-sidebar-accent hover:text-sidebar-fg-active"
      )}
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
        "w-full flex items-center rounded-lg transition-all duration-300 ease-spring active:scale-[0.97]",
        "text-[13px] font-medium",
        collapsed ? "justify-center p-2" : "gap-2.5 px-2.5 py-1.5",
        highlight
          ? "text-sidebar-primary bg-sidebar-primary/8 hover:bg-sidebar-primary/15"
          : "text-sidebar-fg hover:bg-sidebar-accent hover:text-sidebar-fg-active"
      )}
    >
      <span className="shrink-0">{icon}</span>
      {!collapsed && (
        <>
          <span className="flex-1 text-left truncate">{label}</span>
          {shortcut && (
            <span
              className="text-[10px] font-mono px-1 py-0.5 rounded bg-sidebar-border/60 text-sidebar-fg/80"
            >
              {shortcut}
            </span>
          )}
        </>
      )}
    </button>
  );
}

// ── OverdueBadge ───────────────────────────────────────────────
function OverdueBadge() {
  const [count, setCount] = useState(0);

  // Per requirements: Live sidebar badges updated via bus events.
  useBusEvent("task:created", () => setCount(c => c + 1));
  useBusEvent("task:completed", () => setCount(c => Math.max(0, c - 1)));
  useBusEvent("task:deleted", () => setCount(c => Math.max(0, c - 1)));

  if (count === 0) return null;

  return (
    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground">
      {count}
    </span>
  );
}

// ── FocusMiniPlayer ────────────────────────────────────────────
function FocusMiniPlayer({ collapsed }: { collapsed: boolean }) {
  const [active, setActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [type, setType] = useState<"focus" | "short_break" | "long_break">("focus");
  const onNavigate = useShellStore((s) => s.onNavigate);

  useBusEvent("focus:session-started", ({ session }) => {
    setActive(true);
    setType(session.type as any);
    const duration = session.plannedMinutes ?? session.plannedDuration ?? 25;
    setTimeLeft(duration * 60);
  });
  useBusEvent("focus:session-completed", () => {
    setActive(false);
  });
  useBusEvent("focus:tick", ({ remainingSeconds }) => {
    setTimeLeft(remainingSeconds);
    setActive(true);
  });

  if (!active) return null;

  const m = Math.floor(timeLeft / 60);
  const s = timeLeft % 60;
  const timeStr = `${m}:${s.toString().padStart(2, "0")}`;

  return (
    <div
      onClick={() => {
        onNavigate("/focus", "Focus", "focus");
        bus.emit("navigate:to", { path: "/focus" });
      }}
      className={cn(
        "mx-2 mb-2 p-2 rounded-md border cursor-pointer transition-fast",
        "bg-primary/10 border-primary/20 text-primary hover:bg-primary/20",
        collapsed ? "flex justify-center" : "flex items-center justify-between"
      )}
      title="Active Focus Session"
    >
      <div className="flex items-center gap-2">
        <Timer size={14} className="animate-pulse" />
        {!collapsed && <span className="text-[12px] font-semibold">{timeStr}</span>}
      </div>
      {!collapsed && (
        <span className="text-[10px] uppercase tracking-wider font-semibold opacity-80">
          {type === "focus" ? "Focusing" : "Break"}
        </span>
      )}
    </div>
  );
}
