// ============================================================
// AI ASSISTANT MODULE — /ai
// Central hub for all AI features + configuration.
// ============================================================

import React, { useEffect, useState } from "react";
import {
  Bot, Wand2, Layers, FileText, MessageSquare, Settings2, Zap,
  CheckCircle2, AlertCircle, Clock, Loader2, ChevronRight, RotateCcw,
  Sparkles, Brain, FileSearch, Calendar, Target,
} from "lucide-react";
import { cn } from "@/shared/utils";
import { registry } from "@/kernel/router";
import { AI_MANIFEST } from "./manifest";
import { useAIStore } from "./store";
import { ChatPanel } from "./components/ChatPanel";
import { NLTaskCreator } from "./components/NLTaskCreator";
import type { AIProvider } from "@/shared/types";

registry.register(AI_MANIFEST);

// ── Feature cards ─────────────────────────────────────────────

const AI_FEATURES = [
  { id: "task_nl",        icon: Wand2,        label: "NL Task Creator",        desc: "Turn plain English into structured tasks instantly.",             color: "text-purple-400", bg: "bg-purple-500/10" },
  { id: "task_breakdown", icon: Layers,        label: "Task Breakdown",         desc: "Split complex tasks into 3-8 actionable subtasks.",              color: "text-blue-400",   bg: "bg-blue-500/10"   },
  { id: "note_summary",   icon: FileText,      label: "Note Summarisation",     desc: "Get a 3-5 sentence summary of any note or document.",            color: "text-green-400",  bg: "bg-green-500/10"  },
  { id: "meeting_notes",  icon: FileSearch,    label: "Meeting Notes",          desc: "Extract decisions, action items & questions from transcripts.",  color: "text-orange-400", bg: "bg-orange-500/10" },
  { id: "journal_prompts",icon: Brain,         label: "Journal Prompts",        desc: "Personalised reflection questions based on your day.",           color: "text-pink-400",   bg: "bg-pink-500/10"   },
  { id: "goal_health",    icon: Target,        label: "Goal Health Report",     desc: "Monthly AI assessment of goal trajectory and momentum.",         color: "text-amber-400",  bg: "bg-amber-500/10"  },
  { id: "schedule",       icon: Calendar,      label: "Smart Scheduling",       desc: "Propose a time-blocked day plan based on tasks & energy.",       color: "text-cyan-400",   bg: "bg-cyan-500/10"   },
  { id: "connections",    icon: Sparkles,      label: "Note Connections",       desc: "Surface related notes via semantic similarity matching.",         color: "text-indigo-400", bg: "bg-indigo-500/10" },
];

const PROVIDERS: { id: AIProvider; label: string; description: string; needsKey: boolean }[] = [
  { id: "local_ollama", label: "Ollama (Local)",   description: "Run any open-weight model. No data leaves your machine.",      needsKey: false },
  { id: "lm_studio",   label: "LM Studio",         description: "OpenAI-compatible local server. Load any GGUF model via GUI.", needsKey: false },
  { id: "openai",      label: "OpenAI",             description: "GPT-4o, GPT-4o-mini. Fast, capable, cloud-based.",             needsKey: true  },
  { id: "anthropic",   label: "Anthropic",          description: "Claude 3 Haiku / Sonnet. Excellent for long context.",          needsKey: true  },
  { id: "gemini",      label: "Google Gemini",      description: "Gemini 1.5 Flash / Pro. Competitive pricing.",                 needsKey: true  },
];

const COMMON_MODELS: Record<AIProvider, string[]> = {
  local_ollama: ["llama3.2", "llama3.2:3b", "llama3.1", "mistral", "phi3", "gemma2", "deepseek-r1:8b", "qwen2.5"],
  lm_studio:    [], // populated dynamically from /v1/models
  openai:       ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo"],
  anthropic:    ["claude-3-haiku-20240307", "claude-3-5-sonnet-20241022"],
  gemini:       ["gemini-1.5-flash", "gemini-1.5-pro"],
};

