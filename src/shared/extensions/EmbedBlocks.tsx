import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import { useTaskStore } from "@/modules/tasks/store";
import { useProjectStore } from "@/modules/projects/store";
import { CheckSquare, Circle, Database, LayoutList } from "lucide-react";
import { cn } from "@/shared/utils";

// --- Tasks Block ---

const TasksBlockComponent = (props: any) => {
  const { tasks, updateTask } = useTaskStore();
  const openProjectId = useProjectStore((s) => s.openProjectId);
  
  // If openProjectId exists, filter tasks by it. Otherwise show all incomplete
  const blockTasks = openProjectId 
    ? tasks.filter(t => t.projectId === openProjectId && t.status !== "archived")
    : tasks.filter(t => t.status !== "archived" && t.status !== "done").slice(0, 5);

  return (
    <NodeViewWrapper className="my-4" contentEditable={false}>
      <div className="border border-border/50 rounded-xl bg-muted/10 overflow-hidden shadow-sm">
        <div className="bg-muted/30 px-3 py-2 border-b border-border/50 flex items-center gap-2">
          <LayoutList size={14} className="text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Live Tasks</span>
        </div>
        <div className="p-2 space-y-1 max-h-[300px] overflow-y-auto">
          {blockTasks.length === 0 ? (
            <p className="text-xs text-muted-foreground/50 p-2 italic text-center">No open tasks.</p>
          ) : (
            blockTasks.map(t => {
              const isDone = t.status === "done";
              return (
                <div key={t.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-accent/50 group transition-fast">
                  <button 
                    onClick={() => updateTask(t.id, { status: isDone ? "todo" : "done" })}
                    className="shrink-0"
                  >
                    {isDone ? (
                      <CheckSquare size={14} className="text-emerald-500" />
                    ) : (
                      <Circle size={14} className="text-muted-foreground/50 group-hover:text-primary/70" />
                    )}
                  </button>
                  <span className={cn("text-xs flex-1 truncate", isDone && "line-through text-muted-foreground/50")}>
                    {t.title}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </NodeViewWrapper>
  );
};

export const LiveTasksExtension = Node.create({
  name: "liveTasksBlock",
  group: "block",
  atom: true,

  parseHTML() {
    return [{ tag: "live-tasks-block" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["live-tasks-block", mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TasksBlockComponent);
  },
});


// --- Database Block ---

const DatabaseBlockComponent = (props: any) => {
  const { tasks, updateTask } = useTaskStore();
  const openProjectId = useProjectStore((s) => s.openProjectId);
  
  const blockTasks = openProjectId 
    ? tasks.filter(t => t.projectId === openProjectId && t.status !== "archived")
    : tasks.filter(t => t.status !== "archived").slice(0, 5);

  return (
    <NodeViewWrapper className="my-4" contentEditable={false}>
      <div className="border border-border/50 rounded-xl bg-muted/10 overflow-hidden shadow-sm">
        <div className="bg-muted/30 px-3 py-2 border-b border-border/50 flex items-center gap-2">
          <Database size={14} className="text-indigo-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Live Database View</span>
        </div>
        <div className="p-4 flex flex-col items-center justify-center text-center">
          <div className="w-full max-w-2xl bg-background border border-border/50 rounded shadow-sm overflow-hidden text-left">
            <div className="grid grid-cols-4 bg-muted/30 border-b border-border/50 text-[10px] font-bold uppercase text-muted-foreground px-3 py-2">
              <span className="col-span-2">Feature / Task</span>
              <span>Status</span>
              <span>Priority</span>
            </div>
            {blockTasks.length === 0 ? (
               <p className="text-xs text-muted-foreground/50 p-3 italic text-center">No tasks to display in database view.</p>
            ) : (
               blockTasks.map((t, i) => (
                 <div key={t.id} className={cn(
                   "grid grid-cols-4 text-xs px-3 py-2 items-center",
                   i !== blockTasks.length - 1 && "border-b border-border/20"
                 )}>
                   <span className="col-span-2 truncate pr-2 cursor-pointer font-medium hover:text-primary transition-fast">
                     {t.title}
                   </span>
                   <button
                     onClick={() => updateTask(t.id, { status: t.status === "done" ? "todo" : "done" })}
                     className={cn(
                       "px-1.5 py-0.5 rounded w-fit text-[10px] font-bold transition-fast",
                       t.status === "done" 
                         ? "text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20" 
                         : "text-amber-500 bg-amber-500/10 hover:bg-amber-500/20"
                     )}
                   >
                     {t.status === "done" ? "Done" : "In Progress"}
                   </button>
                   <span className="text-muted-foreground truncate capitalize">
                     {t.priority || "Normal"}
                   </span>
                 </div>
               ))
            )}
          </div>
          <p className="text-[10px] text-muted-foreground/70 mt-3 italic">
            This table is live. Updating linked tasks changes the row status automatically.
          </p>
        </div>
      </div>
    </NodeViewWrapper>
  );
};

export const LiveDatabaseExtension = Node.create({
  name: "liveDatabaseBlock",
  group: "block",
  atom: true,

  parseHTML() {
    return [{ tag: "live-database-block" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["live-database-block", mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DatabaseBlockComponent);
  },
});
