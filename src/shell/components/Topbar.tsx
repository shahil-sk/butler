import { useState, useEffect } from "react";
import { format } from "date-fns";
import { cn } from "@/shared/utils";
import { useShellStore } from "@/shell/store";
import { useTheme } from "@/shell/components/ThemeProvider";
import { bus } from "@/kernel/event-bus";
import { CheckSquare, FolderKanban, CalendarDays, Target, Activity, Focus, Timer, Bot, Search, Plus, Settings, Sun, Moon, Inbox } from "lucide-react";

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
    <header className="w-full flex justify-center items-center p-2 sm:p-4 pb-0 shrink-0 z-50 bg-transparent">
      <div className="w-full max-w-[1600px] bg-background/60 backdrop-blur-2xl border border-border/40 rounded-3xl sm:rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] flex flex-wrap xl:flex-nowrap items-center justify-between px-3 sm:px-4 py-2 sm:py-0 sm:min-h-[4rem] relative gap-y-3 z-50">
        
        {/* Subtle inner glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 rounded-3xl sm:rounded-[2rem] pointer-events-none" />
        
        {/* Left Side: Brand & Time */}
        <div className="flex items-center gap-4 z-10 w-auto xl:w-[280px] shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-background shadow-sm border border-border/40 rounded-xl transition-transform hover:scale-105 cursor-default">
              <img src={appIcon} alt="Butler" width={24} height={24} className="rounded-lg w-5 h-5 sm:w-6 sm:h-6" draggable={false} />
            </div>
            <span className="text-[15px] font-bold tracking-tight text-foreground">Butler</span>
          </div>
          <div className="hidden 2xl:block w-px h-5 bg-border/50" />
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground hidden 2xl:block bg-muted/40 px-3 py-1.5 rounded-full border border-border/30 backdrop-blur-md">
            {timeStr}
          </span>
        </div>

        {/* Center: Navigation Pill */}
        <nav className="order-last xl:order-none w-full xl:w-auto flex justify-start sm:justify-center overflow-x-auto scrollbar-none z-20 pb-1 sm:pb-0">
          <div className="flex items-center gap-1 p-1 bg-muted/20 border border-border/30 rounded-full backdrop-blur-xl shrink-0 min-w-min mx-auto xl:mx-0">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeSidebarItem === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(item)}
                  title={item.label}
                  className={cn(
                    "relative flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full text-[13px] font-semibold transition-all duration-300 ease-out group shrink-0",
                    isActive
                      ? "text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {isActive && (
                    <span className="absolute inset-0 bg-background dark:bg-muted/80 rounded-full -z-10 shadow-sm border border-border/50" />
                  )}
                  {!isActive && (
                    <span className="absolute inset-0 bg-muted/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 -z-10" />
                  )}
                  <Icon size={16} strokeWidth={isActive ? 2.5 : 2} className={cn("transition-transform duration-300", isActive ? "scale-110" : "")} />
                  <span className="hidden md:inline tracking-wide">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Right Side: Quick Actions */}
        <div className="flex items-center justify-end gap-1 sm:gap-2 z-10 w-auto xl:w-[280px] shrink-0">
          <button 
            onClick={() => bus.emit("task:quick-add", {})} 
            className="flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-all duration-300 font-bold text-xs tracking-wider uppercase"
            title="New Task (⌘N)"
          >
            <Plus size={14} strokeWidth={3} />
            <span className="hidden sm:inline">Add Task</span>
            <span className="inline sm:hidden">Add</span>
          </button>

          <button 
            onClick={() => bus.emit("triage:open")} 
            className="p-2 rounded-full text-muted-foreground hover:bg-red-500/10 hover:text-red-500 border border-transparent hover:border-red-500/30 transition-all duration-200 ml-1" 
            title="Triage Missed Items"
          >
            <Inbox size={16} className="sm:w-[18px] sm:h-[18px]" strokeWidth={2.5} />
          </button>

          <div className="w-px h-5 bg-border/50 mx-1 hidden sm:block" />

          <button 
            onClick={() => openCommandPalette()} 
            className="p-2 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent hover:border-border/50 transition-all duration-200" 
            title="Search (⌘K)"
          >
            <Search size={16} className="sm:w-[18px] sm:h-[18px]" strokeWidth={2.5} />
          </button>
          
          <button 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} 
            className="p-2 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent hover:border-border/50 transition-all duration-200" 
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun size={16} className="sm:w-[18px] sm:h-[18px]" strokeWidth={2.5} /> : <Moon size={16} className="sm:w-[18px] sm:h-[18px]" strokeWidth={2.5} />}
          </button>
          
          <button 
            onClick={() => bus.emit("navigate:to", { path: "/settings" })} 
            className="p-2 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent hover:border-border/50 transition-all duration-200"
            title="Settings"
          >
            <Settings size={16} className="sm:w-[18px] sm:h-[18px]" strokeWidth={2.5} />
          </button>
        </div>
        
      </div>
    </header>
  );
}
