// ============================================================
// NOTES — NoteToolbar  (journal redesign)
// Big title + subtle divider + meta row.
// Full dark/light support via hsl(var(--*)) tokens.
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

// ── Tiny toolbar icon button ───────────────────────────────────
function TBtn({
  children, title, danger = false, active = false, onClick,
}: {
  children: React.ReactNode;
  title?: string;
  danger?: boolean;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-7 h-7 flex items-center justify-center rounded-md transition-fast shrink-0"
      style={{
        color: danger
          ? "hsl(var(--destructive))"
          : active
            ? "hsl(var(--primary))"
            : "hsl(var(--muted-foreground))",
        background: active ? "hsl(var(--primary) / 0.10)" : "transparent",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger
          ? "hsl(var(--destructive) / 0.10)"
          : "hsl(var(--accent))";
        e.currentTarget.style.color = danger
          ? "hsl(var(--destructive))"
          : "hsl(var(--foreground))";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = active ? "hsl(var(--primary) / 0.10)" : "transparent";
        e.currentTarget.style.color = danger
          ? "hsl(var(--destructive))"
          : active ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))";
      }}
    >
      {children}
    </button>
  );
}

// ── Linked-entity chip ─────────────────────────────────────────
function LinkedChip({ label, icon, onOpen, onRemove }: {
  label: string;
  icon: React.ReactNode;
  onOpen: () => void;
  onRemove: () => void;
}) {
  return (
    <span
      className="group/chip inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-[11px] font-medium max-w-[160px] transition-fast"
      style={{
        background: "hsl(var(--muted) / 0.6)",
        border: "1px solid hsl(var(--border))",
        color: "hsl(var(--muted-foreground))",
      }}
    >
      {icon}
      <button
        onClick={onOpen}
        className="truncate transition-fast"
        title={label}
        onMouseEnter={(e) => (e.currentTarget.style.color = "hsl(var(--primary))")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "hsl(var(--muted-foreground))")}
      >
        {label}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="opacity-0 group-hover/chip:opacity-100 w-4 h-4 flex items-center justify-center rounded-full transition-fast shrink-0"
        style={{ color: "hsl(var(--muted-foreground))" }}
        aria-label="Unlink"
        onMouseEnter={(e) => (e.currentTarget.style.background = "hsl(var(--accent))")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <X size={9} />
      </button>
    </span>
  );
}

