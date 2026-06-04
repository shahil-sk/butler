import type { Migration } from "@/kernel/db";

export const AI_MIGRATIONS: Migration[] = [
  {
    version: 150,
    module: "ai",
    up: `
      CREATE TABLE IF NOT EXISTS ai_conversations (
        id TEXT PRIMARY KEY,
        context_type TEXT NOT NULL DEFAULT 'global',
        context_id TEXT,
        title TEXT,
        messages TEXT NOT NULL DEFAULT '[]',
        model TEXT NOT NULL DEFAULT '',
        provider TEXT NOT NULL DEFAULT 'local_ollama',
        tokens_used INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_ai_conversations_context
        ON ai_conversations(context_type, context_id);

      CREATE TABLE IF NOT EXISTS ai_actions (
        id TEXT PRIMARY KEY,
        action_type TEXT NOT NULL,
        input_context TEXT NOT NULL DEFAULT '{}',
        output TEXT NOT NULL DEFAULT '{}',
        accepted INTEGER,
        accepted_at TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ai_config (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL DEFAULT 'local_ollama',
        local_model TEXT,
        local_base_url TEXT,
        openai_key TEXT,
        anthropic_key TEXT,
        gemini_key TEXT,
        embedding_model TEXT NOT NULL DEFAULT 'nomic-embed-text',
        enabled_features TEXT NOT NULL DEFAULT '[]',
        max_tokens INTEGER NOT NULL DEFAULT 2048,
        temperature REAL NOT NULL DEFAULT 0.7,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
    down: `
      DROP TABLE IF EXISTS ai_conversations;
      DROP TABLE IF EXISTS ai_actions;
      DROP TABLE IF EXISTS ai_config;
    `,
  },
];
