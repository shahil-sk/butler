import { useEffect, useCallback, useMemo } from "react";
import { Command } from "cmdk";
import { useShellStore } from "@/shell/store";
import { bus } from "@/kernel/event-bus";
import { useBusEvent } from "@/kernel/event-bus";
import { registry } from "@/kernel/router";
import {
  CheckSquare, FolderKanban, CalendarDays, FileText,
  BookOpen, Timer, Zap, Database, Search, FileSearch,
  Settings, Plus, ArrowRight, Clock,
  Moon, Sun, Monitor, Columns, XSquare,
} from "lucide-react";
import { cn } from "@/shared/utils";

const STATIC_COMMANDS = [
  { id: "new-task",  label: "New task",   group: "Create", icon: Plus,     action: () => bus.emit("task:quick-add", {}) },
  { id: "new-note",  label: "New note",   group: "Create", icon: Plus,     action: () => bus.emit("navigate:to", { path: "/notes/new" }) },
  { id: "settings",  label: "Settings",   group: "App",    icon: Settings, action: () => bus.emit("navigate:to", { path: "/settings" }) },
  { id: "search",    label: "Search all", group: "App",    icon: Search,   action: () => bus.emit("search:open", {}) },
  { id: "theme-dark",   label: "Dark mode",     group: "App", icon: Moon,     action: () => useShellStore.getState().updateSettings({ theme: "dark" }) },
  { id: "theme-light",  label: "Light mode",    group: "App", icon: Sun,      action: () => useShellStore.getState().updateSettings({ theme: "light" }) },
  { id: "theme-system", label: "System theme",  group: "App", icon: Monitor,  action: () => useShellStore.getState().updateSettings({ theme: "system" }) },
  { id: "split-panel",  label: "Split panel",   group: "App", icon: Columns,  action: () => useShellStore.getState().activePanelId && useShellStore.getState().splitPanel(useShellStore.getState().activePanelId!) },
  { id: "close-panel",  label: "Close panel",   group: "App", icon: XSquare,  action: () => useShellStore.getState().activePanelId && useShellStore.getState().closePanel(useShellStore.getState().activePanelId!) },
];

const NAV_COMMANDS = [
  { id: "nav-tasks",    label: "Tasks",    icon: CheckSquare,  path: "/tasks",    moduleId: "tasks" },
  { id: "nav-projects", label: "Projects", icon: FolderKanban, path: "/projects", moduleId: "projects" },
  { id: "nav-planner",  label: "Planner",  icon: CalendarDays, path: "/planner",  moduleId: "planner" },
  { id: "nav-notes",    label: "Notes",    icon: FileText,     path: "/notes",    moduleId: "notes" },
  { id: "nav-calendar", label: "Calendar", icon: CalendarDays, path: "/calendar", moduleId: "calendar" },
  { id: "nav-journal",  label: "Journal",  icon: BookOpen,     path: "/journal",  moduleId: "journal" },
  { id: "nav-focus",    label: "Focus",    icon: Zap,          path: "/focus",    moduleId: "focus" },
];

function getIconForGroup(groupName: string) {
  const name = groupName.toLowerCase();
  if (name.includes("task")) return CheckSquare;
  if (name.includes("project")) return FolderKanban;
  if (name.includes("note")) return FileText;
  if (name.includes("calendar")) return CalendarDays;
  if (name.includes("planner")) return CalendarDays;
  if (name.includes("journal")) return BookOpen;
  if (name.includes("focus")) return Zap;
  if (name.includes("time")) return Clock;
  if (name.includes("database")) return Database;
  if (name.includes("research")) return FileSearch;
  return Zap;
}

