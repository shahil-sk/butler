import { useEffect, useState, useCallback, useMemo } from "react";

import { format } from "date-fns";
import {
  Book, Calendar, SlidersHorizontal, Sun, Moon,
  Target, CheckSquare, Award, AlertCircle, BookOpen,
  Activity, ArrowRight, Save, Layout, CircleDot, Lightbulb, Sparkles, Loader2
} from "lucide-react";
import { cn, today } from "@/shared/utils";

import { useJournalStore } from "./store";
import { useNoteStore } from "@/modules/notes/store";
import { useTaskStore } from "@/modules/tasks/store";
import { useProjectStore } from "@/modules/projects/store";
import { useHabitsStore } from "@/modules/habits/store";
import { useGoalsStore } from "@/modules/goals/store";
import { useTimeStore } from "@/modules/time-tracking/store";
import { useFocusStore } from "@/modules/focus/store";
import { AIService } from "@/modules/ai/service";
import { RichEditor } from "@/shared/RichEditor";
import { registry } from "@/kernel/router";
import { JOURNAL_MANIFEST } from "./manifest";
import { setupJournalEventListeners } from "./events";
import type { JournalEntry, Note } from "@/shared/types";

// ─────────────────────────────────────────────────────────────
// MOOD SLIDER COMPONENT
// ─────────────────────────────────────────────────────────────

