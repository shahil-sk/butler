// ============================================================
// DATABASE — Create table modal
// ============================================================

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDatabaseStore } from "../store";
import { PrimaryButton, GhostButton } from "@/shared/ui";

interface Props {
  onClose: () => void;
}

export function CreateTableModal({ onClose }: Props) {
  const navigate = useNavigate();
  const createTable = useDatabaseStore((s) => s.createTable);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const table = await createTable(name.trim(), description.trim() || undefined);
    setSaving(false);
    onClose();
    navigate(table.id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-surface rounded-xl shadow-lg w-full max-w-md p-6">
        <h2 className="text-base font-semibold mb-4">New Table</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Name</label>
            <input
              autoFocus
              className="w-full text-sm bg-surface-2 border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Untitled table"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Description (optional)</label>
            <input
              className="w-full text-sm bg-surface-2 border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this table for?"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <GhostButton type="button" onClick={onClose}>Cancel</GhostButton>
            <PrimaryButton type="submit" disabled={!name.trim() || saving}>
              {saving ? "Creating…" : "Create"}
            </PrimaryButton>
          </div>
        </form>
      </div>
    </div>
  );
}
