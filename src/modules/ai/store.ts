import { create } from "zustand";
import { AIService } from "./service";
import type {
  AIConversation, AIConfig, AIAction, AIContextType,
  ParsedTask, TaskBreakdown, MeetingNoteResult, JournalPrompt, GoalHealthReport, ID,
} from "@/shared/types";

interface AIState {
  // Config
  config: AIConfig | null;
  isAvailable: boolean;
  availableModel: string | null;
  availableProvider: string | null;
  isCheckingAvailability: boolean;

  // Active conversation panel
  activeConversationId: ID | null;
  conversations: AIConversation[];
  isLoadingConversations: boolean;

  // Streaming / generation state
  isGenerating: boolean;
  lastError: string | null;

  // Actions log
  recentActions: AIAction[];
}

interface AIActions {
  loadConfig: () => Promise<void>;
  saveConfig: (patch: Partial<AIConfig>) => Promise<void>;
  checkAvailability: () => Promise<void>;

  loadConversations: (contextType?: string, contextId?: string) => Promise<void>;
  openConversation: (id: ID) => void;
  startConversation: (contextType: AIContextType, contextId?: ID, title?: string) => Promise<ID>;
  sendMessage: (convId: ID, message: string) => Promise<string>;
  deleteConversation: (id: ID) => Promise<void>;
  closeConversation: () => void;

  // Feature helpers
  parseTaskFromNL: (input: string) => Promise<ParsedTask>;
  breakdownTask: (title: string, description?: string, project?: string) => Promise<TaskBreakdown["subtasks"]>;
  processMeetingNotes: (transcript: string) => Promise<MeetingNoteResult>;
  summariseText: (content: string) => Promise<string>;
  generateJournalPrompts: (ctx: {
    completedTasks: string[];
    deferredTasks: string[];
    focusMinutes: number;
    mood?: number;
  }) => Promise<JournalPrompt[]>;
  generateGoalHealthReport: (input: {
    goalTitle: string;
    progressPercent: number;
    targetDate?: string;
    checkInNotes: string[];
    completedTasks: number;
    totalTasks: number;
  }) => Promise<GoalHealthReport>;

  loadRecentActions: () => Promise<void>;
  recordAcceptance: (actionId: ID, accepted: boolean) => Promise<void>;
  clearError: () => void;
}

export const useAIStore = create<AIState & AIActions>((set, get) => ({
  config: null,
  isAvailable: false,
  availableModel: null,
  availableProvider: null,
  isCheckingAvailability: false,
  activeConversationId: null,
  conversations: [],
  isLoadingConversations: false,
  isGenerating: false,
  lastError: null,
  recentActions: [],

  loadConfig: async () => {
    try {
      const config = await AIService.getConfig();
      set({ config });
    } catch (e) {
      console.error("[AI] loadConfig failed", e);
    }
  },

  saveConfig: async (patch) => {
    try {
      const config = await AIService.saveConfig(patch);
      set({ config });
      // Re-check availability after config change
      void get().checkAvailability();
    } catch (e) {
      set({ lastError: String(e) });
    }
  },

  checkAvailability: async () => {
    set({ isCheckingAvailability: true });
    try {
      const { ok, provider, model } = await AIService.isAvailable();
      set({ isAvailable: ok, availableProvider: provider, availableModel: model });
    } catch {
      set({ isAvailable: false });
    } finally {
      set({ isCheckingAvailability: false });
    }
  },

  loadConversations: async (contextType, contextId) => {
    set({ isLoadingConversations: true });
    try {
      const conversations = await AIService.getConversations(contextType, contextId);
      set({ conversations });
    } finally {
      set({ isLoadingConversations: false });
    }
  },

  openConversation: (id) => set({ activeConversationId: id }),
  closeConversation: () => set({ activeConversationId: null }),

  startConversation: async (contextType, contextId, title) => {
    const conv = await AIService.createConversation(contextType, contextId, title);
    set((s) => ({ conversations: [conv, ...s.conversations], activeConversationId: conv.id }));
    return conv.id;
  },

  sendMessage: async (convId, message) => {
    set({ isGenerating: true, lastError: null });
    try {
      const reply = await AIService.sendMessage(convId, message);
      // Reload conversation to get updated messages
      const updated = await AIService.getConversations();
      set({ conversations: updated });
      return reply;
    } catch (e) {
      set({ lastError: String(e) });
      throw e;
    } finally {
      set({ isGenerating: false });
    }
  },

  deleteConversation: async (id) => {
    await AIService.deleteConversation(id);
    set((s) => ({
      conversations: s.conversations.filter((c) => c.id !== id),
      activeConversationId: s.activeConversationId === id ? null : s.activeConversationId,
    }));
  },

  parseTaskFromNL: async (input) => {
    set({ isGenerating: true, lastError: null });
    try {
      const result = await AIService.parseTaskFromNL(input);
      await AIService.logAction("task_extracted", { input }, result as any);
      return result;
    } catch (e) {
      set({ lastError: String(e) });
      throw e;
    } finally {
      set({ isGenerating: false });
    }
  },

  breakdownTask: async (title, description, project) => {
    set({ isGenerating: true, lastError: null });
    try {
      const result = await AIService.breakdownTask(title, description, project);
      await AIService.logAction("task_breakdown", { title, description, project }, { subtasks: result } as any);
      return result;
    } catch (e) {
      set({ lastError: String(e) });
      throw e;
    } finally {
      set({ isGenerating: false });
    }
  },

  processMeetingNotes: async (transcript) => {
    set({ isGenerating: true, lastError: null });
    try {
      const result = await AIService.processMeetingNotes(transcript);
      await AIService.logAction("meeting_processed", { transcriptLength: transcript.length }, result as any);
      return result;
    } catch (e) {
      set({ lastError: String(e) });
      throw e;
    } finally {
      set({ isGenerating: false });
    }
  },

  summariseText: async (content) => {
    set({ isGenerating: true, lastError: null });
    try {
      const summary = await AIService.summariseText(content);
      await AIService.logAction("note_summarised", { contentLength: content.length }, { summary } as any);
      return summary;
    } catch (e) {
      set({ lastError: String(e) });
      throw e;
    } finally {
      set({ isGenerating: false });
    }
  },

  generateJournalPrompts: async (ctx) => {
    set({ isGenerating: true, lastError: null });
    try {
      const prompts = await AIService.generateJournalPrompts(ctx);
      await AIService.logAction("prompt_generated", ctx as any, { prompts } as any);
      return prompts;
    } catch (e) {
      set({ lastError: String(e) });
      throw e;
    } finally {
      set({ isGenerating: false });
    }
  },

  generateGoalHealthReport: async (input) => {
    set({ isGenerating: true, lastError: null });
    try {
      const report = await AIService.generateGoalHealthReport(input);
      await AIService.logAction("insight_generated", input as any, report as any);
      return report;
    } catch (e) {
      set({ lastError: String(e) });
      throw e;
    } finally {
      set({ isGenerating: false });
    }
  },

  loadRecentActions: async () => {
    const recentActions = await AIService.getRecentActions();
    set({ recentActions });
  },

  recordAcceptance: async (actionId, accepted) => {
    await AIService.recordAcceptance(actionId, accepted);
    set((s) => ({
      recentActions: s.recentActions.map((a) =>
        a.id === actionId ? { ...a, accepted } : a
      ),
    }));
  },

  clearError: () => set({ lastError: null }),
}));
