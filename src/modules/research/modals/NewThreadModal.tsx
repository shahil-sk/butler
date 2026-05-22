import { useState, useEffect, useRef } from "react";
import { Modal, GhostButton, PrimaryButton } from "@/shared/ui";
import { Plus, Loader2 } from "lucide-react";

export function NewThreadModal({
  open, onClose, onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (title: string, desc?: string) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [desc, setDesc]   = useState("");
  const [busy, setBusy]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) { setTitle(""); setDesc(""); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [open]);

  const submit = async () => {
    if (!title.trim()) return;
    setBusy(true);
    await onCreate(title.trim(), desc.trim() || undefined);
    setBusy(false);
  };

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-[440px]">
      <div className="px-5 pt-5 pb-4 flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">New research thread</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Group sources around a research question or topic.</p>
        </div>
        <div className="space-y-3">
          <input
            ref={inputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void submit()}
            placeholder="Thread title…"
            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface-2 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Description (optional)…"
            rows={2}
            className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-surface-2 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
          />
        </div>
        <div className="flex justify-end gap-2">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={() => void submit()} disabled={!title.trim() || busy}>
            {busy ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
            Create thread
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}
