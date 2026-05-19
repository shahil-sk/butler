// ============================================================
// DATABASE — Table list (home screen)
// ============================================================

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { useDatabaseStore } from "../store";
import { PageHeader, EmptyState, PrimaryButton } from "@/shared/ui";
import { CreateTableModal } from "./CreateTableModal";

export function TableList() {
  const navigate = useNavigate();
  const { tables, loading } = useDatabaseStore((s) => ({
    tables: s.tables,
    loading: s.loading,
  }));
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Database"
        count={tables.length}
        right={
          <PrimaryButton onClick={() => setShowCreate(true)}>
            <Plus size={14} className="mr-1" /> New Table
          </PrimaryButton>
        }
      />

      <div className="flex-1 overflow-y-auto p-4">
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

        {!loading && tables.length === 0 && (
          <EmptyState
            title="No tables yet"
            description="Create a table to start organising structured data."
            action={{ label: "New Table", onClick: () => setShowCreate(true) }}
          />
        )}

        {!loading && tables.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {tables.map((t) => (
              <button
                key={t.id}
                onClick={() => navigate(t.id)}
                className="text-left p-4 rounded-lg border border-border bg-surface hover:bg-surface-2 transition-colors"
              >
                <p className="font-medium text-sm truncate">{t.name}</p>
                {t.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  {t.schema.length} column{t.schema.length !== 1 ? "s" : ""}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {showCreate && <CreateTableModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
