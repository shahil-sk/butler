import { bus } from "@/kernel/event-bus";
import { SearchService } from "./service";
import type { Task, Project, Note, JournalEntry, Goal, FocusSession, ResearchSource, ResearchChunk } from "@/shared/types";

const source: any = undefined; const chunk: any = undefined;

export function setupSearchEventListeners() {
  const unsubs: Array<() => void> = [];

  // Tasks
  unsubs.push(bus.on("task:created" as any, ({ task }: { task: Task }) => {
    void SearchService.indexEntity({
      entityType: "task",
      entityId: task.id,
      title: task.title,
      body: task.description || "",
      tags: task.tags,
      projectId: task.projectId
    });
  }));
  unsubs.push(bus.on("task:updated" as any, ({ task }: { task: Task }) => {
    void SearchService.indexEntity({
      entityType: "task",
      entityId: task.id,
      title: task.title,
      body: task.description || "",
      tags: task.tags,
      projectId: task.projectId
    });
  }));
  unsubs.push(bus.on("task:deleted" as any, ({ taskId }: { taskId: string }) => {
    void SearchService.deindexEntity("task", taskId);
  }));

  // Projects
  unsubs.push(bus.on("project:created" as any, ({ project }: { project: Project }) => {
    void SearchService.indexEntity({
      entityType: "project",
      entityId: project.id,
      title: project.name,
      body: project.description || "",
      tags: []
    });
  }));
  unsubs.push(bus.on("project:updated" as any, ({ project }: { project: Project }) => {
    void SearchService.indexEntity({
      entityType: "project",
      entityId: project.id,
      title: project.name,
      body: project.description || "",
      tags: []
    });
  }));
  unsubs.push(bus.on("project:deleted" as any, ({ projectId }: { projectId: string }) => {
    void SearchService.deindexEntity("project", projectId);
  }));

  // Notes
  unsubs.push(bus.on("note:created" as any, ({ note }: { note: Note }) => {
    void SearchService.indexEntity({
      entityType: "note",
      entityId: note.id,
      title: note.title || "Untitled Note",
      body: note.content || "",
      tags: note.tags
    });
  }));
  unsubs.push(bus.on("note:updated" as any, ({ note }: { note: Note }) => {
    void SearchService.indexEntity({
      entityType: "note",
      entityId: note.id,
      title: note.title || "Untitled Note",
      body: note.content || "",
      tags: note.tags
    });
  }));
  unsubs.push(bus.on("note:deleted" as any, ({ noteId }: { noteId: string }) => {
    void SearchService.deindexEntity("note", noteId);
  }));

  // Journal
  unsubs.push(bus.on("journal:entry-created" as any, ({ entry }: { entry: JournalEntry }) => {
    void SearchService.indexEntity({
      entityType: "journal",
      entityId: entry.id,
      title: `Journal Entry - ${entry.date}`,
      body: entry.content || "",
      tags: entry.tags
    });
  }));
  unsubs.push(bus.on("journal:entry-updated" as any, ({ entry }: { entry: JournalEntry }) => {
    void SearchService.indexEntity({
      entityType: "journal",
      entityId: entry.id,
      title: `Journal Entry - ${entry.date}`,
      body: entry.content || "",
      tags: entry.tags
    });
  }));
  unsubs.push(bus.on("journal:entry-deleted" as any, ({ entryId }: { entryId: string }) => {
    void SearchService.deindexEntity("journal", entryId);
  }));

  // Goals
  unsubs.push(bus.on("goal:created" as any, ({ goal }: { goal: Goal }) => {
    void SearchService.indexEntity({
      entityType: "goal",
      entityId: goal.id,
      title: goal.title,
      body: goal.description || "",
      tags: goal.tags || []
    });
  }));
  unsubs.push(bus.on("goal:updated" as any, ({ goal }: { goal: Goal }) => {
    void SearchService.indexEntity({
      entityType: "goal",
      entityId: goal.id,
      title: goal.title,
      body: goal.description || "",
      tags: goal.tags || []
    });
  }));
  unsubs.push(bus.on("goal:deleted" as any, ({ goalId }: { goalId: string }) => {
    void SearchService.deindexEntity("goal", goalId);
  }));

  // Focus Sessions
  unsubs.push(bus.on("focus:session-completed" as any, ({ session }: { session: FocusSession }) => {
    void SearchService.indexEntity({
      entityType: "focus_session",
      entityId: session.id,
      title: `Focus Session - ${session.startedAt?.slice(0, 10)}`,
      body: session.notes || "",
      tags: [],
      projectId: session.projectId
    });
  }));
  unsubs.push(bus.on("focus:session-updated" as any, ({ session }: { session: FocusSession }) => {
    void SearchService.indexEntity({
      entityType: "focus_session",
      entityId: session.id,
      title: `Focus Session - ${session.startedAt?.slice(0, 10)}`,
      body: session.notes || "",
      tags: [],
      projectId: session.projectId
    });
  }));

  // Research
  unsubs.push(bus.on("research:source-imported" as any, ({ source }: { source: ResearchSource }) => {
    void SearchService.indexEntity({
      entityType: "research_document",
      entityId: source.id,
      title: source.title,
      body: "",
      tags: []
    });
  }));
  unsubs.push(bus.on("research:chunk-created" as any, ({ chunk }: { chunk: ResearchChunk }) => {
    void SearchService.indexEntity({
      entityType: "research_chunk",
      entityId: chunk.id,
      title: source ? `${source.title} (Page ${chunk.pageNumber || '?'})` : "Document Passage",
      body: chunk.content,
      tags: chunk.semanticTags || []
    });
  }));

  // Generic re-index request
  unsubs.push(bus.on("search:index-invalidated" as any, async ({ entityType, id }) => {
    if (entityType === "research_document") {
      if (source) {
        void SearchService.indexEntity({
          entityType: "research_document",
          entityId: source.id,
          title: source.title,
          body: "",
          tags: []
        });
      }
    } else if (entityType === "research_chunk") {
      if (chunk) {
        void SearchService.indexEntity({
          entityType: "research_chunk",
          entityId: chunk.id,
          title: source ? `${source.title} (Page ${chunk.pageNumber || '?'})` : "Document Passage",
          body: chunk.content,
          tags: chunk.semanticTags || []
        });
      }
    }
  }));

  return () => {
    unsubs.forEach(fn => fn());
  };
}
