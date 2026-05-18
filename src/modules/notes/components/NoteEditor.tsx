// ============================================================
// NOTES — NoteEditor
// Thin wrapper around shared RichEditor.
// NoteToolbar (title, links, tags) sits above this in index.tsx
// and is separate from the formatting toolbar inside RichEditor.
// ============================================================

import { RichEditor } from "@/shared/RichEditor";
import { cn } from "@/shared/utils";
import { useNoteStore } from "../store";
import type { Note } from "@/shared/types";

interface NoteEditorProps {
  note: Note;
  className?: string;
}

export function NoteEditor({ note, className }: NoteEditorProps) {
  const { updateNote } = useNoteStore();

  return (
    <div className={cn("flex flex-col flex-1 overflow-hidden", className)}>
      <RichEditor
        content={note.content}
        onChange={(json) => void updateNote(note.id, { content: json })}
        placeholder="Write something, or type / for commands…"
        resetKey={note.id}
        debounceMs={800}
        minHeight="min-h-[calc(100vh-200px)]"
        showToolbar={true}
        // No outer border — NoteToolbar + page chrome already provide structure
        borderless
        className="flex-1 overflow-y-auto"
      />
    </div>
  );
}
