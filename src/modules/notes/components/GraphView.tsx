import { useMemo } from "react";
import type { Note } from "@/shared/types";
import { getTiptapPlainText } from "@/shared/utils";

// Very simplified graph view for now
export function GraphView({ notes, onOpenNote }: { notes: Note[], onOpenNote: (id: string) => void }) {
  const links = useMemo(() => {
    const list: { source: Note, target: Note }[] = [];
    for (const source of notes) {
      const text = getTiptapPlainText(source.content ?? "").toLowerCase();
      for (const target of notes) {
        if (source.id !== target.id && target.title && text.includes(target.title.toLowerCase())) {
          list.push({ source, target });
        }
      }
    }
    return list;
  }, [notes]);

  return (
    <div className="flex-1 flex flex-col p-6 overflow-hidden">
      <h2 className="text-xl font-bold mb-4">Knowledge Graph</h2>
      <div className="flex-1 overflow-auto border border-border rounded-xl bg-muted/10 p-4">
        {notes.length === 0 && <p className="text-muted-foreground">No notes available.</p>}
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {notes.map(note => {
            const connected = links.filter(l => l.source.id === note.id || l.target.id === note.id);
            return (
              <button 
                key={note.id} 
                onClick={() => onOpenNote(note.id)}
                className="p-4 rounded-xl border border-border bg-background hover:border-primary text-left transition-colors"
              >
                <div className="font-bold text-base">{note.title || "Untitled"}</div>
                <div className="text-xs text-muted-foreground mt-2">{connected.length} connections</div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  );
}
