import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { AIConfig, generateCompletion } from "../services/aiService";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface AIState {
  provider: "ollama" | "openai" | "gemini";
  apiKey: string;
  model: string;
  embeddingModel: string;
  messages: ChatMessage[];
  panelOpen: boolean;
  loading: boolean;
  error: string | null;

  loadConfig: () => Promise<void>;
  updateConfig: (updates: {
    provider?: "ollama" | "openai" | "gemini";
    apiKey?: string;
    model?: string;
    embeddingModel?: string;
  }) => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  clearChat: () => void;
  setPanelOpen: (open: boolean) => void;
}

export const useAIStore = create<AIState>((set, get) => ({
  provider: "ollama",
  apiKey: "",
  model: "llama3",
  embeddingModel: "nomic-embed-text",
  messages: [],
  panelOpen: false,
  loading: false,
  error: null,

  setPanelOpen: (open) => set({ panelOpen: open }),

  loadConfig: async () => {
    try {
      const p = await invoke<string>("get_setting", { key: "ai_provider" }).catch(() => "ollama");
      const k = await invoke<string>("get_setting", { key: "ai_api_key" }).catch(() => "");
      const m = await invoke<string>("get_setting", { key: "ai_model" }).catch(() => "llama3");
      const em = await invoke<string>("get_setting", { key: "ai_embedding_model" }).catch(() => "nomic-embed-text");

      set({
        provider: (p || "ollama") as "ollama" | "openai" | "gemini",
        apiKey: k || "",
        model: m || "llama3",
        embeddingModel: em || "nomic-embed-text",
      });
    } catch (e) {
      console.error("Failed to load AI config", e);
    }
  },

  updateConfig: async (updates) => {
    set(updates);
    try {
      if (updates.provider) await invoke("set_setting", { key: "ai_provider", value: updates.provider });
      if (updates.apiKey !== undefined) await invoke("set_setting", { key: "ai_api_key", value: updates.apiKey });
      if (updates.model) await invoke("set_setting", { key: "ai_model", value: updates.model });
      if (updates.embeddingModel) await invoke("set_setting", { key: "ai_embedding_model", value: updates.embeddingModel });
    } catch (e) {
      console.error("Failed to save AI config", e);
    }
  },

  sendMessage: async (text) => {
    if (!text.trim()) return;
    const userMsg: ChatMessage = { role: "user", content: text };
    set((state) => ({
      messages: [...state.messages, userMsg],
      loading: true,
      error: null,
    }));

    try {
      const config: AIConfig = {
        provider: get().provider,
        apiKey: get().apiKey,
        model: get().model,
      };

      const systemPrompt = "You are Butler AI, a helpful, offline-first personal operating system assistant.";
      const reply = await generateCompletion(text, systemPrompt, config);
      
      const assistantMsg: ChatMessage = { role: "assistant", content: reply };
      set((state) => ({
        messages: [...state.messages, assistantMsg],
      }));
    } catch (e: any) {
      console.error(e);
      set({ error: e.toString() || "Failed to generate response" });
    } finally {
      set({ loading: false });
    }
  },

  clearChat: () => set({ messages: [] }),
}));
