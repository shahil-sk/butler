import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { DatabaseTable, DatabaseRecord, DatabaseColumn } from "../types";

interface DatabasesState {
  tables: DatabaseTable[];
  records: DatabaseRecord[];
  activeTableId: string | null;
  loading: boolean;
  error: string | null;

  loadTables: () => Promise<void>;
  setActiveTableId: (id: string | null) => void;
  createTable: (name: string, columns: DatabaseColumn[], project_id: string | null, tags: string[]) => Promise<DatabaseTable>;
  updateTable: (id: string, name: string, columns: DatabaseColumn[], project_id: string | null, tags: string[]) => Promise<void>;
  deleteTable: (id: string) => Promise<void>;

  loadRecords: (tableId: string) => Promise<void>;
  createRecord: (tableId: string, values: Record<string, any>, tags: string[]) => Promise<DatabaseRecord>;
  updateRecord: (id: string, values: Record<string, any>, tags: string[]) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
}

export const useDatabasesStore = create<DatabasesState>((set, get) => ({
  tables: [],
  records: [],
  activeTableId: null,
  loading: false,
  error: null,

  setActiveTableId: (id) => {
    set({ activeTableId: id, records: [] });
    if (id) {
      void get().loadRecords(id);
    }
  },

  loadTables: async () => {
    set({ loading: true, error: null });
    try {
      const list = await invoke<DatabaseTable[]>("list_database_tables");
      set({ tables: list });
      if (list.length > 0 && !get().activeTableId) {
        get().setActiveTableId(list[0].id);
      }
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to load database tables" });
    } finally {
      set({ loading: false });
    }
  },

  createTable: async (name, columns, project_id, tags) => {
    set({ loading: true, error: null });
    try {
      const created = await invoke<DatabaseTable>("create_database_table", {
        name,
        columns: JSON.stringify(columns),
        projectId: project_id || null,
        tags,
      });
      set((state) => ({
        tables: [...state.tables, created],
      }));
      get().setActiveTableId(created.id);
      return created;
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to create database table" });
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  updateTable: async (id, name, columns, project_id, tags) => {
    set({ loading: true, error: null });
    try {
      await invoke("update_database_table", {
        id,
        name,
        columns: JSON.stringify(columns),
        projectId: project_id || null,
        tags,
      });
      await get().loadTables();
      if (get().activeTableId === id) {
        await get().loadRecords(id);
      }
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to update database table" });
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  deleteTable: async (id) => {
    set({ loading: true, error: null });
    try {
      await invoke("delete_database_table", { id });
      set((state) => {
        const nextTables = state.tables.filter((t) => t.id !== id);
        let nextActive = state.activeTableId;
        if (nextActive === id) {
          nextActive = nextTables.length > 0 ? nextTables[0].id : null;
        }
        return {
          tables: nextTables,
          activeTableId: nextActive,
        };
      });
      if (get().activeTableId) {
        get().setActiveTableId(get().activeTableId);
      }
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to delete database table" });
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  loadRecords: async (tableId) => {
    try {
      const list = await invoke<DatabaseRecord[]>("list_database_records", { tableId });
      set({ records: list });
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to load database records" });
    }
  },

  createRecord: async (tableId, values, tags) => {
    try {
      const created = await invoke<DatabaseRecord>("create_database_record", {
        tableId,
        valuesJson: JSON.stringify(values),
        tags,
      });
      set((state) => ({
        records: [...state.records, created],
      }));
      return created;
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to create database record" });
      throw e;
    }
  },

  updateRecord: async (id, values, tags) => {
    // Optimistic update
    const prevRecords = get().records;
    set((state) => ({
      records: state.records.map((r) =>
        r.id === id
          ? {
              ...r,
              values_json: JSON.stringify(values),
              tags,
              updated_at: Date.now(),
            }
          : r
      ),
    }));

    try {
      await invoke("update_database_record", {
        id,
        valuesJson: JSON.stringify(values),
        tags,
      });
    } catch (e: any) {
      console.error(e);
      set({ records: prevRecords, error: "Failed to update record" });
      throw e;
    }
  },

  deleteRecord: async (id) => {
    set((state) => ({
      records: state.records.filter((r) => r.id !== id),
    }));
    try {
      await invoke("delete_database_record", { id });
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to delete record" });
      if (get().activeTableId) {
        void get().loadRecords(get().activeTableId!);
      }
      throw e;
    }
  },
}));
