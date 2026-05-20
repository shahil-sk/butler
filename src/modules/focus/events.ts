// ============================================================
// FOCUS — EVENT BUS LISTENERS
// Wire focus module to task events (completed, cancelled, etc.)
// Call useFocusEventListeners() from the Focus UI component.
// ============================================================

import { useEffect } from "react";
import { bus } from "@/kernel/event-bus";
import { useFocusStore } from "./store";

// ── In-app confirmation dialog (replaces window.confirm) ──────────────────
// Creates a lightweight modal overlay without freezing the JS thread.

function showFocusEndPrompt(message: string, onConfirm: () => void): void {
  // Remove any existing prompt to avoid stacking
  document.getElementById("__focus-end-prompt")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "__focus-end-prompt";
  overlay.style.cssText = [
    "position:fixed",
    "inset:0",
    "z-index:9999",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "background:oklch(0 0 0 / 0.45)",
    "backdrop-filter:blur(4px)",
    "-webkit-backdrop-filter:blur(4px)",
    "animation:fadeIn 120ms ease",
  ].join(";");

  const card = document.createElement("div");
  card.style.cssText = [
    "background:hsl(var(--card, 0 0% 100%))",
    "border:1px solid hsl(var(--border, 0 0% 88%))",
    "border-radius:0.75rem",
    "padding:1.25rem 1.5rem",
    "max-width:22rem",
    "width:calc(100% - 2rem)",
    "box-shadow:0 20px 48px oklch(0 0 0 / 0.22)",
    "display:flex",
    "flex-direction:column",
    "gap:1rem",
  ].join(";");

  const icon = document.createElement("div");
  icon.style.cssText = "font-size:1.5rem;text-align:center";
  icon.textContent = "⏸";

  const text = document.createElement("p");
  text.style.cssText = [
    "font-size:0.875rem",
    "color:hsl(var(--foreground, 0 0% 4%))",
    "line-height:1.5",
    "text-align:center",
  ].join(";");
  text.textContent = message;

  const row = document.createElement("div");
  row.style.cssText = "display:flex;gap:0.5rem;justify-content:center";

  function dismiss() { overlay.remove(); }

  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Keep going";
  cancelBtn.style.cssText = [
    "flex:1",
    "padding:0.5rem 0.75rem",
    "border-radius:0.5rem",
    "border:1px solid hsl(var(--border, 0 0% 88%))",
    "background:transparent",
    "font-size:0.8125rem",
    "font-weight:500",
    "cursor:pointer",
    "color:hsl(var(--foreground, 0 0% 4%))",
    "transition:background 150ms ease",
  ].join(";");
  cancelBtn.onmouseenter = () => (cancelBtn.style.background = "hsl(var(--muted, 0 0% 94%))");
  cancelBtn.onmouseleave = () => (cancelBtn.style.background = "transparent");
  cancelBtn.onclick = dismiss;

  const confirmBtn = document.createElement("button");
  confirmBtn.textContent = "End session";
  confirmBtn.style.cssText = [
    "flex:1",
    "padding:0.5rem 0.75rem",
    "border-radius:0.5rem",
    "border:none",
    "background:hsl(var(--destructive, 0 84% 60%))",
    "color:hsl(var(--destructive-foreground, 0 0% 100%))",
    "font-size:0.8125rem",
    "font-weight:600",
    "cursor:pointer",
    "transition:opacity 150ms ease",
  ].join(";");
  confirmBtn.onmouseenter = () => (confirmBtn.style.opacity = "0.88");
  confirmBtn.onmouseleave = () => (confirmBtn.style.opacity = "1");
  confirmBtn.onclick = () => { dismiss(); onConfirm(); };

  // Dismiss on overlay click
  overlay.onclick = (e) => { if (e.target === overlay) dismiss(); };
  // Dismiss on Escape
  const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { dismiss(); document.removeEventListener("keydown", onKey); } };
  document.addEventListener("keydown", onKey);

  row.append(cancelBtn, confirmBtn);
  card.append(icon, text, row);
  overlay.append(card);
  document.body.append(overlay);

  // Inject fade-in keyframe once
  if (!document.getElementById("__focus-prompt-style")) {
    const style = document.createElement("style");
    style.id = "__focus-prompt-style";
    style.textContent = "@keyframes fadeIn{from{opacity:0;transform:scale(0.96)}to{opacity:1;transform:scale(1)}}";
    document.head.append(style);
  }
}

// ── Event listeners ───────────────────────────────────────────

export function useFocusEventListeners() {
  const activeSession = useFocusStore((s) => s.activeSession);
  const cancel        = useFocusStore((s) => s.cancel);

  useEffect(() => {
    // Prompt user to end session when task is completed
    const offCompleted = bus.on("task:completed", ({ taskId }) => {
      if (!activeSession?.taskId || activeSession.taskId !== taskId) return;
      showFocusEndPrompt(
        "The task you're focusing on was just completed. End this focus session?",
        () => void cancel()
      );
    });

    // Prompt user to end session when task is cancelled
    const offCancelled = bus.on("task:cancelled", ({ taskId }) => {
      if (!activeSession?.taskId || activeSession.taskId !== taskId) return;
      showFocusEndPrompt(
        "The task you're focusing on was just cancelled. End this focus session?",
        () => void cancel()
      );
    });

    return () => {
      offCompleted();
      offCancelled();
    };
  }, [activeSession?.taskId, cancel]);
}
