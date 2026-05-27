import React, { useEffect, useState } from "react";
import { usePlannerStore } from "../state/plannerStore";
import { useTasksStore } from "../../tasks/state/tasksStore";
import { BlockType } from "../types";
import { 
  Calendar as CalendarIcon, Plus, 
  Trash2, BookOpen, CheckSquare, Sparkles, AlertCircle
} from "lucide-react";

export const PlannerView: React.FC = () => {
  const {
    timeBlocks,
    reflections,
    loading,
    error,
    loadTimeBlocks,
    createTimeBlock,
    deleteTimeBlock,
    loadReflections,
    saveReflection,
  } = usePlannerStore();

  const { tasks, loadTasks } = useTasksStore();

  // Date selection
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0]; // YYYY-MM-DD
  });

  // Time block creation states
  const [blockTitle, setBlockTitle] = useState("");
  const [startTimeStr, setStartTimeStr] = useState("09:00");
  const [endTimeStr, setEndTimeStr] = useState("10:00");
  const [blockType, setBlockType] = useState<BlockType>("work");
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");

  // Reflection text states
  const [morningIntention, setMorningIntention] = useState("");
  const [eveningReflection, setEveningReflection] = useState("");

  useEffect(() => {
    loadTimeBlocks();
    loadTasks();
  }, []);

  useEffect(() => {
    loadReflections(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    // Populate reflection inputs when loaded
    const morning = reflections.find((r) => r.prompt_id === "morning_intention");
    const evening = reflections.find((r) => r.prompt_id === "evening_reflection");
    setMorningIntention(morning ? morning.response : "");
    setEveningReflection(evening ? evening.response : "");
  }, [reflections]);

  const handleCreateBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockTitle.trim()) return;

    // Convert time strings (HH:MM) to unix timestamps relative to selectedDate
    const dateObj = new Date(selectedDate);
    const startHour = parseInt(startTimeStr.split(":")[0]);
    const startMin = parseInt(startTimeStr.split(":")[1]);
    const endHour = parseInt(endTimeStr.split(":")[0]);
    const endMin = parseInt(endTimeStr.split(":")[1]);

    const startTimestamp = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), startHour, startMin).getTime();
    const endTimestamp = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), endHour, endMin).getTime();

    await createTimeBlock(
      blockTitle,
      startTimestamp,
      endTimestamp,
      blockType,
      selectedTaskId || null
    );

    setBlockTitle("");
    setSelectedTaskId("");
  };

  const handleSaveReflection = async (promptId: string, response: string) => {
    await saveReflection(selectedDate, promptId, response);
  };

  // Helper to format timestamp into readable HH:MM AM/PM
  const formatTime = (ts: number) => {
    const d = new Date(ts);
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 should be 12
    return `${hours}:${minutes} ${ampm}`;
  };

  // Filter blocks for the selected date
  const filteredBlocks = timeBlocks.filter((block) => {
    const blockDate = new Date(block.start_time).toISOString().split("T")[0];
    return blockDate === selectedDate;
  });

  return (
    <div className="flex-1 flex flex-col p-6 overflow-hidden h-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-zinc-400" />
            Daily Planner
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">Time-block your day and track your focus intent.</p>
        </div>

        {/* Date Selector */}
        <input
          type="date"
          className="bg-zinc-900 border border-zinc-850 rounded-lg px-3 py-1.5 text-xs text-zinc-300 focus:outline-hidden cursor-pointer"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3.5 py-2.5 rounded-xl mb-4 flex items-center gap-2 shrink-0">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Workspace Split Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden min-h-0">
        {/* Left Agenda Column */}
        <div className="lg:col-span-2 flex flex-col min-h-0 bg-zinc-900/10 border border-zinc-850/40 rounded-2xl p-4">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Agenda & Time Blocks</h2>

          {/* Time blocks list */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-4">
            {loading && timeBlocks.length === 0 ? (
              <div className="text-center py-8 text-xs text-zinc-500">Loading planner data...</div>
            ) : filteredBlocks.length === 0 ? (
              <div className="border border-dashed border-zinc-850 rounded-2xl p-8 text-center text-xs text-zinc-550 flex flex-col items-center justify-center h-48">
                <span>No time blocks scheduled for this date.</span>
                <span>Use the form below to plan your day.</span>
              </div>
            ) : (
              filteredBlocks.map((block) => {
                // Find associated task if any
                const linkedTask = tasks.find((t) => t.id === block.task_id);
                return (
                  <div
                    key={block.id}
                    className="flex gap-4 p-3 bg-zinc-900/20 border border-zinc-850 rounded-xl items-center hover:border-zinc-800 transition-colors group"
                  >
                    <div className="w-24 text-[10px] font-mono text-zinc-500 shrink-0 flex flex-col">
                      <span>{formatTime(block.start_time)}</span>
                      <span className="text-[9px] text-zinc-650 mt-0.5">to {formatTime(block.end_time)}</span>
                    </div>

                    <div className={`h-8 w-1 rounded-full shrink-0 ${
                      block.block_type === "work" 
                        ? "bg-blue-500/80" 
                        : block.block_type === "break" 
                        ? "bg-zinc-700" 
                        : "bg-emerald-500/80"
                    }`}></div>

                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-zinc-200 truncate">{block.title}</div>
                      {linkedTask && (
                        <div className="text-[10px] text-zinc-500 flex items-center gap-1 mt-1 truncate">
                          <CheckSquare className="w-3 h-3 text-zinc-600" />
                          <span>Linked task: {linkedTask.title}</span>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => deleteTimeBlock(block.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/10 hover:text-red-400 text-zinc-600 rounded-lg transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Add Form */}
          <form onSubmit={handleCreateBlock} className="bg-zinc-950 border border-zinc-850 rounded-xl p-3 shrink-0 flex flex-col gap-2.5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <input
                type="text"
                className="bg-zinc-900 border border-zinc-850 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-650 focus:outline-hidden focus:border-zinc-750"
                placeholder="Block title (e.g. Code Review)"
                value={blockTitle}
                onChange={(e) => setBlockTitle(e.target.value)}
              />

              <select
                className="bg-zinc-900 border border-zinc-850 rounded-lg px-2.5 py-1.5 text-xs text-zinc-400 focus:outline-hidden cursor-pointer"
                value={selectedTaskId}
                onChange={(e) => setSelectedTaskId(e.target.value)}
              >
                <option value="">-- Link a Task (Optional) --</option>
                {tasks.filter(t => t.status !== "done").map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-zinc-600 font-semibold uppercase">Start:</span>
                  <input
                    type="time"
                    className="bg-zinc-900 border border-zinc-850 rounded-lg px-1.5 py-0.5 text-xs text-zinc-300 focus:outline-hidden cursor-pointer"
                    value={startTimeStr}
                    onChange={(e) => setStartTimeStr(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-zinc-600 font-semibold uppercase">End:</span>
                  <input
                    type="time"
                    className="bg-zinc-900 border border-zinc-850 rounded-lg px-1.5 py-0.5 text-xs text-zinc-300 focus:outline-hidden cursor-pointer"
                    value={endTimeStr}
                    onChange={(e) => setEndTimeStr(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-zinc-600 font-semibold uppercase">Type:</span>
                  <select
                    className="bg-zinc-900 border border-zinc-850 rounded-lg px-1.5 py-0.5 text-xs text-zinc-400 focus:outline-hidden cursor-pointer"
                    value={blockType}
                    onChange={(e) => setBlockType(e.target.value as BlockType)}
                  >
                    <option value="work">Work Block</option>
                    <option value="routine">Routine</option>
                    <option value="break">Break</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-bold px-3 py-1 rounded-lg text-xs flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Block
              </button>
            </div>
          </form>
        </div>

        {/* Right Review Column */}
        <div className="space-y-4 flex flex-col min-h-0">
          {/* Morning Intentions */}
          <div className="bg-zinc-900/10 border border-zinc-850/40 rounded-2xl p-4 flex flex-col">
            <div className="flex items-center gap-2 border-b border-zinc-850/50 pb-2 mb-3">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-semibold text-zinc-300">Morning Intention</h3>
            </div>
            <textarea
              className="w-full bg-zinc-950 border border-zinc-850 rounded-xl p-3 text-xs text-zinc-300 placeholder-zinc-700 min-h-[90px] focus:outline-hidden focus:border-zinc-750"
              placeholder="What would make today a success? Define your core objective..."
              value={morningIntention}
              onChange={(e) => setMorningIntention(e.target.value)}
              onBlur={() => handleSaveReflection("morning_intention", morningIntention)}
            ></textarea>
            <span className="text-[9px] text-zinc-600 mt-1.5 self-end">Saves automatically on blur</span>
          </div>

          {/* Evening Reflections */}
          <div className="bg-zinc-900/10 border border-zinc-850/40 rounded-2xl p-4 flex flex-col flex-1">
            <div className="flex items-center gap-2 border-b border-zinc-850/50 pb-2 mb-3">
              <BookOpen className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-semibold text-zinc-300">Evening Reflection</h3>
            </div>
            <textarea
              className="w-full flex-1 bg-zinc-950 border border-zinc-850 rounded-xl p-3 text-xs text-zinc-300 placeholder-zinc-700 min-h-[120px] focus:outline-hidden focus:border-zinc-750"
              placeholder="What went well today? What were the learning moments or key struggles?"
              value={eveningReflection}
              onChange={(e) => setEveningReflection(e.target.value)}
              onBlur={() => handleSaveReflection("evening_reflection", eveningReflection)}
            ></textarea>
            <span className="text-[9px] text-zinc-600 mt-1.5 self-end">Saves automatically on blur</span>
          </div>
        </div>
      </div>
    </div>
  );
};
export default PlannerView;
