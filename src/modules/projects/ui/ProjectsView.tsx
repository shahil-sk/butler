import React, { useEffect, useState } from "react";
import { useProjectsStore } from "../state/projectsStore";
import { useTasksStore } from "../../tasks/state/tasksStore";
import { ProjectStatus } from "../types";
import { TaskPriority, TaskStatus } from "../../tasks/types";
import { 
  FolderKanban, Plus, Trash2, Milestone
} from "lucide-react";

const TEMPLATES = [
  {
    name: "Software Dev",
    description: "DB schema, backend API, frontend UI, testing, and launch spec.",
    tasks: [
      { title: "Define Requirements & Spec", priority: "high" as TaskPriority, tags: ["spec", "milestone"] },
      { title: "Design DB Schema & Backend API", priority: "high" as TaskPriority, tags: ["dev"] },
      { title: "Implement Frontend UI Screens", priority: "medium" as TaskPriority, tags: ["dev"] },
      { title: "Conduct QA & Integration Testing", priority: "medium" as TaskPriority, tags: ["testing", "milestone"] },
      { title: "Deploy to Production & Release", priority: "high" as TaskPriority, tags: ["release", "milestone"] },
    ]
  },
  {
    name: "Content Production",
    description: "Scriptwriting, filming, editing, and publishing flow.",
    tasks: [
      { title: "Brainstorm Ideas & Outline", priority: "low" as TaskPriority, tags: ["ideation"] },
      { title: "Draft Full Script & Storyboard", priority: "medium" as TaskPriority, tags: ["spec", "milestone"] },
      { title: "Film Core Footages", priority: "high" as TaskPriority, tags: ["production"] },
      { title: "Edit & Audio Mix Video", priority: "medium" as TaskPriority, tags: ["post-production"] },
      { title: "Publish Content & Promote", priority: "high" as TaskPriority, tags: ["publish", "milestone"] },
    ]
  }
];