// ── Tag chip ───────────────────────────────────────────────────
function TagChip({ tag, onRemove }: { tag: string; onRemove: () => void }) {
  return (
    <span
      className="group/tag inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full text-[11px] font-medium transition-fast"
      style={{
        background: "hsl(var(--primary) / 0.08)",
        border: "1px solid hsl(var(--primary) / 0.20)",
        color: "hsl(var(--primary))",
      }}
    >
      <Hash size={9} />
      {tag}
      <button
        onClick={onRemove}
        className="opacity-0 group-hover/tag:opacity-100 w-4 h-4 flex items-center justify-center rounded-full transition-fast shrink-0"
        aria-label="Remove tag"
        onMouseEnter={(e) => (e.currentTarget.style.background = "hsl(var(--primary) / 0.12)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <X size={9} />
      </button>
    </span>
  );
}

// ── Link popup ────────────────────────────────────────────────
function LinkPopup({
  note, tasks, projects, onLinkTask, onLinkProject, onClose,
}: {
  note: Note;
  tasks: ReturnType<typeof useTaskStore.getState>["tasks"];
  projects: ReturnType<typeof useProjectStore.getState>["projects"];
  onLinkTask: (id: string) => void;
  onLinkProject: (id: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"tasks" | "projects">("tasks");
  const [q,   setQ]   = useState("");

  const filteredTasks    = tasks.filter((t)    => t.title.toLowerCase().includes(q.toLowerCase())).slice(0, 8);
  const filteredProjects = projects.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8);

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="absolute right-0 top-full mt-1.5 z-50 w-60 rounded-xl overflow-hidden"
        style={{
          background: "hsl(var(--popover))",
          border: "1px solid hsl(var(--border))",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        {/* Tabs */}
        <div
          className="flex"
          style={{ borderBottom: "1px solid hsl(var(--border))" }}
        >
          {(["tasks", "projects"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setQ(""); }}
              className="flex-1 py-2 text-[11px] font-semibold capitalize transition-fast"
              style={{
                color: tab === t ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                borderBottom: tab === t
                  ? "2px solid hsl(var(--primary))"
                  : "2px solid transparent",
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="px-3 pt-2.5 pb-1.5">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${tab}…`}
            className="w-full text-[12px] rounded-md px-2.5 py-1.5 outline-none"
            style={{
              background: "hsl(var(--muted) / 0.5)",
              color: "hsl(var(--foreground))",
            }}
          />
        </div>

        {/* Results */}
        <div className="max-h-44 overflow-y-auto py-1">
          {tab === "tasks" && (
            filteredTasks.length === 0
              ? <p className="px-4 py-3 text-[11px]" style={{ color: "hsl(var(--muted-foreground) / 0.5)" }}>No tasks</p>
              : filteredTasks.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onLinkTask(t.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 text-[12px] text-left transition-fast",
                      note.linkedTaskIds.includes(t.id) && "opacity-40 pointer-events-none"
                    )}
                    style={{ color: "hsl(var(--foreground))" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "hsl(var(--accent))")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    {t.status === "done"
                      ? <CheckCircle2 size={11} style={{ color: "hsl(var(--success))", flexShrink: 0 }} />
                      : <Circle       size={11} style={{ color: "hsl(var(--muted-foreground) / 0.4)", flexShrink: 0 }} />}
                    <span className="flex-1 truncate">{t.title}</span>
                    {note.linkedTaskIds.includes(t.id) && (
                      <span className="text-[10px]" style={{ color: "hsl(var(--muted-foreground))" }}>linked</span>
                    )}
                  </button>
                ))
          )}
          {tab === "projects" && (
            filteredProjects.length === 0
              ? <p className="px-4 py-3 text-[11px]" style={{ color: "hsl(var(--muted-foreground) / 0.5)" }}>No projects</p>
              : filteredProjects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onLinkProject(p.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 text-[12px] text-left transition-fast",
                      note.linkedProjectIds?.includes(p.id) && "opacity-40 pointer-events-none"
                    )}
                    style={{ color: "hsl(var(--foreground))" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "hsl(var(--accent))")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <ProjectDot color={p.color} size={7} />
                    <span className="flex-1 truncate">{p.name}</span>
                    {note.linkedProjectIds?.includes(p.id) && (
                      <span className="text-[10px]" style={{ color: "hsl(var(--muted-foreground))" }}>linked</span>
                    )}
                  </button>
                ))
          )}
        </div>
      </div>
    </>
  );
}

// ── Main toolbar ───────────────────────────────────────────────
export function NoteToolbar({ note }: NoteToolbarProps) {
  const { updateNote, deleteNote, closeNote } = useNoteStore();
  const tasks    = useTaskStore((s) => s.tasks);
  const projects = useProjectStore((s) => s.projects);
  const events   = useCalendarStore((s) => s.events);

  const linkedTasks    = tasks.filter((t)    => note.linkedTaskIds.includes(t.id));
  const linkedProjects = projects.filter((p) => note.linkedProjectIds?.includes(p.id));
  const linkedEvents   = events.filter((e)   => note.linkedEventIds?.includes(e.id));

  const [title,     setTitle]     = useState(note.title);
  const [tagInput,  setTagInput]  = useState("");
  const [linkOpen,  setLinkOpen]  = useState(false);
  const [menuOpen,  setMenuOpen]  = useState(false);

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

  const addTag = (raw: string) => {
    const t = raw.trim().toLowerCase().replace(/^#+/, "");
    if (!t || note.tags.includes(t)) return;
    void updateNote(note.id, { tags: [...note.tags, t] });
    setTagInput("");
  };

  const removeTag     = (tag: string) => void updateNote(note.id, { tags: note.tags.filter((x) => x !== tag) });
  const unlinkTask    = (id: string)  => void updateNote(note.id, { linkedTaskIds:    note.linkedTaskIds.filter((x) => x !== id) });
  const unlinkProject = (id: string)  => void updateNote(note.id, { linkedProjectIds: (note.linkedProjectIds ?? []).filter((x) => x !== id) });
  const unlinkEvent   = (id: string)  => void updateNote(note.id, { linkedEventIds:   (note.linkedEventIds ?? []).filter((x) => x !== id) });

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

  return (
    <div
      className="flex flex-col shrink-0"
      style={{ borderBottom: "1px solid hsl(var(--border))" }}
    >
      {/* ── Title row ──────────────────────────────────────── */}
      <div className="flex items-start gap-2 px-8 pt-7 pb-1">
        {/* Big journal-style title */}
        <input
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); titleRef.current?.blur(); }
          }}
          className="flex-1 bg-transparent outline-none min-w-0 font-semibold"
          style={{
            fontSize: "clamp(1.25rem, 2vw, 1.5rem)",
            lineHeight: 1.25,
            color: "hsl(var(--foreground))",
            caretColor: "hsl(var(--primary))",
          }}
          placeholder="Untitled"
        />

        {/* Action cluster */}
        <div className="flex items-center gap-0.5 mt-0.5 shrink-0">
          <TBtn
            title={note.isPinned ? "Unpin" : "Pin note"}
            active={note.isPinned}
            onClick={() => void updateNote(note.id, { isPinned: !note.isPinned })}
          >
            <Pin size={13} style={{ fill: note.isPinned ? "currentColor" : "none" }} />
          </TBtn>

          {/* Link picker */}
          <div className="relative">
            <TBtn title="Link task or project" onClick={() => setLinkOpen((v) => !v)}>
              <Link2 size={13} />
            </TBtn>
            {linkOpen && (
              <LinkPopup
                note={note}
                tasks={tasks}
                projects={projects}
                onLinkTask={linkTask}
                onLinkProject={linkProject}
                onClose={() => setLinkOpen(false)}
              />
            )}
          </div>

          {/* More menu */}
          <div className="relative" ref={menuRef}>
            <TBtn title="More" onClick={() => setMenuOpen((v) => !v)}>
              <MoreHorizontal size={13} />
            </TBtn>
            {menuOpen && (
              <div
                className="absolute right-0 top-full mt-1.5 z-50 w-40 rounded-xl py-1.5"
                style={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  boxShadow: "var(--shadow-lg)",
                }}
              >
                <button
                  onClick={() => { void deleteNote(note.id); closeNote(); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-fast"
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

      {/* ── Meta row: chips + tag input ─────────────────────── */}
      <div className="flex items-center gap-1.5 flex-wrap px-8 pb-3 pt-1.5 min-h-[2.25rem]">

        {/* Linked tasks */}
        {linkedTasks.map((t) => (
          <LinkedChip
            key={t.id}
            label={t.title}
            icon={t.status === "done"
              ? <CheckCircle2 size={10} style={{ color: "hsl(var(--success))" }} />
              : <Circle       size={10} style={{ color: "hsl(var(--muted-foreground))" }} />}
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

        {/* Inline tag input */}
        <form
          onSubmit={(e) => { e.preventDefault(); addTag(tagInput); }}
          className="inline-flex items-center gap-1"
        >
          <Tag size={9} style={{ color: "hsl(var(--muted-foreground) / 0.3)", flexShrink: 0 }} />
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onBlur={() => { if (tagInput.trim()) addTag(tagInput); }}
            placeholder="Add tag…"
            className="bg-transparent outline-none text-[11px] transition-fast"
            style={{
              width: tagInput ? "4.5rem" : "3rem",
              color: "hsl(var(--muted-foreground) / 0.5)",
            }}
          />
        </form>
      </div>

      {/* ── Thin ruled divider (journal feel) ──────────────── */}
      <div
        className="mx-8 mb-0"
        style={{
          height: 1,
          background: "linear-gradient(to right, hsl(var(--border)), hsl(var(--border) / 0.2))",
        }}
      />
    </div>
  );
}
