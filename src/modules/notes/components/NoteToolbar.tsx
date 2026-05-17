import { useState } from "react";
import {
  Pin, PinOff, Trash2, MoreHorizontal, Tag,
  CheckSquare, FolderKanban, Calendar, Plus, X, Circle, CheckCircle2,
} from "lucide-react";
import { cn, formatDate } from "@/shared/utils";
import { ProjectDot } from "@/shared/ui";
import { useNoteStore } from "../store";
import { useTaskStore } from "@/modules/tasks/store";
import { useProjectStore } from "@/modules/projects/store";
import { useCalendarStore } from "@/modules/calendar/store";
import { bus } from "@/kernel/event-bus";
import type { Note } from "@/shared/types";

const TYPE_LABELS: Record<string, string> = {
  note: "Note", daily: "Daily", meeting: "Meeting", template: "Template",
};

export function NoteToolbar({ note }: { note: Note }) {
  const { updateNote, deleteNote, closeNote, pinNote } = useNoteStore();

  // Cross-module stores — read-only for display
  const tasks    = useTaskStore((s) => s.tasks);
  const projects = useProjectStore((s) => s.projects);
  const events   = useCalendarStore((s) => s.events);

  const [title,      setTitle]      = useState(note.title);
  const [menuOpen,   setMenuOpen]   = useState(false);
  const [linkPanel,  setLinkPanel]  = useState<"tasks" | "projects" | "events" | null>(null);
  const [linkSearch, setLinkSearch] = useState("");

  const linkedTasks    = tasks.filter((t)    => note.linkedTaskIds.includes(t.id));
  const linkedProjects = projects.filter((p) => note.linkedProjectIds.includes(p.id));
  const linkedEvents   = events.filter((e)   => note.linkedEventIds.includes(e.id));

  const handleTitleBlur = () => {
    if (title.trim() && title !== note.title) void updateNote(note.id, { title: title.trim() });
  };

  const linkTask = (taskId: string) => {
    if (note.linkedTaskIds.includes(taskId)) return;
    const updated = [...note.linkedTaskIds, taskId];
    void updateNote(note.id, { linkedTaskIds: updated });
    bus.emit("note:link-to-task", { noteId: note.id, taskId });
  };

  const unlinkTask = (taskId: string) => {
    void updateNote(note.id, { linkedTaskIds: note.linkedTaskIds.filter((id) => id !== taskId) });
  };

  const linkProject = (projectId: string) => {
    if (note.linkedProjectIds.includes(projectId)) return;
    void updateNote(note.id, { linkedProjectIds: [...note.linkedProjectIds, projectId] });
  };

  const unlinkProject = (projectId: string) => {
    void updateNote(note.id, { linkedProjectIds: note.linkedProjectIds.filter((id) => id !== projectId) });
  };

  const linkEvent = (eventId: string) => {
    if (note.linkedEventIds.includes(eventId)) return;
    void updateNote(note.id, { linkedEventIds: [...note.linkedEventIds, eventId] });
  };

  const unlinkEvent = (eventId: string) => {
    void updateNote(note.id, { linkedEventIds: note.linkedEventIds.filter((id) => id !== eventId) });
  };

  const searchedTasks    = tasks.filter((t) =>
    t.status !== "archived" && t.title.toLowerCase().includes(linkSearch.toLowerCase())
  ).slice(0, 8);
  const searchedProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(linkSearch.toLowerCase())
  ).slice(0, 8);
  const searchedEvents   = events.filter((e) =>
    e.title.toLowerCase().includes(linkSearch.toLowerCase())
  ).slice(0, 8);

  return (
    <div className="flex flex-col border-b border-border shrink-0">
      {/* Title row */}
      <div className="flex items-center gap-2 px-4 py-2.5">
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium shrink-0">
          {TYPE_LABELS[note.type] ?? "Note"}
        </span>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
          className="flex-1 text-sm font-semibold bg-transparent outline-none min-w-0"
          placeholder="Untitled"
        />

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={() => void pinNote(note.id)}
            className={cn(
              "p-1.5 rounded transition-fast",
              note.isPinned ? "text-primary hover:bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
            title={note.isPinned ? "Unpin" : "Pin"}
          >
            {note.isPinned ? <PinOff size={13} /> : <Pin size={13} />}
          </button>

          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-fast"
            >
              <MoreHorizontal size={13} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-8 z-20 w-44 rounded-lg border border-border bg-popover shadow-xl py-1 animate-fade-in">
                  {(["note", "daily", "meeting"] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => { void updateNote(note.id, { type }); setMenuOpen(false); }}
                      className="w-full flex items-center justify-between px-3 py-1.5 text-xs hover:bg-accent transition-fast"
                    >
                      {TYPE_LABELS[type]}
                      {note.type === type && <span className="text-primary text-[10px]">✓</span>}
                    </button>
                  ))}
                  <div className="my-1 border-t border-border/50" />
                  <button
                    onClick={() => { void deleteNote(note.id); closeNote(); setMenuOpen(false); }}
                    className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-500/10 transition-fast"
                  >
                    Delete note
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Link chips row */}
      <div className="flex items-center gap-1.5 px-4 pb-2.5 flex-wrap">

        {/* Linked tasks */}
        {linkedTasks.map((t) => (
          <LinkedChip
            key={t.id}
            label={t.title}
            icon={t.status === "done" ? <CheckCircle2 size={10} className="text-green-500" /> : <Circle size={10} />}
            onOpen={() => {
              useTaskStore.getState().openTask(t.id);
              bus.emit("navigate:to", { path: "/tasks" });
            }}
            onRemove={() => unlinkTask(t.id)}
          />
        ))}

        {/* Linked projects */}
        {linkedProjects.map((p) => (
          <LinkedChip
            key={p.id}
            label={p.name}
            icon={<ProjectDot color={p.color} size={8} />}
            onOpen={() => {
              useProjectStore.getState().openProject(p.id);
              bus.emit("navigate:to", { path: "/projects" });
            }}
            onRemove={() => unlinkProject(p.id)}
          />
        ))}

        {/* Linked events */}
        {linkedEvents.map((e) => (
          <LinkedChip
            key={e.id}
            label={e.title}
            icon={<Calendar size={10} />}
            onOpen={() => bus.emit("navigate:to", { path: "/calendar" })}
            onRemove={() => unlinkEvent(e.id)}
          />
        ))}

        {/* Link buttons */}
        <div className="flex items-center gap-1 ml-auto">
          <LinkButton
            icon={<CheckSquare size={11} />}
            label="Link task"
            active={linkPanel === "tasks"}
            onClick={() => { setLinkPanel(linkPanel === "tasks" ? null : "tasks"); setLinkSearch(""); }}
          />
          <LinkButton
            icon={<FolderKanban size={11} />}
            label="Link project"
            active={linkPanel === "projects"}
            onClick={() => { setLinkPanel(linkPanel === "projects" ? null : "projects"); setLinkSearch(""); }}
          />
          <LinkButton
            icon={<Calendar size={11} />}
            label="Link event"
            active={linkPanel === "events"}
            onClick={() => { setLinkPanel(linkPanel === "events" ? null : "events"); setLinkSearch(""); }}
          />
        </div>
      </div>

      {/* Link picker dropdown */}
      {linkPanel && (
        <div className="border-t border-border bg-surface-1 px-4 py-2">
          <input
            value={linkSearch}
            onChange={(e) => setLinkSearch(e.target.value)}
            placeholder={`Search ${linkPanel}…`}
            autoFocus
            className="w-full text-xs bg-background border border-border rounded-md px-2.5 py-1.5 outline-none mb-2"
          />
          <div className="space-y-0.5 max-h-36 overflow-y-auto">
            {linkPanel === "tasks" && searchedTasks.map((t) => (
              <button
                key={t.id}
                onClick={() => { linkTask(t.id); setLinkPanel(null); }}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-accent transition-fast text-left",
                  note.linkedTaskIds.includes(t.id) && "opacity-40 pointer-events-none"
                )}
              >
                {t.status === "done"
                  ? <CheckCircle2 size={12} className="text-green-500 shrink-0" />
                  : <Circle size={12} className="text-muted-foreground shrink-0" />
                }
                <span className="flex-1 truncate">{t.title}</span>
                {note.linkedTaskIds.includes(t.id) && <span className="text-[10px] text-muted-foreground">linked</span>}
              </button>
            ))}
            {linkPanel === "projects" && searchedProjects.map((p) => (
              <button
                key={p.id}
                onClick={() => { linkProject(p.id); setLinkPanel(null); }}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-accent transition-fast text-left",
                  note.linkedProjectIds.includes(p.id) && "opacity-40 pointer-events-none"
                )}
              >
                <ProjectDot color={p.color} size={8} />
                <span className="flex-1 truncate">{p.name}</span>
                {note.linkedProjectIds.includes(p.id) && <span className="text-[10px] text-muted-foreground">linked</span>}
              </button>
            ))}
            {linkPanel === "events" && searchedEvents.map((e) => (
              <button
                key={e.id}
                onClick={() => { linkEvent(e.id); setLinkPanel(null); }}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-accent transition-fast text-left",
                  note.linkedEventIds.includes(e.id) && "opacity-40 pointer-events-none"
                )}
              >
                <Calendar size={11} className="text-muted-foreground shrink-0" />
                <span className="flex-1 truncate">{e.title}</span>
                <span className="text-[10px] text-muted-foreground/60 tabular-nums">{formatDate(e.startAt)}</span>
              </button>
            ))}
            {((linkPanel === "tasks" && searchedTasks.length === 0) ||
              (linkPanel === "projects" && searchedProjects.length === 0) ||
              (linkPanel === "events" && searchedEvents.length === 0)) && (
              <p className="text-xs text-muted-foreground/50 px-2 py-2">No results</p>
            )}
          </div>
        </div>
      )}

      {/* Tags */}
      {note.tags.length > 0 && (
        <div className="flex items-center gap-1.5 px-4 pb-2 flex-wrap">
          <Tag size={11} className="text-muted-foreground/50 shrink-0" />
          {note.tags.map((tag) => (
            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function LinkedChip({
  label, icon, onOpen, onRemove,
}: {
  label: string; icon: React.ReactNode; onOpen: () => void; onRemove: () => void;
}) {
  return (
    <span className="group flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-border bg-muted/50 text-[10px] text-muted-foreground hover:border-primary/30 transition-fast">
      {icon}
      <button onClick={onOpen} className="hover:text-foreground transition-fast truncate max-w-[80px]">
        {label}
      </button>
      <button onClick={onRemove} className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-fast">
        <X size={9} />
      </button>
    </span>
  );
}

function LinkButton({
  icon, label, active, onClick,
}: {
  icon: React.ReactNode; label: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        "p-1.5 rounded transition-fast",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-accent"
      )}
    >
      {icon}
    </button>
  );
}
