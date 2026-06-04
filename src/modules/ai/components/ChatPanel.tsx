// ============================================================
// AI ASSISTANT — CHAT PANEL COMPONENT
// Floating or embedded chat thread for any context.
// ============================================================

import React, { useEffect, useRef, useState } from "react";
import { Send, Loader2, Trash2, X, Bot, User, AlertCircle } from "lucide-react";
import { cn } from "@/shared/utils";
import { useAIStore } from "../store";
import type { AIContextType, ID } from "@/shared/types";

interface ChatPanelProps {
  contextType?: AIContextType;
  contextId?: ID;
  title?: string;
  onClose?: () => void;
  className?: string;
}

export function ChatPanel({ contextType = "global", contextId, title, onClose, className }: ChatPanelProps) {
  const {
    conversations, activeConversationId, isGenerating, lastError,
    loadConversations, startConversation, sendMessage, openConversation, deleteConversation, clearError,
  } = useAIStore();

  const [input, setInput] = useState("");
  const [localMessages, setLocalMessages] = useState<Array<{ role: string; content: string; ts: string }>>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeConv = conversations.find((c) => c.id === activeConversationId);

  useEffect(() => {
    void loadConversations(contextType, contextId);
  }, [contextType, contextId]);

  useEffect(() => {
    if (activeConv) {
      setLocalMessages(
        activeConv.messages
          .filter((m) => m && typeof m.role === "string")
          .map((m) => ({
            role: m.role,
            content: typeof m.content === "string" ? m.content : String(m.content ?? ""),
            ts: m.timestamp || new Date().toISOString(),
          }))
      );
    }
  }, [activeConv?.id, activeConv?.messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isGenerating) return;
    setInput("");

    // Ensure we have a conversation
    let convId = activeConversationId;
    if (!convId) {
      convId = await startConversation(contextType, contextId, title || "New Chat");
    }

    // Optimistically add user message
    const userMsg = { role: "user", content: text, ts: new Date().toISOString() };
    setLocalMessages((prev) => [...prev, userMsg]);

    try {
      const reply = await sendMessage(convId!, text);
      setLocalMessages((prev) => [...prev, { role: "assistant", content: reply, ts: new Date().toISOString() }]);
    } catch (e) {
      // error already set in store
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className={cn("flex flex-col h-full min-h-0 bg-background", className)}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
          <Bot size={13} className="text-primary" />
        </div>
        <span className="text-sm font-semibold flex-1 truncate">
          {activeConv?.title || title || "AI Assistant"}
        </span>
        <div className="flex items-center gap-1">
          {activeConversationId && (
            <button
              onClick={() => activeConversationId && void deleteConversation(activeConversationId)}
              className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
              title="Clear conversation"
            >
              <Trash2 size={13} />
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-accent text-muted-foreground transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        {localMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-10">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Bot size={22} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Ask me anything</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">
                I can help with tasks, notes, plans, and more.
              </p>
            </div>
          </div>
        )}

        {localMessages.map((msg, i) => (
          <div
            key={i}
            className={cn("flex gap-2.5", msg.role === "user" ? "flex-row-reverse" : "flex-row")}
          >
            <div
              className={cn(
                "w-6 h-6 rounded-md shrink-0 flex items-center justify-center mt-0.5",
                msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-surface-1 border border-border"
              )}
            >
              {msg.role === "user" ? <User size={11} /> : <Bot size={11} className="text-primary" />}
            </div>
            <div
              className={cn(
                "max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-tr-sm"
                  : "bg-surface-1 border border-border/60 text-foreground rounded-tl-sm"
              )}
            >
              {(msg.content ?? "").split("\n").map((line, li) => {
                const lines = (msg.content ?? "").split("\n");
                return (
                  <span key={li}>{line}{li < lines.length - 1 && <br />}</span>
                );
              })}
            </div>
          </div>
        ))}

        {isGenerating && (
          <div className="flex gap-2.5">
            <div className="w-6 h-6 rounded-md bg-surface-1 border border-border flex items-center justify-center shrink-0">
              <Bot size={11} className="text-primary" />
            </div>
            <div className="bg-surface-1 border border-border/60 rounded-xl rounded-tl-sm px-3.5 py-2.5">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        {lastError && (
          <div className="flex items-start gap-2 px-3 py-2.5 bg-red-500/8 border border-red-500/20 rounded-lg text-xs text-red-400">
            <AlertCircle size={13} className="shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <span>{lastError}</span>
            </div>
            <button onClick={clearError} className="shrink-0 hover:text-red-300">
              <X size={11} />
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 px-3 pb-3 pt-2 border-t border-border/60">
        <div className="flex items-end gap-2 bg-surface-1 border border-border rounded-xl px-3 py-2">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask anything... (Enter to send)"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none resize-none max-h-32 leading-relaxed"
            style={{ minHeight: 22 }}
            disabled={isGenerating}
          />
          <button
            onClick={() => void handleSend()}
            disabled={!input.trim() || isGenerating}
            className={cn(
              "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all duration-150",
              input.trim() && !isGenerating
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground/40 cursor-not-allowed"
            )}
          >
            {isGenerating ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground/30 text-center mt-1.5">
          Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
