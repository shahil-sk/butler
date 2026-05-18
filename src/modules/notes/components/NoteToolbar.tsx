// ============================================================
// NOTES — NoteToolbar  (redesign v2)
// Inline title editor + meta row (tags, links) + action menu
// ============================================================

import { useState, useRef, useEffect } from "react";
import {
  Tag, Link2, MoreHorizontal, X, Trash2, Pin,
  CheckCircle2, Circle, Calendar, Hash,
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

// ── Linked chip pill ──────────────────────────────────────────
function LinkedChip({ label, icon, onOpen, onRemove }: {
  label: string;
  icon: React.ReactNode;
  onOpen: () => void;
  onRemove: () => void;
}) {
  return (
    <span
      className="group/chip inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-[11px] font-medium transition-colors max-w-[160px]"
      style={{
        background: "hsl(var(--muted) / 0.7)",
        border: "1px solid hsl(var(--border) / 0.7)",
        color: "hsl(var(--muted-foreground))",
      }}
    >
      {icon}
      <button
        onClick={onOpen}
        className="truncate transition-colors"
        title={label}
        style={{ color: "inherit" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "hsl(var(--primary))")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "inherit")}
      >
        {label}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="opacity-0 group-hover/chip:opacity-100 w-4 h-4 flex items-center justify-center rounded-full transition-all shrink-0"
        style={{ color: "hsl(var(--muted-foreground))" }}
        aria-label="Unlink"
        onMouseEnter={(e) => (e.currentTarget.style.background = "hsl(var(--muted))")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <X size={9} />
      </button>
    </span>
  );
}

// ── Tag chip pill ─────────────────────────────────────────────
function TagChip({ tag, onRemove }: { tag: string; onRemove: () => void }) {
  return (
    <span
      className="group/tag inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-[11px] font-medium"
      style={{
        background: "hsl(var(--primary) / 0.08)",
        border: "1px solid hsl(var(--primary) / 0.18)",
        color: "hsl(var(--primary) / 0.8)",
      }}
    >
      <Hash size={9} />
      {tag}
      <button
        onClick={onRemove}
        className="opacity-0 group-hover/tag:opacity-100 w-4 h-4 flex items-center justify-center rounded-full transition-all shrink-0"
        aria-label="Remove tag"
        onMouseEnter={(e) => (e.currentTarget.style.background = "hsl(var(--primary) / 0.12)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <X size={9} />
      </button>
    </span>
  );
}

// ── Toolbar action button ─────────────────────────────────────
function ToolbarBtn({
  children, title, danger = false, onClick,
}: {
  children: React.ReactNode;
  title?: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-7 h-7 flex items-center justify-center rounded-md transition-colors shrink-0"
      style={{ color: danger ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger
          ? "hsl(var(--destructive) / 0.08)"
          : "hsl(var(--accent))";
        e.currentTarget.style.color = danger
          ? "hsl(var(--destructive))"
          : "hsl(var(--foreground))";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = danger
          ? "hsl(var(--destructive))"
          : "hsl(var(--muted-foreground))";
      }}
    >
      {children}
    </button>
  );
}

// ── Main toolbar ──────────────────────────────────────────────
export function NoteToolbar({ note }: NoteToolbarProps) {
  const { updateNote, deleteNote, closeNote } = useNoteStore();
  const tasks    = useTaskStore((s) => s.tasks);
  const projects = useProjectStore((s) => s.projects);
  const events   = useCalendarStore((s) => s.events);

  const linkedTasks    = tasks.filter((t)    => note.linkedTaskIds.includes(t.id));
  const linkedProjects = projects.filter((p) => note.linkedProjectIds?.includes(p.id));
  const linkedEvents   = events.filter((e)   => note.linkedEventIds?.includes(e.id));

  const hasLinks = linkedTasks.length > 0 || linkedProjects.length > 0 || linkedEvents.length > 0;
  const hasTags  = note.tags.length > 0;

  const [title,      setTitle]      = useState(note.title);
  const [tagInput,   setTagInput]   = useState("");
  const [linkOpen,   setLinkOpen]   = useState(false);
  const [linkSearch, setLinkSearch] = useState("");
  const [linkTab,    setLinkTab]    = useState<"tasks" | "projects">("tasks");
  const [menuOpen,   setMenuOpen]   = useState(false);
  const titleRef  = useRef<HTMLInputElement>(null);
  const menuRef   = useRef<HTMLDivElement>(null);
  const linkBtnRef = useRef<HTMLButtonElement>(null);

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
    const t = tag.trim().toLowerCase().replace(/^#+/, "");
    if (!t || note.tags.includes(t)) return;
    void updateNote(note.id, { tags: [...note.tags, t] });
    setTagInput("");
  };

  const removeTag     = (tag: string)       => void updateNote(note.id, { tags: note.tags.filter((x) => x !== tag) });
  const unlinkTask    = (id: string)         => void updateNote(note.id, { linkedTaskIds:    note.linkedTaskIds.filter((x) => x !== id) });
  const unlinkProject = (id: string)         => void updateNote(note.id, { linkedProjectIds: (note.linkedProjectIds ?? []).filter((x) => x !== id) });
  const unlinkEvent   = (id: string)         => void updateNote(note.id, { linkedEventIds:   (note.linkedEventIds ?? []).filter((x) => x !== id) });

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
    <div
      className="flex flex-col shrink-0 border-b"
      style={{ borderColor: "hsl(var(--border))" }}
    >
      {/* ── Title + actions row ──────────────────────────── */}
      <div className="flex items-center gap-2 px-6 pt-4 pb-1">
        <input
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); titleRef.current?.blur(); } }}
          className="flex-1 bg-transparent text-[17px] font-semibold outline-none min-w-0"
          style={{
            color: "hsl(var(--foreground))",
          }}
          placeholder="Untitled"
        />

        <div className="flex items-center gap-0.5 shrink-0">
          {/* Pin */}
          <ToolbarBtn
            title={note.isPinned ? "Unpin" : "Pin"}
            onClick={() => void updateNote(note.id, { isPinned: !note.isPinned })}
          >
            <Pin size={13} style={{ fill: note.isPinned ? "currentColor" : "none" }} />
          </ToolbarBtn>

          {/* Link */}
          <div className="relative">
            <ToolbarBtn
              title="Link to task or project"
              onClick={() => { setLinkOpen((v) => !v); setLinkSearch(""); setLinkTab("tasks"); }}
            >
              <Link2 size={13} />
            </ToolbarBtn>

            {linkOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setLinkOpen(false)} />
                <div
                  className="absolute right-0 top-full mt-1.5 z-50 w-64 overflow-hidden rounded-xl shadow-xl"
                  style={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                  }}
                >
                  {/* Tabs */}
                  <div className="flex border-b" style={{ borderColor: "hsl(var(--border))" }}>
                    {(["tasks", "projects"] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => { setLinkTab(tab); setLinkSearch(""); }}
                        className="flex-1 py-2 text-[11px] font-semibold capitalize transition-colors"
                        style={{
                          color: linkTab === tab ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                          borderBottom: linkTab === tab ? "2px solid hsl(var(--primary))" : "2px solid transparent",
                        }}
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
                      className="w-full text-[12px] rounded-md px-2.5 py-1.5 outline-none"
                      style={{
                        background: "hsl(var(--muted) / 0.6)",
                        color: "hsl(var(--foreground))",
                      }}
                    />
                  </div>
                  {/* Results */}
                  <div className="max-h-48 overflow-y-auto py-1">
                    {linkTab === "tasks" && (
                      filteredTasks.length === 0
                        ? <p className="px-4 py-3 text-[11px]" style={{ color: "hsl(var(--muted-foreground) / 0.5)" }}>No tasks found</p>
                        : filteredTasks.map((t) => (
                            <button
                              key={t.id}
                              onClick={() => linkTask(t.id)}
                              className={cn(
                                "w-full flex items-center gap-2 px-3 py-2 text-[12px] text-left transition-colors",
                                note.linkedTaskIds.includes(t.id) && "opacity-40 pointer-events-none"
                              )}
                              style={{ color: "hsl(var(--foreground))" }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "hsl(var(--accent))")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            >
                              {t.status === "done"
                                ? <CheckCircle2 size={11} style={{ color: "hsl(142 65% 44%)", flexShrink: 0 }} />
                                : <Circle       size={11} style={{ color: "hsl(var(--muted-foreground) / 0.4)", flexShrink: 0 }} />}
                              <span className="flex-1 truncate">{t.title}</span>
                              {note.linkedTaskIds.includes(t.id) && (
                                <span style={{ color: "hsl(var(--muted-foreground))", fontSize: 10 }}>linked</span>
                              )}
                            </button>
                          ))
                    )}
                    {linkTab === "projects" && (
                      filteredProjects.length === 0
                        ? <p className="px-4 py-3 text-[11px]" style={{ color: "hsl(var(--muted-foreground) / 0.5)" }}>No projects found</p>
                        : filteredProjects.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => linkProject(p.id)}
                              className={cn(
                                "w-full flex items-center gap-2 px-3 py-2 text-[12px] text-left transition-colors",
                                note.linkedProjectIds?.includes(p.id) && "opacity-40 pointer-events-none"
                              )}
                              style={{ color: "hsl(var(--foreground))" }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "hsl(var(--accent))")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            >
                              <ProjectDot color={p.color} size={7} />
                              <span className="flex-1 truncate">{p.name}</span>
                              {note.linkedProjectIds?.includes(p.id) && (
                                <span style={{ color: "hsl(var(--muted-foreground))", fontSize: 10 }}>linked</span>
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
            <ToolbarBtn title="More options" onClick={() => setMenuOpen((v) => !v)}>
              <MoreHorizontal size={13} />
            </ToolbarBtn>
            {menuOpen && (
              <div
                className="absolute right-0 top-full mt-1.5 z-50 w-44 rounded-xl py-1.5 shadow-xl"
                style={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                }}
              >
                <button
                  onClick={() => { void deleteNote(note.id); closeNote(); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors"
                  style={{ color: "hsl(var(--destructive))" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "hsl(var(--destructive) / 0.08)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <Trash2 size={12} /> Delete note
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Meta row (tags + links) ───────────────────────── */}
      {(hasLinks || hasTags || true) && (
        <div className="flex items-center gap-1.5 flex-wrap px-6 pb-3 pt-1 min-h-0">

          {/* Linked tasks */}
          {linkedTasks.map((t) => (
            <LinkedChip
              key={t.id}
              label={t.title}
              icon={t.status === "done"
                ? <CheckCircle2 size={10} style={{ color: "hsl(142 65% 44%)" }} />
                : <Circle       size={10} />}
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
            <TagChip key={tag} tag={tag} onRemove={() => removeTag(tag)} />
          ))}

          {/* Add tag inline */}
          <form
            onSubmit={(e) => { e.preventDefault(); addTag(tagInput); }}
            className="inline-flex items-center gap-1"
          >
            <Tag size={9} style={{ color: "hsl(var(--muted-foreground) / 0.3)" }} />
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onBlur={() => { if (tagInput.trim()) addTag(tagInput); }}
              placeholder="Add tag…"
              className="text-[11px] bg-transparent outline-none transition-all duration-150"
              style={{
                width: tagInput ? "5rem" : "3.5rem",
                color: "hsl(var(--muted-foreground) / 0.5)",
              }}
            />
          </form>
        </div>
      )}
    </div>
  );
}
