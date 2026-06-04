// ============================================================
// SHARED — RichEditor
// Generic Tiptap editor with full Markdown & HTML support.
// No store coupling.
//
// Props:
//   content           — Tiptap JSON string, plain markdown, or plain text
//   onChange          — called with JSON string (debounced)
//   placeholder       — editor placeholder text
//   debounceMs        — debounce delay, default 800
//   minHeight         — editor min height class, default "min-h-[200px]"
//   showToolbar       — show formatting toolbar, default true
//   borderless        — removes outer border (Notes: NoteToolbar provides chrome)
//   className         — wrapper class
//   resetKey          — resets editor content when changed (e.g. note.id)
//   showViewModes     — show markdown/html/preview toggle buttons, default true
//   exportFormats     — enable export buttons for markdown/html/json, default true
//
// Features:
//   • Full Markdown support — parse, render, and export markdown
//   • HTML support — render and export HTML content
//   • View modes — toggle between editor, markdown, HTML, and preview views
//   • Export formats — export content as Markdown, HTML, or JSON
//   • Sticky toolbar — toolbar stays pinned while content scrolls
//
// FIX 1: Markdown input — uses @tiptap/extension-markdown to accept
//         raw markdown strings and render them as Tiptap nodes.
//         Install: pnpm add @tiptap/extension-markdown
//
// FIX 2: Sticky toolbar — toolbar is position:sticky top-0 z-10,
//         editor area scrolls independently beneath it.
//
// FIX 3: HTML support — Tiptap natively handles HTML rendering via getHTML().
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
import { Markdown } from "tiptap-markdown";
import { useEffect, useCallback, useRef, useState } from "react";
import { cn } from "@/shared/utils";
import type { Editor } from "@tiptap/react";
import { bus } from "@/kernel/event-bus";
import { LiveTasksExtension, LiveDatabaseExtension } from "./extensions/EmbedBlocks";

// Track the last focused editor to know where to insert links
let lastFocusedEditor: Editor | null = null;

// ── View Mode Types ───────────────────────────────────────────────────────────

type ViewMode = "editor" | "markdown" | "html" | "preview";

// ── Toolbar ───────────────────────────────────────────────────────────────────

