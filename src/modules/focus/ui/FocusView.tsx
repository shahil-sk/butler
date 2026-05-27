import React, { useEffect } from "react";
import { useFocusStore } from "../state/focusStore";
import { useTasksStore } from "../../tasks/state/tasksStore";
import { 
  Clock, Play, Pause, RotateCcw, CheckSquare, 
  Sparkles, Coffee, AlertCircle, History
} from "lucide-react";

export const FocusView: React.FC = () => {
  const {
    sessions,
    secondsRemaining,
    isActive,
    sessionType,
    timerState,
    linkedTaskId,
    loading,
    error,
    loadSessions,
    logSession,
    setSessionType,
    setLinkedTaskId,
    startTimer,
    pauseTimer,
    resetTimer,
    tick
  } = useFocusStore();

  const { tasks, loadTasks } = useTasksStore();

  // Tick the timer
  useEffect(() => {
    let interval: any = null;
    if (isActive) {
      interval = setInterval(() => {
        tick();
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive]);

  useEffect(() => {
    loadSessions();
    loadTasks();
  }, []);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${remaining.toString().padStart(2, "0")}`;
  };

  const handleStopDeepWork = async () => {
    if (sessionType === "deep_work" && secondsRemaining > 0) {
      pauseTimer();
      await logSession(linkedTaskId, secondsRemaining, "deep_work");
      resetTimer();
    }
  };

  // Helper to format Completed At timestamps
  const formatTimestamp = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Helper to format session duration
  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    if (mins === 0) return `${secs}s`;
    return `${mins}m`;
  };

  return (
    <div className="flex-1 flex flex-col p-6 overflow-hidden h-full">
      {/* Header */}
      <div className="mb-6 shrink-0">
        <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
          <Clock className="w-5 h-5 text-zinc-400" />
          Focus & Pomodoro
        </h1>
        <p className="text-xs text-zinc-400 mt-0.5">Protect deep work sessions and track focus intervals.</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3.5 py-2.5 rounded-xl mb-4 flex items-center gap-2 shrink-0">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Container */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden min-h-0">
        
        {/* Left Columns - Timer View */}
        <div className="lg:col-span-2 flex flex-col items-center justify-center bg-zinc-900/10 border border-zinc-850/40 rounded-2xl p-6 min-h-0 relative">
          
          {/* Mode switch */}
          <div className="absolute top-4 bg-zinc-950 border border-zinc-850 p-1 rounded-lg flex items-center text-xs shrink-0 z-10">
            <button
              onClick={() => setSessionType("pomodoro")}
              disabled={isActive}
              className={`px-3 py-1 rounded-md transition-colors ${
                isActive ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
              } ${
                sessionType === "pomodoro" ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Pomodoro
            </button>
            <button
              onClick={() => setSessionType("deep_work")}
              disabled={isActive}
              className={`px-3 py-1 rounded-md transition-colors ${
                isActive ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
              } ${
                sessionType === "deep_work" ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Deep Work
            </button>
          </div>

          {/* Active Timer Ring Display */}
          <div className="flex flex-col items-center justify-center space-y-6 mt-8">
            <div className={`w-56 h-56 border-[3.5px] rounded-full flex flex-col items-center justify-center bg-zinc-950/20 shadow-2xl relative transition-colors duration-500 ${
              timerState === "work" 
                ? "border-amber-500/60" 
                : timerState === "break" 
                ? "border-emerald-500/60" 
                : "border-zinc-850"
            }`}>
              {/* Pulsing indicator */}
              {isActive && (
                <div className={`absolute inset-0 rounded-full animate-ping opacity-5 ${
                  timerState === "work" ? "bg-amber-500" : "bg-emerald-500"
                }`}></div>
              )}

              <span className="text-4xl font-mono font-bold text-zinc-100 tracking-wider">
                {formatTime(secondsRemaining)}
              </span>

              <span className="text-[10px] text-zinc-500 font-bold tracking-widest mt-2 uppercase flex items-center gap-1">
                {timerState === "work" ? (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Focus Block
                  </>
                ) : timerState === "break" ? (
                  <>
                    <Coffee className="w-3.5 h-3.5 text-emerald-400" /> Break Interval
                  </>
                ) : (
                  "Ready"
                )}
              </span>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
              <button
                onClick={resetTimer}
                className="p-2.5 border border-zinc-850 hover:border-zinc-800 rounded-full bg-zinc-950 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              {sessionType === "deep_work" && isActive ? (
                <button
                  onClick={handleStopDeepWork}
                  className="px-6 py-2.5 rounded-full bg-red-650 hover:bg-red-700 text-white text-xs font-bold transition-all cursor-pointer"
                >
                  Log & Stop
                </button>
              ) : (
                <button
                  onClick={isActive ? pauseTimer : startTimer}
                  className="px-8 py-2.5 rounded-full bg-zinc-150 hover:bg-zinc-200 text-zinc-950 text-xs font-bold flex items-center gap-1.5 transition-all transform hover:scale-[1.02] cursor-pointer"
                >
                  {isActive ? <Pause className="w-3.5 h-3.5 fill-zinc-950" /> : <Play className="w-3.5 h-3.5 fill-zinc-950" />}
                  <span>{isActive ? "Pause" : "Start Focus"}</span>
                </button>
              )}
            </div>

            {/* Task Linker */}
            <div className="w-64 flex flex-col gap-1.5">
              <label className="text-[9px] text-zinc-650 font-bold uppercase tracking-wider text-center">Focus Task association</label>
              <select
                disabled={isActive}
                className="bg-zinc-950 border border-zinc-850 rounded-lg px-2.5 py-1.5 text-xs text-zinc-400 focus:outline-hidden text-center cursor-pointer disabled:opacity-50"
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

        {/* Right Column - Focus History log */}
        <div className="bg-zinc-900/10 border border-zinc-850/40 rounded-2xl p-4 flex flex-col min-h-0">
          <div className="flex items-center gap-2 border-b border-zinc-850/50 pb-2 mb-3 shrink-0">
            <History className="w-4 h-4 text-zinc-500" />
            <h3 className="text-xs font-semibold text-zinc-300">Completed Sessions</h3>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
            {loading && sessions.length === 0 ? (
              <div className="text-center py-6 text-xs text-zinc-500">Querying database...</div>
            ) : sessions.length === 0 ? (
              <div className="border border-dashed border-zinc-850 rounded-xl py-8 text-center text-xs text-zinc-600">
                No focus blocks logged yet.
              </div>
            ) : (
              sessions.map((sess) => {
                const linkedTask = tasks.find((t) => t.id === sess.task_id);
                return (
                  <div key={sess.id} className="p-3 bg-zinc-900/20 border border-zinc-850 rounded-xl flex items-center justify-between text-xs transition-colors">
                    <div>
                      <div className="font-semibold text-zinc-300 flex items-center gap-1.5 uppercase text-[9px] tracking-wide text-zinc-450">
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          sess.session_type === "pomodoro" ? "bg-amber-500" : "bg-blue-500"
                        }`}></span>
                        {sess.session_type} • {formatDuration(sess.duration)}
                      </div>
                      
                      {linkedTask ? (
                        <div className="text-[10px] text-zinc-500 flex items-center gap-1 mt-1 truncate max-w-[160px]">
                          <CheckSquare className="w-3 h-3 text-zinc-650 shrink-0" />
                          <span className="truncate">{linkedTask.title}</span>
                        </div>
                      ) : (
                        <div className="text-[9px] text-zinc-600 mt-1 italic">Standalone focus block</div>
                      )}
                    </div>
                    
                    <span className="text-[9px] font-mono text-zinc-550 shrink-0">
                      {formatTimestamp(sess.completed_at)}
                    </span>
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
export default FocusView;
