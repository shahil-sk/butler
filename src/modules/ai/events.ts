import { bus } from "@/kernel/event-bus";
import { AIService } from "./service";
import { useTaskStore } from "@/modules/tasks/store";
import { useShellStore } from "@/shell/store";
import { useNoteStore } from "@/modules/notes/store";

export function setupAIEventListeners() {
  const unsubs: Array<() => void> = [];

  unsubs.push(bus.on("ai:extract-tasks", async ({ noteId, content }) => {
    const notify = useShellStore.getState().notify;
    
    // Convert content from string to plain text for extraction if it's JSON
    let textContent = content;
    try {
      if (content.startsWith("{")) {
        const parsed = JSON.parse(content);
        // Simple extraction of text from tiptap JSON for AI
        const extractText = (node: any): string => {
          if (node.type === "text") return node.text || "";
          if (node.content) return node.content.map(extractText).join(" ");
          return " ";
        };
        textContent = extractText(parsed);
      }
    } catch {
      // It's already text or invalid JSON, leave as is
    }

    notify({
      type: "info",
      message: "AI is extracting tasks...",
      durationMs: 3000,
    });

    try {
      const extractedTasks = await AIService.extractTasks(textContent);
      
      if (!extractedTasks || extractedTasks.length === 0) {
        notify({
          type: "info",
          message: "No tasks found in the note.",
          durationMs: 3000,
        });
        return;
      }

      let count = 0;
      for (const t of extractedTasks) {
        if (!t.title) continue;
        const task = await useTaskStore.getState().createTask({
          title: t.title,
          dueDate: t.dueDate,
          dueTime: t.dueTime,
          priority: t.priority || "none",
          tags: t.tags || [],
          estimateMinutes: t.estimateMinutes,
          description: t.description,
          linkedNoteIds: [noteId],
        });
        
        // Link task to note
        const note = useNoteStore.getState().getNoteById(noteId);
        if (note && !note.linkedTaskIds.includes(task.id)) {
          await useNoteStore.getState().updateNote(noteId, {
            linkedTaskIds: [...note.linkedTaskIds, task.id]
          });
        }
        
        count++;
      }

      notify({
        type: "success",
        message: `Extracted ${count} task${count === 1 ? "" : "s"} successfully!`,
        durationMs: 4000,
      });

    } catch (e) {
      notify({
        type: "error",
        message: `Extraction failed: ${(e as Error).message}`,
        durationMs: 5000,
      });
    }
  }));

  unsubs.push(bus.on("ai:create-task", async ({ query }) => {
    const notify = useShellStore.getState().notify;
    
    notify({
      type: "info",
      message: "AI is parsing task...",
      durationMs: 3000,
    });

    try {
      const parsedTask = await AIService.parseTaskFromNL(query);
      if (!parsedTask || !parsedTask.title) {
        notify({
          type: "error",
          message: "Could not understand the task.",
          durationMs: 3000,
        });
        return;
      }
      
      const task = await useTaskStore.getState().createTask({
        title: parsedTask.title,
        dueDate: parsedTask.dueDate,
        dueTime: parsedTask.dueTime,
        priority: parsedTask.priority || "none",
        tags: parsedTask.tags || [],
        estimateMinutes: parsedTask.estimateMinutes,
        description: parsedTask.description,
      });

      notify({
        type: "success",
        message: `Task created: ${task.title}`,
        durationMs: 4000,
      });
    } catch (e) {
      notify({
        type: "error",
        message: `Task creation failed: ${(e as Error).message}`,
        durationMs: 5000,
      });
    }
  }));

  return () => {
    unsubs.forEach((u) => u());
  };
}
