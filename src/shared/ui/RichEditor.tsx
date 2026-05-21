// ============================================================
// SHARED — RichEditor
// Full markdown-aware Tiptap editor with:
//  - markdown input rules (StarterKit ships these by default)
//  - markdown paste (via handlePaste interceptor)
//  - typography extension (smart quotes, dashes, ellipsis)
//  - syntax-highlighted code blocks via lowlight
//  - proper icon toolbar (lucide-react)
//  - character count
//  - highlight extension
//  - flush debounce on resetKey change (no stale saves)
//
// Props:
//   content      — Tiptap JSON string or plain text
//   onChange     — called with JSON string (debounced)
//   placeholder  — editor placeholder text
//   debounceMs   — debounce delay, default 800
//   minHeight    — editor min height class, default "min-h-[200px]"
//   showToolbar  — show formatting toolbar, default true
//   borderless   — removes outer border
//   className    — wrapper class
//   resetKey     — resets editor content when changed (e.g. note.id)
//
// Markdown shortcuts (all work inline as you type):
//   # → h1,  ## → h2,  ### → h3
//   **text** or __text__ → bold
//   *text* or _text_ → italic
//   ~~text~~ → strikethrough
//   `code` → inline code
//   ```lang → code block
//   > text → blockquote
//   - text or * text → bullet list
//   1. text → ordered list
//   - [ ] text → task item
//   --- → horizontal rule
//
// Markdown paste:
//   Pasting raw markdown text is auto-converted to rich content.
// ============================================================

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import Typography from "@tiptap/extension-typography";
import Highlight from "@tiptap/extension-highlight";
import CharacterCount from "@tiptap/extension-character-count";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { createLowlight, common } from "lowlight";
import { useEffect, useCallback, useRef } from "react";
import { cn } from "@/shared/utils";
import type { Editor } from "@tiptap/react";
import {
  Bold, Italic, Strikethrough, Code, Code2,
  Heading1, Heading2, Heading3,
  List, ListOrdered, CheckSquare,
  Quote, Minus, Link as LinkIcon,
  Undo2, Redo2, Highlighter,
} from "lucide-react";

// lowlight instance with common grammars
const lowlight = createLowlight(common);

// ── Toolbar button ─────────────────────────────────────────────

function ToolbarBtn({
  onClick, active, title, children, disabled,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      disabled={disabled}
      className={cn(
        "flex items-center justify-center w-7 h-7 rounded transition-fast select-none shrink-0",
        active
          ? "bg-primary/[0.12] text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-accent",
        disabled && "opacity-40 pointer-events-none"
      )}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div className="w-px h-4 bg-border mx-0.5 shrink-0 self-center" />;
}

// ── Toolbar ────────────────────────────────────────────────────

function Toolbar({ editor }: { editor: Editor }) {
  const chars = editor.storage.characterCount?.characters() ?? 0;

  const addLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url  = window.prompt("Enter URL", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().setLink({ href: url }).run();
  };

  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border bg-background shrink-0 flex-wrap">
      {/* Headings */}
      <ToolbarBtn title="Heading 1 (# text)" active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
        <Heading1 size={13} />
      </ToolbarBtn>
      <ToolbarBtn title="Heading 2 (## text)" active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 size={13} />
      </ToolbarBtn>
      <ToolbarBtn title="Heading 3 (### text)" active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        <Heading3 size={13} />
      </ToolbarBtn>

      <Sep />

      {/* Inline marks */}
      <ToolbarBtn title="Bold (** text **)" active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold size={13} />
      </ToolbarBtn>
      <ToolbarBtn title="Italic (* text *)" active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic size={13} />
      </ToolbarBtn>
      <ToolbarBtn title="Strikethrough (~~ text ~~)" active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough size={13} />
      </ToolbarBtn>
      <ToolbarBtn title="Highlight" active={editor.isActive("highlight")}
        onClick={() => editor.chain().focus().toggleHighlight().run()}>
        <Highlighter size={13} />
      </ToolbarBtn>
      <ToolbarBtn title="Inline code (` code `)" active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}>
        <Code size={13} />
      </ToolbarBtn>
      <ToolbarBtn title="Link" active={editor.isActive("link")}
        onClick={addLink}>
        <LinkIcon size={13} />
      </ToolbarBtn>

      <Sep />

      {/* Lists */}
      <ToolbarBtn title="Bullet list (- item)" active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List size={13} />
      </ToolbarBtn>
      <ToolbarBtn title="Numbered list (1. item)" active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered size={13} />
      </ToolbarBtn>
      <ToolbarBtn title="Task list (- [ ] item)" active={editor.isActive("taskList")}
        onClick={() => editor.chain().focus().toggleTaskList().run()}>
        <CheckSquare size={13} />
      </ToolbarBtn>

      <Sep />

      {/* Block types */}
      <ToolbarBtn title="Blockquote (> text)" active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote size={13} />
      </ToolbarBtn>
      <ToolbarBtn title="Code block (``` lang)" active={editor.isActive("codeBlock")}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
        <Code2 size={13} />
      </ToolbarBtn>
      <ToolbarBtn title="Horizontal rule (---)"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        <Minus size={13} />
      </ToolbarBtn>

      <Sep />

      {/* History */}
      <ToolbarBtn title="Undo (Ctrl+Z)" disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}>
        <Undo2 size={13} />
      </ToolbarBtn>
      <ToolbarBtn title="Redo (Ctrl+Shift+Z)" disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}>
        <Redo2 size={13} />
      </ToolbarBtn>

      {/* Character count — right side */}
      <div className="ml-auto flex items-center pr-1">
        <span className="text-[10px] tabular-nums text-muted-foreground/50 select-none">
          {chars.toLocaleString()} chars
        </span>
      </div>
    </div>
  );
}

