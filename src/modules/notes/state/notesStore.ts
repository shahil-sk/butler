import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { Note, Backlink } from "../types";

interface NotesState {
  notes: Note[];
  activeNote: Note | null;
  backlinks: Backlink[];
  searchQuery: string;
  loading: boolean;
  error: string | null;

  setSearchQuery: (query: string) => void;
  loadNotes: () => Promise<void>;
  searchNotes: (query: string) => Promise<void>;
  setActiveNote: (note: Note | null) => Promise<void>;
  createNote: (title: string, content: string, tags?: string[], metadata?: string) => Promise<Note>;
  updateNote: (id: string, title: string, content: string, tags?: string[], metadata?: string) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  syncNoteLinks: (sourceId: string, content: string) => Promise<void>;
  loadBacklinks: (noteId: string) => Promise<void>;
  generateNoteEmbedding: (id: string) => Promise<void>;
}

const extractWikilinks = (content: string): string[] => {
  const regex = /\[\[(.*?)\]\]/g;
  const matches: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    const raw = match[1];
    const title = raw.split("|")[0].trim();
    if (title) {
      matches.push(title);
    }
  }
  return Array.from(new Set(matches));
};

export const useNotesStore = create<NotesState>((set, get) => ({
  notes: [],
  activeNote: null,
  backlinks: [],
  searchQuery: "",
  loading: false,
  error: null,

  setSearchQuery: (query) => set({ searchQuery: query }),

  loadNotes: async () => {
    set({ loading: true, error: null });
    try {
      const query = get().searchQuery;
      let list: Note[];
      if (query.trim()) {
        list = await invoke<Note[]>("search_notes", { query });
      } else {
        list = await invoke<Note[]>("list_notes");
      }
      set({ notes: list });
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to load notes from database" });
    } finally {
      set({ loading: false });
    }
  },

  searchNotes: async (query) => {
    set({ searchQuery: query, loading: true, error: null });
    try {
      const list = await invoke<Note[]>("search_notes", { query });
      set({ notes: list });
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to perform notes search" });
    } finally {
      set({ loading: false });
    }
  },

  setActiveNote: async (note) => {
    set({ activeNote: note, backlinks: [] });
    if (note) {
      await get().loadBacklinks(note.id);
    }
  },

  createNote: async (title, content, tags = [], metadata = "{}") => {
    set({ loading: true, error: null });
    try {
      const newNote = await invoke<Note>("create_note", {
        title,
        content,
        tags,
        metadata,
      });

      // Automatically sync wikilinks in content
      const targetTitles = extractWikilinks(content);
      if (targetTitles.length > 0) {
        await invoke("sync_note_links", {
          sourceId: newNote.id,
          targetTitles,
        });
      }

      // Reload notes list
      await get().loadNotes();
      
      // Set created note as active
      set({ activeNote: newNote });
      await get().loadBacklinks(newNote.id);

      return newNote;
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to create note" });
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  updateNote: async (id, title, content, tags = [], metadata = "{}") => {
    try {
      await invoke("update_note", {
        id,
        title,
        content,
        tags,
        metadata,
      });

      // Synchronize wikilinks
      const targetTitles = extractWikilinks(content);
      await invoke("sync_note_links", {
        sourceId: id,
        targetTitles,
      });

      // Update active note locally
      const active = get().activeNote;
      if (active && active.id === id) {
        const updated = { ...active, title, content, tags, metadata };
        set({ activeNote: updated });
        // Reload backlinks in case the note title itself changed or tags changed
        await get().loadBacklinks(id);
      }

      // Reload notes list
      await get().loadNotes();
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to update note" });
      throw e;
    }
  },

  deleteNote: async (id) => {
    set({ loading: true, error: null });
    try {
      await invoke("delete_note", { id });
      
      const active = get().activeNote;
      if (active && active.id === id) {
        set({ activeNote: null, backlinks: [] });
      }

      // Reload notes
      await get().loadNotes();
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to delete note" });
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  syncNoteLinks: async (sourceId, content) => {
    try {
      const targetTitles = extractWikilinks(content);
      await invoke("sync_note_links", {
        sourceId,
        targetTitles,
      });
    } catch (e: any) {
      console.error("Failed to sync note links:", e);
    }
  },

  loadBacklinks: async (noteId) => {
    try {
      const backlinks = await invoke<Backlink[]>("get_backlinks", { noteId });
      set({ backlinks });
    } catch (e: any) {
      console.error("Failed to load backlinks:", e);
    }
  },

  generateNoteEmbedding: async (id) => {
    const notes = get().notes;
    const note = notes.find(n => n.id === id) || (get().activeNote?.id === id ? get().activeNote : null);
    if (!note || !note.content.trim()) return;

    try {
      // Dynamic imports to prevent circular dependency
      const aiStore = (await import("../../../core/state/aiStore")).useAIStore.getState();
      const aiService = await import("../../../core/services/aiService");
      
      const config = {
        provider: aiStore.provider,
        apiKey: aiStore.apiKey,
        model: aiStore.embeddingModel || "nomic-embed-text",
      };

      const embedding = await aiService.generateEmbeddings(note.content, config);
      
      let parsedMetadata: any = {};
      try {
        parsedMetadata = JSON.parse(note.metadata || "{}");
      } catch (err) {
        console.error("Failed to parse note metadata", err);
      }

      parsedMetadata.embedding = embedding;
      const updatedMetadata = JSON.stringify(parsedMetadata);

      // Save directly to db without triggering full note list reload to avoid flicker
      await invoke("update_note", {
        id: note.id,
        title: note.title,
        content: note.content,
        tags: note.tags,
        metadata: updatedMetadata,
      });

      // Update locally
      if (get().activeNote?.id === id) {
        set({ activeNote: { ...get().activeNote!, metadata: updatedMetadata } });
      }
      set({
        notes: get().notes.map(n => n.id === id ? { ...n, metadata: updatedMetadata } : n)
      });
    } catch (e) {
      console.error("Failed to generate embedding in background", e);
    }
  },
}));
