import React from "react";
import { useLayoutStore } from "../core/state/layoutStore";
import { useAIStore } from "../core/state/aiStore";
import { AIAssistantPanel } from "../core/ui/AIAssistantPanel";
import { CommandPalette } from "../shared/ui/command-palette";
import { TasksView } from "../modules/tasks/ui/TasksView";
import { PlannerView } from "../modules/planner/ui/PlannerView";
import { NotesView } from "../modules/notes/ui/NotesView";
import { CalendarView } from "../modules/calendar/ui/CalendarView";
import { FocusView } from "../modules/focus/ui/FocusView";
import { TimeTrackingView } from "../modules/time_tracking/ui/TimeTrackingView";
import { JournalView } from "../modules/journal/ui/JournalView";
import { HabitsView } from "../modules/habits/ui/HabitsView";
import { ProjectsView } from "../modules/projects/ui/ProjectsView";
import { GoalsView } from "../modules/goals/ui/GoalsView";
import { DocumentsView } from "../modules/documents/ui/DocumentsView";
import { DatabasesView } from "../modules/databases/ui/DatabasesView";
import { MediaView } from "../modules/media/ui/MediaView";
import { SettingsView } from "../modules/settings/ui/SettingsView";
import { 
  CheckSquare, Calendar, BookOpen, Compass, Clock, Timer, Settings, 
  Menu, X, Command, Sun, Moon, Database, Flame, FolderKanban, Target,
  FileText, FolderOpen, Sparkles
} from "lucide-react";


