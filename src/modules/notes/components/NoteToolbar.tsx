// ============================================================
// NOTES — NoteToolbar
// Title editor + linked chips row + toolbar actions.
// ============================================================

import { useState, useRef, useEffect } from "react";
import {
  Tag, Link2, MoreHorizontal, X,
  CheckCircle2, Circle, Calendar,
} from "lucide-react";
import { cn } from "@/shared/utils";
import { useNoteStore } from "../store";
import { useTaskStore } from "@/modules/tasks/store";
import { useProjectStore } from "@/modules/projects/store";
import { useCalendarStore } from "@/modules/calendar/store";
import { ProjectDot } from "@/shared/ui";
import { bus } from "@/kernel/event-bus";
import type { Note } from "@/shared/types";

interface NoteToolbarProps { note: Note; }

// ── Small linked chip ───────────────────────────────────────
function LinkedChip({
  label, icon, onOpen, onRemove,
}: {
  label: string;
  icon: React.ReactNode;
  onOpen: () => void;
  onRemove: () => void;
}) {
  return (
    <span className="group/chip inline-flex items-center gap-1 pl-1.5 pr-0.5 py-0.5 rounded-full text-[11px] bg-muted/70 border border-border/60 text-muted-foreground hover:text-foreground transition-fast max-w-[160px]">
      {icon}
      <button
        onClick={onOpen}
        className="truncate hover:text-primary transition-fast"
        title={label}
      >
        {label}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="opacity-0 group-hover/chip:opacity-100 p-0.5 rounded-full hover:bg-muted transition-fast shrink-0"
        aria-label="Unlink"
      >
        <X size={9} />
      </button>
    </span>
  );
}

