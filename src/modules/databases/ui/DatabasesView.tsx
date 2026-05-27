import React, { useEffect, useState } from "react";
import { useDatabasesStore } from "../state/databasesStore";
import { useProjectsStore } from "../../projects/state/projectsStore";
import { DatabaseColumn } from "../types";
import { SchemaManagerModal } from "./SchemaManagerModal";
import { DatabaseGrid } from "./DatabaseGrid";
import { DatabaseBoard } from "./DatabaseBoard";
import {
  Database,
  Plus,
  Trash2,
  Settings,
  Grid,
  Kanban,
  FileSpreadsheet,
  Search,
} from "lucide-react";

export const DatabasesView: React.FC = () => {
  const {
    tables,
    records,
    activeTableId,
    loadTables,
    setActiveTableId,
    createTable,
    updateTable,
    deleteTable,
    createRecord,
    updateRecord,
    deleteRecord,
  } = useDatabasesStore();

  const { projects, loadProjects } = useProjectsStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [rowSearch, setRowSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "board">("grid");
  const [boardGroupByColId, setBoardGroupByColId] = useState<string>("");

  const [isNewTableOpen, setIsNewTableOpen] = useState(false);
  const [newTableName, setNewTableName] = useState("");
  const [isSchemaOpen, setIsSchemaOpen] = useState(false);

  const activeTable = tables.find((t) => t.id === activeTableId);
  const activeCols: DatabaseColumn[] = activeTable ? JSON.parse(activeTable.columns) : [];

  useEffect(() => {
    void loadTables();
    void loadProjects();
  }, []);

  useEffect(() => {
    if (activeCols.length > 0) {
      const selectCol = activeCols.find((c) => c.type === "select");
      setBoardGroupByColId(selectCol ? selectCol.id : "");
    }
  }, [activeTableId]);

  const handleCreateTable = async () => {
    if (!newTableName.trim()) return;
    const defaultCols: DatabaseColumn[] = [
      { id: "col-name", name: "Name", type: "text" },
      { id: "col-status", name: "Status", type: "select", options: ["Todo", "In Progress", "Done"] },
    ];
    await createTable(newTableName.trim(), defaultCols, null, []);
    setNewTableName("");
    setIsNewTableOpen(false);
  };

  const handleSaveSchema = async (cols: DatabaseColumn[]) => {
    if (!activeTable) return;
    await updateTable(activeTable.id, activeTable.name, cols, activeTable.project_id || null, activeTable.tags);
    setIsSchemaOpen(false);
  };

  const handleAddRow = async () => {
    if (!activeTable) return;
    const defaultValues: Record<string, any> = {};
    activeCols.forEach((col) => {
      if (col.type === "select" && col.options && col.options.length > 0) {
        defaultValues[col.id] = col.options[0];
      } else {
        defaultValues[col.id] = "";
      }
    });
    await createRecord(activeTable.id, defaultValues, []);
  };

  const handleCellChange = async (recordId: string, colId: string, value: any) => {
    const rec = records.find((r) => r.id === recordId);
    if (!rec) return;
    const currentVals = JSON.parse(rec.values_json);
    currentVals[colId] = value;
    await updateRecord(recordId, currentVals, rec.tags);
  };

  const parsedRecords = records.map((r) => ({
    id: r.id,
    vals: JSON.parse(r.values_json) as Record<string, any>,
  }));

  const filteredRecords = parsedRecords.filter((r) => {
    if (!rowSearch) return true;
    return Object.values(r.vals).some((val) =>
      String(val).toLowerCase().includes(rowSearch.toLowerCase())
    );
  });

  const filteredTables = tables.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-full w-full bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Left Sidebar */}
      <div className="w-60 border-r border-zinc-850 bg-zinc-900/40 flex flex-col h-full shrink-0">
        <div className="p-4 border-b border-zinc-850 flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search tables..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-amber-500/50"
            />
          </div>
          <button
            onClick={() => setIsNewTableOpen(true)}
            className="w-full bg-zinc-850 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 rounded px-2.5 py-1.5 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> New Database
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredTables.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTableId(t.id)}
              className={`w-full text-left rounded-md px-3 py-1.5 text-xs flex items-center gap-2 border border-transparent ${
                t.id === activeTableId
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  : "text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200"
              }`}
            >
              <Database className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{t.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Workspace */}
      {activeTable ? (
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-zinc-950/20">
          {/* Header Bar */}
          <div className="h-14 border-b border-zinc-850 bg-zinc-900/20 px-6 flex items-center justify-between gap-4 shrink-0">
            <span className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <FileSpreadsheet className="h-4.5 w-4.5 text-amber-500" />
              {activeTable.name}
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsSchemaOpen(true)}
                className="bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 rounded-lg px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
              >
                <Settings className="h-3.5 w-3.5" /> Schema Properties
              </button>

              <div className="flex bg-zinc-900 rounded-lg p-0.5 border border-zinc-800 text-xs font-semibold">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`px-2.5 py-1.5 rounded-md flex items-center gap-1 cursor-pointer transition-colors ${
                    viewMode === "grid" ? "bg-amber-500/10 text-amber-400" : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Grid className="h-3.5 w-3.5" /> Grid
                </button>
                <button
                  onClick={() => setViewMode("board")}
                  className={`px-2.5 py-1.5 rounded-md flex items-center gap-1 cursor-pointer transition-colors ${
                    viewMode === "board" ? "bg-amber-500/10 text-amber-400" : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <Kanban className="h-3.5 w-3.5" /> Board
                </button>
              </div>

              <button
                onClick={() => void deleteTable(activeTable.id)}
                className="bg-zinc-900 hover:bg-red-500/10 border border-zinc-800 hover:border-red-500/20 text-zinc-400 hover:text-red-400 rounded-lg p-2 cursor-pointer transition-colors"
                title="Delete Database"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Sub Control bar */}
          <div className="h-12 border-b border-zinc-900 bg-zinc-950/40 px-6 flex items-center justify-between gap-4 shrink-0">
            <div className="relative w-64">
              <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-zinc-650" />
              <input
                type="text"
                placeholder="Filter rows..."
                value={rowSearch}
                onChange={(e) => setRowSearch(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded pl-7 pr-2 py-1 text-[11px] focus:outline-none focus:border-amber-500/50"
              />
            </div>
            {viewMode === "board" && (
              <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                <span>Group by:</span>
                <select
                  value={boardGroupByColId}
                  onChange={(e) => setBoardGroupByColId(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 rounded text-zinc-300 text-xs px-2 py-1 focus:outline-none"
                >
                  <option value="">(None)</option>
                  {activeCols
                    .filter((c) => c.type === "select")
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>
            )}
            <button
              onClick={() => void handleAddRow()}
              className="bg-amber-600 hover:bg-amber-500 text-zinc-950 font-bold text-xs rounded px-3 py-1 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Add Row
            </button>
          </div>

          {/* Records Display Container */}
          <div className="flex-1 overflow-auto p-6">
            {viewMode === "grid" ? (
              <DatabaseGrid
                columns={activeCols}
                records={filteredRecords}
                projects={projects}
                onCellChange={handleCellChange}
                onDeleteRecord={deleteRecord}
              />
            ) : (
              <DatabaseBoard
                columns={activeCols}
                records={filteredRecords}
                projects={projects}
                groupByColId={boardGroupByColId}
                onDeleteRecord={deleteRecord}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 gap-2">
          <Database className="h-8 w-8 text-zinc-700" />
          <span className="text-sm">Select or create a database to get started</span>
        </div>
      )}

      {/* New Database Modal */}
      {isNewTableOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-sm w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <Plus className="h-4 w-4 text-amber-500" /> Create Custom Database
            </h3>
            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-zinc-400 font-medium">Database Name</label>
                <input
                  type="text"
                  placeholder="e.g. Contacts, Specs, Inventory"
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500/50"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 text-xs">
              <button
                onClick={() => setIsNewTableOpen(false)}
                className="bg-zinc-850 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 rounded px-3 py-1.5 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleCreateTable()}
                className="bg-amber-600 hover:bg-amber-500 text-zinc-950 rounded px-4 py-1.5 font-semibold cursor-pointer"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schema Properties Manager Modal */}
      {isSchemaOpen && (
        <SchemaManagerModal
          isOpen={isSchemaOpen}
          onClose={() => setIsSchemaOpen(false)}
          columns={activeCols}
          onSave={handleSaveSchema}
        />
      )}
    </div>
  );
};