function MoodSlider({ value, onChange, label, colorClass }: { value?: number, onChange: (v: number) => void, label: string, colorClass: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
        <span className={cn("text-xs font-bold", value ? colorClass : "text-muted-foreground/50")}>
          {value ? `${value}/10` : "Not set"}
        </span>
      </div>
      <input
        type="range"
        min="1" max="10" step="1"
        value={value || 5}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className={cn("w-full h-1.5 rounded-full appearance-none bg-muted focus:outline-none focus:ring-2 focus:ring-primary/50", colorClass.replace("text-", "accent-"))}
        style={{
          background: value ? undefined : "var(--muted)",
        }}
      />
      <div className="flex items-center justify-between text-[10px] text-muted-foreground/70 font-medium px-1">
        <span>Low</span>
        <span>Avg</span>
        <span>High</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// LIST INPUT COMPONENT
// ─────────────────────────────────────────────────────────────

function ListInput({ items, onChange, placeholder, maxItems = 5, icon: Icon }: { items: string[], onChange: (v: string[]) => void, placeholder: string, maxItems?: number, icon: any }) {
  const [val, setVal] = useState("");
  
  const handleAdd = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && val.trim() && items.length < maxItems) {
      onChange([...items, val.trim()]);
      setVal("");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-muted/50 border border-border rounded-lg group">
            <Icon size={12} className="text-muted-foreground/70" />
            <span>{it}</span>
            <button onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="text-muted-foreground/50 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
              &times;
            </button>
          </div>
        ))}
      </div>
      {items.length < maxItems && (
        <input
          type="text"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={handleAdd}
          placeholder={placeholder}
          className="w-full bg-background border border-border/60 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-primary/50"
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DAILY JOURNAL VIEW
// ─────────────────────────────────────────────────────────────

function DailyJournalView() {
  const { entries, getOrCreateDaily, updateEntry } = useJournalStore();
  const { getOrCreateToday, updateNote } = useNoteStore();
  const { tasks } = useTaskStore();
  const { projects } = useProjectStore();
  const { habits, logs, logHabit } = useHabitsStore();
  const { goals } = useGoalsStore();
  
  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const [prompts, setPrompts] = useState<{ question: string, context: string }[] | null>(null);
  const [loadingPrompts, setLoadingPrompts] = useState(false);

  const todayStr = today();
  const todaysTasks = useMemo(() => {
    return tasks.filter((t) => t.dueDate === todayStr || t.scheduledDate === todayStr || (t.completedAt && t.completedAt.startsWith(todayStr)));
  }, [tasks, todayStr]);

  const completedToday = todaysTasks.filter((t) => t.status === "done");
  const unfinishedToday = todaysTasks.filter((t) => t.status !== "done" && t.status !== "cancelled");

  const completedByProject = useMemo(() => {
    const groups: Record<string, typeof completedToday> = {};
    completedToday.forEach((t) => {
      const pid = t.projectId || "unassigned";
      if (!groups[pid]) groups[pid] = [];
      groups[pid].push(t);
    });
    return groups;
  }, [completedToday]);

  const activeHabits = useMemo(() => habits.filter(h => !h.archivedAt), [habits]);
  const todayLogs = useMemo(() => logs.filter(l => l.date === todayStr), [logs, todayStr]);

  // Load today's entries
  useEffect(() => {
    async function load() {
      const n = await getOrCreateToday();
      const e = await getOrCreateDaily(today(), n.id);
      setNote(n);
      setEntry(e);
    }
    load();
  }, [getOrCreateDaily, getOrCreateToday]);

  if (!entry || !note) {
    return <div className="p-8 text-center text-muted-foreground">Loading journal...</div>;
  }

  const hour = new Date().getHours();
  const isMorning = hour < 12;
  const isEvening = hour >= 17;

  // Nudges for Goal-linked Habits & Milestones
  const nudges: { id: string, message: string, contextTitle?: string }[] = [];
  const todayDate = new Date();
  activeHabits.forEach(h => {
    if (!h.linkedGoalId) return;
    const goal = goals.find(g => g.id === h.linkedGoalId);
    if (!goal || goal.status !== "active") return;
    
    let missedDays = 0;
    for (let i = 1; i <= 4; i++) {
      const d = new Date(todayDate);
      d.setDate(d.getDate() - i);
      const dateStr = format(d, "yyyy-MM-dd");
      const logForAll = logs.find(l => l.habitId === h.id && l.date === dateStr);
      if (!logForAll || logForAll.status !== "done") {
        missedDays++;
      }
    }
    
    if (missedDays >= 4) {
      nudges.push({
        id: h.id,
        message: `Your "${h.name}" habit has slipped ${missedDays} days — still aligned with your goal?`,
        contextTitle: goal.title
      });
    }
  });

  // Nudges for Upcoming Milestones (Morning Review)
  if (isMorning) {
    const nextWeekDate = new Date();
    nextWeekDate.setDate(nextWeekDate.getDate() + 7);
    const nextWeekStr = format(nextWeekDate, "yyyy-MM-dd");
    
    projects.forEach(p => {
      if (p.status !== "active") return;
      p.milestones.forEach(m => {
        if (!m.completedAt && m.dueDate >= todayStr && m.dueDate <= nextWeekStr) {
          const daysAway = Math.ceil((new Date(m.dueDate).getTime() - new Date(todayStr).getTime()) / (1000 * 3600 * 24));
          const daysText = daysAway === 0 ? "today" : daysAway === 1 ? "tomorrow" : `in ${daysAway} days`;
          nudges.push({
            id: m.id,
            message: `Milestone due ${daysText}: ${m.title}`,
            contextTitle: `Project: ${p.name}`
          });
        }
      });
    });
  }

  const generatePrompts = async () => {
    setLoadingPrompts(true);
    try {
      const focusMinutes = useFocusStore.getState().sessions
        .filter(s => s.completedAt && s.startedAt?.startsWith(todayStr))
        .reduce((acc, s) => acc + (s.actualMinutes || 0), 0);

      const res = await AIService.generateJournalPrompts({
        completedTasks: completedToday.map(t => t.title),
        deferredTasks: unfinishedToday.map(t => t.title),
        focusMinutes,
        mood: entry?.moodEvening,
      });
      setPrompts(res);
    } catch (e) {
      console.error(e);
    }
    setLoadingPrompts(false);
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      
      {/* LEFT PANE: Note Content */}
      <div className="flex-1 flex flex-col border-r border-border min-w-0 bg-background">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-foreground">Daily Note</h2>
            <p className="text-xs text-muted-foreground font-medium">{format(new Date(note.date || today()), "EEEE, MMMM d, yyyy")}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 bg-muted rounded text-muted-foreground">
              {entry.writeStreak} Day Streak
            </span>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          <RichEditor
            content={note.content}
            onChange={(c) => updateNote(note.id, { content: c })}
            placeholder="Write your daily note here..."
            className="h-full min-h-[500px]"
            borderless
          />
        </div>
      </div>

      {/* RIGHT PANE: Structured Journal Data */}
      <div className="w-96 flex flex-col shrink-0 bg-muted/5 overflow-y-auto">
        <div className="p-4 border-b border-border/40 bg-muted/20 shrink-0 sticky top-0 z-10 backdrop-blur-md">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <SlidersHorizontal size={14} className="text-primary" />
            Journal Metrics
          </h3>
        </div>

        <div className="p-5 space-y-8">
          
          {/* Nudges */}
          {nudges.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5 mb-3">
                <Lightbulb size={14} /> Insights & Nudges
              </h4>
              <div className="space-y-3">
                {nudges.map((n) => (
                  <div key={n.id} className="p-3 bg-background rounded-lg border border-border shadow-sm flex items-start gap-3 text-sm">
                    <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground">{n.message}</p>
                      {n.contextTitle && <p className="text-xs text-muted-foreground mt-0.5">{n.contextTitle}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mood & Energy */}
          <div className="space-y-5">
            <div className="flex items-center gap-2 mb-2">
              <Sun size={14} className="text-amber-500" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Morning Check-in</h4>
            </div>
            <MoodSlider 
              label="Mood" 
              value={entry.moodMorning} 
              onChange={(v) => updateEntry(entry.id, { moodMorning: v })} 
              colorClass="text-amber-500" 
            />
            <MoodSlider 
              label="Energy" 
              value={entry.energyMorning} 
              onChange={(v) => updateEntry(entry.id, { energyMorning: v })} 
              colorClass="text-orange-500" 
            />

            <div className="mt-4 pt-2">
              <h5 className="text-[10px] font-bold uppercase text-amber-500/80 mb-2 tracking-wider">Morning Habits</h5>
              {activeHabits.length === 0 ? (
                <p className="text-xs text-muted-foreground/50 italic">No habits configured.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {activeHabits.map((h) => {
                    const log = todayLogs.find((l) => l.habitId === h.id);
                    const isDone = log?.status === "done";
                    return (
                      <button 
                        key={h.id}
                        onClick={() => logHabit(h.id, todayStr, isDone ? "skipped" : "done")}
                        className="flex items-center gap-2 text-left group"
                      >
                        <div className={cn(
                          "w-3.5 h-3.5 rounded-[4px] border flex items-center justify-center transition-colors", 
                          isDone ? "bg-emerald-500 border-emerald-500" : "border-border/60 group-hover:border-primary/50"
                        )}>
                          {isDone && <CheckSquare size={10} className="text-white opacity-0 absolute" />}
                        </div>
                        <span className={cn(
                          "text-xs transition-colors",
                          isDone ? "text-muted-foreground line-through decoration-muted-foreground/40" : "text-foreground/80 group-hover:text-foreground"
                        )}>
                          {h.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <hr className="border-border/50" />

          <div className="space-y-5">
            <div className="flex items-center gap-2 mb-2">
              <Moon size={14} className="text-indigo-500" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Evening Review</h4>
            </div>
            <MoodSlider 
              label="Mood" 
              value={entry.moodEvening} 
              onChange={(v) => updateEntry(entry.id, { moodEvening: v })} 
              colorClass="text-indigo-500" 
            />
            <MoodSlider 
              label="Energy" 
              value={entry.energyEvening} 
              onChange={(v) => updateEntry(entry.id, { energyEvening: v })} 
              colorClass="text-blue-500" 
            />

            {/* Completed Tasks by Project */}
            <div className="mt-4 pt-2">
              <h5 className="text-[10px] font-bold uppercase text-emerald-500/80 mb-2 tracking-wider">Completed Today</h5>
              {completedToday.length === 0 ? (
                <p className="text-xs text-muted-foreground/50 italic">No tasks completed today.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {Object.entries(completedByProject).map(([pid, pTasks]) => {
                    const pName = pid === "unassigned" ? "Unassigned" : (projects.find(p => p.id === pid)?.name || "Unknown Project");
                    return (
                      <div key={pid} className="flex flex-col gap-1.5">
                        <span className="text-[10px] font-semibold text-muted-foreground">{pName}</span>
                        {pTasks.map((t) => (
                          <div key={t.id} className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
                            <CheckSquare size={11} className="text-emerald-500/60" />
                            <span className="truncate line-through decoration-muted-foreground/30">{t.title}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Unfinished Tasks */}
            <div className="mt-4">
              <h5 className="text-[10px] font-bold uppercase text-orange-500/80 mb-2 tracking-wider">Not completed — move, delegate, or let go</h5>
              {unfinishedToday.length === 0 ? (
                <p className="text-xs text-muted-foreground/50 italic">All caught up!</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {unfinishedToday.map((t) => (
                    <div key={t.id} className="flex items-center gap-1.5 text-xs text-foreground/80">
                      <CircleDot size={11} className="text-muted-foreground/40" />
                      <span className="truncate">{t.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <hr className="border-border/50" />

          {/* Structured Lists */}
          <div className="space-y-6">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <Target size={14} className="text-emerald-500" /> Intentions
              </h4>
              <textarea
                value={entry.morningIntention || ""}
                onChange={(e) => updateEntry(entry.id, { morningIntention: e.target.value })}
                placeholder="What matters most today?"
                className="w-full h-20 text-sm bg-background border border-border/60 rounded-lg p-3 resize-none focus:outline-none focus:border-primary/50"
              />
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <Award size={14} className="text-yellow-500" /> Wins
              </h4>
              <ListInput
                items={entry.wins || []}
                onChange={(wins) => updateEntry(entry.id, { wins })}
                placeholder="What went well today? (Enter to add)"
                icon={Award}
              />
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <AlertCircle size={14} className="text-rose-500" /> Challenges
              </h4>
              <ListInput
                items={entry.challenges || []}
                onChange={(challenges) => updateEntry(entry.id, { challenges })}
                placeholder="What was hard today?"
                icon={AlertCircle}
              />
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <BookOpen size={14} className="text-purple-500" /> Learnings
              </h4>
              <ListInput
                items={entry.learnings || []}
                onChange={(learnings) => updateEntry(entry.id, { learnings })}
                placeholder="What did you learn today?"
                icon={BookOpen}
              />
            </div>

            {/* AI Prompts */}
            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 mt-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-500 flex items-center gap-1.5">
                  <Sparkles size={14} /> AI Reflection
                </h4>
                {!prompts && (
                  <button onClick={generatePrompts} disabled={loadingPrompts} className="text-[10px] bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded font-medium hover:bg-indigo-500/30 transition-fast flex items-center gap-1">
                    {loadingPrompts ? <Loader2 size={10} className="animate-spin" /> : null}
                    Generate
                  </button>
                )}
              </div>
              
              {!prompts && !loadingPrompts && (
                <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                  Get personalized reflection questions based on today's tasks and activity.
                </p>
              )}

              {prompts && (
                <div className="space-y-3">
                  {prompts.map((p, idx) => (
                    <div key={idx} className="bg-background/60 border border-border/50 rounded-lg p-3">
                      <p className="text-[11px] text-indigo-500/80 uppercase font-bold tracking-wider mb-1.5">{p.context}</p>
                      <p className="text-xs text-foreground/90 font-medium leading-relaxed">{p.question}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODULE ROOT
// ─────────────────────────────────────────────────────────────

export default function JournalModule() {
  const { loadEntries, entries } = useJournalStore();
  const { loadNotes } = useNoteStore();
  const { loadHabits } = useHabitsStore();

  useEffect(() => {
    registry.register(JOURNAL_MANIFEST);
    const unsub = setupJournalEventListeners();
    void loadEntries();
    void loadNotes();
    void loadHabits();
    return unsub;
  }, [loadEntries, loadNotes, loadHabits]);

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-3 border-b border-border/40 shrink-0 gap-4">
        <div>
          <h1 className="text-[20px] font-bold leading-tight tracking-tight text-gradient flex items-center gap-2">
            <Book size={20} className="text-primary" /> Journal
          </h1>
          <p className="text-[12px] text-muted-foreground mt-0.5 leading-tight font-medium">Daily reflection, mood tracking, and self-awareness.</p>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <DailyJournalView />
      </div>
    </div>
  );
}