// ── Main toolbar ────────────────────────────────────────────
export function NoteToolbar({ note }: NoteToolbarProps) {
  const { updateNote, deleteNote, closeNote } = useNoteStore();
  const tasks    = useTaskStore((s) => s.tasks);
  const projects = useProjectStore((s) => s.projects);
  const events   = useCalendarStore((s) => s.events);

  const linkedTasks    = tasks.filter((t)    => note.linkedTaskIds.includes(t.id));
  const linkedProjects = projects.filter((p) => note.linkedProjectIds?.includes(p.id));
  const linkedEvents   = events.filter((e)   => note.linkedEventIds?.includes(e.id));

  const [title,      setTitle]      = useState(note.title);
  const [tagInput,   setTagInput]   = useState("");
  const [linkOpen,   setLinkOpen]   = useState(false);
  const [linkSearch, setLinkSearch] = useState("");
  const [linkTab,    setLinkTab]    = useState<"tasks" | "projects">("tasks");
  const [menuOpen,   setMenuOpen]   = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const menuRef  = useRef<HTMLDivElement>(null);

  useEffect(() => { setTitle(note.title); }, [note.id, note.title]);

  useEffect(() => {
    if (!menuOpen) return;
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [menuOpen]);

  const saveTitle = () => {
    const t = title.trim() || "Untitled";
    if (t !== note.title) void updateNote(note.id, { title: t });
  };

  const addTag = (tag: string) => {
    const t = tag.trim().toLowerCase();
    if (!t || note.tags.includes(t)) return;
    void updateNote(note.id, { tags: [...note.tags, t] });
    setTagInput("");
  };

  const removeTag     = (tag: string)       => void updateNote(note.id, { tags: note.tags.filter((x) => x !== tag) });
  const unlinkTask    = (taskId: string)    => void updateNote(note.id, { linkedTaskIds:    note.linkedTaskIds.filter((id) => id !== taskId) });
  const unlinkProject = (projectId: string) => void updateNote(note.id, { linkedProjectIds: (note.linkedProjectIds ?? []).filter((id) => id !== projectId) });
  const unlinkEvent   = (eventId: string)   => void updateNote(note.id, { linkedEventIds:   (note.linkedEventIds ?? []).filter((id) => id !== eventId) });

  const linkTask = (taskId: string) => {
    if (note.linkedTaskIds.includes(taskId)) return;
    void updateNote(note.id, { linkedTaskIds: [...note.linkedTaskIds, taskId] });
    bus.emit("note:link-to-task", { noteId: note.id, taskId });
    setLinkOpen(false);
  };

  const linkProject = (projectId: string) => {
    if (note.linkedProjectIds?.includes(projectId)) return;
    void updateNote(note.id, { linkedProjectIds: [...(note.linkedProjectIds ?? []), projectId] });
    setLinkOpen(false);
  };

  const filteredTasks    = tasks.filter((t)    => t.title.toLowerCase().includes(linkSearch.toLowerCase())).slice(0, 8);
  const filteredProjects = projects.filter((p) => p.name.toLowerCase().includes(linkSearch.toLowerCase())).slice(0, 8);

  return (
    <div className="flex flex-col border-b border-border shrink-0">

      {/* Title + actions row */}
      <div className="flex items-center gap-2 px-4 py-2">
        <input
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); titleRef.current?.blur(); } }}
          className="flex-1 bg-transparent text-[15px] font-semibold outline-none placeholder:text-muted-foreground/30 min-w-0"
          placeholder="Untitled"
        />

        {/* Link button */}
        <div className="relative">
          <button
            onClick={() => { setLinkOpen((v) => !v); setLinkSearch(""); setLinkTab("tasks"); }}
            className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-muted/60 transition-fast"
            title="Link task or project"
          >
            <Link2 size={13} />
          </button>

          {linkOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setLinkOpen(false)} />
              <div className="absolute right-0 top-full mt-1.5 z-50 w-64 rounded-xl border border-border bg-popover shadow-xl overflow-hidden">
                {/* Tabs */}
                <div className="flex border-b border-border">
                  {(["tasks", "projects"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => { setLinkTab(tab); setLinkSearch(""); }}
                      className={cn(
                        "flex-1 py-2 text-[11px] font-semibold capitalize transition-fast",
                        linkTab === tab ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {/* Search */}
                <div className="px-3 pt-2.5 pb-1.5">
                  <input
                    autoFocus
                    value={linkSearch}
                    onChange={(e) => setLinkSearch(e.target.value)}
                    placeholder={`Search ${linkTab}…`}
                    className="w-full text-[12px] bg-muted/50 rounded-lg px-3 py-1.5 outline-none placeholder:text-muted-foreground/40"
                  />
                </div>

                {/* Results */}
                <div className="max-h-48 overflow-y-auto py-1">
                  {linkTab === "tasks" && (
                    filteredTasks.length === 0
                      ? <p className="px-4 py-3 text-[11px] text-muted-foreground/40">No tasks found</p>
                      : filteredTasks.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => linkTask(t.id)}
                            className={cn(
                              "w-full flex items-center gap-2 px-3 py-[7px] text-[12px] hover:bg-accent transition-fast text-left",
                              note.linkedTaskIds.includes(t.id) && "opacity-40 pointer-events-none"
                            )}
                          >
                            {t.status === "done"
                              ? <CheckCircle2 size={11} className="text-green-500 shrink-0" />
                              : <Circle size={11} className="text-muted-foreground/40 shrink-0" />}
                            <span className="flex-1 truncate">{t.title}</span>
                            {note.linkedTaskIds.includes(t.id) && (
                              <span className="text-[10px] text-muted-foreground">linked</span>
                            )}
                          </button>
                        ))
                  )}
                  {linkTab === "projects" && (
                    filteredProjects.length === 0
                      ? <p className="px-4 py-3 text-[11px] text-muted-foreground/40">No projects found</p>
                      : filteredProjects.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => linkProject(p.id)}
                            className={cn(
                              "w-full flex items-center gap-2 px-3 py-[7px] text-[12px] hover:bg-accent transition-fast text-left",
                              note.linkedProjectIds?.includes(p.id) && "opacity-40 pointer-events-none"
                            )}
                          >
                            <ProjectDot color={p.color} size={7} />
                            <span className="flex-1 truncate">{p.name}</span>
                            {note.linkedProjectIds?.includes(p.id) && (
                              <span className="text-[10px] text-muted-foreground">linked</span>
                            )}
                          </button>
                        ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* More menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-muted/60 transition-fast"
          >
            <MoreHorizontal size={13} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1.5 z-50 w-44 rounded-xl border border-border bg-popover shadow-xl py-1.5">
              <button
                onClick={() => { void deleteNote(note.id); closeNote(); setMenuOpen(false); }}
                className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-500/10 transition-fast"
              >
                Delete note
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Link chips row */}
      <div className="flex items-center gap-1.5 px-4 pb-2.5 flex-wrap">

        {/* Linked tasks — opens TaskDetail modal in-place, no navigation to /tasks */}
        {linkedTasks.map((t) => (
          <LinkedChip
            key={t.id}
            label={t.title}
            icon={t.status === "done"
              ? <CheckCircle2 size={10} className="text-green-500" />
              : <Circle size={10} />}
            onOpen={() => useTaskStore.getState().openTask(t.id)}
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

        {/* Tags */}
        {note.tags.map((tag) => (
          <span key={tag} className="group/tag inline-flex items-center gap-1 pl-2 pr-0.5 py-0.5 rounded-full text-[11px] bg-primary/8 text-primary/70 border border-primary/20">
            <Tag size={9} />
            {tag}
            <button
              onClick={() => removeTag(tag)}
              className="opacity-0 group-hover/tag:opacity-100 p-0.5 rounded-full hover:bg-primary/10 transition-fast"
            >
              <X size={9} />
            </button>
          </span>
        ))}

        {/* Add tag inline */}
        <form
          onSubmit={(e) => { e.preventDefault(); addTag(tagInput); }}
          className="inline-flex items-center"
        >
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onBlur={() => { if (tagInput.trim()) addTag(tagInput); }}
            placeholder="+ tag"
            className="w-12 text-[11px] bg-transparent outline-none placeholder:text-muted-foreground/25 text-muted-foreground focus:w-20 transition-all duration-150"
          />
        </form>
      </div>
    </div>
  );
}
