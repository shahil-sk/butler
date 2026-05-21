import { List, LayoutGrid, Calendar, Table2, Plus, Trash2, CheckSquare, X } from "lucide-react";
import { cn } from "@/shared/utils";
import { PageHeader, ViewSwitcher, PrimaryButton, GhostButton, ToolbarSeparator } from "@/shared/ui";
import { useTaskStore, type TaskView, type TaskGroupBy, type TaskSortBy } from "../store";

const VIEW_OPTIONS = [
  { value: "list"     as TaskView, icon: List,      label: "List" },
  { value: "board"    as TaskView, icon: LayoutGrid, label: "Board" },
  { value: "calendar" as TaskView, icon: Calendar,   label: "Calendar" },
  { value: "table"    as TaskView, icon: Table2,     label: "Table" },
];

export function TasksHeader() {
  const {
    view, setView,
    groupBy, setGroupBy,
    sortBy, setSortBy,
    selectedTaskIds, clearSelection,
    batchDelete, batchUpdate,
    openQuickAdd,
    getFilteredTasks,
  } = useTaskStore();

  const selected     = [...selectedTaskIds];
  const hasSelection = selected.length > 0;

  return (
    <div className="shrink-0">
      <PageHeader title="Tasks" count={getFilteredTasks().length}>
        <ViewSwitcher options={VIEW_OPTIONS} value={view} onChange={setView} />

        <ToolbarSeparator />

        {/* Group by */}
        <select
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value as TaskGroupBy)}
          className={cn(
            "text-xs bg-transparent border border-border/70 rounded-lg px-2 py-1.5 outline-none",
            "text-muted-foreground hover:text-foreground hover:border-border transition-fast cursor-pointer",
            "focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-ring"
          )}
        >
          <option value="none">No grouping</option>
          <option value="status">By status</option>
          <option value="priority">By priority</option>
          <option value="project">By project</option>
          <option value="dueDate">By due date</option>
        </select>

        {/* Sort by */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as TaskSortBy)}
          className={cn(
            "text-xs bg-transparent border border-border/70 rounded-lg px-2 py-1.5 outline-none",
            "text-muted-foreground hover:text-foreground hover:border-border transition-fast cursor-pointer",
            "focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-ring"
          )}
        >
          <option value="manual">Manual</option>
          <option value="dueDate">Due date</option>
          <option value="priority">Priority</option>
          <option value="createdAt">Created</option>
          <option value="title">Title</option>
        </select>

        <ToolbarSeparator />

        <PrimaryButton onClick={() => openQuickAdd()}>
          <Plus size={13} strokeWidth={2.5} />
          New task
        </PrimaryButton>
      </PageHeader>

      {/* Bulk action bar */}
      {hasSelection && (
        <div className="flex items-center gap-2 px-4 py-2 bg-primary/[0.06] border-b border-border animate-fade-in">
          <span className="text-xs text-muted-foreground font-medium tabular-nums">
            {selected.length} selected
          </span>
          <div className="h-3.5 w-px bg-border mx-1" />
          <div className="flex items-center gap-1">
            <GhostButton onClick={() => void batchUpdate(selected, { status: "done" })}>
              <CheckSquare size={12} />
              Complete
            </GhostButton>
            <GhostButton onClick={() => void batchDelete(selected)} danger>
              <Trash2 size={12} />
              Delete
            </GhostButton>
          </div>
          <div className="flex-1" />
          <button
            onClick={clearSelection}
            className="p-1 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-muted/70 transition-fast"
            title="Clear selection"
          >
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
