import { db } from "@/kernel/db";
import { useProjectStore } from "./store";
import type { Project, Milestone, ID } from "@/shared/types";
import { bus } from "@/kernel/event-bus";
import { useTaskStore } from "@/modules/tasks/store";

export interface ProjectModuleAPI {
  getProject(id: ID): Promise<Project | undefined>;
  getProjectsForGoal(goalId: ID): Promise<Project[]>;
  getActiveProjects(): Promise<Project[]>;
  getProjectProgress(id: ID): Promise<number>;
  linkTaskToProject(taskId: ID, projectId: ID): Promise<void>;
  getProjectMilestones(id: ID): Promise<Milestone[]>;
  getUpcomingMilestones(days: number): Promise<Milestone[]>;
  getProjectTimeSpent(id: ID): Promise<number>;
}

export const ProjectAPI: ProjectModuleAPI = {
  async getProject(id: ID): Promise<Project | undefined> {
    return useProjectStore.getState().projects.find(p => p.id === id);
  },

  async getProjectsForGoal(goalId: ID): Promise<Project[]> {
    return useProjectStore.getState().projects.filter(p => p.goalId === goalId);
  },

  async getActiveProjects(): Promise<Project[]> {
    return useProjectStore.getState().projects.filter(p => p.status === "active");
  },

  async getProjectProgress(id: ID): Promise<number> {
    const project = await this.getProject(id);
    if (!project) return 0;
    if (project.progressMode === "manual") {
      return project.progressPercent || 0;
    }
    if (project.progressMode === "task_based") {
      const tasks = useTaskStore.getState().tasks.filter(t => t.projectId === id);
      if (tasks.length === 0) return 0;
      const completed = tasks.filter(t => t.status === "done").length;
      return (completed / tasks.length) * 100;
    }
    if (project.progressMode === "milestone_based") {
      const milestones = project.milestones;
      if (milestones.length === 0) return 0;
      const completed = milestones.filter(m => m.status === "completed").length;
      return (completed / milestones.length) * 100;
    }
    return 0;
  },

  async linkTaskToProject(taskId: ID, projectId: ID): Promise<void> {
    const taskStore = useTaskStore.getState();
    await taskStore.updateTask(taskId, { projectId });
  },

  async getProjectMilestones(id: ID): Promise<Milestone[]> {
    const project = await this.getProject(id);
    return project?.milestones || [];
  },

  async getUpcomingMilestones(days: number): Promise<Milestone[]> {
    const projects = useProjectStore.getState().projects;
    const now = new Date();
    const targetDate = new Date();
    targetDate.setDate(now.getDate() + days);

    const upcoming: Milestone[] = [];
    for (const p of projects) {
      if (p.status !== "active") continue;
      for (const m of p.milestones) {
        if (m.status !== "pending") continue;
        if (!m.dueDate) continue;
        const dueDate = new Date(m.dueDate);
        if (dueDate >= now && dueDate <= targetDate) {
          upcoming.push(m);
        }
      }
    }
    return upcoming.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  },

  async getProjectTimeSpent(id: ID): Promise<number> {
    // Requires time-tracking module lookup.
    // For now, return 0.
    return 0;
  }
};
