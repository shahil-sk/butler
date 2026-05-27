import React, { useEffect, useState, useRef } from "react";
import { useAIStore } from "../state/aiStore";
import { Sparkles, X, Settings, Send, Trash2, Sliders } from "lucide-react";

export const AIAssistantPanel: React.FC = () => {
  const {
    provider,
    apiKey,
    model,
    embeddingModel,
    messages,
    panelOpen,
    loading,
    error,
    loadConfig,
    updateConfig,
    sendMessage,
    clearChat,
    setPanelOpen,
  } = useAIStore();

  const [input, setInput] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const threadEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadConfig();
  }, []);

  useEffect(() => {
    if (panelOpen) {
      threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, panelOpen]);

  if (!panelOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    void sendMessage(input.trim());
    setInput("");
  };

  return (
    <div className="fixed top-0 right-0 h-full w-80 z-40 bg-zinc-900/95 border-l border-zinc-800 backdrop-blur-md flex flex-col shadow-2xl text-xs text-zinc-150 animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="h-12 border-b border-zinc-800 px-4 flex items-center justify-between shrink-0">
        <span className="font-bold text-zinc-100 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
          <Sparkles className="h-4 w-4 text-amber-500" /> Butler AI Assistant
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1.5 rounded transition-colors cursor-pointer ${
              showSettings ? "bg-amber-500/10 text-amber-400" : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="AI Config Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
          <button
            onClick={() => setPanelOpen(false)}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 rounded cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showSettings ? (
        /* Settings panel */
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-950/20">
          <div className="flex items-center gap-1.5 text-zinc-400 font-bold uppercase tracking-wider text-[9px] border-b border-zinc-800 pb-1.5">
            <Sliders className="h-3.5 w-3.5" /> Provider Configuration
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-zinc-500 font-medium">AI Provider</label>
              <select
                value={provider}
                onChange={(e) => void updateConfig({ provider: e.target.value as any })}
                className="w-full bg-zinc-900 border border-zinc-850 rounded px-2 py-1.5 text-zinc-200 focus:outline-none"
              >
                <option value="ollama">Ollama (Local-First)</option>
                <option value="openai">OpenAI (Cloud)</option>
                <option value="gemini">Gemini (Cloud)</option>
              </select>
            </div>

            {provider !== "ollama" && (
              <div className="space-y-1">
                <label className="text-zinc-500 font-medium">API Auth Key</label>
                <input
                  type="password"
                  placeholder="Paste bearer token..."
                  value={apiKey}
                  onChange={(e) => void updateConfig({ apiKey: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-850 rounded px-2.5 py-1.5 text-zinc-200 focus:outline-none"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-zinc-500 font-medium">LLM Chat Model</label>
              <input
                type="text"
                value={model}
                onChange={(e) => void updateConfig({ model: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-850 rounded px-2.5 py-1.5 text-zinc-200 focus:outline-none"
                placeholder={provider === "ollama" ? "e.g. llama3" : provider === "openai" ? "e.g. gpt-4o-mini" : "e.g. gemini-1.5-flash"}
              />
            </div>

            <div className="space-y-1">
              <label className="text-zinc-500 font-medium">Embedding Model</label>
              <input
                type="text"
                value={embeddingModel}
                onChange={(e) => void updateConfig({ embeddingModel: e.target.value })}
                className="w-full bg-zinc-900 border border-zinc-850 rounded px-2.5 py-1.5 text-zinc-200 focus:outline-none"
                placeholder={provider === "ollama" ? "e.g. nomic-embed-text" : "e.g. text-embedding-3-small"}
              />
            </div>
          </div>
          
          <button
            onClick={() => setShowSettings(false)}
            className="w-full bg-zinc-850 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-bold rounded py-1.5 mt-2 cursor-pointer transition-colors"
          >
            Back to Assistant
          </button>
        </div>
      ) : (
        /* Chat interface panel */
        <div className="flex-1 flex flex-col min-h-0 bg-zinc-950/20">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-center gap-2 p-6">
                <Sparkles className="h-8 w-8 text-zinc-700" />
                <p>Hello! I am Butler, your local productivity copilot.</p>
                <p className="text-[10px]">Ask me to summarize notes, outline steps for a task, or draft proposals.</p>
              </div>
            ) : (
              messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex flex-col gap-1 max-w-[85%] ${
                    m.role === "user" ? "ml-auto items-end" : "mr-auto items-start"
                  }`}
                >
                  <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">
                    {m.role === "user" ? "You" : "Butler AI"}
                  </span>
                  <div
                    className={`rounded-lg px-3 py-2 leading-relaxed whitespace-pre-wrap ${
                      m.role === "user"
                        ? "bg-amber-600 text-zinc-950 font-medium"
                        : "bg-zinc-800/80 border border-zinc-850 text-zinc-200"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))
            )}
            {loading && (
              <div className="flex flex-col gap-1 max-w-[85%] mr-auto items-start">
                <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Butler AI</span>
                <div className="bg-zinc-800/80 border border-zinc-850 text-zinc-400 rounded-lg px-3 py-2 italic animate-pulse">
                  Butler is thinking...
                </div>
              </div>
            )}
            {error && (
              <div className="bg-red-950/30 border border-red-900/50 text-red-400 p-2.5 rounded text-[11px]">
                {error}
              </div>
            )}
            <div ref={threadEndRef} />
          </div>

          <div className="p-3 border-t border-zinc-800 flex gap-2 items-center bg-zinc-900 shrink-0">
            <button
              onClick={clearChat}
              className="p-2 text-zinc-500 hover:text-red-400 rounded transition-colors cursor-pointer"
              title="Clear Thread"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <form onSubmit={handleSubmit} className="flex-1 flex gap-1">
              <input
                type="text"
                placeholder="Ask Butler..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 focus:outline-none focus:border-amber-500/50"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:hover:bg-amber-600 text-zinc-950 rounded p-1.5 transition-colors cursor-pointer"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