export const ProjectsView: React.FC = () => {
  const { projects, activeProjectId, loadProjects, createProject, updateProject, deleteProject, setActiveProjectId } = useProjectsStore();
  const { tasks, loadTasks, createTask, updateTaskStatus } = useTasksStore();

  const [activeTab, setActiveTab] = useState<"overview" | "tasks" | "timeline">("overview");
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [budget, setBudget] = useState(0);
  const [selectedTemplateIdx, setSelectedTemplateIdx] = useState<number | null>(null);

  // New task input inside project
  const [taskTitle, setTaskTitle] = useState("");
  const [taskPriority, setTaskPriority] = useState<TaskPriority>("medium");
  const [taskIsMilestone, setTaskIsMilestone] = useState(false);

  useEffect(() => {
    loadProjects();
    loadTasks();
  }, []);

  const activeProject = projects.find(p => p.id === activeProjectId) || null;
  const projectTasks = tasks.filter(t => t.project_id === activeProjectId);
  const completedTasks = projectTasks.filter(t => t.status === "done");
  const completionRate = projectTasks.length > 0 ? Math.round((completedTasks.length / projectTasks.length) * 100) : 0;
  
  // Milestones are tasks with "milestone" tag
  const milestones = projectTasks.filter(t => t.tags.includes("milestone"));
  const completedMilestones = milestones.filter(t => t.status === "done");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      const projId = await createProject(name, desc || null, "active", budget, []);
      if (selectedTemplateIdx !== null) {
        const template = TEMPLATES[selectedTemplateIdx];
        for (const t of template.tasks) {
          await createTask(t.title, t.priority, t.tags, projId);
        }
      }
      setName("");
      setDesc("");
      setBudget(0);
      setSelectedTemplateIdx(null);
      setModalOpen(false);
      loadTasks();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !activeProjectId) return;
    const tags = taskIsMilestone ? ["milestone"] : [];
    await createTask(taskTitle, taskPriority, tags, activeProjectId);
    setTaskTitle("");
    setTaskPriority("medium");
    setTaskIsMilestone(false);
  };

  const updateStatus = async (status: ProjectStatus) => {
    if (!activeProject) return;
    await updateProject(activeProject.id, activeProject.name, activeProject.description || null, status, activeProject.budget_hours, activeProject.tags);
  };

  return (
    <div className="flex-1 flex overflow-hidden h-full">
      {/* Left Sidebar: Projects List */}
      <div className="w-64 border-r border-zinc-850 bg-zinc-950/40 flex flex-col shrink-0">
        <div className="p-4 border-b border-zinc-850 flex items-center justify-between shrink-0">
          <span className="text-xs font-bold tracking-wider uppercase text-zinc-400 flex items-center gap-1.5">
            <FolderKanban className="w-3.5 h-3.5 text-zinc-400" /> Projects
          </span>
          <button onClick={() => setModalOpen(true)} className="p-1 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-zinc-200 cursor-pointer">
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {projects.map((proj) => {
            const pTasks = tasks.filter(t => t.project_id === proj.id);
            const done = pTasks.filter(t => t.status === "done").length;
            const rate = pTasks.length > 0 ? Math.round((done / pTasks.length) * 100) : 0;
            const isActive = proj.id === activeProjectId;
            return (
              <button
                key={proj.id}
                onClick={() => setActiveProjectId(proj.id)}
                className={`w-full text-left p-3 rounded-xl transition-all cursor-pointer border ${
                  isActive ? "bg-zinc-900 border-zinc-800 text-zinc-150" : "border-transparent text-zinc-500 hover:bg-zinc-900/40 hover:text-zinc-300"
                }`}
              >
                <div className="text-xs font-semibold truncate">{proj.name}</div>
                {pTasks.length > 0 ? (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${rate}%` }} />
                    </div>
                    <span className="text-[9px] font-mono text-zinc-500">{rate}%</span>
                  </div>
                ) : (
                  <span className="text-[9px] text-zinc-650 mt-1 block">Empty Project</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Panel */}
      {activeProject ? (
        <div className="flex-1 flex flex-col overflow-hidden bg-zinc-950/10">
          {/* Header */}
          <div className="p-6 border-b border-zinc-850 shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-lg font-bold text-zinc-100 flex items-center gap-2">{activeProject.name}</h1>
                <p className="text-xs text-zinc-400 mt-1">{activeProject.description || "No description provided."}</p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={activeProject.status}
                  onChange={(e) => updateStatus(e.target.value as ProjectStatus)}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-full border cursor-pointer ${
                    activeProject.status === "active" ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" :
                    activeProject.status === "completed" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                    activeProject.status === "on-hold" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                    "bg-zinc-800 text-zinc-400 border-zinc-700"
                  }`}
                >
                  <option value="active">Active</option>
                  <option value="on-hold">On Hold</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
                <button onClick={() => deleteProject(activeProject.id)} className="p-1.5 hover:bg-red-500/10 hover:text-red-400 text-zinc-600 rounded-lg cursor-pointer">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 mt-6">
              {(["overview", "tasks", "timeline"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`text-xs font-semibold pb-2 border-b-2 transition-all cursor-pointer capitalize ${
                    activeTab === tab ? "border-zinc-200 text-zinc-100" : "border-transparent text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Contents */}
          <div className="flex-1 overflow-y-auto p-6 min-h-0">
            {activeTab === "overview" && (
              <div className="space-y-6">
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-zinc-900/40 border border-zinc-850 p-4 rounded-xl">
                    <span className="text-[10px] uppercase font-bold tracking-wide text-zinc-500 block">Progress</span>
                    <span className="text-xl font-bold text-zinc-200 mt-2 block">{completionRate}%</span>
                    <span className="text-[10px] text-zinc-400 mt-1 block">{completedTasks.length} of {projectTasks.length} tasks completed</span>
                  </div>
                  <div className="bg-zinc-900/40 border border-zinc-850 p-4 rounded-xl">
                    <span className="text-[10px] uppercase font-bold tracking-wide text-zinc-500 block">Milestones</span>
                    <span className="text-xl font-bold text-zinc-200 mt-2 block">{completedMilestones.length} / {milestones.length}</span>
                    <span className="text-[10px] text-zinc-400 mt-1 block">Key objectives completed</span>
                  </div>
                  <div className="bg-zinc-900/40 border border-zinc-850 p-4 rounded-xl">
                    <span className="text-[10px] uppercase font-bold tracking-wide text-zinc-500 block">Time Budget</span>
                    <span className="text-xl font-bold text-zinc-200 mt-2 block">{activeProject.budget_hours > 0 ? `${activeProject.budget_hours} hrs` : "None"}</span>
                    <span className="text-[10px] text-zinc-400 mt-1 block">Allocated project hours</span>
                  </div>
                </div>

                {/* Milestones Card */}
                <div className="bg-zinc-900/20 border border-zinc-850 rounded-xl p-4">
                  <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wide flex items-center gap-1.5 mb-3">
                    <Milestone className="w-3.5 h-3.5 text-zinc-400" /> Key Milestones
                  </h3>
                  {milestones.length === 0 ? (
                    <span className="text-xs text-zinc-500">No milestones set. Create a task with the "milestone" tag.</span>
                  ) : (
                    <div className="space-y-2">
                      {milestones.map(m => (
                        <div key={m.id} className="flex items-center gap-3 p-2 hover:bg-zinc-900/20 rounded-lg">
                          <input
                            type="checkbox"
                            checked={m.status === "done"}
                            onChange={() => updateTaskStatus(m.id, m.status === "done" ? "todo" : "done")}
                            className="w-4 h-4 rounded border-zinc-800 bg-zinc-950 text-indigo-500 focus:ring-0 cursor-pointer"
                          />
                          <span className={`text-xs font-medium ${m.status === "done" ? "line-through text-zinc-650" : "text-zinc-350"}`}>{m.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "tasks" && (
              <div className="space-y-6">
                {/* Inline Task Creator */}
                <form onSubmit={handleCreateTask} className="bg-zinc-900/30 border border-zinc-850 p-3.5 rounded-xl flex flex-wrap items-center gap-3">
                  <input
                    type="text"
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder="Add a task to this project..."
                    className="flex-1 min-w-[200px] bg-transparent border-0 outline-hidden text-xs text-zinc-200 placeholder-zinc-600 focus:ring-0"
                  />
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}
                    className="bg-zinc-950 border border-zinc-850 rounded-lg px-2.5 py-1 text-xs text-zinc-400 focus:outline-hidden cursor-pointer"
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                  <label className="flex items-center gap-1.5 text-xs text-zinc-400 select-none cursor-pointer">
                    <input
                      type="checkbox"
                      checked={taskIsMilestone}
                      onChange={(e) => setTaskIsMilestone(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-zinc-800 bg-zinc-950 text-indigo-500 focus:ring-0"
                    />
                    Milestone
                  </label>
                  <button type="submit" className="p-1 hover:bg-zinc-850 rounded-lg text-zinc-250 cursor-pointer">
                    <Plus className="w-4 h-4" />
                  </button>
                </form>

                {/* Tasks list */}
                <div className="space-y-2">
                  {projectTasks.map(t => (
                    <div key={t.id} className="flex items-center justify-between p-3 bg-zinc-900/10 border border-zinc-850/50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <select
                          value={t.status}
                          onChange={(e) => updateTaskStatus(t.id, e.target.value as TaskStatus)}
                          className="bg-zinc-950 border border-zinc-800 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-zinc-450 focus:outline-hidden cursor-pointer"
                        >
                          <option value="todo">Todo</option>
                          <option value="in_progress">In Progress</option>
                          <option value="done">Done</option>
                        </select>
                        <span className={`text-xs font-medium ${t.status === "done" ? "line-through text-zinc-650" : "text-zinc-200"}`}>{t.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {t.tags.map(tag => (
                          <span key={tag} className="text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-sm bg-zinc-900 text-zinc-500 border border-zinc-850">{tag}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "timeline" && (
              <div className="space-y-4 relative pl-4 border-l border-zinc-800 ml-2 py-2">
                {projectTasks.length === 0 ? (
                  <span className="text-xs text-zinc-500">No project tasks scheduled.</span>
                ) : (
                  projectTasks.map((t, idx) => (
                    <div key={t.id} className="relative flex items-start gap-4">
                      {/* Node Bullet */}
                      <div className={`absolute -left-[21px] w-2.5 h-2.5 rounded-full border-2 ${
                        t.status === "done" ? "bg-emerald-500 border-emerald-500" : "bg-zinc-950 border-zinc-700"
                      }`} />
                      <div>
                        <span className={`text-xs font-semibold ${t.status === "done" ? "line-through text-zinc-650" : "text-zinc-200"}`}>{t.title}</span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[8px] uppercase font-bold text-zinc-500">Step {idx + 1}</span>
                          {t.tags.includes("milestone") && (
                            <span className="text-[8px] font-bold uppercase text-amber-400 bg-amber-950/20 px-1.5 py-0.2 rounded border border-amber-900/30">Milestone</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-zinc-950/10">
          <FolderKanban className="w-8 h-8 text-zinc-600 mb-2" />
          <span className="text-xs text-zinc-500 font-medium">Select or create a project from the sidebar to get started.</span>
        </div>
      )}

      {/* Creation Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <form onSubmit={handleCreate} className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-2xl space-y-4">
            <h2 className="text-sm font-bold text-zinc-200">Create New Project</h2>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Project Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-zinc-200 outline-hidden focus:border-zinc-700"
              />
              <textarea
                placeholder="Description (optional)"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-zinc-200 outline-hidden focus:border-zinc-700 h-20 resize-none"
              />
              <input
                type="number"
                placeholder="Budget Hours"
                value={budget || ""}
                onChange={(e) => setBudget(Number(e.target.value))}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-zinc-200 outline-hidden focus:border-zinc-700"
              />
              
              {/* Preset templates selection */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-zinc-500">Preset Template (Optional)</span>
                <div className="grid grid-cols-2 gap-2">
                  {TEMPLATES.map((tmpl, idx) => (
                    <button
                      key={tmpl.name}
                      type="button"
                      onClick={() => setSelectedTemplateIdx(selectedTemplateIdx === idx ? null : idx)}
                      className={`p-2.5 text-left rounded-lg border text-xs cursor-pointer transition-all ${
                        selectedTemplateIdx === idx ? "bg-indigo-500/10 border-indigo-500/40 text-indigo-300" : "bg-zinc-950 border-zinc-850 text-zinc-450 hover:bg-zinc-900/60"
                      }`}
                    >
                      <span className="font-semibold block">{tmpl.name}</span>
                      <span className="text-[9px] text-zinc-550 block mt-1 leading-tight">{tmpl.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModalOpen(false)} className="px-3.5 py-2 text-xs text-zinc-400 hover:bg-zinc-800 rounded-lg cursor-pointer">Cancel</button>
              <button type="submit" className="px-3.5 py-2 text-xs bg-indigo-600 hover:bg-indigo-500 text-zinc-100 rounded-lg cursor-pointer font-semibold">Create</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
export default ProjectsView;