function ToolbarBtn({
  onClick, active, title, children, disabled = false,
}: {
  onClick: () => void; active?: boolean; title: string; children: React.ReactNode; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      title={title}
      className={cn(
        "flex items-center justify-center px-1.5 py-1 rounded text-xs font-medium transition-fast select-none",
        disabled
          ? "opacity-50 cursor-not-allowed"
          : active
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

function Toolbar({ 
  editor, 
  viewMode, 
  onViewModeChange, 
  showViewModes, 
  onExport 
}: { 
  editor: Editor; 
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  showViewModes: boolean;
  onExport: (format: "markdown" | "html" | "json") => void;
}) {
  const isEditing = viewMode === "editor";

  return (
    // FIX 2: sticky — stays pinned while editor content scrolls
    <div className="sticky top-0 z-10 flex items-center gap-0.5 px-2 py-1 border-b border-border bg-background shrink-0 flex-wrap">
      {isEditing && (
        <>
          <ToolbarBtn title="Heading 1" active={editor.isActive("heading", { level: 1 })}
            onClick={() => ((editor.chain().focus() as any)).toggleHeading({ level: 1 }).run()}>H1</ToolbarBtn>
          <ToolbarBtn title="Heading 2" active={editor.isActive("heading", { level: 2 })}
            onClick={() => ((editor.chain().focus() as any)).toggleHeading({ level: 2 }).run()}>H2</ToolbarBtn>
          <ToolbarBtn title="Heading 3" active={editor.isActive("heading", { level: 3 })}
            onClick={() => ((editor.chain().focus() as any)).toggleHeading({ level: 3 }).run()}>H3</ToolbarBtn>
          <Sep />
          <ToolbarBtn title="Bold" active={editor.isActive("bold")}
            onClick={() => ((editor.chain().focus() as any)).toggleBold().run()}><strong>B</strong></ToolbarBtn>
          <ToolbarBtn title="Italic" active={editor.isActive("italic")}
            onClick={() => ((editor.chain().focus() as any)).toggleItalic().run()}><em>I</em></ToolbarBtn>
          <ToolbarBtn title="Strikethrough" active={editor.isActive("strike")}
            onClick={() => ((editor.chain().focus() as any)).toggleStrike().run()}><s>S</s></ToolbarBtn>
          <ToolbarBtn title="Inline code" active={editor.isActive("code")}
            onClick={() => ((editor.chain().focus() as any)).toggleCode().run()}>
            <span className="font-mono text-[11px]">`c`</span>
          </ToolbarBtn>
          <Sep />
          <ToolbarBtn title="Bullet list" active={editor.isActive("bulletList")}
            onClick={() => ((editor.chain().focus() as any)).toggleBulletList().run()}>• List</ToolbarBtn>
          <ToolbarBtn title="Numbered list" active={editor.isActive("orderedList")}
            onClick={() => ((editor.chain().focus() as any)).toggleOrderedList().run()}>1. List</ToolbarBtn>
          <ToolbarBtn title="Task list" active={editor.isActive("taskList")}
            onClick={() => ((editor.chain().focus() as any)).toggleTaskList().run()}>☑ Tasks</ToolbarBtn>
          <Sep />
          <ToolbarBtn title="Blockquote" active={editor.isActive("blockquote")}
            onClick={() => ((editor.chain().focus() as any)).toggleBlockquote().run()}>" Quote</ToolbarBtn>
          <ToolbarBtn title="Code block" active={editor.isActive("codeBlock")}
            onClick={() => ((editor.chain().focus() as any)).toggleCodeBlock().run()}>
            <span className="font-mono text-[11px]">{"</>"}</span>
          </ToolbarBtn>
          <ToolbarBtn title="Horizontal rule"
            onClick={() => ((editor.chain().focus() as any)).setHorizontalRule().run()}>― Rule</ToolbarBtn>
          <Sep />
          <ToolbarBtn title="Undo" onClick={() => ((editor.chain().focus() as any)).undo().run()}>↩</ToolbarBtn>
          <ToolbarBtn title="Redo" onClick={() => ((editor.chain().focus() as any)).redo().run()}>↪</ToolbarBtn>
        </>
      )}

      {showViewModes && (
        <>
          <Sep />
          <ToolbarBtn 
            title="Editor view" 
            active={viewMode === "editor"}
            onClick={() => onViewModeChange("editor")}
          >
            ✎ Edit
          </ToolbarBtn>
          <ToolbarBtn 
            title="Markdown view" 
            active={viewMode === "markdown"}
            onClick={() => onViewModeChange("markdown")}
          >
            # MD
          </ToolbarBtn>
          <ToolbarBtn 
            title="HTML view" 
            active={viewMode === "html"}
            onClick={() => onViewModeChange("html")}
          >
            &lt;/&gt; HTML
          </ToolbarBtn>
          <ToolbarBtn 
            title="Preview view" 
            active={viewMode === "preview"}
            onClick={() => onViewModeChange("preview")}
          >
            👁 Preview
          </ToolbarBtn>
          <Sep />
          <ToolbarBtn 
            title="Export as Markdown" 
            onClick={() => onExport("markdown")}
          >
            ⬇ MD
          </ToolbarBtn>
          <ToolbarBtn 
            title="Export as HTML" 
            onClick={() => onExport("html")}
          >
            ⬇ HTML
          </ToolbarBtn>
          <ToolbarBtn 
            title="Export as JSON" 
            onClick={() => onExport("json")}
          >
            ⬇ JSON
          </ToolbarBtn>
        </>
      )}
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

/**
 * Parse content for Tiptap.
 * tiptap-markdown patches setContent() to accept raw markdown strings directly.
 * Just detect JSON vs markdown and return appropriately.
 *   1. Empty        → ""
 *   2. Tiptap JSON  → parsed object
 *   3. Markdown/text → raw string (tiptap-markdown handles it)
 *   4. HTML         → raw string (tiptap-html handles it)
 */
function parseContent(raw: string): object | string {
  if (!raw || raw === "{}") return "";
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.type === "doc") return parsed;
    return raw; // unexpected JSON shape → treat as text
  } catch {
    return raw; // raw markdown or HTML string
  }
}



/**
 * Generate a downloadable file and trigger browser download.
 */
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── RichEditor ────────────────────────────────────────────────────────────────

export interface RichEditorProps {
  content:         string;
  onChange:        (jsonString: string) => void;
  placeholder?:    string;
  debounceMs?:     number;
  minHeight?:      string;
  showToolbar?:    boolean;
  /** Remove outer border — use when host provides chrome (Notes, etc.) */
  borderless?:     boolean;
  className?:      string;
  resetKey?:       string;
  /** Show view mode toggle buttons (markdown, html, preview) */
  showViewModes?:  boolean;
  /** Enable export functionality */
  exportFormats?:  boolean;
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
  showViewModes = true,
  exportFormats = true,
}: RichEditorProps) {
  const debouncedOnChange = useDebounced(onChange, debounceMs);
  const [viewMode, setViewMode] = useState<ViewMode>("editor");
  const [markdownContent, setMarkdownContent] = useState("");
  const [htmlContent, setHtmlContent] = useState("");

  const editor = useEditor({
    extensions: [
      (StarterKit.configure({
        heading:   { levels: [1, 2, 3] },
        codeBlock: { languageClassPrefix: "language-" },
      }) as any),
      Placeholder.configure({
        placeholder: ({ node }) =>
          node.type.name === "heading" ? "Heading…" : placeholder,
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false }),
      Markdown.configure({
        html:                true,  // Enable HTML parsing
        tightLists:          true,
        transformPastedText: true,   // paste markdown → rendered nodes
        transformCopiedText: false,
      }),
      LiveTasksExtension,
      LiveDatabaseExtension,
    ],
    content: parseContent(content),
    onUpdate: ({ editor }) => {
      // Detect /task slash command and [[ linking
      const { $to } = editor.state.selection;
      if ($to && $to.parent) {
        const textBefore = $to.parent.textBetween(0, $to.parentOffset, undefined, "\ufffc");
        if (textBefore.endsWith("/task")) {
          editor.chain().deleteRange({ from: $to.pos - 5, to: $to.pos }).run();
          bus.emit("editor:slash-task", undefined as any);
        } else if (textBefore.endsWith("/tasks")) {
          editor.chain().deleteRange({ from: $to.pos - 6, to: $to.pos }).insertContent('<live-tasks-block></live-tasks-block>').run();
        } else if (textBefore.endsWith("/database")) {
          editor.chain().deleteRange({ from: $to.pos - 9, to: $to.pos }).insertContent('<live-database-block></live-database-block>').run();
        } else if (textBefore.endsWith("[[")) {
          editor.chain().deleteRange({ from: $to.pos - 2, to: $to.pos }).run();
          bus.emit("search:open", { mode: "link" });
        }
      }

      const json = editor.getJSON();
      const jsonString = JSON.stringify(json);
      debouncedOnChange(jsonString);
      
      // Update markdown and HTML representations
      try {
        const md = (editor.storage as any).markdown?.getMarkdown?.() || "";
        setMarkdownContent(md);
      } catch {
        setMarkdownContent("");
      }
      
      try {
        const html = editor.getHTML();
        setHtmlContent(html);
      } catch {
        setHtmlContent("");
      }
    },
    editorProps: {
      handleClick(view, pos, event) {
        const target = event.target as HTMLElement;
        const link = target.closest("a");
        if (link && link.href && link.href.startsWith("butler://")) {
          event.preventDefault();
          const [type, id] = link.href.replace("butler://", "").split("/");
          if (type === "task") {
            bus.emit("navigate:to", { path: "/tasks" });
            setTimeout(() => bus.emit("task:open", { taskId: id }), 50);
          } else if (type === "note") {
            bus.emit("navigate:to", { path: "/notes" });
            setTimeout(() => bus.emit("note:open", { noteId: id }), 50);
          } else if (type === "project") {
            bus.emit("navigate:to", { path: "/projects" });
            setTimeout(() => bus.emit("project:open", { projectId: id }), 50);
          }
          return true;
        }
        return false;
      },
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

  // Update markdown and HTML when editor content changes
  useEffect(() => {
    if (!editor) return;
    
    try {
      const md = (editor.storage as any).markdown?.getMarkdown?.() || "";
      setMarkdownContent(md);
    } catch {
      setMarkdownContent("");
    }
    
    try {
      const html = editor.getHTML();
      setHtmlContent(html);
    } catch {
      setHtmlContent("");
    }
  }, [editor?.getJSON()]);

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
  };

  const handleExport = (format: "markdown" | "html" | "json") => {
    if (!editor) return;

    const timestamp = new Date().toISOString().split("T")[0];
    
    switch (format) {
      case "markdown": {
        const md = markdownContent || (editor.storage as any).markdown?.getMarkdown?.() || "";
        downloadFile(md, `export-${timestamp}.md`, "text/markdown");
        break;
      }
      case "html": {
        const html = htmlContent || editor.getHTML();
        downloadFile(html, `export-${timestamp}.html`, "text/html");
        break;
      }
      case "json": {
        const json = JSON.stringify(editor.getJSON(), null, 2);
        downloadFile(json, `export-${timestamp}.json`, "application/json");
        break;
      }
    }
  };

  // Track focus and handle link insertion
  useEffect(() => {
    if (!editor) return;

    const handleFocus = () => {
      lastFocusedEditor = editor;
    };
    editor.on("focus", handleFocus);
    
    // Fallback focus check on update (sometimes focus events are tricky)
    const handleUpdate = () => {
      if (editor.isFocused) lastFocusedEditor = editor;
    };
    editor.on("update", handleUpdate);

    const unsubLink = bus.on("editor:insert-link", (payload: any) => {
      if (lastFocusedEditor === editor) {
        const { result } = payload;
        // Insert as standard markdown/HTML link
        editor.chain().focus().insertContent(`<a href="butler://${result.type || result.entityType}/${result.id || result.entityId}">${result.title}</a> `).run();
      }
    });

    return () => {
      editor.off("focus", handleFocus);
      editor.off("update", handleUpdate);
      unsubLink();
      if (lastFocusedEditor === editor) {
        lastFocusedEditor = null;
      }
    };
  }, [editor]);

  if (!editor) {
    return (
      <div className={cn(
        "flex flex-col bg-background",
        !borderless && "border border-border rounded-lg",
        className
      )}>
        <div className="p-4 text-muted-foreground">Loading editor...</div>
      </div>
    );
  }

  return (
    // FIX 2: outer wrapper does NOT overflow-hidden — allows sticky to work.
    // The scrolling container must be the PARENT (NoteEditor / EntryEditor),
    // not this wrapper. overflow-hidden on this wrapper would clip sticky.
    <div className={cn(
      "flex flex-col bg-background",
      !borderless && "border border-border rounded-lg",
      className
    )}>
      {showToolbar && (
        <Toolbar 
          editor={editor} 
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          showViewModes={showViewModes}
          onExport={handleExport}
        />
      )}
      
      {viewMode === "editor" && (
        <EditorContent editor={editor} className="flex-1 overflow-y-auto" />
      )}
      
      {viewMode === "markdown" && (
        <div className={cn(
          "flex-1 overflow-y-auto px-6 py-4",
          "prose prose-sm dark:prose-invert max-w-none",
          "font-mono text-sm whitespace-pre-wrap break-words",
          "text-foreground bg-muted rounded"
        )}>
          {markdownContent || "No markdown content"}
        </div>
      )}
      
      {viewMode === "html" && (
        <div className={cn(
          "flex-1 overflow-y-auto px-6 py-4",
          "prose prose-sm dark:prose-invert max-w-none",
          "font-mono text-sm whitespace-pre-wrap break-words",
          "text-foreground bg-muted rounded"
        )}>
          {htmlContent || "No HTML content"}
        </div>
      )}
      
      {viewMode === "preview" && (
        <div 
          className={cn(
            "flex-1 overflow-y-auto px-6 py-4",
            "prose prose-sm dark:prose-invert max-w-none",
            "prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-foreground",
            "prose-code:before:content-none prose-code:after:content-none",
            "prose-code:bg-muted prose-code:text-foreground prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-[0.8em] prose-code:font-mono",
            "prose-pre:bg-muted prose-pre:text-foreground prose-pre:rounded-lg prose-pre:border prose-pre:border-border",
            "prose-blockquote:border-l-primary/40 prose-blockquote:text-muted-foreground prose-blockquote:not-italic",
            "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
            "prose-p:text-foreground prose-p:leading-relaxed",
            "prose-li:text-foreground",
            "prose-hr:border-border"
          )}
          dangerouslySetInnerHTML={{ __html: htmlContent || "<p>No content to preview</p>" }}
        />
      )}
    </div>
  );
}
