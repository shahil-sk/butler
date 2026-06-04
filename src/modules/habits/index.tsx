// ============================================================
// HABITS — Module  (ground-up redesign)
// Three views: Today · Habits · Routines
// ============================================================

import { useEffect, useState, useRef, useMemo } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  Plus, X, Check, SkipForward, Flame, Target, TrendingUp,
  Sun, Moon, Zap, Brain, Heart, DollarSign, Palette,
  Users, BookOpen, Dumbbell, Trash2, Archive, ArrowRight,
  ChevronRight, Edit2, Clock, Repeat, Award
} from "lucide-react";

import { useHabitsStore } from "./store";
import { HABITS_MANIFEST } from "./manifest";
import { registry }       from "@/kernel/router";
import { cn, today, generateId } from "@/shared/utils";
import type { Habit, HabitLog } from "@/shared/types";

registry.register(HABITS_MANIFEST);

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const CATEGORY_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  health:        { label: "Health",        icon: <Heart size={14} />,     color: "#ef4444" },
  fitness:       { label: "Fitness",       icon: <Dumbbell size={14} />,  color: "#f97316" },
  learning:      { label: "Learning",      icon: <BookOpen size={14} />,  color: "#3b82f6" },
  mindfulness:   { label: "Mindfulness",   icon: <Brain size={14} />,     color: "#8b5cf6" },
  productivity:  { label: "Productivity",  icon: <Zap size={14} />,       color: "#eab308" },
  social:        { label: "Social",        icon: <Users size={14} />,     color: "#ec4899" },
  creative:      { label: "Creative",      icon: <Palette size={14} />,   color: "#14b8a6" },
  finance:       { label: "Finance",       icon: <DollarSign size={14} />,color: "#22c55e" },
  custom:        { label: "Custom",        icon: <Target size={14} />,    color: "#6366f1" },
};

const PRESET_COLORS = [
  "#6366f1","#8b5cf6","#ec4899","#ef4444","#f97316",
  "#eab308","#22c55e","#14b8a6","#3b82f6","#06b6d4",
];

