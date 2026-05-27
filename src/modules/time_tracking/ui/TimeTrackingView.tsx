import React, { useEffect, useState } from "react";
import { useTimeTrackingStore } from "../state/timeTrackingStore";
import { useTasksStore } from "../../tasks/state/tasksStore";
import { 
  Clock, Play, Pause, RotateCcw, Plus, Trash2, 
  CheckSquare, Award, AlertCircle, History
} from "lucide-react";

export const TimeTrackingView: React.FC = () => {
  const {
    logs,
    secondsElapsed,
    isActive,
    linkedTaskId,
    description,
    category,
    loading,
    error,
    loadLogs,
    logTime,
    startTimer,
    pauseTimer,
    resetTimer,
    tick,
    deleteLog,
    setLinkedTaskId,
    setDescription,
    setCategory
  } = useTimeTrackingStore();

  const { tasks, loadTasks } = useTasksStore();

  // Manual entry states
  const [manualMinutes, setManualMinutes] = useState("");
  const [manualDesc, setManualDesc] = useState("");
  const [manualCat, setManualCat] = useState("Coding");
  const [manualTaskId, setManualTaskId] = useState("");

  useEffect(() => {
    loadLogs();
    loadTasks();
  }, []);

  // Tick active stopwatch
  useEffect(() => {
    let interval: any = null;
    if (isActive) {
      interval = setInterval(() => {
        tick();
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive]);

  const handleStopAndLog = async () => {
    if (secondsElapsed > 0) {
      pauseTimer();
      await logTime(
        linkedTaskId,
        secondsElapsed,
        description.trim() || "Untitled Activity",
        category
      );
      resetTimer();
      setDescription("");
      setLinkedTaskId(null);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const durationMins = parseInt(manualMinutes);
    if (isNaN(durationMins) || durationMins <= 0 || !manualDesc.trim()) return;

    await logTime(
      manualTaskId || null,
      durationMins * 60,
      manualDesc,
      manualCat
    );

    setManualMinutes("");
    setManualDesc("");
    setManualTaskId("");
  };

  // Helper formatting seconds -> HH:MM:SS
  const formatStopwatch = (secs: number) => {
    const hours = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const remaining = secs % 60;
    return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${remaining.toString().padStart(2, "0")}`;
  };

  // Helper formatting logged duration
  const formatDuration = (secs: number) => {
    const hours = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const categories = ["Coding", "Meeting", "Design", "Research", "Break", "Admin"];

  // Calculate total hours tracked
  const totalSecondsTracked = logs.reduce((sum, log) => sum + log.duration, 0);

  return (
    <div className="flex-1 flex flex-col p-6 overflow-hidden h-full">
      {/* Header */}
      <div className="mb-6 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <Clock className="w-5 h-5 text-zinc-400" />
            Time Tracker
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">Track work hours on tasks and analyze productivity logs.</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-850 px-3.5 py-1.5 rounded-xl flex items-center gap-2 text-xs font-semibold text-zinc-300">
          <Award className="w-4 h-4 text-amber-500" />
          <span>Total Tracked: <span className="font-mono text-zinc-100">{formatDuration(totalSecondsTracked)}</span></span>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3.5 py-2.5 rounded-xl mb-4 flex items-center gap-2 shrink-0">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden min-h-0">
        
        {/* Left Agenda Column: Stopwatch and Manual Log */}
        <div className="lg:col-span-2 flex flex-col gap-4 min-h-0 overflow-y-auto">
          {/* Active Stopwatch Card */}
          <div className="bg-zinc-900/10 border border-zinc-850/40 rounded-2xl p-5 flex flex-col items-center justify-center relative">
            <span className="text-[10px] text-zinc-550 font-bold uppercase tracking-widest absolute top-4">Stopwatch Timer</span>

            <div className="flex flex-col items-center justify-center space-y-4 my-6">
              <span className="text-4xl font-mono font-bold text-zinc-100 tracking-wider">
                {formatStopwatch(secondsElapsed)}
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={resetTimer}
                  className="p-2 border border-zinc-850 hover:border-zinc-800 rounded-full bg-zinc-950 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  onClick={isActive ? pauseTimer : startTimer}
                  className="px-6 py-2 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-950 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                >
                  {isActive ? <Pause className="w-3.5 h-3.5 fill-zinc-950" /> : <Play className="w-3.5 h-3.5 fill-zinc-950" />}
                  <span>{isActive ? "Pause" : "Start"}</span>
                </button>
                {secondsElapsed > 0 && (
                  <button
                    onClick={handleStopAndLog}
                    className="px-6 py-2 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-xs font-bold transition-all cursor-pointer"
                  >
                    Log Time
                  </button>
                )}
              </div>
            </div>

            {/* Stopwatch Config Fields */}
            <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] text-zinc-550 font-bold uppercase">Activity description</label>
                <input
                  type="text"
                  className="bg-zinc-950 border border-zinc-850 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-700 focus:outline-hidden"
                  placeholder="What are you working on?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] text-zinc-550 font-bold uppercase">Category</label>
                <select
                  className="bg-zinc-950 border border-zinc-850 rounded-lg px-2.5 py-1.5 text-xs text-zinc-400 focus:outline-hidden cursor-pointer"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] text-zinc-550 font-bold uppercase">Link task</label>
                <select
                  className="bg-zinc-950 border border-zinc-850 rounded-lg px-2.5 py-1.5 text-xs text-zinc-400 focus:outline-hidden cursor-pointer"
                  value={linkedTaskId || ""}
                  onChange={(e) => setLinkedTaskId(e.target.value || null)}
                >
                  <option value="">-- No Task Associated --</option>
                  {tasks.filter(t => t.status !== "done").map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Manual Entry Log Form */}
          <form onSubmit={handleManualSubmit} className="bg-zinc-900/10 border border-zinc-850/40 rounded-2xl p-4 flex flex-col gap-3">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Manual Log past activity</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] text-zinc-550 font-bold uppercase">Duration (Minutes)</label>
                <input
                  type="number"
                  required
                  className="bg-zinc-950 border border-zinc-850 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-700 focus:outline-hidden"
                  placeholder="e.g. 45"
                  value={manualMinutes}
                  onChange={(e) => setManualMinutes(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] text-zinc-550 font-bold uppercase">Category</label>
                <select
                  className="bg-zinc-950 border border-zinc-850 rounded-lg px-2.5 py-1.5 text-xs text-zinc-400 focus:outline-hidden cursor-pointer"
                  value={manualCat}
                  onChange={(e) => setManualCat(e.target.value)}
                >
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div className="md:col-span-2 flex flex-col gap-1">
                <label className="text-[9px] text-zinc-550 font-bold uppercase">Description</label>
                <input
                  type="text"
                  required
                  className="bg-zinc-950 border border-zinc-850 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-700 focus:outline-hidden"
                  placeholder="Summary of what was completed..."
                  value={manualDesc}
                  onChange={(e) => setManualDesc(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[9px] text-zinc-550 font-bold uppercase">Link task</label>
                <select
                  className="bg-zinc-950 border border-zinc-850 rounded-lg px-2.5 py-1.5 text-xs text-zinc-400 focus:outline-hidden cursor-pointer"
                  value={manualTaskId}
                  onChange={(e) => setManualTaskId(e.target.value)}
                >
                  <option value="">-- No Task Associated --</option>
                  {tasks.filter(t => t.status !== "done").map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-bold px-4 py-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors self-end cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Log Activity
            </button>
          </form>
        </div>

        {/* Right Column: Time Log history */}
        <div className="bg-zinc-900/10 border border-zinc-850/40 rounded-2xl p-4 flex flex-col min-h-0">
          <div className="flex items-center gap-2 border-b border-zinc-850/50 pb-2 mb-3 shrink-0">
            <History className="w-4 h-4 text-zinc-500" />
            <h3 className="text-xs font-semibold text-zinc-300">Logged History</h3>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
            {loading && logs.length === 0 ? (
              <div className="text-center py-6 text-xs text-zinc-500">Querying SQLite...</div>
            ) : logs.length === 0 ? (
              <div className="border border-dashed border-zinc-850 rounded-xl py-8 text-center text-xs text-zinc-650">
                No time logs recorded.
              </div>
            ) : (
              logs.map((log) => {
                const linkedTask = tasks.find((t) => t.id === log.task_id);
                return (
                  <div key={log.id} className="p-3 bg-zinc-900/20 border border-zinc-850 rounded-xl flex items-center justify-between text-xs transition-colors group">
                    <div className="min-w-0 flex-1 mr-3">
                      <div className="font-semibold text-zinc-350 truncate">{log.description}</div>
                      <div className="flex items-center gap-2.5 mt-1 text-[9px] text-zinc-550">
                        <span className="bg-zinc-950 px-1.5 py-0.2 rounded-sm uppercase tracking-wider text-zinc-600 font-bold border border-zinc-850">{log.category}</span>
                        {linkedTask && (
                          <span className="flex items-center gap-0.5 truncate max-w-[120px]">
                            <CheckSquare className="w-2.5 h-2.5 text-zinc-700" />
                            <span className="truncate">{linkedTask.title}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono text-zinc-400 font-semibold">{formatDuration(log.duration)}</span>
                      <button
                        onClick={() => deleteLog(log.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/10 hover:text-red-400 text-zinc-650 rounded-md transition-all cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default TimeTrackingView;
