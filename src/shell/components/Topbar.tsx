import { useState, useEffect } from "react";
import { format } from "date-fns";
import { cn } from "@/shared/utils";
import { useShellStore } from "@/shell/store";
import { useTheme } from "@/shell/components/ThemeProvider";
import { bus } from "@/kernel/event-bus";
import { CheckSquare, FolderKanban, CalendarDays, Target, Activity, Focus, Timer, Bot, Search, Plus, Settings } from "lucide-react";

const appIcon = new URL("../../../src-tauri/icons/64x64.png", import.meta.url).href;

const NAV_ITEMS = [
  { id: "tasks",    label: "Tasks",    icon: CheckSquare,  path: "/tasks" },
  { id: "projects", label: "Projects", icon: FolderKanban, path: "/projects" },
  { id: "calendar", label: "Calendar", icon: CalendarDays, path: "/calendar" },
  { id: "focus",    label: "Focus & Time", icon: Timer,        path: "/focus" },
  { id: "habits",   label: "Habits",   icon: Activity,     path: "/habits" },
  { id: "goals",    label: "Goals",    icon: Target,       path: "/goals" },
  { id: "ai",       label: "AI",       icon: Bot,          path: "/ai" },
];

export function Topbar() {
  const { activeSidebarItem, onNavigate, openCommandPalette } = useShellStore();
  const { theme, setTheme } = useTheme();

  const [timeStr, setTimeStr] = useState("");
  useEffect(() => {
    const tick = () => setTimeStr(format(new Date(), "EEEE, MMM do hh:mm a"));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const navigate = (item: any) => {
    onNavigate(item.path, item.label, item.id);
    bus.emit("navigate:to", { path: item.path });
  };

  return (
    <header className="h-14 w-full flex items-center justify-between px-4 mac-glass border-b shrink-0 z-50">
      <div className="flex items-center gap-4 pr-2">
        <div className="flex items-center gap-2">
          <img src={appIcon} alt="Butler" width={24} height={24} className="rounded-md shadow-sm" draggable={false} />
          <span className="text-[14px] font-semibold tracking-tight text-foreground hidden sm:block">Butler</span>
        </div>
        <div className="hidden md:block w-px h-4 bg-border/50" />
        <span className="text-[11px] uppercase tracking-widest font-medium text-muted-foreground hidden md:block">
          {timeStr}
        </span>
      </div>

      <nav className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1 overflow-x-auto scrollbar-none max-w-[60vw]">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeSidebarItem === item.id;
          return (
            <button
              key={item.id}
              onClick={() => navigate(item)}
              title={item.label}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-fast whitespace-nowrap",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
              )}
            >
              <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
              <span className="hidden lg:inline">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="flex items-center gap-1.5 shrink-0 pl-4">
        <button onClick={() => bus.emit("task:quick-add", {})} className="p-1.5 rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-foreground transition-fast" title="New Task (⌘N)">
          <Plus size={16} />
        </button>
        <button onClick={() => openCommandPalette()} className="p-1.5 rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-foreground transition-fast" title="Search (⌘K)">
          <Search size={16} />
        </button>
        <div className="w-[1px] h-4 bg-border/80 mx-1" />
        <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-1.5 rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-foreground transition-fast border border-border bg-surface-1" title="Toggle Theme">
          <div className="w-[14px] h-[14px] rounded-full bg-gradient-to-tr from-foreground/40 to-transparent shadow-inner" />
        </button>
        <button onClick={() => bus.emit("navigate:to", { path: "/settings" })} className="p-1.5 rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-foreground transition-fast">
          <Settings size={16} />
        </button>
      </div>
    </header>
  );
}
