import { useState } from "react";
import { Plus, FileText, FileDown, CalendarDays } from "lucide-react";
import { useNoteStore } from "@/modules/notes/store";
import { formatDate } from "@/shared/utils";

export function ProjectDocuments({ projectId }: { projectId: string }) {
  const { notes, createNote, openNote } = useNoteStore();
  const docs = notes.filter(n => n.linkedProjectIds?.includes(projectId) && n.status !== "archived" && n.status !== "trashed");

  const handleCreate = async (type: "note" | "meeting") => {
    const note = await createNote({
      title: type === "meeting" ? "Meeting Notes" : "New Document",
      type: type,
      noteType: type,
      linkedProjectIds: [projectId]
    });
    openNote(note.id);
  };

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm">Project Documents</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleCreate("meeting")}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/50 hover:bg-muted text-xs font-medium rounded-lg transition-fast"
          >
            <CalendarDays size={14} />
            Meeting Note
          </button>
          <button
            onClick={() => handleCreate("note")}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium rounded-lg transition-fast"
          >
            <Plus size={14} />
            New Document
          </button>
        </div>
      </div>
      
      {docs.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <FileDown size={32} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">No documents yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map(doc => (
            <div 
              key={doc.id}
              onClick={() => openNote(doc.id)}
              className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:border-primary/30 hover:bg-accent/50 cursor-pointer transition-fast"
            >
              <div className="flex items-center gap-3">
                <FileText size={16} className="text-muted-foreground/70" />
                <span className="text-sm font-medium">{doc.title || "Untitled"}</span>
              </div>
              <span className="text-xs text-muted-foreground">{formatDate(doc.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
