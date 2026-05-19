/**
 * ui/DatabaseListPage.tsx — Home screen listing all databases.
 * Pure UI.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table2, Plus, Archive } from 'lucide-react';
import { useDatabases, useDatabaseMutations } from './hooks/useDatabaseData';
import type { Database } from '../types';

export function DatabaseListPage() {
  const navigate = useNavigate();
  const { data: databases = [], isLoading } = useDatabases();
  const { createDatabase } = useDatabaseMutations();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  // Listen for global new-database event from command palette
  useEffect(() => {
    const handler = () => setCreating(true);
    window.addEventListener('butler:database:new', handler);
    return () => window.removeEventListener('butler:database:new', handler);
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const db = await createDatabase.mutateAsync({ name: newName.trim() });
    setCreating(false);
    setNewName('');
    navigate(`/database/${db.id}`);
  };

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-foreground">Databases</h1>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            onClick={() => setCreating(true)}
          >
            <Plus size={14} /> New database
          </button>
        </div>

        {/* Create inline */}
        {creating && (
          <div className="mb-4 flex items-center gap-2 p-3 border border-border rounded-lg bg-card">
            <Table2 size={16} className="text-muted-foreground flex-shrink-0" />
            <input
              autoFocus
              className="flex-1 bg-transparent outline-none text-sm"
              placeholder="Database name…"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') { setCreating(false); setNewName(''); }
              }}
            />
            <button
              className="px-3 py-1 bg-primary text-primary-foreground text-xs rounded font-medium hover:bg-primary/90 transition-colors"
              onClick={handleCreate}
            >
              Create
            </button>
            <button
              className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => { setCreating(false); setNewName(''); }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* List */}
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : databases.length === 0 && !creating ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Table2 size={36} className="text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">No databases yet.</p>
            <button
              className="text-sm text-blue-500 hover:underline"
              onClick={() => setCreating(true)}
            >
              Create your first database
            </button>
          </div>
        ) : (
          <div className="grid gap-2">
            {databases.map(db => (
              <DatabaseCard
                key={db.id}
                database={db}
                onClick={() => navigate(`/database/${db.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface DatabaseCardProps {
  database: Database;
  onClick: () => void;
}

function DatabaseCard({ database, onClick }: DatabaseCardProps) {
  return (
    <button
      className="flex items-center gap-3 w-full text-left px-4 py-3 rounded-lg border border-border bg-card hover:bg-accent/30 transition-colors group"
      onClick={onClick}
    >
      <span className="text-xl leading-none select-none">
        {database.icon ?? '🗃️'}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{database.name}</p>
        {database.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{database.description}</p>
        )}
      </div>
      <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
        Open →
      </span>
    </button>
  );
}
