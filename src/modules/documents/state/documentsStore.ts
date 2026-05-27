import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { Document, CreateDocumentInput, DocumentTemplate } from "../types";

export const TEMPLATE_PRESETS: Record<DocumentTemplate, string> = {
  prd: `# Product Requirement Document (PRD)

## 1. Overview
Describe the goal, problem, and target audience.

## 2. Requirements
- [ ] Requirement 1: Description
- [ ] Requirement 2: Description

## 3. Architecture & Tech Stack
Outline the design, database schemas, and components.

## 4. Open Questions
List any remaining unknowns.`,

  sop: `# Standard Operating Procedure (SOP)

## Purpose
Define why this procedure exists.

## Scope
Who and what does this procedure apply to?

## Procedure Steps
1. **Step 1**: Details
2. **Step 2**: Details

## Verification & Review
How do we verify correct execution?`,

  meeting_notes: `# Meeting Notes

**Date**: ${new Date().toLocaleDateString()}
**Attendees**: Name 1, Name 2

## Agenda
- Topic 1
- Topic 2

## Discussion Points
- Key item 1
- Key item 2

## Action Items
- [ ] Action item 1 (Owner)
- [ ] Action item 2 (Owner)`,

  proposal: `# Project Proposal

## Executive Summary
Brief high-level summary of the proposal.

## Problem Statement
What is the problem we are trying to solve?

## Proposed Solution
Details of the proposed path forward.

## Timeline & Resources
Expected milestones and resource allocation.`,

  none: "",
};

interface DocumentsState {
  documents: Document[];
  activeDocumentId: string | null;
  loading: boolean;
  error: string | null;

  loadDocuments: () => Promise<void>;
  createDocument: (input: CreateDocumentInput) => Promise<Document>;
  updateDocument: (
    id: string,
    title: string,
    content: string,
    parent_id: string | null,
    template: DocumentTemplate,
    project_id: string | null,
    tags: string[]
  ) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  exportDocument: (id: string, path: string) => Promise<void>;
  setActiveDocumentId: (id: string | null) => void;
}

export const useDocumentsStore = create<DocumentsState>((set, get) => ({
  documents: [],
  activeDocumentId: null,
  loading: false,
  error: null,

  setActiveDocumentId: (id) => {
    set({ activeDocumentId: id });
  },

  loadDocuments: async () => {
    set({ loading: true, error: null });
    try {
      const list = await invoke<Document[]>("list_documents");
      set({ documents: list });
      if (list.length > 0 && !get().activeDocumentId) {
        set({ activeDocumentId: list[0].id });
      }
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to load documents" });
    } finally {
      set({ loading: false });
    }
  },

  createDocument: async (input) => {
    set({ loading: true, error: null });
    try {
      const created = await invoke<Document>("create_document", {
        title: input.title,
        content: input.content,
        parentId: input.parent_id || null,
        template: input.template,
        projectId: input.project_id || null,
        tags: input.tags,
        metadata: input.metadata || "{}",
      });
      set((state) => ({
        documents: [...state.documents, created],
        activeDocumentId: created.id,
      }));
      return created;
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to create document" });
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  updateDocument: async (id, title, content, parent_id, template, project_id, tags) => {
    // Optimistic local update
    set((state) => ({
      documents: state.documents.map((d) =>
        d.id === id
          ? {
              ...d,
              title,
              content,
              parent_id,
              template,
              project_id,
              tags,
              updated_at: Date.now(),
            }
          : d
      ),
    }));

    try {
      await invoke("update_document", {
        id,
        title,
        content,
        parentId: parent_id || null,
        template,
        projectId: project_id || null,
        tags,
      });
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to update document" });
      // Re-fetch to revert to actual state on error
      void get().loadDocuments();
      throw e;
    }
  },

  deleteDocument: async (id) => {
    set({ loading: true, error: null });
    try {
      await invoke("delete_document", { id });
      set((state) => {
        const nextDocs = state.documents.filter((d) => d.id !== id);
        let nextActive = state.activeDocumentId;
        if (nextActive === id) {
          nextActive = nextDocs.length > 0 ? nextDocs[0].id : null;
        }
        return {
          documents: nextDocs,
          activeDocumentId: nextActive,
        };
      });
    } catch (e: any) {
      console.error(e);
      set({ error: "Failed to delete document" });
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  exportDocument: async (id, path) => {
    const doc = get().documents.find((d) => d.id === id);
    if (!doc) throw new Error("Document not found");
    try {
      await invoke("write_text_file", {
        path,
        content: doc.content,
      });
    } catch (e: any) {
      console.error(e);
      throw e;
    }
  },
}));