export function CommandPalette() {
  const {
    commandPaletteOpen,
    commandPaletteQuery,
    closeCommandPalette,
    setCommandPaletteQuery,
    onNavigate,
    recentPaths,
  } = useShellStore();

  useBusEvent("command-palette:open", () => {
    useShellStore.getState().openCommandPalette();
  });

  const runAction = useCallback(
    (action: () => void) => { closeCommandPalette(); action(); },
    [closeCommandPalette]
  );

  const runRegistryCommand = useCallback((cmd: any) => {
    closeCommandPalette();

    if (cmd.action === "navigate:to") {
      let path = "";
      if (cmd.id === "note.new") path = "/notes/new";
      else if (cmd.id === "note.today") path = `/notes/daily/${new Date().toISOString().slice(0, 10)}`;
      else if (cmd.id === "planner.today") path = "/planner";
      else if (cmd.id === "planner.day") path = "/planner/day";
      else if (cmd.id === "planner.week") path = "/planner/week";
      else {
        const mod = registry.get(cmd.moduleId);
        path = mod?.routes[0]?.path ?? "/";
      }
      onNavigate(path, cmd.label, cmd.moduleId);
      bus.emit("navigate:to", { path });
      return;
    }

    let payload: any = undefined;
    if (cmd.action === "journal:open-date") {
      payload = { date: new Date().toISOString().slice(0, 10) };
    }
    bus.emit(cmd.action as any, payload);
  }, [closeCommandPalette, onNavigate]);

  const navTo = useCallback(
    (path: string, label: string, moduleId: string) => {
      closeCommandPalette();
      onNavigate(path, label, moduleId);
      bus.emit("navigate:to", { path });
    },
    [closeCommandPalette, onNavigate]
  );

  const registryCommands = useMemo(() => {
    return registry.getAllCommands();
  }, [commandPaletteOpen]);

  const groupedRegistryCommands = useMemo(() => {
    const groups: Record<string, typeof registryCommands> = {};
    registryCommands.forEach((cmd) => {
      // Avoid duplicates with nav commands
      if (cmd.action === "navigate:to" && NAV_COMMANDS.some(nav => nav.moduleId === cmd.moduleId && nav.path === `/` + cmd.moduleId)) {
        return;
      }
      (groups[cmd.group] ??= []).push(cmd);
    });
    return groups;
  }, [registryCommands]);

  if (!commandPaletteOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[3px]"
        onClick={closeCommandPalette}
      />

      {/* Palette */}
      <div
        className="relative z-10 w-full max-w-[560px] mx-4 rounded-xl border border-border bg-popover overflow-hidden animate-fade-in"
        style={{ boxShadow: "var(--shadow-popover)" }}
      >
        <Command
          value={commandPaletteQuery}
          onValueChange={setCommandPaletteQuery}
          className="flex flex-col"
        >
          {/* Search input */}
          <div className="flex items-center gap-2.5 px-3.5 border-b border-border">
            <Search size={14} className="text-muted-foreground shrink-0" />
            <Command.Input
              placeholder="Type a command or search…"
              className={cn(
                "flex-1 h-11 bg-transparent text-sm outline-none",
                "placeholder:text-muted-foreground/60 font-normal"
              )}
              autoFocus
              onKeyDown={(e) => { if (e.key === "Escape") closeCommandPalette(); }}
            />
            <kbd className="kbd">esc</kbd>
          </div>

          <Command.List className="max-h-[380px] overflow-y-auto p-1.5 space-y-0.5">
            <Command.Empty className="py-10 text-center text-sm text-muted-foreground">
              No exact matches found. 
            </Command.Empty>

            {/* AI Natural Language Task Creation */}
            {commandPaletteQuery.length > 2 && (
              <Command.Group heading="AI Actions" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground/50">
                <CommandItem
                  key="ai-create-task"
                  icon={<Zap size={13} className="text-purple-500" />}
                  label={`Create task: "${commandPaletteQuery}"`}
                  onSelect={() => {
                    closeCommandPalette();
                    bus.emit("ai:create-task", { query: commandPaletteQuery });
                  }}
                />
              </Command.Group>
            )}

            {/* Recent */}
            {recentPaths.length > 0 && (
              <Command.Group
                heading="Recent"
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground/50"
              >
                {recentPaths.slice(0, 3).map((path) => {
                  const nav = NAV_COMMANDS.find((n) => n.path === path);
                  if (!nav) return null;
                  return (
                    <CommandItem
                      key={path}
                      icon={<Clock size={13} />}
                      label={nav.label}
                      onSelect={() => navTo(nav.path, nav.label, nav.moduleId)}
                    />
                  );
                })}
              </Command.Group>
            )}

            {/* Navigate */}
            <Command.Group
              heading="Navigate"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground/50"
            >
              {NAV_COMMANDS.map((cmd) => {
                const Icon = cmd.icon;
                return (
                  <CommandItem
                    key={cmd.id}
                    icon={<Icon size={13} />}
                    label={cmd.label}
                    onSelect={() => navTo(cmd.path, cmd.label, cmd.moduleId)}
                    suffix={<ArrowRight size={11} className="text-muted-foreground/40" />}
                  />
                );
              })}
            </Command.Group>

            {/* Actions */}
            <Command.Group
              heading="Actions"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground/50"
            >
              {STATIC_COMMANDS.map((cmd) => {
                const Icon = cmd.icon;
                return (
                  <CommandItem
                    key={cmd.id}
                    icon={<Icon size={13} />}
                    label={cmd.label}
                    group={cmd.group}
                    onSelect={() => runAction(cmd.action)}
                  />
                );
              })}
            </Command.Group>

            {/* Module Commands */}
            {Object.entries(groupedRegistryCommands).map(([group, cmds]) => (
              <Command.Group
                key={group}
                heading={group}
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground/50"
              >
                {cmds.map((cmd) => {
                  const Icon = getIconForGroup(cmd.group);
                  return (
                    <CommandItem
                      key={cmd.id}
                      icon={<Icon size={13} />}
                      label={cmd.label}
                      group={cmd.moduleName}
                      onSelect={() => runRegistryCommand(cmd)}
                      suffix={cmd.shortcut && <kbd className="kbd text-[9px] px-1 py-0.5">{cmd.shortcut}</kbd>}
                    />
                  );
                })}
              </Command.Group>
            ))}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}

function CommandItem({
  icon,
  label,
  group,
  suffix,
  onSelect,
}: {
  icon: React.ReactNode;
  label: string;
  group?: string;
  suffix?: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      value={label}
      onSelect={onSelect}
      className={cn(
        "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm cursor-pointer",
        "text-foreground transition-fast",
        "data-[selected=true]:bg-accent data-[selected=true]:text-foreground",
        "hover:bg-accent"
      )}
    >
      <span className="text-muted-foreground shrink-0 w-[18px] flex items-center justify-center">
        {icon}
      </span>
      <span className="flex-1 font-normal">{label}</span>
      {group && (
        <span className="text-[10px] text-muted-foreground/50 hidden sm:block font-medium uppercase tracking-wide">
          {group}
        </span>
      )}
      {suffix}
    </Command.Item>
  );
}
