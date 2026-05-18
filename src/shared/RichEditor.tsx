// ============================================================
// SHARED — RichEditor
// Generic Tiptap editor. No store coupling.
//
// Props:
//   content      — Tiptap JSON string or plain text
//   onChange     — called with JSON string (debounced)
//   placeholder  — editor placeholder text
//   debounceMs   — debounce delay, default 800
//   minHeight    — editor min height class, default "min-h-[200px]"
//   showToolbar  — show formatting toolbar, default true
//   borderless   — removes outer border (Notes: NoteToolbar provides chrome)
//   className    — wrapper class
//   resetKey     — resets editor content when changed (e.g. note.id)
//
// Used by:
//   Notes    → NoteEditor.tsx (borderless, full height)
//   Journal  → EntryEditor in index.tsx
//   Focus    → SessionNotesArea in index.tsx
// ============================================================

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import { useEffect, useCallback, useRef } from "react";
import { cn } from "@/shared/utils";
import type { Editor } from "@tiptap/react";

// ── Toolbar ───────────────────────────────────────────────────────────────────

function ToolbarBtn({
  onClick, active, title, children,
}: {
  onClick: () => void; active?: boolean; title: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className={cn(
        "flex items-center justify-center px-1.5 py-1 rounded text-xs font-medium transition-fast select-none",
        active
          ? "bg-primary/[0.08] text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-accent"
      )}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div className="w-px h-3.5 bg-border mx-0.5 shrink-0" />;
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex items-center gap-0.5 px-2 py-1 border-b border-border bg-background shrink-0 flex-wrap">
      <ToolbarBtn title="Heading 1" active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</ToolbarBtn>
      <ToolbarBtn title="Heading 2" active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</ToolbarBtn>
      <ToolbarBtn title="Heading 3" active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</ToolbarBtn>
      <Sep />
      <ToolbarBtn title="Bold" active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}><strong>B</strong></ToolbarBtn>
      <ToolbarBtn title="Italic" active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}><em>I</em></ToolbarBtn>
      <ToolbarBtn title="Strikethrough" active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}><s>S</s></ToolbarBtn>
      <ToolbarBtn title="Inline code" active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}>
        <span className="font-mono text-[11px]">`c`</span>
      </ToolbarBtn>
      <Sep />
      <ToolbarBtn title="Bullet list" active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}>• List</ToolbarBtn>
      <ToolbarBtn title="Numbered list" active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. List</ToolbarBtn>
      <ToolbarBtn title="Task list" active={editor.isActive("taskList")}
        onClick={() => editor.chain().focus().toggleTaskList().run()}>☑ Tasks</ToolbarBtn>
      <Sep />
      <ToolbarBtn title="Blockquote" active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}>" Quote</ToolbarBtn>
      <ToolbarBtn title="Code block" active={editor.isActive("codeBlock")}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
        <span className="font-mono text-[11px]">{"</>"}</span>
      </ToolbarBtn>
      <ToolbarBtn title="Horizontal rule"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}>― Rule</ToolbarBtn>
      <Sep />
      <ToolbarBtn title="Undo" onClick={() => editor.chain().focus().undo().run()}>↩</ToolbarBtn>
      <ToolbarBtn title="Redo" onClick={() => editor.chain().focus().redo().run()}>↪</ToolbarBtn>
    </div>
  );
}

// ── Debounce hook ─────────────────────────────────────────────────────────────

function useDebounced<T extends (...args: Parameters<T>) => void>(fn: T, ms: number): T {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  return useCallback(
    ((...args: Parameters<T>) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => fnRef.current(...args), ms);
    }) as T,
    [ms]
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseContent(raw: string): object | string {
  if (!raw || raw === "{}") return "";
  try { return JSON.parse(raw); } catch { return raw; }
}

// ── RichEditor ────────────────────────────────────────────────────────────────

export interface RichEditorProps {
  content:      string;
  onChange:     (jsonString: string) => void;
  placeholder?: string;
  debounceMs?:  number;
  minHeight?:   string;
  showToolbar?: boolean;
  /** Remove outer border — use when host provides chrome (Notes, etc.) */
  borderless?:  boolean;
  className?:   string;
  resetKey?:    string;
}

export function RichEditor({
  content,
  onChange,
  placeholder = "Write something…",
  debounceMs  = 800,
  minHeight   = "min-h-[200px]",
  showToolbar = true,
  borderless  = false,
  className,
  resetKey,
}: RichEditorProps) {
  const debouncedOnChange = useDebounced(onChange, debounceMs);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading:   { levels: [1, 2, 3] },
        codeBlock: { languageClassPrefix: "language-" },
      }),
      Placeholder.configure({
        placeholder: ({ node }) =>
          node.type.name === "heading" ? "Heading…" : placeholder,
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
          // headings
          "prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-foreground",
          // inline code
          "prose-code:before:content-none prose-code:after:content-none",
          "prose-code:bg-muted prose-code:text-foreground prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-[0.8em] prose-code:font-mono",
          // code blocks
          "prose-pre:bg-muted prose-pre:text-foreground prose-pre:rounded-lg prose-pre:border prose-pre:border-border",
          // blockquote
          "prose-blockquote:border-l-primary/40 prose-blockquote:text-muted-foreground prose-blockquote:not-italic",
          // links
          "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
          // paragraph
          "prose-p:text-foreground prose-p:leading-relaxed",
          // lists
          "prose-li:text-foreground",
          // hr
          "prose-hr:border-border",
          minHeight,
          "px-6 py-4"
        ),
      },
    },
  });

  // Reset content when resetKey changes (switching notes / journal entries)
  useEffect(() => {
    if (!editor || !resetKey) return;
    editor.commands.setContent(parseContent(content));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  return (
    <div className={cn(
      "flex flex-col bg-background",
      !borderless && "border border-border rounded-lg overflow-hidden",
      borderless  && "overflow-hidden",
      className
    )}>
      {showToolbar && editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} className="flex-1" />
    </div>
  );
}