// ── Main module ───────────────────────────────────────────────

type View = "hub" | "chat" | "config" | "try_nl";

export default function AIModule() {
  const {
    config, isAvailable, availableModel, availableProvider, isCheckingAvailability,
    loadConfig, saveConfig, checkAvailability, recentActions, loadRecentActions,
  } = useAIStore();

  const [view, setView] = useState<View>("hub");
  const [configDraft, setConfigDraft] = useState<Partial<typeof config>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void loadConfig();
    void checkAvailability();
    void loadRecentActions();
  }, []);

  useEffect(() => {
    if (config) setConfigDraft(config);
  }, [config]);

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      await saveConfig(configDraft as any);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-background">
      {/* Sidebar nav */}
      <nav
        className="flex flex-col shrink-0 py-3 px-2 gap-0.5"
        style={{ width: 200, borderRight: "1px solid hsl(var(--border))", background: "hsl(var(--surface-1))" }}
      >
        <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
          AI Assistant
        </p>
        {([
          { id: "hub",    label: "Overview",      icon: Bot         },
          { id: "chat",   label: "Chat",          icon: MessageSquare },
          { id: "try_nl", label: "NL Task Parser", icon: Wand2       },
          { id: "config", label: "Configuration", icon: Settings2   },
        ] as { id: View; label: string; icon: typeof Bot }[]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={cn(
              "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm text-left transition-fast w-full",
              view === id
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
          >
            <Icon size={14} className="shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </nav>

      {/* Content */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        {view === "hub" && (
          <HubView
            isAvailable={isAvailable}
            isChecking={isCheckingAvailability}
            availableModel={availableModel}
            availableProvider={availableProvider}
            config={config}
            onGoConfig={() => setView("config")}
            onGoChat={() => setView("chat")}
            onCheck={() => void checkAvailability()}
            recentActions={recentActions}
          />
        )}
        {view === "chat" && (
          <div className="h-full" style={{ maxHeight: "100%" }}>
            <ChatPanel contextType="global" className="h-full" />
          </div>
        )}
        {view === "try_nl" && (
          <NLView />
        )}
        {view === "config" && (
          <ConfigView
            config={config}
            draft={configDraft as any}
            setDraft={setConfigDraft as any}
            isSaving={isSaving}
            onSave={() => void handleSaveConfig()}
          />
        )}
      </div>
    </div>
  );
}

// ── Hub view ──────────────────────────────────────────────────

function HubView({
  isAvailable, isChecking, availableModel, availableProvider, config,
  onGoConfig, onGoChat, onCheck, recentActions,
}: any) {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      {/* Status card */}
      <div className={cn(
        "dashboard-card p-4 flex items-center gap-4",
        isAvailable ? "border-green-500/30" : "border-red-500/30"
      )}>
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
          isAvailable ? "bg-green-500/10" : "bg-red-500/10"
        )}>
          <Bot size={20} className={isAvailable ? "text-green-400" : "text-red-400"} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              {isAvailable ? "AI is ready" : "AI not connected"}
            </span>
            {isAvailable && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 font-medium">
                {availableProvider}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {isAvailable
              ? `Model: ${availableModel || config?.localModel || "configured"}`
              : config
                ? "Provider unreachable — check config or start Ollama."
                : "Configure a provider to get started."
            }
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onCheck}
            disabled={isChecking}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground transition-colors"
            title="Recheck"
          >
            <RotateCcw size={13} className={cn(isChecking && "animate-spin")} />
          </button>
          {!isAvailable && (
            <button
              onClick={onGoConfig}
              className="h-7 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
            >
              Configure
            </button>
          )}
          {isAvailable && (
            <button
              onClick={onGoChat}
              className="h-7 px-3 rounded-md bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
            >
              Open Chat
            </button>
          )}
        </div>
      </div>

      {/* Feature grid */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-3">
          AI Features
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {AI_FEATURES.map((f) => (
            <div key={f.id} className="dashboard-card p-4 flex items-start gap-3 hover:border-border/80 transition-colors">
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", f.bg)}>
                <f.icon size={16} className={f.color} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">{f.label}</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent AI actions */}
      {recentActions.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-3">
            Recent Actions
          </h2>
          <div className="space-y-1">
            {recentActions.slice(0, 5).map((action: any) => (
              <div key={action.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent/50 transition-colors">
                <Zap size={12} className="text-primary shrink-0" />
                <span className="text-xs text-foreground flex-1 truncate capitalize">
                  {action.actionType.replace(/_/g, " ")}
                </span>
                <div className="flex items-center gap-1.5">
                  {action.accepted === true && <CheckCircle2 size={12} className="text-green-400" />}
                  {action.accepted === false && <AlertCircle size={12} className="text-red-400" />}
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(action.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── NL Task view ──────────────────────────────────────────────

function NLView() {
  const [accepted, setAccepted] = useState<any[]>([]);

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-lg font-bold text-foreground">Natural Language Task Parser</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Type a task in plain English. The AI parses it into a structured task with dates, priority, and tags.
        </p>
      </div>

      <div className="dashboard-card p-4">
        <NLTaskCreator
          onAccept={(task) => setAccepted((p) => [task, ...p])}
          placeholder="e.g. review Q4 report with Sarah on Friday 3pm — high priority, work project"
        />
      </div>

      {accepted.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-3">
            Accepted ({accepted.length})
          </h2>
          <div className="space-y-2">
            {accepted.map((t, i) => (
              <div key={i} className="dashboard-card p-3 flex items-center gap-3">
                <CheckCircle2 size={14} className="text-green-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{t.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {[t.dueDate, t.dueTime, t.priority !== "none" && `↑ ${t.priority}`, t.projectName].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Config view ───────────────────────────────────────────────

function ConfigView({ config, draft, setDraft, isSaving, onSave }: any) {
  const provider: AIProvider = draft?.provider || "local_ollama";
  const models = COMMON_MODELS[provider] || [];

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-lg font-bold text-foreground">AI Configuration</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Choose a provider and configure your API keys or local model.
        </p>
      </div>

      {/* Provider selector */}
      <div className="space-y-3">
        <Label>Provider</Label>
        <div className="grid grid-cols-2 gap-2">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setDraft((d: any) => ({ ...d, provider: p.id }))}
              className={cn(
                "text-left p-3 rounded-xl border-2 transition-all",
                provider === p.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-border/80 hover:bg-accent"
              )}
            >
              <p className="text-sm font-medium text-foreground">{p.label}</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{p.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Local Ollama settings */}
      {provider === "local_ollama" && (
        <div className="space-y-3">
          <div>
            <Label>Ollama Base URL</Label>
            <input
              type="text"
              value={draft?.localBaseUrl || "http://localhost:11434"}
              onChange={(e) => setDraft((d: any) => ({ ...d, localBaseUrl: e.target.value }))}
              className="w-full h-9 px-3 text-sm bg-surface-1 border border-border rounded-lg outline-none focus:border-primary/60 mt-1.5 text-foreground"
            />
          </div>
          <div>
            <Label>Model</Label>
            <div className="flex gap-2 mt-1.5">
              <input
                type="text"
                value={draft?.localModel || ""}
                onChange={(e) => setDraft((d: any) => ({ ...d, localModel: e.target.value }))}
                placeholder="e.g. llama3.2"
                className="flex-1 h-9 px-3 text-sm bg-surface-1 border border-border rounded-lg outline-none focus:border-primary/60 text-foreground"
              />
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {models.map((m) => (
                <button
                  key={m}
                  onClick={() => setDraft((d: any) => ({ ...d, localModel: m }))}
                  className={cn(
                    "text-[11px] px-2 py-0.5 rounded-md border transition-colors",
                    draft?.localModel === m
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-border/80"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* LM Studio settings */}
      {provider === "lm_studio" && (
        <LMStudioConfig draft={draft} setDraft={setDraft} />
      )}

      {/* Cloud API key */}
      {provider === "openai" && (
        <div>
          <Label>OpenAI API Key</Label>
          <input
            type="password"
            value={draft?.openaiKey || ""}
            onChange={(e) => setDraft((d: any) => ({ ...d, openaiKey: e.target.value }))}
            placeholder="sk-..."
            className="w-full h-9 px-3 text-sm bg-surface-1 border border-border rounded-lg outline-none focus:border-primary/60 mt-1.5 text-foreground font-mono"
          />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {models.map((m) => (
              <button
                key={m}
                onClick={() => setDraft((d: any) => ({ ...d, localModel: m }))}
                className={cn(
                  "text-[11px] px-2 py-0.5 rounded-md border transition-colors",
                  draft?.localModel === m
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >{m}</button>
            ))}
          </div>
        </div>
      )}

      {provider === "anthropic" && (
        <div>
          <Label>Anthropic API Key</Label>
          <input
            type="password"
            value={draft?.anthropicKey || ""}
            onChange={(e) => setDraft((d: any) => ({ ...d, anthropicKey: e.target.value }))}
            placeholder="sk-ant-..."
            className="w-full h-9 px-3 text-sm bg-surface-1 border border-border rounded-lg outline-none focus:border-primary/60 mt-1.5 text-foreground font-mono"
          />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {models.map((m) => (
              <button key={m} onClick={() => setDraft((d: any) => ({ ...d, localModel: m }))}
                className={cn("text-[11px] px-2 py-0.5 rounded-md border transition-colors",
                  draft?.localModel === m ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                )}>{m}</button>
            ))}
          </div>
        </div>
      )}

      {provider === "gemini" && (
        <div>
          <Label>Gemini API Key</Label>
          <input
            type="password"
            value={draft?.geminiKey || ""}
            onChange={(e) => setDraft((d: any) => ({ ...d, geminiKey: e.target.value }))}
            placeholder="AIza..."
            className="w-full h-9 px-3 text-sm bg-surface-1 border border-border rounded-lg outline-none focus:border-primary/60 mt-1.5 text-foreground font-mono"
          />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {models.map((m) => (
              <button key={m} onClick={() => setDraft((d: any) => ({ ...d, localModel: m }))}
                className={cn("text-[11px] px-2 py-0.5 rounded-md border transition-colors",
                  draft?.localModel === m ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                )}>{m}</button>
            ))}
          </div>
        </div>
      )}

      {/* Generation params */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Max Tokens</Label>
          <input
            type="number"
            value={draft?.maxTokens || 2048}
            onChange={(e) => setDraft((d: any) => ({ ...d, maxTokens: Number(e.target.value) }))}
            min={256} max={8192} step={256}
            className="w-full h-9 px-3 text-sm bg-surface-1 border border-border rounded-lg outline-none focus:border-primary/60 mt-1.5 text-foreground"
          />
        </div>
        <div>
          <Label>Temperature</Label>
          <input
            type="number"
            value={draft?.temperature ?? 0.7}
            onChange={(e) => setDraft((d: any) => ({ ...d, temperature: Number(e.target.value) }))}
            min={0} max={2} step={0.1}
            className="w-full h-9 px-3 text-sm bg-surface-1 border border-border rounded-lg outline-none focus:border-primary/60 mt-1.5 text-foreground"
          />
        </div>
      </div>

      <button
        onClick={onSave}
        disabled={isSaving}
        className={cn(
          "h-9 px-6 rounded-lg text-sm font-medium flex items-center gap-2 transition-all",
          isSaving
            ? "bg-muted text-muted-foreground cursor-wait"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        )}
      >
        {isSaving && <Loader2 size={13} className="animate-spin" />}
        {isSaving ? "Saving..." : "Save Configuration"}
      </button>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">{children}</p>
  );
}

// ── LM Studio config component ────────────────────────────────

function LMStudioConfig({ draft, setDraft }: { draft: any; setDraft: any }) {
  const [loadedModels, setLoadedModels] = React.useState<string[]>([]);
  const [fetchingModels, setFetchingModels] = React.useState(false);
  const [fetchError, setFetchError] = React.useState<string | null>(null);

  const baseUrl = ((draft?.localBaseUrl as string) || "http://localhost:1234").replace(/\/$/, "");

  const fetchModels = async () => {
    setFetchingModels(true);
    setFetchError(null);
    try {
      const res = await fetch(`${baseUrl}/v1/models`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const ids: string[] = (json.data as { id: string }[]).map((m) => m.id);
      setLoadedModels(ids);
      // Auto-select first model if none set
      if (!draft?.localModel && ids.length > 0) {
        setDraft((d: any) => ({ ...d, localModel: ids[0] }));
      }
    } catch (e) {
      setFetchError(`Could not reach LM Studio at ${baseUrl} — is it running?`);
    } finally {
      setFetchingModels(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>LM Studio Server URL</Label>
        <div className="flex gap-2 mt-1.5">
          <input
            type="text"
            value={draft?.localBaseUrl || "http://localhost:1234"}
            onChange={(e) => setDraft((d: any) => ({ ...d, localBaseUrl: e.target.value }))}
            className="flex-1 h-9 px-3 text-sm bg-surface-1 border border-border rounded-lg outline-none focus:border-primary/60 text-foreground font-mono"
            placeholder="http://localhost:1234"
          />
          <button
            onClick={() => void fetchModels()}
            disabled={fetchingModels}
            className={cn(
              "h-9 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 shrink-0 transition-all border",
              fetchingModels
                ? "border-border text-muted-foreground cursor-wait"
                : "border-primary/40 text-primary hover:bg-primary/5"
            )}
          >
            {fetchingModels
              ? <Loader2 size={12} className="animate-spin" />
              : <RotateCcw size={12} />
            }
            {fetchingModels ? "Loading..." : "Fetch models"}
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground/50 mt-1.5">
          Enable <strong>Local Server</strong> in LM Studio → Developer tab. Make sure CORS is enabled.
        </p>
        {fetchError && (
          <p className="text-[11px] text-red-400 mt-1">{fetchError}</p>
        )}
      </div>

      <div>
        <Label>Model (identifier)</Label>
        <input
          type="text"
          value={draft?.localModel || ""}
          onChange={(e) => setDraft((d: any) => ({ ...d, localModel: e.target.value }))}
          placeholder="e.g. liquid/lfm2.5-1.2b"
          className="w-full h-9 px-3 text-sm bg-surface-1 border border-border rounded-lg outline-none focus:border-primary/60 mt-1.5 text-foreground font-mono"
        />
        {loadedModels.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {loadedModels.map((m) => (
              <button
                key={m}
                onClick={() => setDraft((d: any) => ({ ...d, localModel: m }))}
                className={cn(
                  "text-[11px] px-2 py-0.5 rounded-md border transition-colors font-mono",
                  draft?.localModel === m
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-border/80"
                )}
              >
                {m}
              </button>
            ))}
          </div>
        )}
        {loadedModels.length === 0 && (
          <p className="text-[11px] text-muted-foreground/50 mt-1.5">
            Click <strong>Fetch models</strong> to load currently loaded models from LM Studio.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Exported standalone config panel for Settings ─────────────

export function AIConfigPanel() {
  const { config, loadConfig, saveConfig } = useAIStore();
  const [draft, setDraft] = React.useState<any>({});
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    void loadConfig();
  }, []);

  React.useEffect(() => {
    if (config) setDraft(config);
  }, [config]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveConfig(draft);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ConfigView
      config={config}
      draft={draft}
      setDraft={setDraft}
      isSaving={isSaving}
      onSave={() => void handleSave()}
    />
  );
}
