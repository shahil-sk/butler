import React, { useEffect, useState, useRef } from "react";
import { useLayoutStore } from "../../core/state/layoutStore";
import { Search, Command, Sun, Sidebar, CheckSquare, Calendar, Compass, Clock, BookOpen, Settings, Flame, FolderKanban, Target, FileText, Database, FolderOpen } from "lucide-react";

interface PaletteCommand {
  id: string;
  name: string;
  category: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
}

export const CommandPalette: React.FC = () => {
  const {
    commandPaletteOpen,
    setCommandPaletteOpen,
    toggleTheme,
    toggleSidebar,
    addTab,
  } = useLayoutStore();

  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const commands: PaletteCommand[] = [
    {
      id: "toggle-sidebar",
      name: "Toggle Sidebar",
      category: "Navigation",
      icon: <Sidebar className="w-4 h-4" />,
      shortcut: "⌘B",
      action: () => toggleSidebar(),
    },
    {
      id: "toggle-theme",
      name: "Toggle Dark/Light Theme",
      category: "Appearance",
      icon: <Sun className="w-4 h-4" />,
      shortcut: "⌘T",
      action: () => toggleTheme(),
    },
    {
      id: "nav-tasks",
      name: "Go to Tasks",
      category: "Modules",
      icon: <CheckSquare className="w-4 h-4" />,
      action: () => addTab("Tasks", "tasks"),
    },
    {
      id: "nav-planner",
      name: "Go to Daily Planner",
      category: "Modules",
      icon: <Calendar className="w-4 h-4" />,
      action: () => addTab("Planner", "planner"),
    },
    {
      id: "nav-notes",
      name: "Go to Notes (Second Brain)",
      category: "Modules",
      icon: <BookOpen className="w-4 h-4" />,
      action: () => addTab("Notes", "notes"),
    },
    {
      id: "nav-calendar",
      name: "Go to Calendar",
      category: "Modules",
      icon: <Compass className="w-4 h-4" />,
      action: () => addTab("Calendar", "calendar"),
    },
    {
      id: "nav-focus",
      name: "Go to Focus & Pomodoro",
      category: "Modules",
      icon: <Clock className="w-4 h-4" />,
      action: () => addTab("Focus", "focus"),
    },
    {
      id: "nav-journal",
      name: "Go to Journal",
      category: "Modules",
      icon: <BookOpen className="w-4 h-4" />,
      action: () => addTab("Journal", "journal"),
    },
    {
      id: "nav-habits",
      name: "Go to Habits & Routines",
      category: "Modules",
      icon: <Flame className="w-4 h-4" />,
      action: () => addTab("Habits", "habits"),
    },
    {
      id: "nav-projects",
      name: "Go to Projects Workspace",
      category: "Modules",
      icon: <FolderKanban className="w-4 h-4" />,
      action: () => addTab("Projects", "projects"),
    },
    {
      id: "nav-goals",
      name: "Go to Goals & OKRs",
      category: "Modules",
      icon: <Target className="w-4 h-4" />,
      action: () => addTab("Goals", "goals"),
    },
    {
      id: "nav-documents",
      name: "Go to Documents System",
      category: "Modules",
      icon: <FileText className="w-4 h-4" />,
      action: () => addTab("Documents", "documents"),
    },
    {
      id: "nav-databases",
      name: "Go to Databases (Custom Tables)",
      category: "Modules",
      icon: <Database className="w-4 h-4" />,
      action: () => addTab("Databases", "databases"),
    },
    {
      id: "nav-media",
      name: "Go to Media & Attachments",
      category: "Modules",
      icon: <FolderOpen className="w-4 h-4" />,
      action: () => addTab("Media & Files", "media"),
    },
    {
      id: "nav-settings",
      name: "Go to Settings",
      category: "System",
      icon: <Settings className="w-4 h-4" />,
      action: () => addTab("Settings", "settings"),
    },
  ];

  const filtered = commands.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.category.toLowerCase().includes(search.toLowerCase())
  );

  // Toggle palette on Ctrl+K or Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  // Focus input when opened
  useEffect(() => {
    if (commandPaletteOpen) {
      setSearch("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [commandPaletteOpen]);

  // Handle outside clicks
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setCommandPaletteOpen(false);
      }
    };
    if (commandPaletteOpen) {
      window.addEventListener("mousedown", handleOutsideClick);
    }
    return () => window.removeEventListener("mousedown", handleOutsideClick);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  // Keyboard navigation inside palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setCommandPaletteOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action();
        setCommandPaletteOpen(false);
      }
    }
  };

  if (!commandPaletteOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-start justify-center pt-[15vh] z-50 p-4">
      <div
        ref={containerRef}
        className="w-full max-w-xl bg-zinc-900/95 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden text-zinc-100 flex flex-col"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center px-4 py-3 border-b border-zinc-800">
          <Search className="w-5 h-5 text-zinc-400 mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-transparent border-0 outline-hidden placeholder-zinc-500 text-sm focus:ring-0 focus:outline-hidden"
            placeholder="Type a command or search modules..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedIndex(0);
            }}
          />
          <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-sm border border-zinc-700 font-mono">ESC</span>
        </div>

        <div className="max-h-[320px] overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-zinc-500">
              No results found for "{search}"
            </div>
          ) : (
            filtered.map((cmd, idx) => (
              <div
                key={cmd.id}
                onClick={() => {
                  cmd.action();
                  setCommandPaletteOpen(false);
                }}
                className={`flex items-center justify-between px-4 py-2.5 mx-2 rounded-lg cursor-pointer transition-colors ${
                  idx === selectedIndex
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="text-zinc-400">{cmd.icon}</div>
                  <span className="text-sm font-medium">{cmd.name}</span>
                  <span className="text-[10px] text-zinc-600 bg-zinc-950/40 px-1.5 py-0.5 rounded-sm uppercase tracking-wide">
                    {cmd.category}
                  </span>
                </div>
                {cmd.shortcut && (
                  <span className="text-xs text-zinc-500 font-mono">{cmd.shortcut}</span>
                )}
              </div>
            ))
          )}
        </div>
        
        <div className="flex items-center justify-between px-4 py-2 bg-zinc-950/50 border-t border-zinc-800/60 text-[11px] text-zinc-500">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
          </div>
          <div className="flex items-center gap-1">
            <Command className="w-3 h-3" />
            <span>+ K to open/close</span>
          </div>
        </div>
      </div>
    </div>
  );
};