const DIFFICULTY_MAP = {
  easy:   { label: "Easy",   cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  medium: { label: "Medium", cls: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  hard:   { label: "Hard",   cls: "text-red-400 bg-red-500/10 border-red-500/20" },
};

const DOW = ["S","M","T","W","T","F","S"];

// ─────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────
function getPast14Days(): string[] {
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.now() - (13 - i) * 86400000);
    return d.toISOString().slice(0, 10);
  });
}
function computeStreak(logs: HabitLog[], habitId: string): number {
  const done = new Set(
    logs.filter(l => l.habitId === habitId && l.status === "done").map(l => l.date)
  );
  let streak = 0;
  let d = new Date();
  while (true) {
    const key = d.toISOString().slice(0, 10);
    if (done.has(key)) { streak++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return streak;
}
function isDueToday(habit: Habit): boolean {
  const dow = new Date().getDay();
  if (habit.frequencyType === "daily") return true;
  if (habit.frequencyType === "weekly") return habit.frequencyDays?.includes(dow) ?? false;
  return true;
}

// ─────────────────────────────────────────────────────────────
// HERO HEADER
// ─────────────────────────────────────────────────────────────
function HabitsHero({
  doneToday, totalToday, topStreak, totalAllTime, activeView
}: {
  doneToday: number; totalToday: number; topStreak: number;
  totalAllTime: number; activeView: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    gsap.from(".habits-hero-item", {
      y: 40, opacity: 0, duration: 1, stagger: 0.08, ease: "power4.out", clearProps: "all"
    });
  }, { scope: ref, dependencies: [activeView] });

  const pct = totalToday > 0 ? Math.round((doneToday / totalToday) * 100) : 0;

  const STATS = [
    { label: "Done Today",   value: `${doneToday}/${totalToday}`, color: "text-primary",     bg: "bg-primary/10",       border: "border-primary/20"       },
    { label: "Completion",   value: `${pct}%`,                    color: "text-emerald-400", bg: "bg-emerald-500/10",   border: "border-emerald-500/20"   },
    { label: "Top Streak",   value: `${topStreak}d`,              color: "text-amber-400",   bg: "bg-amber-500/10",     border: "border-amber-500/20"     },
    { label: "All Time Done",value: String(totalAllTime),         color: "text-violet-400",  bg: "bg-violet-500/10",    border: "border-violet-500/20"    },
  ];

  const headlineMap: Record<string, string> = {
    today:    pct === 100 ? "Perfect Day! 🎉" : pct > 50 ? "Keep Going." : "Let's Build.",
    habits:   "Your Habits.",
    routines: "Your Routines.",
  };

  return (
    <div ref={ref} className="px-8 md:px-16 pt-8 pb-8 text-center w-full">
      <p className="habits-hero-item text-sm font-bold tracking-[0.2em] uppercase text-muted-foreground mb-3">
        {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
      </p>
      <h1 className="habits-hero-item text-5xl md:text-7xl font-black tracking-tighter text-foreground mb-4 leading-none">
        {headlineMap[activeView] ?? "Habits."}
      </h1>
      <p className="habits-hero-item text-base text-muted-foreground mb-8 max-w-sm mx-auto">
        {activeView === "today"
          ? `${doneToday} of ${totalToday} habits checked off`
          : `${totalToday} habits · ${topStreak}d best streak`}
      </p>

      {activeView === "today" && (
        <>
          {/* Thick progress bar */}
          <div className="habits-hero-item w-full max-w-sm mx-auto mb-8">
            <div className="h-3 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-1000 ease-out shadow-[0_0_12px_hsl(var(--primary)/0.5)]"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">{pct}% complete</p>
          </div>
        </>
      )}

      <div className="habits-hero-item flex flex-wrap justify-center gap-3">
        {STATS.map(({ label, value, color, bg, border }) => (
          <div key={label} className={cn("flex flex-col items-center px-5 py-3 rounded-2xl border", bg, border)}>
            <span className={cn("text-2xl font-black tabular-nums", color)}>{value}</span>
            <span className="text-xs font-semibold text-muted-foreground mt-0.5">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// HABIT CARD (Today view) — large, one-tap check-off
// ─────────────────────────────────────────────────────────────
function TodayHabitCard({
  habit, log, streak, onDone, onSkip, onEdit
}: {
  habit: Habit; log?: HabitLog; streak: number;
  onDone: () => void; onSkip: () => void; onEdit: () => void;
}) {
  const past14 = getPast14Days();
  const cardRef = useRef<HTMLDivElement>(null);
  const isDone    = log?.status === "done";
  const isSkipped = log?.status === "skipped";

  useGSAP(() => {
    gsap.from(cardRef.current, {
      y: 30, opacity: 0, duration: 0.5, ease: "back.out(1.2)", clearProps: "all"
    });
  }, []);

  const catMeta = CATEGORY_META[habit.category ?? "custom"];

  return (
    <div
      ref={cardRef}
      className={cn(
        "group relative rounded-3xl border p-6 transition-all duration-300",
        "hover:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.15)] hover:scale-[1.01]",
        isDone
          ? "border-emerald-500/30 bg-emerald-500/5"
          : isSkipped
          ? "border-border/30 bg-muted/20 opacity-60"
          : "border-border/50 bg-card"
      )}
    >
      {/* Edit button */}
      <button
        onClick={onEdit}
        className="absolute top-4 right-4 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground hover:bg-muted"
      >
        <Edit2 size={12} />
      </button>

      {/* Header row */}
      <div className="flex items-start gap-4 mb-5">
        {/* Color + icon circle */}
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0 shadow-lg"
          style={{ backgroundColor: `${habit.color}22`, color: habit.color, border: `1.5px solid ${habit.color}44` }}
        >
          {habit.icon || catMeta?.icon}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className={cn("text-base font-bold leading-tight", isDone && "line-through text-muted-foreground")}>
            {habit.name}
          </h3>
          {habit.description && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{habit.description}</p>
          )}
          <div className="flex items-center gap-2 mt-1.5">
            {habit.category && (
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: habit.color }}>
                {catMeta?.label}
              </span>
            )}
            {streak > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] font-bold text-amber-500">
                <Flame size={10} /> {streak}d
              </span>
            )}
            {habit.difficulty && (
              <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-semibold", DIFFICULTY_MAP[habit.difficulty]?.cls)}>
                {DIFFICULTY_MAP[habit.difficulty]?.label}
              </span>
            )}
          </div>
        </div>

        {/* Check button */}
        <button
          onClick={isDone ? undefined : onDone}
          disabled={isSkipped}
          className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 shrink-0 font-bold shadow-md",
            isDone
              ? "bg-emerald-500 text-white cursor-default scale-95"
              : "border-2 border-border hover:border-emerald-500 hover:bg-emerald-500/10 hover:scale-110 active:scale-95 text-muted-foreground hover:text-emerald-500"
          )}
        >
          <Check size={20} strokeWidth={3} />
        </button>
      </div>

      {/* 14-day dot heatmap */}
      <div className="flex gap-1 items-center">
        {past14.map((d) => {
          // We'd need logs here, pass them in or compute inline
          return (
            <div
              key={d}
              title={d}
              className="flex-1 h-2 rounded-full"
              style={{ backgroundColor: d === today() && isDone ? habit.color : d === today() ? "hsl(var(--border))" : "hsl(var(--muted))" }}
            />
          );
        })}
      </div>

      {/* Skip button */}
      {!isDone && !isSkipped && (
        <button
          onClick={onSkip}
          className="absolute bottom-3 right-4 text-[10px] text-muted-foreground/40 hover:text-muted-foreground transition-colors opacity-0 group-hover:opacity-100"
        >
          skip →
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// HABIT BENTO CARD (Habits management view)
// ─────────────────────────────────────────────────────────────
function HabitManageCard({
  habit, streak, totalDone, onEdit, onArchive, onDelete
}: {
  habit: Habit; streak: number; totalDone: number;
  onEdit: () => void; onArchive: () => void; onDelete: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    gsap.from(cardRef.current, {
      y: 24, opacity: 0, duration: 0.5, ease: "back.out(1.1)", clearProps: "all"
    });
  }, []);

  const catMeta = CATEGORY_META[habit.category ?? "custom"];
  const freq = habit.frequencyType === "daily" ? "Daily"
    : habit.frequencyType === "weekly" ? `${habit.frequencyDays?.length ?? 0}×/week`
    : "Monthly";

  return (
    <div
      ref={cardRef}
      className="group relative rounded-3xl border border-border/50 bg-card p-5 hover:shadow-[0_6px_24px_-8px_rgba(0,0,0,0.12)] hover:scale-[1.01] hover:border-border transition-all duration-300"
    >
      {/* Actions */}
      <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onEdit}    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"><Edit2 size={12} /></button>
        <button onClick={onArchive} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-amber-500 transition-colors"><Archive size={12} /></button>
        <button onClick={onDelete}  className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={12} /></button>
      </div>

      {/* Top */}
      <div className="flex items-center gap-3 mb-4 pr-20">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
          style={{ backgroundColor: `${habit.color}22`, color: habit.color }}
        >
          {habit.icon || catMeta?.icon}
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold leading-tight truncate">{habit.name}</h3>
          {habit.category && (
            <p className="text-[10px] font-bold uppercase tracking-wider mt-0.5" style={{ color: habit.color }}>
              {catMeta?.label}
            </p>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1 text-amber-500 font-bold">
          <Flame size={12} /> {streak}d streak
        </div>
        <div className="flex items-center gap-1 text-emerald-500 font-bold">
          <Check size={12} /> {totalDone} done
        </div>
        <div className="ml-auto text-muted-foreground font-medium">{freq}</div>
      </div>

      {/* Color bar at bottom */}
      <div
        className="absolute bottom-0 left-6 right-6 h-[2px] rounded-full opacity-60"
        style={{ backgroundColor: habit.color }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// HABIT FORM MODAL (TaskDetail-inspired full-screen modal)
// ─────────────────────────────────────────────────────────────
function HabitFormModal({
  initial, onSave, onClose
}: {
  initial?: Partial<Habit>;
  onSave: (data: Partial<Habit>) => void;
  onClose: () => void;
}) {
  const [name,        setName]        = useState(initial?.name        ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [icon,        setIcon]        = useState(initial?.icon        ?? "");
  const [color,       setColor]       = useState(initial?.color       ?? PRESET_COLORS[0]);
  const [category,    setCategory]    = useState<Habit["category"]>(initial?.category ?? "health");
  const [freqType,    setFreqType]    = useState<Habit["frequencyType"]>(initial?.frequencyType ?? "daily");
  const [freqDays,    setFreqDays]    = useState<number[]>(initial?.frequencyDays ?? []);
  const [difficulty,  setDifficulty]  = useState<Habit["difficulty"]>(initial?.difficulty ?? "medium");
  const [cue,         setCue]         = useState(initial?.cue         ?? "");
  const [craving,     setCraving]     = useState(initial?.craving     ?? "");
  const [reward,      setReward]      = useState(initial?.reward      ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef   = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    gsap.fromTo(overlayRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power2.out" });
    gsap.fromTo(panelRef.current,
      { scale: 0.96, opacity: 0, y: 20 },
      { scale: 1, opacity: 1, y: 0, duration: 0.45, ease: "back.out(1.1)" }
    );
  }, []);

  const handleClose = () => {
    gsap.to(overlayRef.current, { opacity: 0, duration: 0.2 });
    gsap.to(panelRef.current, {
      scale: 0.97, opacity: 0, y: 10, duration: 0.2, ease: "power2.in",
      onComplete: onClose,
    });
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      onSave({
        name: name.trim(), description: description || undefined,
        icon: icon || undefined, color, category,
        frequencyType: freqType, frequencyDays: freqType === "weekly" ? freqDays : undefined,
        timesPerPeriod: 1, reminderEnabled: false,
        startDate: today(), difficulty, cue: cue || undefined,
        craving: craving || undefined, reward: reward || undefined,
      });
      handleClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleDay = (d: number) =>
    setFreqDays(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8">
      <div ref={overlayRef} onClick={handleClose} className="absolute inset-0 bg-background/80 backdrop-blur-xl" />
      <div
        ref={panelRef}
        className="relative w-full max-w-3xl max-h-[90vh] bg-card border border-border/50 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Dynamic glow */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] blur-[80px] rounded-full pointer-events-none -z-10 opacity-25 transition-colors duration-500"
          style={{ backgroundColor: color }}
        />

        {/* Header */}
        <div className="sticky top-0 z-10 px-8 py-6 bg-card/80 backdrop-blur-md border-b border-border/40 flex flex-col gap-5 shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold tracking-wider uppercase text-muted-foreground">
              {initial?.id ? "Edit Habit" : "New Habit"}
            </span>
            <button onClick={handleClose} className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Big name input */}
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && void handleSave()}
            placeholder="Name your habit…"
            autoFocus
            className="w-full bg-transparent text-4xl md:text-5xl font-black tracking-tight text-foreground placeholder:text-muted-foreground/25 focus:outline-none"
          />

          {/* Difficulty pills */}
          <div className="flex items-center gap-1.5 p-1 bg-muted/30 rounded-full border border-border/40 w-fit">
            {(["easy","medium","hard"] as const).map(d => (
              <button key={d} onClick={() => setDifficulty(d)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border border-transparent transition-all duration-200",
                  difficulty === d ? DIFFICULTY_MAP[d].cls : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}>
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">

          {/* Category grid */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold tracking-wider uppercase text-muted-foreground flex items-center gap-2">
              <Target size={14} /> Category
            </h4>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {Object.entries(CATEGORY_META).map(([k, meta]) => (
                <button
                  key={k}
                  onClick={() => setCategory(k as Habit["category"])}
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-3 rounded-2xl border text-xs font-semibold transition-all duration-200",
                    category === k
                      ? "border-foreground/30 bg-foreground/5 scale-105"
                      : "border-border/40 hover:border-border text-muted-foreground hover:text-foreground"
                  )}
                  style={category === k ? { color: meta.color, borderColor: `${meta.color}60`, backgroundColor: `${meta.color}12` } : {}}
                >
                  {meta.icon}
                  <span className="leading-tight text-center">{meta.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Bento metadata */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Color */}
            <div className="p-4 bg-muted/20 border border-border/50 rounded-2xl space-y-3">
              <h4 className="text-xs font-bold tracking-wider uppercase text-muted-foreground">Color</h4>
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map(c => (
                  <button key={c} onClick={() => setColor(c)}
                    className={cn("w-7 h-7 rounded-full border-[3px] transition-all duration-200",
                      color === c ? "border-foreground scale-110 shadow-lg" : "border-transparent hover:scale-105")}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>

            {/* Frequency */}
            <div className="p-4 bg-muted/20 border border-border/50 rounded-2xl space-y-3">
              <h4 className="text-xs font-bold tracking-wider uppercase text-muted-foreground flex items-center gap-1"><Repeat size={12} /> Frequency</h4>
              <div className="flex gap-1">
                {(["daily","weekly","monthly"] as const).map(f => (
                  <button key={f} onClick={() => setFreqType(f)}
                    className={cn("px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                      freqType === f ? "bg-primary text-primary-foreground" : "bg-background border border-border text-muted-foreground hover:border-primary/50"
                    )}>{f}</button>
                ))}
              </div>
              {freqType === "weekly" && (
                <div className="flex gap-1.5 mt-2">
                  {DOW.map((d, i) => (
                    <button key={i} onClick={() => toggleDay(i)}
                      className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all border",
                        freqDays.includes(i)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:border-primary/50"
                      )}>{d}</button>
                  ))}
                </div>
              )}
            </div>

            {/* Icon */}
            <div className="p-4 bg-muted/20 border border-border/50 rounded-2xl space-y-3">
              <h4 className="text-xs font-bold tracking-wider uppercase text-muted-foreground">Icon / Emoji</h4>
              <input
                value={icon}
                onChange={e => setIcon(e.target.value)}
                placeholder="💪 or any emoji"
                maxLength={4}
                className="w-full bg-background border border-border/50 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>

            {/* Description */}
            <div className="p-4 bg-muted/20 border border-border/50 rounded-2xl space-y-3">
              <h4 className="text-xs font-bold tracking-wider uppercase text-muted-foreground">Description</h4>
              <input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="A short note about this habit…"
                className="w-full bg-background border border-border/50 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>

            {/* Habit Loop */}
            <div className="p-4 md:col-span-2 bg-muted/20 border border-border/50 rounded-2xl space-y-4">
              <h4 className="text-xs font-bold tracking-wider uppercase text-muted-foreground flex items-center gap-1"><Brain size={12} /> Habit Loop (cue → craving → reward)</h4>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Cue", val: cue, set: setCue, ph: "What triggers it?" },
                  { label: "Craving", val: craving, set: setCraving, ph: "Why do you want to?" },
                  { label: "Reward", val: reward, set: setReward, ph: "What's the payoff?" },
                ].map(({ label, val, set, ph }) => (
                  <div key={label}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">{label}</p>
                    <input value={val} onChange={e => set(e.target.value)} placeholder={ph}
                      className="w-full bg-background border border-border/50 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/40" />
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Footer CTA */}
        <div className="shrink-0 p-6 border-t border-border/40 bg-card/80 backdrop-blur-md">
          <button
            onClick={() => void handleSave()}
            disabled={!name.trim() || isSubmitting}
            className="w-full h-14 bg-primary text-primary-foreground font-bold text-lg rounded-2xl flex items-center justify-center gap-2 shadow-[0_8px_32px_-8px_hsl(var(--primary)/0.4)] hover:brightness-110 hover:scale-[1.01] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {isSubmitting ? "Saving…" : initial?.id ? "Save Changes" : "Create Habit"}
            {!isSubmitting && <ArrowRight size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ROUTINE CARD
// ─────────────────────────────────────────────────────────────
function RoutineCard({ routine, habits }: { routine: any; habits: Habit[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    gsap.from(ref.current, { y: 20, opacity: 0, duration: 0.5, ease: "back.out(1.1)", clearProps: "all" });
  }, []);
  const linked = habits.filter(h => routine.habitIds.includes(h.id));
  const typeIcon = routine.type === "morning" ? <Sun size={16} className="text-amber-400" />
    : routine.type === "evening" ? <Moon size={16} className="text-violet-400" />
    : <Zap size={16} className="text-primary" />;

  return (
    <div ref={ref} className="rounded-3xl border border-border/50 bg-card p-6 hover:shadow-[0_6px_24px_-8px_rgba(0,0,0,0.12)] hover:scale-[1.01] hover:border-border transition-all duration-300">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-2xl bg-muted/50 flex items-center justify-center">{typeIcon}</div>
        <div>
          <h3 className="text-sm font-bold">{routine.name}</h3>
          <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">{routine.type} routine{routine.triggerTime ? ` · ${routine.triggerTime}` : ""}</p>
        </div>
        <div className={cn("ml-auto px-2.5 py-1 rounded-full text-[10px] font-bold",
          routine.active ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground")}>
          {routine.active ? "Active" : "Inactive"}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {linked.slice(0, 4).map((h, i) => (
          <div key={h.id} className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs w-4 text-right shrink-0">{i + 1}.</span>
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: h.color }} />
            <span className="text-xs text-foreground truncate">{h.name}</span>
          </div>
        ))}
        {linked.length > 4 && (
          <p className="text-[10px] text-muted-foreground pl-6">+{linked.length - 4} more</p>
        )}
        {linked.length === 0 && <p className="text-xs text-muted-foreground/50 italic pl-6">No habits linked</p>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN MODULE
// ─────────────────────────────────────────────────────────────
export function HabitsModule() {
  const { habits, logs, routines, loadHabits, createHabit, updateHabit, archiveHabit, deleteHabit, logHabit } = useHabitsStore();

  useEffect(() => { void loadHabits(); }, [loadHabits]);

  const [activeView, setActiveView] = useState<"today"|"habits"|"routines">(() =>
    (localStorage.getItem("habits_view") as any) || "today"
  );
  const [editingHabit, setEditingHabit] = useState<Partial<Habit> | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { localStorage.setItem("habits_view", activeView); }, [activeView]);

  // GSAP panel transition
  const mainRef = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    gsap.from(".habits-view-panel", {
      y: 20, opacity: 0, duration: 0.4, ease: "power3.out", clearProps: "all"
    });
  }, [activeView]);

  const todayStr = today();
  const activeHabits = habits.filter(h => !h.archivedAt);
  const dueToday    = activeHabits.filter(isDueToday);
  const doneToday   = dueToday.filter(h => logs.some(l => l.habitId === h.id && l.date === todayStr && l.status === "done"));
  const topStreak   = Math.max(0, ...activeHabits.map(h => computeStreak(logs, h.id)));
  const totalDone   = logs.filter(l => l.status === "done").length;

  const getLog = (habitId: string) => logs.find(l => l.habitId === habitId && l.date === todayStr);

  const handleSave = async (data: Partial<Habit>) => {
    if (editingHabit?.id) {
      await updateHabit(editingHabit.id, data);
    } else {
      await createHabit(data as any);
    }
    setShowForm(false);
    setEditingHabit(null);
  };

  const openCreate = () => { setEditingHabit(null); setShowForm(true); };
  const openEdit   = (h: Habit) => { setEditingHabit(h); setShowForm(true); };

  const NAV_ITEMS = [
    { key: "today",    label: "Today",    icon: <Check size={15} />   },
    { key: "habits",   label: "Habits",   icon: <Flame size={15} />   },
    { key: "routines", label: "Routines", icon: <Repeat size={15} />  },
  ] as const;

  return (
    <main ref={mainRef} className="w-full h-full flex flex-col overflow-hidden bg-background text-foreground">

      {/* ── Glass nav ──────────────────────────────────────── */}
      <div className="shrink-0 pt-6 flex justify-center z-50">
        <div className="flex items-center gap-2 p-2 bg-card/70 backdrop-blur-xl border border-border/50 rounded-full shadow-2xl">
          {NAV_ITEMS.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setActiveView(key)}
              className={cn(
                "flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-300",
                activeView === key
                  ? "bg-foreground text-background shadow-md scale-105"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {icon} {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Hero header ─────────────────────────────────────── */}
      <HabitsHero
        doneToday={doneToday.length}
        totalToday={dueToday.length}
        topStreak={topStreak}
        totalAllTime={totalDone}
        activeView={activeView}
      />

      {/* ── Content ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden px-4 pb-4 habits-view-panel">

        {/* TODAY VIEW */}
        {activeView === "today" && (
          <div className="h-full overflow-y-auto">
            {dueToday.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-5 text-muted-foreground/30">
                <Award size={56} />
                <p className="text-xl font-bold">No habits due today.</p>
                <button onClick={openCreate} className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary text-primary-foreground font-bold hover:brightness-110 transition-all">
                  <Plus size={18} /> Add your first habit
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-8">
                {dueToday.map(h => (
                  <TodayHabitCard
                    key={h.id}
                    habit={h}
                    log={getLog(h.id)}
                    streak={computeStreak(logs, h.id)}
                    onDone={() => void logHabit(h.id, todayStr, "done")}
                    onSkip={() => void logHabit(h.id, todayStr, "skipped")}
                    onEdit={() => openEdit(h)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* HABITS MANAGEMENT VIEW */}
        {activeView === "habits" && (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between px-2 mb-4 shrink-0">
              <p className="text-sm text-muted-foreground">{activeHabits.length} active habits</p>
              <button
                onClick={openCreate}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-primary text-primary-foreground font-bold text-sm hover:brightness-110 hover:scale-[1.02] transition-all shadow-lg shadow-primary/20"
              >
                <Plus size={16} /> New Habit
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {activeHabits.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground/30">
                  <Flame size={48} />
                  <p className="text-lg font-bold">No habits yet.</p>
                  <button onClick={openCreate} className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary text-primary-foreground font-bold hover:brightness-110 transition-all">
                    <Plus size={18} /> Create Habit
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-8">
                  {activeHabits.map(h => (
                    <HabitManageCard
                      key={h.id}
                      habit={h}
                      streak={computeStreak(logs, h.id)}
                      totalDone={logs.filter(l => l.habitId === h.id && l.status === "done").length}
                      onEdit={() => openEdit(h)}
                      onArchive={() => void archiveHabit(h.id)}
                      onDelete={() => void deleteHabit(h.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ROUTINES VIEW */}
        {activeView === "routines" && (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between px-2 mb-4 shrink-0">
              <p className="text-sm text-muted-foreground">{routines.length} routines</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {routines.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground/30">
                  <Repeat size={48} />
                  <p className="text-lg font-bold">No routines yet.</p>
                  <p className="text-sm">Create habits first, then bundle them into morning / evening routines.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-8">
                  {routines.map(r => (
                    <RoutineCard key={r.id} routine={r} habits={habits} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* FAB */}
      {activeView === "today" && dueToday.length > 0 && (
        <button
          onClick={openCreate}
          className="fixed bottom-8 right-8 z-50 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-[0_8px_32px_-8px_hsl(var(--primary)/0.5)] flex items-center justify-center hover:scale-110 active:scale-95 transition-all duration-300"
          title="New Habit"
        >
          <Plus size={26} />
        </button>
      )}

      {/* Habit form modal */}
      {showForm && (
        <HabitFormModal
          initial={editingHabit ?? undefined}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingHabit(null); }}
        />
      )}

    </main>
  );
}

export default HabitsModule;
