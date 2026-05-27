import React, { useState, useEffect, useMemo } from "react";
import { 
  Smile, BookOpen, PenTool, ChevronLeft, ChevronRight, 
  Activity, Heart, ExternalLink, Zap, Target, Loader2, ArrowRight
} from "lucide-react";
import { useJournalStore } from "../state/journalStore";
import { useNotesStore } from "../../notes/state/notesStore";
import { useLayoutStore } from "../../../core/state/layoutStore";
import { MoodGrid } from "./MoodGrid";
import { GratitudeWall } from "./GratitudeWall";

export const JournalView: React.FC = () => {
  const {
    entries,
    activeEntry,
    activeReview,
    loading,
    loadEntries,
    loadActiveEntry,
    saveActiveEntry,
    loadActiveReview,
    saveActiveReview,
  } = useJournalStore();

  const [activeTab, setActiveTab] = useState<"daily" | "reviews" | "analytics">("daily");
  
  // Date selector state
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Daily Reflection input states
  const [mood, setMood] = useState(3);
  const [moodNotes, setMoodNotes] = useState("");
  const [gratitude, setGratitude] = useState(["", "", ""]);
  const [health, setHealth] = useState(5);
  const [work, setWork] = useState(5);
  const [relationships, setRelationships] = useState(5);
  const [learning, setLearning] = useState(5);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");

  // Reviews input states
  const [reviewType, setReviewType] = useState<"weekly" | "monthly">("weekly");
  const [reviewPeriod, setReviewPeriod] = useState("");
  const [answer1, setAnswer1] = useState("");
  const [answer2, setAnswer2] = useState("");
  const [answer3, setAnswer3] = useState("");
  const [answer4, setAnswer4] = useState("");
  const [reviewSaveStatus, setReviewSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");

  // Generate periods
  const weeks = useMemo(() => {
    const list = [];
    const now = new Date();
    for (let i = 0; i < 5; i++) {
      const d = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const target = new Date(d.valueOf());
      const dayNr = (d.getDay() + 6) % 7;
      target.setDate(target.getDate() - dayNr + 3);
      const firstThursday = target.valueOf();
      target.setMonth(0, 1);
      if (target.getDay() !== 4) {
        target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
      }
      const weekNum = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
      list.push({
        value: `${d.getFullYear()}-W${weekNum.toString().padStart(2, "0")}`,
        label: `Week ${weekNum}, ${d.getFullYear()}`,
      });
    }
    return list;
  }, []);

  const months = useMemo(() => {
    const list = [];
    const now = new Date();
    for (let i = 0; i < 4; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      list.push({
        value: `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`,
        label: `${monthNames[d.getMonth()]} ${d.getFullYear()}`,
      });
    }
    return list;
  }, []);

  // Initial load
  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // Load active reflection
  useEffect(() => {
    loadActiveEntry(selectedDate);
  }, [selectedDate, loadActiveEntry]);

  // Load active review
  useEffect(() => {
    if (reviewPeriod) {
      loadActiveReview(reviewPeriod, reviewType);
    }
  }, [reviewPeriod, reviewType, loadActiveReview]);

  // Sync inputs with activeEntry
  useEffect(() => {
    if (activeEntry) {
      setMood(activeEntry.mood);
      setMoodNotes(activeEntry.mood_notes || "");
      setGratitude([
        activeEntry.gratitude[0] || "",
        activeEntry.gratitude[1] || "",
        activeEntry.gratitude[2] || "",
      ]);
      try {
        const parsed = JSON.parse(activeEntry.life_areas);
        setHealth(parsed.health ?? 5);
        setWork(parsed.work ?? 5);
        setRelationships(parsed.relationships ?? 5);
        setLearning(parsed.learning ?? 5);
      } catch (e) {
        setHealth(5); setWork(5); setRelationships(5); setLearning(5);
      }
      setSaveStatus("saved");
    } else {
      setMood(3); setMoodNotes(""); setGratitude(["", "", ""]);
      setHealth(5); setWork(5); setRelationships(5); setLearning(5);
      setSaveStatus("saved");
    }
  }, [activeEntry]);

  // Sync inputs with activeReview
  useEffect(() => {
    if (activeReview) {
      try {
        const parsed = JSON.parse(activeReview.responses);
        setAnswer1(parsed.ans1 || "");
        setAnswer2(parsed.ans2 || "");
        setAnswer3(parsed.ans3 || "");
        setAnswer4(parsed.ans4 || "");
      } catch (e) {
        setAnswer1(""); setAnswer2(""); setAnswer3(""); setAnswer4("");
      }
      setReviewSaveStatus("saved");
    } else {
      setAnswer1(""); setAnswer2(""); setAnswer3(""); setAnswer4("");
      setReviewSaveStatus("saved");
    }
  }, [activeReview]);

  // Set default period on type change
  useEffect(() => {
    setReviewPeriod(reviewType === "weekly" ? weeks[0].value : months[0].value);
  }, [reviewType, weeks, months]);

  // Debounced auto-save journal
  useEffect(() => {
    if (loading) return;
    const isNew = !activeEntry;
    const moodChanged = isNew ? mood !== 3 : mood !== activeEntry.mood;
    const notesChanged = isNew ? moodNotes !== "" : moodNotes !== (activeEntry.mood_notes || "");
    const gratitudeChanged = isNew
      ? gratitude.some(g => g !== "")
      : JSON.stringify(gratitude) !== JSON.stringify(activeEntry.gratitude);
    const lifeObj = { health, work, relationships, learning };
    const lifeChanged = isNew
      ? health !== 5 || work !== 5 || relationships !== 5 || learning !== 5
      : JSON.stringify(lifeObj) !== JSON.stringify(JSON.parse(activeEntry.life_areas || "{}"));

    if (!(moodChanged || notesChanged || gratitudeChanged || lifeChanged)) {
      return;
    }

    setSaveStatus("unsaved");
    const timer = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        await saveActiveEntry({
          date: selectedDate, mood, mood_notes: moodNotes || null, gratitude, life_areas: JSON.stringify(lifeObj)
        });
        setSaveStatus("saved");
      } catch (err) {
        console.error(err);
        setSaveStatus("unsaved");
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [mood, moodNotes, gratitude, health, work, relationships, learning, activeEntry, selectedDate, saveActiveEntry, loading]);

  // Debounced auto-save review
  useEffect(() => {
    if (!reviewPeriod) return;
    const isNew = !activeReview;
    const answersObj = { ans1: answer1, ans2: answer2, ans3: answer3, ans4: answer4 };
    const ansChanged = isNew
      ? answer1 !== "" || answer2 !== "" || answer3 !== "" || answer4 !== ""
      : JSON.stringify(answersObj) !== activeReview.responses;

    if (!ansChanged) return;

    setReviewSaveStatus("unsaved");
    const timer = setTimeout(async () => {
      setReviewSaveStatus("saving");
      try {
        await saveActiveReview({ period: reviewPeriod, type: reviewType, responses: JSON.stringify(answersObj) });
        setReviewSaveStatus("saved");
      } catch (err) {
        console.error(err);
        setReviewSaveStatus("unsaved");
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [answer1, answer2, answer3, answer4, activeReview, reviewPeriod, reviewType, saveActiveReview]);

  const saveImmediately = async () => {
    if (saveStatus !== "unsaved") return;
    setSaveStatus("saving");
    try {
      const lifeObj = { health, work, relationships, learning };
      await saveActiveEntry({
        date: selectedDate, mood, mood_notes: moodNotes || null, gratitude, life_areas: JSON.stringify(lifeObj)
      });
      setSaveStatus("saved");
    } catch (err) {
      console.error(err);
      setSaveStatus("unsaved");
    }
  };

  const handleDateChange = async (daysDiff: number) => {
    await saveImmediately();
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + daysDiff);
    setSelectedDate(current.toISOString().split("T")[0]);
  };

  const handleOpenDailyNote = async () => {
    const { notes, createNote, setActiveNote, loadNotes } = useNotesStore.getState();
    await loadNotes();
    let target = notes.find(n => n.title === selectedDate);
    if (!target) {
      target = await createNote(selectedDate, `# Daily Note: ${selectedDate}\n\nLinked Reflection Journal details are automatically stored. Start journaling here!`);
    }
    await setActiveNote(target);
    useLayoutStore.getState().addTab("Notes", "notes");
  };

  const moodEmojis = [
    { emoji: "😞", label: "Awful", value: 1, color: "hover:bg-rose-500/20 active:bg-rose-500/40 text-rose-500" },
    { emoji: "😐", label: "Bad", value: 2, color: "hover:bg-amber-600/20 active:bg-amber-600/40 text-amber-500" },
    { emoji: "🙂", label: "Neutral", value: 3, color: "hover:bg-zinc-800/80 active:bg-zinc-800 text-zinc-400" },
    { emoji: "😀", label: "Good", value: 4, color: "hover:bg-emerald-600/20 active:bg-emerald-600/40 text-emerald-500" },
    { emoji: "🤩", label: "Awesome", value: 5, color: "hover:bg-emerald-400/20 active:bg-emerald-400/40 text-emerald-400" }
  ];

  const lifeAreaStats = [
    { name: "Health", val: health, set: setHealth, color: "accent-rose-500" },
    { name: "Relationships", val: relationships, set: setRelationships, color: "accent-amber-500" },
    { name: "Work / Productivity", val: work, set: setWork, color: "accent-sky-500" },
    { name: "Learning / Growth", val: learning, set: setLearning, color: "accent-emerald-500" }
  ];

  return (
    <div className="flex-1 flex flex-col p-6 overflow-hidden h-full">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-amber-500" />
            Reflection Journal
          </h1>
          <p className="text-sm text-zinc-400">Track emotional trends, gratitude, and periodical reviews.</p>
        </div>

        <div className="flex bg-zinc-950 border border-zinc-800 rounded-xl p-0.5 self-start">
          {["daily", "reviews", "analytics"].map((tab) => (
            <button
              key={tab}
              onClick={async () => { await saveImmediately(); setActiveTab(tab as any); }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                activeTab === tab ? "bg-zinc-800 text-zinc-100 shadow-sm" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 pr-1">
        {activeTab === "daily" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Panel: Inputs */}
            <div className="lg:col-span-2 space-y-5 bg-zinc-900/10 border border-zinc-850 rounded-2xl p-5 relative">
              <div className="flex justify-between items-center border-b border-zinc-850/60 pb-3.5">
                <div className="flex items-center gap-2">
                  <button onClick={() => handleDateChange(-1)} className="p-1 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm font-bold text-zinc-200">{selectedDate}</span>
                  <button onClick={() => handleDateChange(1)} className="p-1 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    saveStatus === "saved" ? "bg-emerald-500" : saveStatus === "saving" ? "bg-amber-500 animate-pulse" : "bg-rose-500"
                  }`} />
                  <span className="capitalize">{saveStatus === "saving" ? "Saving..." : saveStatus}</span>
                </div>
              </div>

              {/* Mood Check */}
              <div className="space-y-2">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Smile className="w-3.5 h-3.5 text-amber-500" /> How are you feeling today?
                </span>
                <div className="grid grid-cols-5 gap-2 bg-zinc-950/60 p-2.5 rounded-xl border border-zinc-850/40">
                  {moodEmojis.map((e) => {
                    const isSelected = mood === e.value;
                    return (
                      <button
                        key={e.value}
                        type="button"
                        onClick={() => setMood(e.value)}
                        className={`py-2 px-1 rounded-lg flex flex-col items-center gap-1 transition-all hover:scale-105 cursor-pointer ${
                          isSelected ? "bg-zinc-800 border border-zinc-700 text-zinc-100 shadow-sm" : "border border-transparent text-zinc-500"
                        } ${e.color}`}
                      >
                        <span className="text-xl">{e.emoji}</span>
                        <span className="text-[9px] font-bold tracking-tight">{e.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Gratitude Log */}
              <div className="space-y-2">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 text-rose-500" /> Gratitude Log (3 things)
                </span>
                <div className="space-y-2">
                  {[0, 1, 2].map((idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs font-bold text-amber-500/80 w-4">{idx + 1}.</span>
                      <input
                        type="text"
                        value={gratitude[idx] || ""}
                        onChange={(e) => {
                          const updated = [...gratitude];
                          updated[idx] = e.target.value;
                          setGratitude(updated);
                        }}
                        placeholder="I am grateful for..."
                        className="bg-zinc-950 border border-zinc-850 rounded-xl p-3 text-xs w-full text-zinc-300 placeholder-zinc-750 focus:outline-hidden focus:border-zinc-750"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Mood Notes */}
              <div className="space-y-2">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <PenTool className="w-3.5 h-3.5 text-sky-500" /> Journal / Thoughts
                </span>
                <textarea
                  value={moodNotes}
                  onChange={(e) => setMoodNotes(e.target.value)}
                  placeholder="Record highlights, lessons, blocks, or reflections..."
                  className="w-full bg-zinc-950 border border-zinc-850 rounded-xl p-3.5 text-xs text-zinc-300 placeholder-zinc-750 min-h-[100px] focus:outline-hidden focus:border-zinc-750 font-mono"
                />
              </div>
            </div>

            {/* Right Panel: Sliders & Actions */}
            <div className="space-y-5">
              {/* Life Areas Slider Card */}
              <div className="bg-zinc-900/10 border border-zinc-850 rounded-2xl p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-zinc-300 flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-emerald-500" /> Life Areas Rating (1-10)
                  </h3>
                  <p className="text-[10px] text-zinc-500">Rate your fulfillment in key areas today.</p>
                </div>

                <div className="space-y-4">
                  {lifeAreaStats.map((area) => (
                    <div key={area.name} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold text-zinc-400">
                        <span>{area.name}</span>
                        <span className="text-zinc-200">{area.val}</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={area.val}
                        onChange={(e) => area.set(parseInt(e.target.value))}
                        className={`w-full h-1 bg-zinc-950 rounded-lg cursor-pointer ${area.color}`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Daily Wiki Note Link Card */}
              <div className="bg-zinc-900/10 border border-zinc-850 rounded-2xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-zinc-300 flex items-center gap-1.5">
                  <ExternalLink className="w-4 h-4 text-amber-500" /> Daily Wiki Page
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Open the structured Markdown page for this date to record lengthy summaries, transclusions, or link tasks.
                </p>
                <button
                  type="button"
                  onClick={handleOpenDailyNote}
                  className="w-full bg-zinc-950 border border-zinc-850 hover:border-zinc-750 text-zinc-300 text-xs font-bold py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  Open Daily Note <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "reviews" && (
          <div className="bg-zinc-900/10 border border-zinc-850 rounded-2xl p-5 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-850 pb-4">
              <div className="flex items-center gap-3">
                {/* Period Picker */}
                <select
                  value={reviewPeriod}
                  onChange={(e) => setReviewPeriod(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 text-xs font-bold text-zinc-300 rounded-xl px-3 py-2 outline-hidden focus:border-zinc-700"
                >
                  {(reviewType === "weekly" ? weeks : months).map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>

                <div className="flex bg-zinc-950 border border-zinc-800 rounded-lg p-0.5">
                  <button
                    onClick={() => setReviewType("weekly")}
                    className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all cursor-pointer ${
                      reviewType === "weekly" ? "bg-zinc-800 text-zinc-150" : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    Weekly
                  </button>
                  <button
                    onClick={() => setReviewType("monthly")}
                    className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all cursor-pointer ${
                      reviewType === "monthly" ? "bg-zinc-800 text-zinc-150" : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    Monthly
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                <span className={`w-1.5 h-1.5 rounded-full ${
                  reviewSaveStatus === "saved" ? "bg-emerald-500" : reviewSaveStatus === "saving" ? "bg-amber-500 animate-pulse" : "bg-rose-500"
                }`} />
                <span className="capitalize">{reviewSaveStatus === "saving" ? "Saving..." : reviewSaveStatus}</span>
              </div>
            </div>

            {/* Prompt questions */}
            <div className="space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  {reviewType === "weekly" ? "1. What were your biggest wins this week?" : "1. List major milestones and highlights from this month."}
                </span>
                <textarea
                  value={answer1}
                  onChange={(e) => setAnswer1(e.target.value)}
                  placeholder="Record accomplishments..."
                  className="w-full bg-zinc-950 border border-zinc-850 rounded-xl p-3.5 text-xs text-zinc-300 placeholder-zinc-750 min-h-[80px] focus:outline-hidden focus:border-zinc-750 font-mono"
                />
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
                  {reviewType === "weekly" ? "2. What obstacles did you face, and how did you overcome them?" : "2. Which goals were hit or missed, and what is the takeaway?"}
                </span>
                <textarea
                  value={answer2}
                  onChange={(e) => setAnswer2(e.target.value)}
                  placeholder="Record lessons and strategies..."
                  className="w-full bg-zinc-950 border border-zinc-850 rounded-xl p-3.5 text-xs text-zinc-300 placeholder-zinc-750 min-h-[80px] focus:outline-hidden focus:border-zinc-750 font-mono"
                />
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-emerald-500" />
                  {reviewType === "weekly" ? "3. What habits or routines were most consistent?" : "3. How did you manage time (tracked vs. planned) and focus?"}
                </span>
                <textarea
                  value={answer3}
                  onChange={(e) => setAnswer3(e.target.value)}
                  placeholder="Analyze consistency and statistics..."
                  className="w-full bg-zinc-950 border border-zinc-850 rounded-xl p-3.5 text-xs text-zinc-300 placeholder-zinc-750 min-h-[80px] focus:outline-hidden focus:border-zinc-750 font-mono"
                />
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-rose-500" />
                  {reviewType === "weekly" ? "4. What are your top priorities for next week?" : "4. What is your main strategy for the next month?"}
                </span>
                <textarea
                  value={answer4}
                  onChange={(e) => setAnswer4(e.target.value)}
                  placeholder="Define next steps and goals..."
                  className="w-full bg-zinc-950 border border-zinc-850 rounded-xl p-3.5 text-xs text-zinc-300 placeholder-zinc-750 min-h-[80px] focus:outline-hidden focus:border-zinc-750 font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === "analytics" && (
          <div className="space-y-6">
            <MoodGrid entries={entries} onSelectDate={(date) => { setSelectedDate(date); setActiveTab("daily"); }} />
            <GratitudeWall entries={entries} />
          </div>
        )}
      </div>

      {loading && (
        <div className="absolute inset-0 bg-zinc-950/20 backdrop-blur-xs flex items-center justify-center pointer-events-none">
          <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
        </div>
      )}
    </div>
  );
};

export default JournalView;
