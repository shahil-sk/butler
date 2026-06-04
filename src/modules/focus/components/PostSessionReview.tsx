import React, { useState } from "react";
import { useFocusStore } from "../store";
import { Check, X } from "lucide-react";
import { cn } from "@/shared/utils";

export function PostSessionReview() {
  const lastSession = useFocusStore((s) => s.lastCompletedSession);
  const clearLast = useFocusStore((s) => s.clearLastCompleted);
  const setMood = useFocusStore((s) => s.setSessionMood);
  // In a real implementation we would have an update action for flowScore and accomplishment.
  // For now we just use setMood as a proxy or expand store.
  
  const [score, setScore] = useState<number | null>(null);
  const [notes, setNotes] = useState("");

  if (!lastSession) return null;
  // If it's a break session, no need to review
  if (lastSession.type === "break" || lastSession.type === "short_break" || lastSession.type === "long_break") return null;

  function submit() {
    if (score) {
      // For now we map flow score 1-10 to mood 1-5 for backwards compatibility in store,
      // or we can just save it. The store needs setSessionReview.
      // Assuming we will add `setSessionReview` to store.
      const s = useFocusStore.getState();
      if ((s as any).setSessionReview) {
        (s as any).setSessionReview(lastSession!.id, score, notes);
      }
    }
    clearLast();
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-card border shadow-2xl rounded-2xl p-6 relative animate-in zoom-in-95 duration-300">
        <button onClick={clearLast} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
          <X size={20} />
        </button>
        
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold tracking-tight">Session Complete</h2>
          <p className="text-muted-foreground mt-1 text-sm">Great work! How was your flow?</p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 block text-center">Flow Score (1-10)</label>
            <div className="flex justify-between gap-1">
              {[1,2,3,4,5,6,7,8,9,10].map((v) => (
                <button
                  key={v}
                  onClick={() => setScore(v)}
                  className={cn(
                    "w-8 h-10 rounded-md font-medium text-sm transition-all",
                    score === v 
                      ? "bg-primary text-primary-foreground scale-110 shadow-md" 
                      : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-muted-foreground font-medium uppercase tracking-widest px-1">
              <span>Distracted</span>
              <span>Deep Flow</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">What did you accomplish?</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Jotted down some thoughts..."
              className="w-full min-h-[80px] rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary resize-none"
            />
          </div>

          <button
            onClick={submit}
            disabled={!score}
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check size={18} /> Save Review
          </button>
        </div>
      </div>
    </div>
  );
}
