import { useState, useEffect, useRef } from "react";
import { Modal, GhostButton, PrimaryButton } from "@/shared/ui";
import { cn } from "@/shared/utils";
import { Globe, FileText, BookOpen, Plus, Loader2 } from "lucide-react";

// Fix #10: PDF file picker wired to Tauri dialog:open
export function ImportModal({
  open, onClose, onImport, isIngesting,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (input: any) => Promise<void>;
  isIngesting: boolean;
}) {
  const [type, setType]         = useState<"url" | "text" | "pdf">("url");
  const [title, setTitle]       = useState("");
  const [url, setUrl]           = useState("");
  const [text, setText]         = useState("");
  const [filePath, setFilePath] = useState("");
  const [tags, setTags]         = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTitle(""); setUrl(""); setText(""); setFilePath(""); setTags("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const pickPdf = async () => {
    try {
      const { open: tauriOpen } = await import("@tauri-apps/plugin-dialog");
      const selected = await tauriOpen({
        filters: [{ name: "PDF", extensions: ["pdf"] }],
        multiple: false,
      });
      if (selected && typeof selected === "string") {
        setFilePath(selected);
        if (!title) setTitle(selected.split("/").pop()?.replace(".pdf", "") ?? "");
      }
    } catch {
      // Tauri dialog not available in dev browser — ignore
    }
  };

  const submit = async () => {
    if (!title.trim()) return;
    await onImport({
      type,
      title: title.trim(),
      url:        type === "url"  ? url.trim()      : undefined,
      rawContent: type === "text" ? text.trim()     : undefined,
      filePath:   type === "pdf"  ? filePath.trim() : undefined,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
    });
  };

  const sourceTypes = [
    { id: "url",  label: "Web URL",  icon: Globe },
    { id: "text", label: "Text",     icon: FileText },
    { id: "pdf",  label: "PDF",      icon: BookOpen },
  ] as const;

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-[480px]">
      <div className="px-5 pt-5 pb-4 flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Import source</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Add a source to your research knowledge base.</p>
        </div>

        <div className="flex gap-1.5">
          {sourceTypes.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setType(id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs border transition-fast",
                type === id
                  ? "border-primary/40 bg-primary/[0.08] text-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <Icon size={11} /> {label}
            </button>
          ))}
        </div>

        <div className="space-y-2.5">
          <input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title…"
            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface-2 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
          {type === "url" && (
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface-2 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          )}
          {type === "text" && (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste text content…"
              rows={5}
              className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface-2 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
            />
          )}
          {type === "pdf" && (
            <button
              type="button"
              onClick={() => void pickPdf()}
              className="w-full flex items-center justify-center gap-2 h-20 rounded-lg border-2 border-dashed border-border text-xs text-muted-foreground hover:border-primary/40 hover:text-primary transition-fast"
            >
              <BookOpen size={14} />
              {filePath ? filePath.split("/").pop() : "Click to pick PDF file…"}
            </button>
          )}
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Tags (comma-separated)…"
            className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface-2 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>

        <div className="flex justify-end gap-2">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={() => void submit()} disabled={!title.trim() || isIngesting}>
            {isIngesting ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
            Import
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}