// ── Debounce hook ──────────────────────────────────────────────

function useDebounced<T extends (...args: Parameters<T>) => void>(fn: T, ms: number): {
  call: T;
  flush: () => void;
  cancel: () => void;
} {
  const timer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fnRef   = useRef(fn);
  const argsRef = useRef<Parameters<T> | null>(null);
  fnRef.current = fn;

  const call = useCallback(
    ((...args: Parameters<T>) => {
      argsRef.current = args;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        fnRef.current(...(argsRef.current as Parameters<T>));
        argsRef.current = null;
      }, ms);
    }) as T,
    [ms]
  );

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (argsRef.current) {
      fnRef.current(...(argsRef.current as Parameters<T>));
      argsRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    argsRef.current = null;
  }, []);

  return { call, flush, cancel };
}

// ── Content parser ─────────────────────────────────────────────

function parseContent(raw: string): object | string {
  if (!raw || raw === "{}") return "";
  try { return JSON.parse(raw); } catch { return raw; }
}

// ── RichEditor ─────────────────────────────────────────────────

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
  placeholder = "Write something, or type / for commands\u2026",
  debounceMs  = 800,
  minHeight   = "min-h-[200px]",
  showToolbar = true,
  borderless  = false,
  className,
  resetKey,
}: RichEditorProps) {
  const { call: debouncedOnChange, flush, cancel } = useDebounced(onChange, debounceMs);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading:   { levels: [1, 2, 3] },
        // Disable built-in codeBlock — replaced by CodeBlockLowlight
        codeBlock: false,
      }),
      CodeBlockLowlight.configure({
        lowlight,
        defaultLanguage: "plaintext",
        HTMLAttributes: { class: "not-prose" },
      }),
      Placeholder.configure({
        placeholder: ({ node }) =>
          node.type.name === "heading" ? "Heading\u2026" : placeholder,
      }),
      Typography,
      Highlight.configure({ multicolor: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      CharacterCount,
    ],
    content: parseContent(content),
    onUpdate: ({ editor }) => {
      debouncedOnChange(JSON.stringify(editor.getJSON()));
    },
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm dark:prose-invert max-w-none outline-none",
          "prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-foreground",
          "prose-p:text-foreground prose-p:leading-relaxed",
          "prose-code:before:content-none prose-code:after:content-none",
          "prose-code:bg-muted prose-code:text-foreground prose-code:px-1.5 prose-code:py-0.5",
          "prose-code:rounded prose-code:text-[0.8em] prose-code:font-mono",
          "prose-pre:bg-muted prose-pre:text-foreground prose-pre:rounded-lg prose-pre:border prose-pre:border-border",
          "prose-blockquote:border-l-2 prose-blockquote:border-primary/40",
          "prose-blockquote:text-muted-foreground prose-blockquote:not-italic",
          "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
          "prose-li:text-foreground",
          "prose-hr:border-border",
          "[&_mark]:bg-yellow-200/60 [&_mark]:dark:bg-yellow-500/25 [&_mark]:rounded-sm [&_mark]:px-0.5",
          minHeight,
          "px-6 py-4"
        ),
      },
      handlePaste(view, event) {
        const text = event.clipboardData?.getData("text/plain");
        if (!text) return false;
        const looksLikeMarkdown =
          /^#{1,6}\s/.test(text) ||
          /\*{1,2}[^*]+\*{1,2}/.test(text) ||
          /^[-*]\s/.test(text) ||
          /^>\s/.test(text) ||
          /^```/.test(text) ||
          /^- \[[ x]\]/.test(text) ||
          /^\d+\.\s/.test(text) ||
          /~~[^~]+~~/.test(text);
        if (!looksLikeMarkdown) return false;
        event.preventDefault();
        view.dispatch(
          view.state.tr.insertText(text, view.state.selection.from, view.state.selection.to)
        );
        return true;
      },
    },
  });

  // Flush + cancel debounce when switching notes, then load new content
  useEffect(() => {
    if (!editor || !resetKey) return;
    flush();
    cancel();
    editor.commands.setContent(parseContent(content));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  // Flush on unmount
  useEffect(() => { return () => { flush(); }; }, [flush]);

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
