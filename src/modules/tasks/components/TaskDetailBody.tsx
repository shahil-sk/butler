import {
  Plus, X, FileText, ExternalLink,
  CheckSquare, Circle,
} from "lucide-react";
import { cn } from "@/shared/utils";
import { useNoteStore } from "@/modules/notes/store";
import type { Task } from "@/shared/types";

// ─── Checklist ───────────────────────────────────────────────

export function TaskChecklist({
  isCreating,
  checkItems,
  completedCount,
  newCheckItem,
  onNewCheckItemChange,
  onToggle,
  onDelete,
  onAdd,
  onCreateConfirm,
}: {
  isCreating: boolean;
  checkItems: { id: string; text: string; checked: boolean }[];
  completedCount: number;
  newCheckItem: string;
  onNewCheckItemChange: (v: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  onCreateConfirm: () => void;
}) {
  return (
    <div className="border-t border-border/60 px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40">
          Checklist
          {checkItems.length > 0 && (
            <span className="ml-1.5 normal-case font-normal tabular-nums">
              {completedCount}/{checkItems.length}
            </span>
          )}
        </span>
      </div>

      {/* progress bar */}
      {checkItems.length > 0 && (
        <div className="h-[3px] rounded-full bg-border mb-3 overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${(completedCount / checkItems.length) * 100}%` }}
          />
        </div>
      )}

      {/* items */}
      <div className="space-y-0.5 mb-2">
        {checkItems.map((item) => (
          <div
            key={item.id}
            className="group flex items-center gap-2.5 py-1.5 px-2 -mx-2 rounded-lg hover:bg-accent/40 transition-colors"
          >
            <button
              onClick={() => onToggle(item.id)}
              className={cn(
                "shrink-0 transition-fast",
                item.checked ? "text-emerald-500" : "text-muted-foreground/25 hover:text-primary",
              )}
            >
              {item.checked ? <CheckSquare size={14} /> : <Circle size={14} />}
            </button>
            <span className={cn(
              "flex-1 text-sm leading-snug",
              item.checked && "line-through text-muted-foreground/35",
            )}>
              {item.text}
            </span>
            <button
              onClick={() => onDelete(item.id)}
              title="Remove item"
              className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground/30 hover:text-red-500 transition-fast"
            >
              <X size={11} />
            </button>
          </div>
        ))}
      </div>

      {/* add item */}
      <div className="flex items-center gap-2 py-1.5 px-2 -mx-2 rounded-lg hover:bg-accent/30 transition-colors">
        <Plus size={12} className="text-muted-foreground/30 shrink-0" />
        <input
          value={newCheckItem}
          onChange={(e) => onNewCheckItemChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (newCheckItem.trim()) onAdd();
              else if (isCreating) { e.preventDefault(); onCreateConfirm(); }
            }
          }}
          placeholder="Add item…"
          className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/25"
        />
        {newCheckItem.trim() && (
          <button
            onClick={onAdd}
            className="text-[11px] text-primary font-medium shrink-0 hover:opacity-75 transition-fast"
          >
            Add
          </button>
        )}
      </div>
    </div>
  );
}

// ─── LinkedNotes ─────────────────────────────────────────────

export function TaskLinkedNotes({
  linkedNotes,
  linkNoteOpen,
  noteSearch,
  filteredNotes,
  onNoteSearchChange,
  onLinkNote,
}: {
  linkedNotes: { id: string; title: string }[];
  linkNoteOpen: boolean;
  noteSearch: string;
  filteredNotes: { id: string; title: string }[];
  onNoteSearchChange: (v: string) => void;
  onLinkNote: (id: string) => void;
}) {
  return (
    <div className="border-t border-border/60 px-5 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 mb-2">
        Notes
      </p>
      {linkedNotes.map((n) => (
        <button
          key={n.id}
          onClick={() => useNoteStore.getState().openNote(n.id)}
          className="flex items-center gap-2 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-fast w-full text-left"
        >
          <FileText size={13} className="shrink-0" />
          <span className="flex-1 truncate">{n.title || "Untitled"}</span>
          <ExternalLink size={11} className="shrink-0 opacity-30" />
        </button>
      ))}
      {linkNoteOpen && (
        <div className="mt-2 space-y-1">
          <input
            autoFocus
            value={noteSearch}
            onChange={(e) => onNoteSearchChange(e.target.value)}
            placeholder="Search notes…"
            className="w-full text-sm bg-muted/40 rounded-lg px-3 py-2 outline-none border border-border focus:border-primary/50"
          />
          {filteredNotes.map((n) => (
            <button
              key={n.id}
              onClick={() => onLinkNote(n.id)}
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-sm hover:bg-accent transition-fast text-left"
            >
              <FileText size={12} className="shrink-0 text-muted-foreground/50" />
              {n.title || "Untitled"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