export const Layout: React.FC = () => {
  const {
    theme,
    toggleTheme,
    sidebarOpen,
    toggleSidebar,
    tabs,
    activeTabId,
    setActiveTabId,
    closeTab,
    addTab,
    setCommandPaletteOpen
  } = useLayoutStore();

  const { panelOpen, setPanelOpen } = useAIStore();

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  const renderModule = (module: string) => {
    switch (module) {
      case "tasks":
        return <TasksView />;
      case "planner":
        return <PlannerView />;
      case "notes":
        return <NotesView />;
      case "projects":
        return <ProjectsView />;
      case "goals":
        return <GoalsView />;
      case "calendar":
        return <CalendarView />;
      case "focus":
        return <FocusView />;
      case "time_tracking":
        return <TimeTrackingView />;
      case "journal":
        return <JournalView />;
      case "habits":
        return <HabitsView />;
      case "documents":
        return <DocumentsView />;
      case "databases":
        return <DatabasesView />;
      case "media":
        return <MediaView />;
      case "settings":
        return <SettingsView />;
      default:
        return <TasksView />;
    }
  };

  const navItems = [
    { name: "Tasks", module: "tasks", icon: <CheckSquare className="w-4 h-4" /> },
    { name: "Planner", module: "planner", icon: <Calendar className="w-4 h-4" /> },
    { name: "Notes", module: "notes", icon: <BookOpen className="w-4 h-4" /> },
    { name: "Projects", module: "projects", icon: <FolderKanban className="w-4 h-4" /> },
    { name: "Goals", module: "goals", icon: <Target className="w-4 h-4" /> },
    { name: "Calendar", module: "calendar", icon: <Compass className="w-4 h-4" /> },
    { name: "Focus", module: "focus", icon: <Timer className="w-4 h-4" /> },
    { name: "Time", module: "time_tracking", icon: <Clock className="w-4 h-4" /> },
    { name: "Journal", module: "journal", icon: <BookOpen className="w-4 h-4" /> },
    { name: "Habits", module: "habits", icon: <Flame className="w-4 h-4" /> },
    { name: "Documents", module: "documents", icon: <FileText className="w-4 h-4" /> },
    { name: "Databases", module: "databases", icon: <Database className="w-4 h-4" /> },
    { name: "Media & Files", module: "media", icon: <FolderOpen className="w-4 h-4" /> },
    { name: "Settings", module: "settings", icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100 font-sans">
      {/* Sidebar */}
      <div 
        className={`bg-zinc-900/60 border-r border-zinc-850 flex flex-col transition-all duration-200 shrink-0 ${
          sidebarOpen ? "w-60" : "w-0 -translate-x-full lg:w-16 lg:translate-x-0"
        }`}
      >
        {/* Sidebar Header */}
        <div className="h-12 border-b border-zinc-850 flex items-center justify-between px-4 shrink-0 overflow-hidden">
          {sidebarOpen ? (
            <span className="text-xs font-bold tracking-wider uppercase text-zinc-400 flex items-center gap-2">
              <Command className="w-4 h-4 text-zinc-200" />
              Butler OS
            </span>
          ) : (
            <Command className="w-4 h-4 text-zinc-200 mx-auto" />
          )}
        </div>

        {/* Sidebar Navigation */}
        <div className="flex-1 py-4 overflow-y-auto px-2 space-y-1 overflow-hidden">
          {navItems.map((item) => {
            const isTabActive = activeTab && activeTab.module === item.module;
            return (
              <button
                key={item.module}
                onClick={() => addTab(item.name, item.module)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all group hover:bg-zinc-850 hover:text-zinc-250 cursor-pointer ${
                  isTabActive 
                    ? "bg-zinc-800 text-zinc-100" 
                    : "text-zinc-500"
                }`}
              >
                <div className={`${isTabActive ? "text-zinc-200" : "text-zinc-600 group-hover:text-zinc-400"}`}>
                  {item.icon}
                </div>
                {sidebarOpen && <span className="truncate">{item.name}</span>}
              </button>
            );
          })}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-zinc-850 shrink-0 flex flex-col gap-2 overflow-hidden">
          <button 
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium text-zinc-500 rounded-lg hover:bg-zinc-850 hover:text-zinc-200 transition-colors cursor-pointer"
          >
            {theme === "dark" ? <Sun className="w-4 h-4 text-zinc-500" /> : <Moon className="w-4 h-4 text-zinc-500" />}
            {sidebarOpen && <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>}
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-zinc-950/20">
        {/* Top Header & Tab Bar */}
        <div className="h-12 border-b border-zinc-850 flex items-center justify-between px-4 shrink-0 bg-zinc-950">
          <div className="flex items-center gap-3 min-w-0 flex-1 h-full">
            {/* Sidebar toggle */}
            <button 
              onClick={toggleSidebar}
              className="p-1.5 hover:bg-zinc-850 rounded-lg text-zinc-500 hover:text-zinc-200 transition-colors cursor-pointer"
            >
              <Menu className="w-4 h-4" />
            </button>

            {/* Tab Bar */}
            <div className="flex items-end gap-1.5 h-full overflow-x-auto min-w-0 scrollbar-none">
              {tabs.map((tab) => {
                const isActive = tab.id === activeTabId;
                return (
                  <div
                    key={tab.id}
                    className={`h-[38px] flex items-center gap-2 px-3 border-t-2 rounded-t-lg text-xs font-medium transition-all select-none shrink-0 group ${
                      isActive 
                        ? "bg-zinc-900 border-zinc-100 text-zinc-100" 
                        : "border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/40"
                    }`}
                  >
                    <button 
                      onClick={() => setActiveTabId(tab.id)}
                      className="cursor-pointer font-medium"
                    >
                      {tab.title}
                    </button>
                    {tabs.length > 1 && (
                      <button
                        onClick={() => closeTab(tab.id)}
                        className="p-0.5 rounded-sm hover:bg-zinc-800 text-zinc-700 hover:text-zinc-400 group-hover:opacity-100 transition-opacity cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Info & Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button 
              onClick={() => setCommandPaletteOpen(true)}
              className="text-xs bg-zinc-900 hover:bg-zinc-850 text-zinc-400 px-3 py-1.5 rounded-lg border border-zinc-800 flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Command className="w-3 h-3" />
              <span>Palette</span>
              <kbd className="text-[10px] bg-zinc-950 px-1 border border-zinc-800 rounded-sm">⌘K</kbd>
            </button>

            <button 
              onClick={() => setPanelOpen(!panelOpen)}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer flex items-center justify-center ${
                panelOpen 
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-400" 
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-850 hover:text-zinc-200"
              }`}
              title="Toggle AI Assistant"
            >
              <Sparkles className="w-4 h-4 animate-pulse" />
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden min-h-0 bg-zinc-900/10">
          {renderModule(activeTab.module)}
        </div>

        {/* Status Bar */}
        <div className="h-7 border-t border-zinc-850 bg-zinc-950 flex items-center justify-between px-4 text-[10px] text-zinc-500 shrink-0 font-medium select-none">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-zinc-400">SQLite Connected</span>
            </span>
          </div>
          <div>
            <span>Press <kbd className="bg-zinc-900 px-1 py-0.5 rounded-sm border border-zinc-800 font-mono">Ctrl+K</kbd> to launch anything</span>
          </div>
        </div>
      </div>

      {/* Overlays */}
      <CommandPalette />
      <AIAssistantPanel />
    </div>
  );
};
export default Layout;
