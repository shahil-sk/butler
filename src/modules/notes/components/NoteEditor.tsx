import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import { useEffect, useCallback } from "react";
import { cn } from "@/shared/utils";
import { useNoteStore } from "../store";
import type { Note } from "@/shared/types";

interface NoteEditorProps {
  note: Note;
  className?: string;
}

export function NoteEditor({ note, className }: NoteEditorProps) {
  const { updateNote } = useNoteStore();

  // Debounced save
  const save = useCallback(
    debounce((content: string) => {
      void updateNote(note.id, { content });
    }, 800),
    [note.id, updateNote]
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: { languageClassPrefix: "language-" },
      }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === "heading") return "Heading…";
          return "Write something, or type / for commands…";
        },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false }),
    ],
    content: (() => {
      try { return JSON.parse(note.content); } catch { return note.content || ""; }
    })(),
    onUpdate: ({ editor }) => {
      save(JSON.stringify(editor.getJSON()));
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm dark:prose-invert max-w-none outline-none min-h-[200px]",
      },
    },
  });

  // Sync when note changes (switching notes)
  useEffect(() => {
    if (!editor) return;
    const current = JSON.stringify(editor.getJSON());
    if (current !== note.content) {
      try {
        editor.commands.setContent(JSON.parse(note.content));
      } catch {
        editor.commands.setContent(note.content || "");
      }
    }
  }, [note.id]);

  return (
    <div className={cn("flex flex-col", className)}>
      <EditorContent editor={editor} className="flex-1 px-6 py-4" />
    </div>
  );
}

// Minimal debounce
function debounce<T extends (...args: Parameters<T>) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}
