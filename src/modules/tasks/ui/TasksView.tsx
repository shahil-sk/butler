import React, { useEffect, useState } from "react";
import { useTasksStore } from "../state/tasksStore";
import { TaskStatus, Task } from "../types";
import { TaskRow } from "./TaskRow";
import { TaskCreateForm } from "./TaskCreateForm";
import { generateCompletion } from "../../../core/services/aiService";
import { invoke } from "@tauri-apps/api/core";
import { 
  CheckSquare, Search, Tag, AlertCircle, Trash2, 
  Columns, List as ListIcon, ChevronRight, ChevronLeft, Filter, Sparkles
} from "lucide-react";

export const TasksView: React.FC = () => {
  const {
    tasks,
    loading,
    error,
    loadTasks,
    searchTasks,
    createTask,
    updateTaskStatus,
    deleteTask,
  } = useTasksStore();
  
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [searchVal, setSearchVal] = useState("");
  const [activePriorityFilter, setActivePriorityFilter] = useState<string>("all");
  const [generatingSubtasksId, setGeneratingSubtasksId] = useState<string | null>(null);

  useEffect(() => {
    void loadTasks();
  }, []);

  const handleSearch = (val: string) => {
    setSearchVal(val);
    void searchTasks(val);
  };

  const handleAIBreakdown = async (task: Task) => {
    setGeneratingSubtasksId(task.id);
    try {
      const p = await invoke<string>("get_setting", { key: "ai_provider" }).catch(() => "ollama");
      const k = await invoke<string>("get_setting", { key: "ai_api_key" }).catch(() => "");
      const m = await invoke<string>("get_setting", { key: "ai_model" }).catch(() => "llama3");

      const prompt = `Generate a checklist of 3-5 short, concrete subtasks to complete this task: "${task.title}". Return ONLY a plain text list where each item is on a new line starting with "- " and nothing else. No intro, no headers.`;
      const reply = await generateCompletion(prompt, "You are a task breakdown assistant.", {
        provider: p as any,
        apiKey: k,
        model: m,
      });

      const items = reply
        .split("\n")
        .map((line) => line.replace(/^-\s+/, "").trim())
        .filter((line) => line.length > 0 && !line.startsWith("#"));

      for (const item of items) {
        await createTask(item, task.priority, ["ai-subtask"], task.project_id || null, task.id);
      }
    } catch (err) {
      console.error("AI task breakdown failed:", err);
    } finally {
      setGeneratingSubtasksId(null);
    }
  };

  const rootTasks = filteredTasks().filter((t) => !t.parent_id);
  const getSubtasks = (parentId: string) => tasks.filter((t) => t.parent_id === parentId);

  function filteredTasks() {
    return tasks.filter((t) => {
      if (activePriorityFilter === "all") return true;
      return t.priority === activePriorityFilter;
    });
  }

  const getPriorityColor = (p: string) => {
    switch (p) {
      case "high": return "bg-red-500/10 text-red-400 border-red-500/20";
      case "medium": return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      default: return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    }
  };

  const statusColumns: { id: TaskStatus; label: string; color: string }[] = [
    { id: "todo", label: "Todo Inbox", color: "border-zinc-800" },
    { id: "in_progress", label: "In Progress", color: "border-blue-900/30" },
    { id: "done", label: "Completed", color: "border-emerald-900/30" },
  ];

  return (
    <div className="flex-1 flex flex-col p-6 overflow-hidden h-full text-zinc-150">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-zinc-400" />
            Task Workspace
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">Manage tasks in real-time with local SQLite storage.</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-zinc-900 border border-zinc-850 p-1 rounded-lg flex items-center">
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-md cursor-pointer ${
                viewMode === "list" ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-350"
              }`}
            >
              <ListIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("kanban")}
              className={`p-1.5 rounded-md cursor-pointer ${
                viewMode === "kanban" ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-355"
              }`}
            >
              <Columns className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Query / Filter Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 shrink-0">
        <div className="md:col-span-2 flex items-center bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2">
          <Search className="w-4 h-4 text-zinc-500 mr-2" />
          <input
            type="text"
            className="w-full bg-transparent border-0 outline-none text-xs text-zinc-200 placeholder-zinc-650 focus:ring-0"
            placeholder="Search tasks instantly via SQLite FTS5..."
            value={searchVal}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2">
          <Filter className="w-4 h-4 text-zinc-500 mr-2" />
          <select
            className="w-full bg-transparent border-0 outline-none text-xs text-zinc-400 focus:ring-0 cursor-pointer"
            value={activePriorityFilter}
            onChange={(e) => setActivePriorityFilter(e.target.value)}
          >
            <option value="all">All Priorities</option>
            <option value="high">High Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="low">Low Priority</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3.5 py-2.5 rounded-xl mb-4 flex items-center gap-2 shrink-0">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Dynamic Content Frame */}
      <div className="flex-1 overflow-hidden min-h-0 flex gap-4">
        <div className="flex-1 flex flex-col min-w-0">
          {loading && tasks.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-xs text-zinc-500">Querying database...</div>
          ) : filteredTasks().length === 0 ? (
            <div className="flex-1 border border-dashed border-zinc-850/60 rounded-2xl flex flex-col items-center justify-center text-center p-6">
              <span className="text-xs text-zinc-500">No matching tasks found. Create a new task below.</span>
            </div>
          ) : viewMode === "list" ? (
            <div className="flex-1 overflow-y-auto pr-1 space-y-2 min-h-0">
              {rootTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  subtasks={getSubtasks(task.id)}
                  onDelete={deleteTask}
                  onStatusChange={updateTaskStatus}
                  generatingId={generatingSubtasksId}
                  onAIBreakdown={handleAIBreakdown}
                  priorityColorHelper={getPriorityColor}
                />
              ))}
            </div>
          ) : (
            /* Kanban Layout */
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 min-h-0">
              {statusColumns.map((col) => {
                const colTasks = filteredTasks().filter((t) => t.status === col.id);
                return (
                  <div key={col.id} className="flex flex-col bg-zinc-900/15 border border-zinc-850/40 rounded-xl p-3 min-h-0">
                    <div className="flex items-center justify-between pb-2 mb-3 border-b border-zinc-850/50">
                      <span className="text-xs font-semibold text-zinc-400">{col.label}</span>
                      <span className="text-[10px] bg-zinc-900 text-zinc-500 px-2 py-0.5 rounded-full font-mono">{colTasks.length}</span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 min-h-0 pr-1">
                      {colTasks.map((task) => (
                        <div
                          key={task.id}
                          className="p-3 bg-zinc-900/40 border border-zinc-850 rounded-xl hover:border-zinc-700 transition-colors flex flex-col gap-2 group text-xs text-zinc-150"
                        >
                          <span className="font-medium text-zinc-200">{task.title}</span>

                          <div className="flex flex-wrap gap-1.5">
                            <span className={`text-[8px] uppercase font-bold px-1 py-0.2 rounded-sm border ${getPriorityColor(task.priority)}`}>
                              {task.priority}
                            </span>
                            {task.tags.map((t) => (
                              <span key={t} className="text-[8px] text-zinc-550 flex items-center gap-0.5">
                                <Tag className="w-2 h-2" />
                                {t}
                              </span>
                            ))}
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-zinc-900/50 mt-1">
                            <div className="flex items-center gap-1">
                              {col.id !== "todo" && (
                                <button
                                  onClick={() => updateTaskStatus(task.id, col.id === "done" ? "in_progress" : "todo")}
                                  className="p-1 hover:bg-zinc-850 rounded text-zinc-500 cursor-pointer"
                                >
                                  <ChevronLeft className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => void handleAIBreakdown(task)}
                                disabled={generatingSubtasksId === task.id}
                                className={`p-1 hover:bg-amber-500/10 hover:text-amber-400 text-zinc-500 rounded cursor-pointer ${
                                  generatingSubtasksId === task.id ? "animate-pulse text-amber-500" : ""
                                }`}
                                title="AI Breakdown"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                              </button>
                              {col.id !== "done" && (
                                <button
                                  onClick={() => updateTaskStatus(task.id, col.id === "todo" ? "in_progress" : "done")}
                                  className="p-1 hover:bg-zinc-850 rounded text-zinc-500 cursor-pointer"
                                >
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            <button
                              onClick={() => deleteTask(task.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/10 hover:text-red-400 text-zinc-650 rounded transition-all cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Creation Drawer */}
      <TaskCreateForm onCreate={createTask} />
    </div>
  );
};
export default TasksView;
