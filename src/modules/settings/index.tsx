// ============================================================
// SETTINGS MODULE — /settings/*
// Tabs: General | Integrations | Shortcuts | Appearance
// ============================================================

import { useState } from "react";
import {
  Settings, Zap, Keyboard, Palette,
  Sun, Moon, Monitor, ChevronRight,
} from "lucide-react";
import { cn } from "@/shared/utils";
import { IntegrationDashboard } from "@/modules/integration/IntegrationDashboard";
import { useShellStore } from "@/shell/store";

type Tab = "general" | "integrations" | "shortcuts" | "appearance";

const TABS: { id: Tab; label: string; icon: typeof Settings }[] = [
  { id: "general",      label: "General",      icon: Settings  },
  { id: "integrations", label: "Integrations", icon: Zap       },
  { id: "shortcuts",    label: "Shortcuts",    icon: Keyboard  },
  { id: "appearance",   label: "Appearance",   icon: Palette   },
];

const SHORTCUTS: { keys: string[]; description: string; module?: string }[] = [
  { keys: ["Cmd", "K"],        description: "Open command palette",      module: "Global" },
  { keys: ["Cmd", "Shift", "F"], description: "Global search",          module: "Global" },
  { keys: ["Cmd", "N"],        description: "New task (quick add)",      module: "Tasks" },
  { keys: ["Cmd", "Enter"],    description: "Save / confirm dialog",     module: "Global" },
  { keys: ["Escape"],          description: "Close modal / cancel",      module: "Global" },
  { keys: ["Cmd", "G"],        description: "Jump to date",              module: "Calendar" },
  { keys: ["Cmd", "K"],        description: "Note quick-search overlay", module: "Notes" },
  { keys: ["Cmd", "K"],        description: "Journal quick-search",      module: "Journal" },
  { keys: ["Space"],           description: "Start / pause focus timer", module: "Focus" },
  { keys: ["Cmd", "["],        description: "Previous period",           module: "Calendar" },
  { keys: ["Cmd", "]"],        description: "Next period",               module: "Calendar" },
  { keys: ["Cmd", "T"],        description: "Go to today",               module: "Calendar" },
  { keys: ["Cmd", "1-9"],   description: "Switch sidebar item",       module: "Global" },
];

export function SettingsModule() {
  const [activeTab, setActiveTab] = useState<Tab>("general");

  return (
    <div className="flex h-full min-h-0 overflow-hidden" style={{ background: "hsl(var(--background))" }}>
      {/* Sidebar nav */}
      <nav
        className="flex flex-col shrink-0 py-3 px-2 gap-0.5"
        style={{ width: 180, borderRight: "1px solid hsl(var(--border))", background: "hsl(var(--surface-1))" }}
      >
        <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
          Settings
        </p>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-left transition-fast",
              activeTab === id
                ? "bg-primary/[0.08] text-primary font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
          >
            <Icon size={13} className="shrink-0" />
            <span className="flex-1">{label}</span>
            {activeTab === id && <ChevronRight size={11} className="text-primary/50" />}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
        {activeTab === "general"      && <GeneralTab />}
        {activeTab === "integrations" && <IntegrationDashboard />}
        {activeTab === "shortcuts"    && <ShortcutsTab />}
        {activeTab === "appearance"   && <AppearanceTab />}
      </div>
    </div>
  );
}

// ── General ─────────────────────────────────────────────────────

function GeneralTab() {
  return (
    <div className="flex-1 overflow-y-auto px-6 py-5">
      <h2 className="text-sm font-semibold text-foreground mb-4">General</h2>

      <section className="space-y-3 mb-8">
        <SectionHeader title="About" />
        <InfoRow label="App" value="Butler" />
        <InfoRow label="Version" value="v3.0.0-alpha" />
        <InfoRow label="Stack" value="Tauri 2 · React 19 · SQLite" />
        <InfoRow label="Theme engine" value="CSS custom properties · OKLCH" />
      </section>

      <section className="space-y-3 mb-8">
        <SectionHeader title="Data" />
        <SettingRow
          label="Auto-save"
          description="Automatically save changes every 30 seconds."
          defaultOn
        />
        <SettingRow
          label="Crash recovery"
          description="Keep a rolling backup of unsaved state in memory."
          defaultOn
        />
      </section>

      <section className="space-y-3">
        <SectionHeader title="Developer" />
        <SettingRow
          label="Debug bus logs"
          description="Log all event bus emissions to the browser console."
          defaultOn={false}
        />
      </section>
    </div>
  );
}

// ── Shortcuts ──────────────────────────────────────────────────

