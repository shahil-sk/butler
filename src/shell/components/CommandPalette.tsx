import { useEffect, useCallback } from "react";
import { Command } from "cmdk";
import { useShellStore } from "@/shell/store";
import { bus } from "@/kernel/event-bus";
import { useBusEvent } from "@/kernel/event-bus";
import {
  CheckSquare, FolderKanban, CalendarDays, FileText,
  BookOpen, Timer, Zap, Database, Search, FileSearch,
  Settings, Plus, ArrowRight, Clock,
} from "lucide-react";
import { cn } from "@/shared/utils";

const STATIC_COMMANDS = [
  { id: "new-task",  label: "New task",   group: "Create", icon: Plus,     action: () => bus.emit("task:quick-add", {}) },
  { id: "new-note",  label: "New note",   group: "Create", icon: Plus,     action: () => bus.emit("navigate:to", { path: "/notes/new" }) },
  { id: "settings",  label: "Settings",   group: "App",    icon: Settings, action: () => bus.emit("navigate:to", { path: "/settings" }) },
  { id: "search",    label: "Search all", group: "App",    icon: Search,   action: () => bus.emit("search:open", {}) },
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

  const navTo = useCallback(
    (path: string, label: string, moduleId: string) => {
      closeCommandPalette();
      onNavigate(path, label, moduleId);
      bus.emit("navigate:to", { path });
    },
    [closeCommandPalette, onNavigate]
  );

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
              No results found.
            </Command.Empty>

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
