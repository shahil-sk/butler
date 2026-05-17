// ============================================================
// SHARED — RichEditor
// Generic Tiptap editor. No store coupling.
// Usage:
//   <RichEditor
//     content={entry.content}        // Tiptap JSON string or plain text
//     onChange={(json) => save(json)} // debounced by caller or internally
//     placeholder="Write something…"
//     debounceMs={800}               // default 800
//     className=""
//   />
//
// Used by: Journal (EntryEditor), Focus (SessionNotesArea), Notes (NoteEditor)
// NoteEditor can be kept as-is or migrated to this — both work.
// ============================================================

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import { useEffect, useCallback, useRef } from "react";
import { cn } from "@/shared/utils";

// ── Toolbar ───────────────────────────────────────────────────────────────────

import type { Editor } from "@tiptap/react";

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault(); // keep editor focus
        onClick();
      }}
      title={title}
      className={cn(
        "px-2 py-1 rounded text-xs font-medium transition-colors select-none",
        active
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border flex-wrap">
      {/* Headings */}
      <ToolbarButton
        title="Heading 1"
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >H1</ToolbarButton>
      <ToolbarButton
        title="Heading 2"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >H2</ToolbarButton>
      <ToolbarButton
        title="Heading 3"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >H3</ToolbarButton>

      <div className="w-px h-4 bg-border mx-1" />

      {/* Inline */}
      <ToolbarButton
        title="Bold"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      ><strong>B</strong></ToolbarButton>
      <ToolbarButton
        title="Italic"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      ><em>I</em></ToolbarButton>
      <ToolbarButton
        title="Strikethrough"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      ><s>S</s></ToolbarButton>
      <ToolbarButton
        title="Code"
        active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >{"`c`"}</ToolbarButton>

      <div className="w-px h-4 bg-border mx-1" />

      {/* Lists */}
      <ToolbarButton
        title="Bullet list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >• List</ToolbarButton>
      <ToolbarButton
        title="Numbered list"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >1. List</ToolbarButton>
      <ToolbarButton
        title="Task list"
        active={editor.isActive("taskList")}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
      >☑ Tasks</ToolbarButton>

      <div className="w-px h-4 bg-border mx-1" />

      {/* Blocks */}
      <ToolbarButton
        title="Blockquote"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >" Quote</ToolbarButton>
      <ToolbarButton
        title="Code block"
        active={editor.isActive("codeBlock")}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >{"</>"}</ToolbarButton>

      <div className="w-px h-4 bg-border mx-1" />

      {/* History */}
      <ToolbarButton
        title="Undo"
        onClick={() => editor.chain().focus().undo().run()}
      >↩</ToolbarButton>
      <ToolbarButton
        title="Redo"
        onClick={() => editor.chain().focus().redo().run()}
      >↪</ToolbarButton>
    </div>
  );
}

// ── Debounce ──────────────────────────────────────────────────────────────────

function useDebounce<T extends (...args: Parameters<T>) => void>(fn: T, ms: number): T {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback(
    ((...args: Parameters<T>) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => fn(...args), ms);
    }) as T,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fn, ms]
  );
}

// ── RichEditor ────────────────────────────────────────────────────────────────

export interface RichEditorProps {
  /** Tiptap JSON string, or plain text fallback */
  content: string;
  /** Called with JSON string on every change (debounced by debounceMs) */
  onChange: (jsonString: string) => void;
  placeholder?: string;
  /** Debounce delay in ms. Default: 800 */
  debounceMs?: number;
  /** Min height of editor content area. Default: min-h-[200px] */
  minHeight?: string;
  /** Show the formatting toolbar. Default: true */
  showToolbar?: boolean;
  className?: string;
  /** Key that resets the editor when it changes (e.g. entry.id) */
  resetKey?: string;
}

export function RichEditor({
  content,
  onChange,
  placeholder = "Write something…",
  debounceMs = 800,
  minHeight = "min-h-[200px]",
  showToolbar = true,
  className,
  resetKey,
}: RichEditorProps) {
  const debouncedOnChange = useDebounce(onChange, debounceMs);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading:   { levels: [1, 2, 3] },
        codeBlock: { languageClassPrefix: "language-" },
      }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === "heading") return "Heading…";
          return placeholder;
        },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false }),
    ],
    content: parseContent(content),
    onUpdate: ({ editor }) => {
      debouncedOnChange(JSON.stringify(editor.getJSON()));
    },
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm dark:prose-invert max-w-none outline-none",
          minHeight,
          "px-4 py-3"
        ),
      },
    },
  });

  // Sync content when resetKey changes (switching entries/sessions)
  useEffect(() => {
    if (!editor) return;
    const incoming = parseContent(content);
    const current  = JSON.stringify(editor.getJSON());
    if (JSON.stringify(incoming) !== current) {
      editor.commands.setContent(incoming);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  return (
    <div className={cn("flex flex-col border border-border rounded-lg overflow-hidden bg-background", className)}>
      {showToolbar && editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} className="flex-1" />
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseContent(raw: string): object | string {
  if (!raw || raw === "{}") return "";
  try { return JSON.parse(raw); } catch { return raw; }
}