function ShortcutsTab() {
  const groups = Array.from(
    SHORTCUTS.reduce((map, s) => {
      const m = s.module ?? "Global";
      if (!map.has(m)) map.set(m, []);
      map.get(m)!.push(s);
      return map;
    }, new Map<string, typeof SHORTCUTS>())
  );

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5">
      <h2 className="text-sm font-semibold text-foreground mb-1">Keyboard Shortcuts</h2>
      <p className="text-xs text-muted-foreground mb-5">On macOS, ⌘ = Cmd. On Windows/Linux, Ctrl.</p>

      <div className="space-y-6">
        {groups.map(([module, shortcuts]) => (
          <div key={module}>
            <SectionHeader title={module} />
            <div className="rounded-lg border border-border overflow-hidden">
              {shortcuts.map(({ keys, description }, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-center justify-between px-4 py-2.5",
                    i < shortcuts.length - 1 && "border-b border-border/60"
                  )}
                >
                  <span className="text-xs text-foreground/80">{description}</span>
                  <div className="flex items-center gap-1">
                    {keys.map((k, ki) => (
                      <span key={ki}>
                        <kbd className="px-1.5 py-0.5 text-[10px] font-medium rounded border border-border bg-surface-2 text-foreground/70">
                          {k}
                        </kbd>
                        {ki < keys.length - 1 && (
                          <span className="text-[10px] text-muted-foreground/40 mx-0.5">+</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Appearance ─────────────────────────────────────────────────

type ThemeMode = "light" | "dark" | "system";

function AppearanceTab() {
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");

  const applyTheme = (mode: ThemeMode) => {
    setThemeMode(mode);
    const html = document.documentElement;
    if (mode === "system") {
      html.removeAttribute("data-theme");
    } else {
      html.setAttribute("data-theme", mode);
    }
  };

  const THEME_OPTIONS: { id: ThemeMode; label: string; icon: typeof Sun }[] = [
    { id: "light",  label: "Light",  icon: Sun     },
    { id: "dark",   label: "Dark",   icon: Moon    },
    { id: "system", label: "System", icon: Monitor },
  ];

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5">
      <h2 className="text-sm font-semibold text-foreground mb-4">Appearance</h2>

      <section className="mb-8">
        <SectionHeader title="Theme" />
        <div className="flex gap-3 mt-2">
          {THEME_OPTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => applyTheme(id)}
              className={cn(
                "flex flex-col items-center gap-2 px-5 py-4 rounded-xl border-2 transition-fast",
                themeMode === id
                  ? "border-primary bg-primary/[0.06]"
                  : "border-border hover:border-border/80 hover:bg-accent"
              )}
            >
              <Icon size={18} className={themeMode === id ? "text-primary" : "text-muted-foreground"} />
              <span className={cn(
                "text-xs font-medium",
                themeMode === id ? "text-primary" : "text-muted-foreground"
              )}>
                {label}
              </span>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground/50 mt-3">
          System follows your OS dark/light preference.
        </p>
      </section>

      <section className="space-y-3 mb-8">
        <SectionHeader title="Density" />
        <SettingRow
          label="Compact mode"
          description="Reduce spacing in lists and cards for more information density."
          defaultOn={false}
        />
        <SettingRow
          label="Large text"
          description="Increase base font size by 1 step for better readability."
          defaultOn={false}
        />
      </section>

      <section className="space-y-3">
        <SectionHeader title="Motion" />
        <SettingRow
          label="Reduce animations"
          description="Disable non-essential transitions and scroll animations."
          defaultOn={false}
        />
      </section>
    </div>
  );
}

// ── Shared sub-components ───────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-2">
      {title}
    </p>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-1.5 border-b border-border/40 last:border-0">
      <span className="text-xs text-muted-foreground/60 w-28 shrink-0">{label}</span>
      <span className="text-xs text-foreground/80">{value}</span>
    </div>
  );
}

function SettingRow({
  label, description, defaultOn,
}: {
  label: string;
  description: string;
  defaultOn: boolean;
}) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-border/40 last:border-0">
      <div>
        <p className="text-xs font-medium text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground/60 mt-0.5 leading-relaxed">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => setOn((v) => !v)}
        className={cn(
          "shrink-0 mt-0.5 w-8 h-4.5 rounded-full transition-colors duration-200 relative",
          on ? "bg-primary" : "bg-border"
        )}
        style={{ height: 18, width: 32 }}
      >
        <span
          className="absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform duration-200"
          style={{ transform: on ? "translateX(14px)" : "translateX(0)" }}
        />
      </button>
    </div>
  );
}
