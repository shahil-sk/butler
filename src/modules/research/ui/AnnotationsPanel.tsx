import { useState, useEffect, useRef } from "react";

// Fix #8: inline draft editor — no empty DB write on create
export function AnnotationsPanel({
  annotations,
  documentId,
  sourceId,
  onDelete,
  onUpdate,
  onAdd,
}: {
  annotations: any[];
  documentId: string;
  sourceId: string;
  onDelete: (id: string) => void;
  onUpdate: (id: string, content: string) => Promise<void>;
  onAdd: (input: any) => Promise<any>;
}) {
  const [draft, setDraft]         = useState("");
  const [showDraft, setShowDraft] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const draftRef = useRef<HTMLTextAreaElement>(null);

  const submitDraft = async () => {
    if (!draft.trim()) { setShowDraft(false); return; }
    await onAdd({ documentId, sourceId, type: "note", content: draft.trim() });
    setDraft("");
    setShowDraft(false);
  };

  const submitEdit = async (id: string) => {
    await onUpdate(id, editContent);
    setEditingId(null);
  };

  useEffect(() => {
    if (showDraft) setTimeout(() => draftRef.current?.focus(), 30);
  }, [showDraft]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 pt-2 pb-1 shrink-0 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">Notes</span>
        <button
          type="button"
          onClick={() => setShowDraft(true)}
          className="text-[10px] text-primary hover:underline"
        >
          + Add note
        </button>
      </div>

      {showDraft && (
        <div className="px-3 pb-2 shrink-0">
          <textarea
            ref={draftRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a note…"
            rows={3}
            className="w-full px-2.5 py-2 text-xs rounded-lg border border-primary/40 bg-surface-2 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
          />
          <div className="flex gap-1.5 mt-1.5 justify-end">
            <button type="button" onClick={() => setShowDraft(false)} className="text-[10px] text-muted-foreground hover:text-foreground">Cancel</button>
            <button type="button" onClick={() => void submitDraft()} className="text-[10px] text-primary font-medium hover:underline">Save</button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 py-1 space-y-2">
        {annotations.length === 0 && !showDraft ? (
          <p className="text-xs text-muted-foreground/60 py-4 text-center">No notes yet.</p>
        ) : (
          annotations.map((a) => (
            <div key={a.id} className="group rounded-md border border-border/60 bg-surface-2 px-3 py-2">
              {editingId === a.id ? (
                <>
                  <textarea
                    autoFocus
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={3}
                    className="w-full px-2 py-1.5 text-xs rounded border border-primary/40 bg-surface-1 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
                  />
                  <div className="flex gap-1.5 mt-1 justify-end">
                    <button type="button" onClick={() => setEditingId(null)} className="text-[10px] text-muted-foreground">Cancel</button>
                    <button type="button" onClick={() => void submitEdit(a.id)} className="text-[10px] text-primary font-medium">Save</button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[11px] text-foreground/80 leading-relaxed">
                    {a.content || <em className="text-muted-foreground/40">Empty note</em>}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 opacity-0 group-hover:opacity-100 transition-fast">
                    <span className="text-[10px] text-muted-foreground/40">{a.type}</span>
                    <button
                      type="button"
                      onClick={() => { setEditingId(a.id); setEditContent(a.content); }}
                      className="text-[10px] text-primary hover:underline ml-auto"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(a.id)}
                      className="text-[10px] text-red-400 hover:text-red-500"
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
