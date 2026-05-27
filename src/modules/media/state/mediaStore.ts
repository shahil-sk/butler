import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { FileAttachment, PdfAnnotation } from "../types";

interface MediaState {
  files: FileAttachment[];
  annotations: PdfAnnotation[];
  activeFileId: string | null;
  loading: boolean;
  error: string | null;

  loadFiles: () => Promise<void>;
  setActiveFileId: (id: string | null) => void;
  loadAnnotations: (fileId: string) => Promise<void>;
  addFile: (name: string, sourcePath: string, mimeType: string, sizeBytes: number) => Promise<FileAttachment>;
  deleteFile: (id: string) => Promise<void>;

  createAnnotation: (fileId: string, page: number, text: string | null, notes: string | null, color: string) => Promise<PdfAnnotation>;
  deleteAnnotation: (id: string) => Promise<void>;
  exportAnnotationsToNote: (fileId: string) => Promise<void>;
}

export const useMediaStore = create<MediaState>((set, get) => ({
  files: [],
  annotations: [],
  activeFileId: null,
  loading: false,
  error: null,

  setActiveFileId: (id) => {
    set({ activeFileId: id, annotations: [] });
    if (id) {
      void get().loadAnnotations(id);
    }
  },

  loadFiles: async () => {
    set({ loading: true, error: null });
    try {
      const list = await invoke<FileAttachment[]>("list_file_attachments");
      set({ files: list });
      if (list.length > 0 && !get().activeFileId) {
        get().setActiveFileId(list[0].id);
      }
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to load files" });
    } finally {
      set({ loading: false });
    }
  },

  loadAnnotations: async (fileId) => {
    try {
      const list = await invoke<PdfAnnotation[]>("list_pdf_annotations", { fileId });
      set({ annotations: list });
    } catch (e) {
      console.error("Failed to load annotations", e);
    }
  },

  addFile: async (name, sourcePath, mimeType, sizeBytes) => {
    set({ loading: true, error: null });
    try {
      const created = await invoke<FileAttachment>("add_file_attachment", {
        name,
        sourcePath,
        mimeType,
        sizeBytes,
      });
      set((state) => ({
        files: [...state.files, created],
      }));
      get().setActiveFileId(created.id);
      return created;
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to upload file attachment" });
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  deleteFile: async (id) => {
    set({ loading: true, error: null });
    try {
      await invoke("delete_file_attachment", { id });
      set((state) => {
        const nextFiles = state.files.filter((f) => f.id !== id);
        let nextActive = state.activeFileId;
        if (nextActive === id) {
          nextActive = nextFiles.length > 0 ? nextFiles[0].id : null;
        }
        return {
          files: nextFiles,
          activeFileId: nextActive,
        };
      });
      if (get().activeFileId) {
        get().setActiveFileId(get().activeFileId);
      }
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to delete file" });
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  createAnnotation: async (fileId, page, text, notes, color) => {
    try {
      const created = await invoke<PdfAnnotation>("create_pdf_annotation", {
        fileId,
        page,
        text,
        notes,
        color,
      });
      set((state) => ({
        annotations: [...state.annotations, created],
      }));
      return created;
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to create annotation" });
      throw e;
    }
  },

  deleteAnnotation: async (id) => {
    set((state) => ({
      annotations: state.annotations.filter((a) => a.id !== id),
    }));
    try {
      await invoke("delete_pdf_annotation", { id });
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to delete annotation" });
      if (get().activeFileId) {
        void get().loadAnnotations(get().activeFileId!);
      }
      throw e;
    }
  },

  exportAnnotationsToNote: async (fileId) => {
    const file = get().files.find((f) => f.id === fileId);
    if (!file) throw new Error("File not found");
    const annotationsList = get().annotations;

    let content = `# Annotation Highlights: ${file.name}\n\n`;
    content += `*Exported from PDF Attachment: [${file.name}](${file.path})*\n\n`;

    if (annotationsList.length === 0) {
      content += `No annotations logged yet.\n`;
    } else {
      // Sort annotations by page number
      const sorted = [...annotationsList].sort((a, b) => a.page - b.page);
      sorted.forEach((ann) => {
        content += `### Page ${ann.page} (${ann.color.toUpperCase()})\n`;
        if (ann.text) {
          content += `> ${ann.text}\n\n`;
        }
        if (ann.notes) {
          content += `**Notes**: ${ann.notes}\n\n`;
        }
        content += `---\n\n`;
      });
    }

    try {
      await invoke("create_note", {
        title: `Annotations: ${file.name.replace(/\.[^/.]+$/, "")}`,
        content,
        tags: "pdf-annotations,study-notes",
        metadata: "{}",
      });
    } catch (e: any) {
      console.error(e);
      throw e;
    }
  },
}));
