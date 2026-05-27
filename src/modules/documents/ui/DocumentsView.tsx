import React, { useEffect, useState, useRef } from "react";
import { useDocumentsStore, TEMPLATE_PRESETS } from "../state/documentsStore";
import { useProjectsStore } from "../../projects/state/projectsStore";
import { Document, DocumentTemplate } from "../types";
import { MarkdownPreview, generateSlug } from "./MarkdownPreview";
import {
  FileText,
  Plus,
  Trash2,
  Download,
  FolderOpen,
  Eye,
  Edit3,
  Columns,
  Search,
  Check,
  ChevronRight,
} from "lucide-react";

export const DocumentsView: React.FC = () => {
  const {
    documents,
    activeDocumentId,
    loadDocuments,
    createDocument,
    updateDocument,
    deleteDocument,
    exportDocument,
    setActiveDocumentId,
  } = useDocumentsStore();

  const { projects, loadProjects } = useProjectsStore();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [template, setTemplate] = useState<DocumentTemplate>("none");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"edit" | "preview" | "split">("split");
  
  // Export Modal state
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportPath, setExportPath] = useState("");
  const [exportSuccess, setExportSuccess] = useState(false);
  const [exportError, setExportError] = useState("");

  const activeDoc = documents.find((d) => d.id === activeDocumentId);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadDocuments();
    void loadProjects();
  }, []);

  // Sync edits when active document changes
  useEffect(() => {
    if (activeDoc) {
      setTitle(activeDoc.title);
      setContent(activeDoc.content);
      setParentId(activeDoc.parent_id || null);
      setProjectId(activeDoc.project_id || null);
      setTemplate(activeDoc.template);
    }
  }, [activeDocumentId, activeDoc]);

  // Debounced auto-save
  useEffect(() => {
    if (!activeDoc) return;
    const delay = setTimeout(() => {
      if (
        title !== activeDoc.title ||
        content !== activeDoc.content ||
        parentId !== activeDoc.parent_id ||
        projectId !== activeDoc.project_id
      ) {
        void updateDocument(
          activeDoc.id,
          title,
          content,
          parentId,
          template,
          projectId,
          activeDoc.tags
        );
      }
    }, 1000);
    return () => clearTimeout(delay);
  }, [title, content, parentId, projectId]);

  const handleCreate = async (tpl: DocumentTemplate) => {
    const defaultTitles: Record<DocumentTemplate, string> = {
      prd: "New PRD Document",
      sop: "New SOP Document",
      meeting_notes: "New Meeting Notes",
      proposal: "New Project Proposal",
      none: "Untitled Document",
    };
    try {
      await createDocument({
        title: defaultTitles[tpl],
        content: TEMPLATE_PRESETS[tpl],
        parent_id: activeDocumentId, // Make child of current active if exists
        template: tpl,
        tags: [],
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDoc || !exportPath.trim()) return;
    try {
      await exportDocument(activeDoc.id, exportPath.trim());
      setExportSuccess(true);
      setExportError("");
      setTimeout(() => {
        setIsExportOpen(false);
        setExportSuccess(false);
      }, 1500);
    } catch (err: any) {
      setExportError(err.toString());
    }
  };

  // Helper to get nested hierarchy path depth
  const getDepth = (doc: Document): number => {
    let depth = 0;
    let current = doc;
    while (current.parent_id) {
      const parent = documents.find((d) => d.id === current.parent_id);
      if (!parent) break;
      depth++;
      current = parent;
    }
    return depth;
  };

  // Pre-order traversal to build flat list matching tree
  const buildTreeList = (parentIdVal: string | null = null): Document[] => {
    return documents
      .filter((d) => d.parent_id === parentIdVal)
      .flatMap((d) => [d, ...buildTreeList(d.id)]);
  };

  const filteredDocs = buildTreeList(null).filter((d) =>
    d.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Extract headings from markdown content
  const headings = content
    .split("\n")
    .filter((line) => line.startsWith("# ") || line.startsWith("## ") || line.startsWith("### "))
    .map((line) => {
      const match = line.match(/^(#{1,3})\s+(.*)$/);
      const level = match ? match[1].length : 1;
      const text = match ? match[2].trim() : "";
      return { level, text, slug: generateSlug(text) };
    });

  return (
    <div className="flex h-full w-full bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Left Sidebar */}
      <div className="w-64 border-r border-zinc-800 bg-zinc-900/40 flex flex-col h-full shrink-0">
        <div className="p-4 border-b border-zinc-800 flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:border-amber-500/50"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">New Document</label>
            <div className="grid grid-cols-2 gap-1">
              {(["none", "prd", "sop", "meeting_notes"] as const).map((tpl) => (
                <button
                  key={tpl}
                  onClick={() => void handleCreate(tpl)}
                  className="bg-zinc-850 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 rounded px-2 py-1 text-[11px] font-medium flex items-center gap-1 justify-center transition-colors cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  {tpl === "none" ? "Empty" : tpl.replace("_", " ").toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredDocs.map((doc) => {
            const depth = getDepth(doc);
            const isActive = doc.id === activeDocumentId;
            return (
              <button
                key={doc.id}
                onClick={() => setActiveDocumentId(doc.id)}
                style={{ paddingLeft: `${Math.max(8, depth * 16)}px` }}
                className={`w-full text-left rounded-md px-3 py-1.5 text-xs flex items-center gap-2 transition-colors cursor-pointer ${
                  isActive
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    : "text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200 border border-transparent"
                }`}
              >
                {depth > 0 ? <ChevronRight className="h-3 w-3 text-zinc-600 shrink-0" /> : <FileText className="h-3.5 w-3.5 shrink-0" />}
                <span className="truncate">{doc.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Workspace */}
      {activeDoc ? (
        <div className="flex-1 flex h-full min-w-0">
          <div className="flex-1 flex flex-col h-full min-w-0 border-r border-zinc-900">
            {/* Active Top Bar */}
            <div className="h-14 border-b border-zinc-800 bg-zinc-900/20 px-6 flex items-center justify-between gap-4 shrink-0">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => void updateDocument(activeDoc.id, title, content, parentId, template, projectId, activeDoc.tags)}
                className="bg-transparent text-sm font-semibold text-zinc-100 border-none focus:outline-none placeholder-zinc-600 min-w-0 flex-1"
                placeholder="Document Title"
              />

              <div className="flex items-center gap-3 shrink-0">
                {/* Parent Select */}
                <select
                  value={parentId || ""}
                  onChange={(e) => setParentId(e.target.value || null)}
                  className="bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs rounded px-2.5 py-1.5 focus:outline-none focus:border-amber-500/50"
                >
                  <option value="">No Parent (Root)</option>
                  {documents
                    .filter((d) => d.id !== activeDoc.id)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        Parent: {d.title}
                      </option>
                    ))}
                </select>

                {/* Project Link */}
                <select
                  value={projectId || ""}
                  onChange={(e) => setProjectId(e.target.value || null)}
                  className="bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs rounded px-2.5 py-1.5 focus:outline-none focus:border-amber-500/50"
                >
                  <option value="">No linked project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      Proj: {p.name}
                    </option>
                  ))}
                </select>

                {/* View Mode Toggle */}
                <div className="flex bg-zinc-900 rounded-lg p-0.5 border border-zinc-800">
                  <button
                    onClick={() => setViewMode("edit")}
                    className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                      viewMode === "edit" ? "bg-amber-500/10 text-amber-400" : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode("split")}
                    className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                      viewMode === "split" ? "bg-amber-500/10 text-amber-400" : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <Columns className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode("preview")}
                    className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                      viewMode === "preview" ? "bg-amber-500/10 text-amber-400" : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                </div>

                <button
                  onClick={() => setIsExportOpen(true)}
                  className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 rounded-lg p-2 transition-colors cursor-pointer"
                  title="Export Markdown"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>

                <button
                  onClick={() => void deleteDocument(activeDoc.id)}
                  className="bg-zinc-900 hover:bg-red-500/10 border border-zinc-800 hover:border-red-500/20 text-zinc-400 hover:text-red-400 rounded-lg p-2 transition-colors cursor-pointer"
                  title="Delete Document"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Split Editor / Preview Pane */}
            <div className="flex-1 flex overflow-hidden">
              {viewMode !== "preview" && (
                <div className={`flex-1 h-full ${viewMode === "split" ? "border-r border-zinc-900" : ""}`}>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    onBlur={() => void updateDocument(activeDoc.id, title, content, parentId, template, projectId, activeDoc.tags)}
                    className="w-full h-full bg-zinc-950/40 p-6 font-mono text-xs leading-relaxed text-zinc-300 resize-none border-none focus:outline-none placeholder-zinc-700"
                    placeholder="Write your markdown content here..."
                  />
                </div>
              )}

              {viewMode !== "edit" && (
                <div ref={previewContainerRef} className="flex-1 h-full overflow-y-auto p-8 bg-zinc-950/20">
                  <MarkdownPreview content={content} />
                </div>
              )}
            </div>
          </div>

          {/* Right Rail (Table of Contents) */}
          <div className="w-56 border-l border-zinc-900 bg-zinc-900/20 p-4 flex flex-col gap-4 overflow-y-auto h-full shrink-0">
            <h4 className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold flex items-center gap-1.5">
              <FolderOpen className="h-3.5 w-3.5" /> Table of Contents
            </h4>
            <div className="space-y-2 mt-1">
              {headings.length > 0 ? (
                headings.map((h, i) => (
                  <button
                    key={`${h.slug}-${i}`}
                    onClick={() => {
                      document.getElementById(h.slug)?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    style={{ paddingLeft: `${(h.level - 1) * 8}px` }}
                    className="w-full text-left text-[11px] text-zinc-400 hover:text-amber-400 truncate block py-0.5 transition-colors cursor-pointer"
                    title={h.text}
                  >
                    {h.text}
                  </button>
                ))
              ) : (
                <div className="text-[11px] text-zinc-600 italic">No headings found</div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 gap-2">
          <FileText className="h-8 w-8 text-zinc-700" />
          <span className="text-sm">Select or create a document to get started</span>
        </div>
      )}

      {/* Export Path Dialog Modal */}
      {isExportOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <Download className="h-4 w-4 text-amber-500" /> Export Document
            </h3>
            <form onSubmit={(e) => void handleExportSubmit(e)} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-zinc-400 font-medium">Absolute File Path</label>
                <input
                  type="text"
                  placeholder="e.g. /tmp/my-document.md"
                  value={exportPath}
                  onChange={(e) => setExportPath(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-amber-500/50"
                  required
                  autoFocus
                />
              </div>

              {exportError && <div className="text-xs text-red-400 bg-red-950/30 border border-red-900/55 rounded p-2">{exportError}</div>}

              {exportSuccess && (
                <div className="text-xs text-emerald-400 bg-emerald-950/30 border border-emerald-900/55 rounded p-2 flex items-center gap-1.5">
                  <Check className="h-4 w-4" /> Exported successfully!
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => setIsExportOpen(false)}
                  className="bg-zinc-850 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 rounded px-3 py-1.5 font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-500 text-zinc-950 rounded px-4 py-1.5 font-semibold transition-colors cursor-pointer"
                >
                  Export
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
