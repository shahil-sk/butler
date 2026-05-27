import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Settings, Save, AlertCircle, CheckCircle, Database } from "lucide-react";

export const SettingsView: React.FC = () => {
  const [userName, setUserName] = useState("");
  const [focusInterval, setFocusInterval] = useState("25");
  const [theme, setTheme] = useState("dark");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      const name = await invoke<string | null>("get_setting", { key: "user_name" });
      const focus = await invoke<string | null>("get_setting", { key: "focus_interval" });
      const currentTheme = await invoke<string | null>("get_setting", { key: "theme" });

      if (name) setUserName(name);
      if (focus) setFocusInterval(focus);
      if (currentTheme) setTheme(currentTheme);
    } catch (e: any) {
      console.error(e);
      setStatus({ type: "error", msg: "Failed to load settings from DB" });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    try {
      await invoke("set_setting", { key: "user_name", value: userName });
      await invoke("set_setting", { key: "focus_interval", value: focusInterval });
      await invoke("set_setting", { key: "theme", value: theme });
      setStatus({ type: "success", msg: "Settings saved successfully to SQLite DB!" });
    } catch (e: any) {
      console.error(e);
      setStatus({ type: "error", msg: "Failed to save settings to DB" });
    }
  }

  return (
    <div className="flex-1 flex flex-col p-6 overflow-hidden h-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
          <Settings className="w-6 h-6 text-zinc-400" />
          Settings
        </h1>
        <p className="text-sm text-zinc-400">Configure your personal environment and database preferences.</p>
      </div>

      {status && (
        <div className={`border rounded-lg p-3 text-xs mb-4 flex items-center gap-2 max-w-xl ${
          status.type === "success" 
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
            : "bg-destructive/15 border-destructive/30 text-destructive"
        }`}>
          {status.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {status.msg}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-zinc-500">Loading settings...</div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6 max-w-xl">
          <div className="space-y-4 bg-zinc-900/10 border border-zinc-850 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2 mb-2">
              <Database className="w-4 h-4 text-zinc-500" /> User Profile
            </h2>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-500 font-semibold uppercase">Profile Name</label>
              <input
                type="text"
                className="bg-zinc-950 border border-zinc-850 rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder-zinc-700 focus:outline-hidden focus:border-zinc-750"
                placeholder="Enter your name..."
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
              />
            </div>
            
            <div className="flex flex-col gap-1.5 mt-3">
              <label className="text-xs text-zinc-500 font-semibold uppercase">Default Focus Interval (Minutes)</label>
              <input
                type="number"
                className="bg-zinc-950 border border-zinc-850 rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder-zinc-700 focus:outline-hidden focus:border-zinc-750"
                value={focusInterval}
                onChange={(e) => setFocusInterval(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5 mt-3">
              <label className="text-xs text-zinc-500 font-semibold uppercase">Default Theme</label>
              <select
                className="bg-zinc-950 border border-zinc-850 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-hidden focus:border-zinc-750"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
              >
                <option value="dark">Dark Theme</option>
                <option value="light">Light Theme</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-bold px-4 py-2 rounded-lg text-xs flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" /> Save Settings
          </button>
        </form>
      )}
    </div>
  );
};
export default SettingsView;
