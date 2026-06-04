// ============================================================
// AI MODULE — SERVICE
// Provider-agnostic abstraction. Calls Ollama (local) or
// OpenAI/Anthropic/Gemini cloud APIs via fetch.
// All heavy logic lives here — UI stays thin.
// ============================================================

import type {
  AIConfig, AIProvider, AIConversation, AIAction, AIActionType,
  ParsedTask, TaskBreakdown, MeetingNoteResult, JournalPrompt,
  GoalHealthReport, ID, ISODateTime,
} from "@/shared/types";
import { generateId, now } from "@/shared/utils";
import { db } from "@/kernel/db";

// ── Provider interfaces ───────────────────────────────────────

export interface CompletionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  stream?: boolean;
}

// ── Config helpers ────────────────────────────────────────────

async function loadConfig(): Promise<AIConfig | null> {
  const rows = await db.select<Record<string, unknown>>(
    "SELECT * FROM ai_config LIMIT 1"
  );
  if (!rows.length) return null;
  const r = rows[0];
  return {
    id: r.id as string,
    provider: r.provider as AIProvider,
    localModel: r.local_model as string | undefined,
    localBaseUrl: (r.local_base_url as string | undefined) || "http://localhost:11434",
    openaiKey: r.openai_key as string | undefined,
    anthropicKey: r.anthropic_key as string | undefined,
    geminiKey: r.gemini_key as string | undefined,
    embeddingModel: r.embedding_model as string,
    enabledFeatures: JSON.parse(r.enabled_features as string || "[]"),
    maxTokens: r.max_tokens as number,
    temperature: r.temperature as number,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

// ── Core completion call ──────────────────────────────────────

async function complete(
  prompt: string,
  config: AIConfig,
  opts: CompletionOptions = {}
): Promise<string> {
  const model = opts.model || config.localModel || "llama3.2";
  const maxTokens = opts.maxTokens || config.maxTokens;
  const temperature = opts.temperature ?? config.temperature;
  const systemPrompt = opts.systemPrompt || "You are Butler, a productivity assistant. Be concise, structured, and practical.";

  if (config.provider === "local_ollama") {
    const baseUrl = config.localBaseUrl || "http://localhost:11434";
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: `${systemPrompt}\n\n${prompt}`,
        stream: false,
        options: { num_predict: maxTokens, temperature },
      }),
    });
    if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
    const json = await res.json();
    return json.response as string;
  }

  // LM Studio — OpenAI-compatible local server
  if (config.provider === "lm_studio") {
    const baseUrl = (config.localBaseUrl || "http://localhost:1234").replace(/\/$/, "");
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: prompt },
        ],
        max_tokens: maxTokens,
        temperature,
        stream: false,
      }),
    });
    if (!res.ok) throw new Error(`LM Studio error: ${res.status}`);
    const json = await res.json();
    return json.choices[0].message.content as string;
  }

  if (config.provider === "openai") {
    if (!config.openaiKey) throw new Error("OpenAI key not configured");
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.openaiKey}`,
      },
      body: JSON.stringify({
        model: opts.model || "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        max_tokens: maxTokens,
        temperature,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);
    const json = await res.json();
    return json.choices[0].message.content as string;
  }

  if (config.provider === "anthropic") {
    if (!config.anthropicKey) throw new Error("Anthropic key not configured");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: opts.model || "claude-3-haiku-20240307",
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic error: ${res.status}`);
    const json = await res.json();
    return json.content[0].text as string;
  }

  if (config.provider === "gemini") {
    if (!config.geminiKey) throw new Error("Gemini key not configured");
    const modelName = opts.model || "gemini-1.5-flash";
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${config.geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\n${prompt}` }] }],
          generationConfig: { maxOutputTokens: maxTokens, temperature },
        }),
      }
    );
    if (!res.ok) throw new Error(`Gemini error: ${res.status}`);
    const json = await res.json();
    return json.candidates[0].content.parts[0].text as string;
  }

  throw new Error(`Unsupported provider: ${config.provider}`);
}

// ── Safe JSON parse helper ────────────────────────────────────

function safeJson<T>(text: string, fallback: T): T {
  try {
    const match = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    return JSON.parse(match ? match[1] : text) as T;
  } catch {
    return fallback;
  }
}

// ── AI Service ────────────────────────────────────────────────

export const AIService = {

  /** Check if AI is available (config exists + provider reachable) */
  async isAvailable(): Promise<{ ok: boolean; provider: AIProvider | null; model: string | null }> {
    try {
      const config = await loadConfig();
      if (!config) return { ok: false, provider: null, model: null };

      if (config.provider === "local_ollama") {
        const baseUrl = config.localBaseUrl || "http://localhost:11434";
        try {
          const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(2000) });
          return { ok: res.ok, provider: config.provider, model: config.localModel || null };
        } catch {
          return { ok: false, provider: config.provider, model: config.localModel || null };
        }
      }

      if (config.provider === "lm_studio") {
        const baseUrl = (config.localBaseUrl || "http://localhost:1234").replace(/\/$/, "");
        try {
          const res = await fetch(`${baseUrl}/v1/models`, { signal: AbortSignal.timeout(2000) });
          return { ok: res.ok, provider: config.provider, model: config.localModel || null };
        } catch {
          return { ok: false, provider: config.provider, model: config.localModel || null };
        }
      }

      // Cloud providers — assume available if key is set
      const hasKey = !!(config.openaiKey || config.anthropicKey || config.geminiKey);
      return { ok: hasKey, provider: config.provider, model: null };
    } catch {
      return { ok: false, provider: null, model: null };
    }
  },

  /** Generic completion */
  async complete(prompt: string, opts?: CompletionOptions): Promise<string> {
    const config = await loadConfig();
    if (!config) throw new Error("AI not configured");
    return complete(prompt, config, opts);
  },

  /** Parse natural language into a task */
  async parseTaskFromNL(input: string): Promise<ParsedTask> {
    const config = await loadConfig();
    if (!config) throw new Error("AI not configured");

    const today = new Date().toISOString().slice(0, 10);
    const prompt = `Parse the following text into a structured task. Today is ${today}.
Return ONLY valid JSON matching this schema (no explanation):
{
  "title": string,
  "dueDate": "YYYY-MM-DD" or null,
  "dueTime": "HH:MM" or null,
  "priority": "none"|"low"|"medium"|"high"|"urgent" or null,
  "projectName": string or null,
  "tags": string[],
  "estimateMinutes": number or null,
  "description": string or null
}

Text: "${input}"`;

    const raw = await complete(prompt, config);
    return safeJson<ParsedTask>(raw, { title: input });
  },

  /** Extract multiple tasks from raw note text */
  async extractTasks(content: string): Promise<ParsedTask[]> {
    const config = await loadConfig();
    if (!config) throw new Error("AI not configured");
    
    const today = new Date().toISOString().slice(0, 10);
    const prompt = `Extract all action items or tasks from the following text into structured tasks. Today is ${today}. Return ONLY a valid JSON array matching this schema (no explanation):
[
  {
    "title": string,
    "dueDate": "YYYY-MM-DD" or null,
    "dueTime": "HH:MM" or null,
    "priority": "none"|"low"|"medium"|"high"|"urgent" or null,
    "projectName": string or null,
    "tags": string[],
    "estimateMinutes": number or null,
    "description": string or null
  }
]

Text: "${content.slice(0, 4000)}"`;

    const raw = await complete(prompt, config);
    return safeJson<ParsedTask[]>(raw, []);
  },

  /** Break a task down into subtasks */
  async breakdownTask(taskTitle: string, taskDescription?: string, projectName?: string): Promise<TaskBreakdown["subtasks"]> {
    const config = await loadConfig();
    if (!config) throw new Error("AI not configured");

    const ctx = [
      `Task: ${taskTitle}`,
      taskDescription && `Description: ${taskDescription}`,
      projectName && `Project: ${projectName}`,
    ].filter(Boolean).join("\n");

    const prompt = `Break this task into 3-8 concrete, actionable subtasks. Return ONLY valid JSON array:
[
  { "title": string, "estimateMinutes": number or null, "description": string or null }
]

${ctx}`;

    const raw = await complete(prompt, config);
    return safeJson<TaskBreakdown["subtasks"]>(raw, []);
  },

  /** Process raw meeting transcript */
  async processMeetingNotes(transcript: string): Promise<MeetingNoteResult> {
    const config = await loadConfig();
    if (!config) throw new Error("AI not configured");

    const prompt = `Process this meeting transcript and extract structured data. Return ONLY valid JSON:
{
  "summary": "3-5 sentence summary",
  "decisions": ["decision 1", ...],
  "actionItems": [{ "title": string, "assignee": string or null, "dueDate": "YYYY-MM-DD" or null }],
  "openQuestions": ["question 1", ...],
  "followUpDates": [{ "description": string, "date": "YYYY-MM-DD" }]
}

Transcript:
${transcript.slice(0, 4000)}`;

    const raw = await complete(prompt, config);
    return safeJson<MeetingNoteResult>(raw, {
      summary: "",
      decisions: [],
      actionItems: [],
      openQuestions: [],
      followUpDates: [],
    });
  },

  /** Summarise a note or document */
  async summariseText(content: string): Promise<string> {
    const config = await loadConfig();
    if (!config) throw new Error("AI not configured");
    const prompt = `Write a concise 3-5 sentence summary of the following content. Be specific and avoid generic phrases:

${content.slice(0, 6000)}

Summary:`;
    return complete(prompt, config);
  },

  /** Generate personalised journal reflection prompts */
  async generateJournalPrompts(context: {
    completedTasks: string[];
    deferredTasks: string[];
    focusMinutes: number;
    mood?: number;
  }): Promise<JournalPrompt[]> {
    const config = await loadConfig();
    if (!config) throw new Error("AI not configured");

    const prompt = `Generate 3 personalised, specific reflection questions for tonight's journal entry.
Base them on today's actual activity. Avoid generic questions. Be direct and thoughtful.
Return ONLY valid JSON array:
[{ "question": string, "context": string }]

Today's activity:
- Completed tasks: ${context.completedTasks.slice(0, 5).join(", ") || "none"}
- Deferred tasks: ${context.deferredTasks.slice(0, 3).join(", ") || "none"}
- Focus time: ${context.focusMinutes} minutes
${context.mood != null ? `- Mood rating: ${context.mood}/10` : ""}`;

    const raw = await complete(prompt, config);
    return safeJson<JournalPrompt[]>(raw, [
      { question: "What's one thing you'll do differently tomorrow?", context: "Reflection" },
    ]);
  },

  /** Generate a goal health report */
  async generateGoalHealthReport(input: {
    goalTitle: string;
    progressPercent: number;
    targetDate?: string;
    checkInNotes: string[];
    completedTasks: number;
    totalTasks: number;
  }): Promise<GoalHealthReport> {
    const config = await loadConfig();
    if (!config) throw new Error("AI not configured");

    const prompt = `Assess this goal's health and return ONLY valid JSON:
{
  "summary": "1-paragraph health summary",
  "trajectory": "on_track"|"at_risk"|"stalled",
  "suggestedAction": "one concrete next step"
}

Goal: ${input.goalTitle}
Progress: ${input.progressPercent}%
${input.targetDate ? `Target date: ${input.targetDate}` : ""}
Tasks completed: ${input.completedTasks}/${input.totalTasks}
${input.checkInNotes.length ? `Recent notes: ${input.checkInNotes.slice(-3).join(" | ")}` : ""}`;

    const raw = await complete(prompt, config);
    return safeJson<GoalHealthReport>(raw, {
      summary: "Insufficient data to assess goal health.",
      trajectory: "at_risk",
      suggestedAction: "Add a check-in with your current progress.",
    });
  },

  /** Propose a day plan (time blocks) for Planner */
  async proposeDayPlan(input: {
    tasks: { id: string; title: string; estimateMinutes?: number; priority?: string }[];
    date: string;
  }): Promise<{ taskId: string; startTime: string; endTime: string }[]> {
    const config = await loadConfig();
    if (!config) throw new Error("AI not configured");

    const prompt = `Propose a time-blocked schedule for these tasks for ${input.date}.
Start around 09:00. Space them out appropriately. Return ONLY valid JSON array:
[ { "taskId": "id", "startTime": "HH:MM", "endTime": "HH:MM" } ]

Tasks:
${input.tasks.map(t => `- [${t.id}] ${t.title} (${t.estimateMinutes || 30}m)`).join("\n")}`;

    const raw = await complete(prompt, config);
    return safeJson<{ taskId: string; startTime: string; endTime: string }[]>(raw, []);
  },

  // ── Config CRUD ────────────────────────────────────────────

  async getConfig(): Promise<AIConfig | null> {
    return loadConfig();
  },

  async saveConfig(config: Partial<AIConfig>): Promise<AIConfig> {
    const existing = await loadConfig();
    const ts = now();
    if (existing) {
      await db.execute(
        `UPDATE ai_config SET
          provider=?, local_model=?, local_base_url=?, openai_key=?, anthropic_key=?,
          gemini_key=?, embedding_model=?, enabled_features=?, max_tokens=?, temperature=?, updated_at=?
        WHERE id=?`,
        [
          config.provider ?? existing.provider,
          config.localModel ?? existing.localModel ?? null,
          config.localBaseUrl ?? existing.localBaseUrl ?? "http://localhost:11434",
          config.openaiKey ?? existing.openaiKey ?? null,
          config.anthropicKey ?? existing.anthropicKey ?? null,
          config.geminiKey ?? existing.geminiKey ?? null,
          config.embeddingModel ?? existing.embeddingModel,
          JSON.stringify(config.enabledFeatures ?? existing.enabledFeatures),
          config.maxTokens ?? existing.maxTokens,
          config.temperature ?? existing.temperature,
          ts,
          existing.id,
        ]
      );
      return (await loadConfig())!;
    } else {
      const id = generateId();
      const defaults: AIConfig = {
        id,
        provider: "local_ollama",
        localModel: "llama3.2",
        localBaseUrl: "http://localhost:11434",
        embeddingModel: "nomic-embed-text",
        enabledFeatures: ["task_nl", "task_breakdown", "note_summary", "journal_prompts"],
        maxTokens: 2048,
        temperature: 0.7,
        createdAt: ts,
        updatedAt: ts,
        ...config,
      };
      await db.execute(
        `INSERT INTO ai_config (id, provider, local_model, local_base_url, openai_key, anthropic_key,
          gemini_key, embedding_model, enabled_features, max_tokens, temperature, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          defaults.id, defaults.provider, defaults.localModel ?? null,
          defaults.localBaseUrl ?? null, defaults.openaiKey ?? null,
          defaults.anthropicKey ?? null, defaults.geminiKey ?? null,
          defaults.embeddingModel, JSON.stringify(defaults.enabledFeatures),
          defaults.maxTokens, defaults.temperature, defaults.createdAt, defaults.updatedAt,
        ]
      );
      return defaults;
    }
  },

  // ── Conversation CRUD ──────────────────────────────────────

  async getConversations(contextType?: string, contextId?: string): Promise<AIConversation[]> {
    let sql = "SELECT * FROM ai_conversations";
    const params: unknown[] = [];
    if (contextType) {
      sql += " WHERE context_type = ?";
      params.push(contextType);
      if (contextId) { sql += " AND context_id = ?"; params.push(contextId); }
    }
    sql += " ORDER BY updated_at DESC LIMIT 50";
    const rows = await db.select<Record<string, unknown>>(sql, params);
    return rows.map(r => ({
      id: r.id as string,
      contextType: r.context_type as any,
      contextId: r.context_id as string | undefined,
      title: r.title as string | undefined,
      messages: JSON.parse(r.messages as string || "[]"),
      model: r.model as string,
      provider: r.provider as AIProvider,
      tokensUsed: r.tokens_used as number,
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
    }));
  },

  async createConversation(
    contextType: string,
    contextId?: string,
    title?: string
  ): Promise<AIConversation> {
    const config = await loadConfig();
    const id = generateId();
    const ts = now();
    const conv: AIConversation = {
      id, contextType: contextType as any, contextId, title,
      messages: [], model: config?.localModel || "",
      provider: config?.provider || "local_ollama",
      tokensUsed: 0, createdAt: ts, updatedAt: ts,
    };
    await db.execute(
      `INSERT INTO ai_conversations (id, context_type, context_id, title, messages, model, provider, tokens_used, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [id, contextType, contextId ?? null, title ?? null, "[]", conv.model, conv.provider, 0, ts, ts]
    );
    return conv;
  },

  async sendMessage(convId: ID, userMessage: string): Promise<string> {
    const rows = await db.select<Record<string, unknown>>(
      "SELECT * FROM ai_conversations WHERE id = ?", [convId]
    );
    if (!rows.length) throw new Error("Conversation not found");
    const config = await loadConfig();
    if (!config) throw new Error("AI not configured");

    const messages: AIConversation["messages"] = JSON.parse(rows[0].messages as string || "[]");
    const ts = now();
    messages.push({ role: "user", content: userMessage, timestamp: ts });

    // Build prompt from history (last 10 messages) — filter out any with missing content
    const history = messages
      .slice(-10)
      .filter((m) => m && typeof m.content === "string" && m.content.trim().length > 0);
    const historyText = history
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n");

    const reply = await complete(historyText, config, {
      systemPrompt: "You are Butler, a context-aware productivity assistant. Answer based on the conversation history above.",
    });

    const replyTs = now();
    messages.push({ role: "assistant", content: reply, timestamp: replyTs });

    await db.execute(
      "UPDATE ai_conversations SET messages=?, updated_at=? WHERE id=?",
      [JSON.stringify(messages), replyTs, convId]
    );

    return reply;
  },

  async deleteConversation(id: ID): Promise<void> {
    await db.execute("DELETE FROM ai_conversations WHERE id=?", [id]);
  },

  // ── Action audit log ───────────────────────────────────────

  async logAction(actionType: AIActionType, input: unknown, output: unknown): Promise<AIAction> {
    const id = generateId();
    const ts = now();
    const action: AIAction = {
      id, actionType,
      inputContext: input as Record<string, unknown>,
      output: output as Record<string, unknown>,
      createdAt: ts,
    };
    await db.execute(
      "INSERT INTO ai_actions (id, action_type, input_context, output, created_at) VALUES (?,?,?,?,?)",
      [id, actionType, JSON.stringify(input), JSON.stringify(output), ts]
    );
    return action;
  },

  async recordAcceptance(actionId: ID, accepted: boolean): Promise<void> {
    await db.execute(
      "UPDATE ai_actions SET accepted=?, accepted_at=? WHERE id=?",
      [accepted ? 1 : 0, now(), actionId]
    );
  },

  async getRecentActions(limit = 20): Promise<AIAction[]> {
    const rows = await db.select<Record<string, unknown>>(
      "SELECT * FROM ai_actions ORDER BY created_at DESC LIMIT ?", [limit]
    );
    return rows.map(r => ({
      id: r.id as string,
      actionType: r.action_type as AIActionType,
      inputContext: JSON.parse(r.input_context as string || "{}"),
      output: JSON.parse(r.output as string || "{}"),
      accepted: r.accepted != null ? Boolean(r.accepted) : undefined,
      acceptedAt: r.accepted_at as string | undefined,
      createdAt: r.created_at as string,
    }));
  },
};
