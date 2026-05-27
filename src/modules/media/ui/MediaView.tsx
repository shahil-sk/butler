import React, { useEffect, useState } from "react";
import { useMediaStore } from "../state/mediaStore";
import { convertFileSrc } from "@tauri-apps/api/core";
import {
  FileText,
  Plus,
  Trash2,
  Download,
  FolderOpen,
  Image as ImageIcon,
  Music,
  Video as VideoIcon,
  Search,
  BookOpen,
  Check,
} from "lucide-react";

export const MediaView: React.FC = () => {
  const {
    files,
    annotations,
    activeFileId,
    loadFiles,
    setActiveFileId,
    addFile,
    deleteFile,
    createAnnotation,
    deleteAnnotation,
    exportAnnotationsToNote,
  } = useMediaStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [isAttachOpen, setIsAttachOpen] = useState(false);
  
  // Attach Form State
  const [attachName, setAttachName] = useState("");
  const [attachPath, setAttachPath] = useState("");
  const [attachMime, setAttachMime] = useState("application/pdf");
  const [attachError, setAttachError] = useState("");

  // Annotation Form State
  const [annPage, setAnnPage] = useState(1);
  const [annText, setAnnText] = useState("");
  const [annNotes, setAnnNotes] = useState("");
  const [annColor, setAnnColor] = useState("yellow");
  
  const [exportSuccess, setExportSuccess] = useState(false);

  const activeFile = files.find((f) => f.id === activeFileId);

  useEffect(() => {
    void loadFiles();
  }, []);

  const handleAttachSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attachName.trim() || !attachPath.trim()) return;
    try {
      await addFile(attachName.trim(), attachPath.trim(), attachMime, 0);
      setAttachName("");
      setAttachPath("");
      setIsAttachOpen(false);
      setAttachError("");
    } catch (err: any) {
      setAttachError(err.toString());
    }
  };

  const handleAddAnnotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFile) return;
    await createAnnotation(
      activeFile.id,
      annPage,
      annText.trim() || null,
      annNotes.trim() || null,
      annColor
    );
    setAnnText("");
    setAnnNotes("");
  };

  const handleExportNotes = async () => {
    if (!activeFile) return;
    try {
      await exportAnnotationsToNote(activeFile.id);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderFilePreview = () => {
    if (!activeFile) return null;
    const src = convertFileSrc(activeFile.path);

    if (activeFile.mime_type.startsWith("image/")) {
      return (
        <div className="w-full h-full flex items-center justify-center p-4">
          <img src={src} alt={activeFile.name} className="max-w-full max-h-full object-contain rounded-lg shadow-md" />
        </div>
      );
    } else if (activeFile.mime_type.startsWith("audio/")) {
      return (
        <div className="w-full h-full flex items-center justify-center p-8">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 w-full max-w-sm text-center space-y-4">
            <Music className="h-12 w-12 text-amber-500 mx-auto" />
            <h4 className="text-xs font-semibold">{activeFile.name}</h4>
            <audio src={src} controls className="w-full" />
          </div>
        </div>
      );
    } else if (activeFile.mime_type.startsWith("video/")) {
      return (
        <div className="w-full h-full flex items-center justify-center p-4">
          <video src={src} controls className="max-w-full max-h-full rounded-lg shadow-md" />
        </div>
      );
    } else if (activeFile.mime_type === "application/pdf") {
      return (
        <iframe
          src={src}
          title={activeFile.name}
          className="w-full h-full border-none rounded-lg bg-zinc-900"
        />
      );
    } else {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center text-zinc-500 gap-2">
          <FileText className="h-8 w-8 text-zinc-700" />
          <span className="text-xs">Preview not supported for this mime type ({activeFile.mime_type})</span>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-amber-500 underline mt-2"
          >
            Open File in Browser
          </a>
        </div>
      );
    }
  };

  const getMimeIcon = (mime: string) => {
    if (mime.startsWith("image/")) return <ImageIcon className="h-4 w-4 text-emerald-400 shrink-0" />;
    if (mime.startsWith("audio/")) return <Music className="h-4 w-4 text-blue-400 shrink-0" />;
    if (mime.startsWith("video/")) return <VideoIcon className="h-4 w-4 text-indigo-400 shrink-0" />;
    return <FileText className="h-4 w-4 text-amber-400 shrink-0" />;
  };

  return (
    <div className="flex h-full w-full bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Left Sidebar */}
      <div className="w-64 border-r border-zinc-850 bg-zinc-900/40 flex flex-col h-full shrink-0">
        <div className="p-4 border-b border-zinc-850 flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-amber-500/50"
            />
          </div>
          <button
            onClick={() => setIsAttachOpen(true)}
            className="w-full bg-zinc-850 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 rounded px-2.5 py-1.5 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Attach File
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredFiles.map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFileId(f.id)}
              className={`w-full text-left rounded-md px-3 py-1.5 text-xs flex items-center gap-2 border border-transparent ${
                f.id === activeFileId
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  : "text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200"
              }`}
            >
              {getMimeIcon(f.mime_type)}
              <span className="truncate">{f.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Previewer Area */}
      {activeFile ? (
        <div className="flex-1 flex h-full min-w-0">
          <div className="flex-1 flex flex-col h-full min-w-0 p-4 border-r border-zinc-900">
            <div className="h-10 flex items-center justify-between px-2 mb-2 shrink-0">
              <span className="text-xs font-semibold text-zinc-300 truncate max-w-md">{activeFile.name}</span>
              <button
                onClick={() => void deleteFile(activeFile.id)}
                className="bg-zinc-900 hover:bg-red-500/10 border border-zinc-850 hover:border-red-500/20 text-zinc-400 hover:text-red-400 rounded p-1.5 transition-colors cursor-pointer"
                title="Delete File Attachment"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 bg-zinc-950/40 rounded-lg border border-zinc-850 overflow-hidden">
              {renderFilePreview()}
            </div>
          </div>

          {/* Right Annotation Notebook Panel (Exclusive to PDFs) */}
          {activeFile.mime_type === "application/pdf" && (
            <div className="w-64 border-l border-zinc-900 bg-zinc-900/20 p-4 flex flex-col gap-4 overflow-y-auto h-full shrink-0">
              <div className="flex justify-between items-center shrink-0">
                <h4 className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5" /> Annotation Notebook
                </h4>
                <button
                  onClick={() => void handleExportNotes()}
                  className="bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 rounded px-2 py-1 text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  title="Export to Notes module"
                >
                  {exportSuccess ? <Check className="h-3 w-3 text-emerald-400" /> : <Download className="h-3 w-3" />}
                  Export
                </button>
              </div>

              {/* Add Annotation Form */}
              <form onSubmit={(e) => void handleAddAnnotation(e)} className="bg-zinc-950/50 border border-zinc-850 rounded p-3 space-y-3 shrink-0 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 font-medium">Page:</span>
                  <input
                    type="number"
                    min={1}
                    value={annPage}
                    onChange={(e) => setAnnPage(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-16 bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 text-center text-zinc-200"
                  />
                  <div className="flex items-center gap-1 ml-auto">
                    {["yellow", "green", "blue"].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setAnnColor(c)}
                        className={`h-4 w-4 rounded-full border transition-transform ${
                          c === "yellow" ? "bg-yellow-500" : c === "green" ? "bg-emerald-500" : "bg-blue-500"
                        } ${c === annColor ? "scale-120 border-white" : "border-transparent"}`}
                      />
                    ))}
                  </div>
                </div>
                <textarea
                  placeholder="Paste highlighted text snippet..."
                  value={annText}
                  onChange={(e) => setAnnText(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-300 resize-none h-12"
                />
                <textarea
                  placeholder="Add your notes/sticky comments..."
                  value={annNotes}
                  onChange={(e) => setAnnNotes(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-zinc-300 resize-none h-12"
                />
                <button
                  type="submit"
                  className="w-full bg-amber-600 hover:bg-amber-500 text-zinc-950 font-bold rounded py-1 cursor-pointer transition-colors"
                >
                  Save Sticky Note
                </button>
              </form>

              {/* Annotations List */}
              <div className="space-y-2 overflow-y-auto flex-1 mt-2">
                {annotations.map((ann) => (
                  <div key={ann.id} className="bg-zinc-950/40 border border-zinc-850 rounded p-2.5 text-[11px] space-y-2">
                    <div className="flex justify-between items-center text-[9px] text-zinc-500 font-bold shrink-0">
                      <span>PAGE {ann.page}</span>
                      <button
                        onClick={() => void deleteAnnotation(ann.id)}
                        className="text-zinc-650 hover:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                    {ann.text && (
                      <blockquote className={`pl-2 border-l-2 text-zinc-300 bg-zinc-900/40 p-1.5 rounded ${
                        ann.color === "yellow" ? "border-yellow-500" : ann.color === "green" ? "border-emerald-500" : "border-blue-500"
                      }`}>
                        "{ann.text}"
                      </blockquote>
                    )}
                    {ann.notes && <p className="text-zinc-400 leading-relaxed">{ann.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 gap-2">
          <FolderOpen className="h-8 w-8 text-zinc-700" />
          <span className="text-sm">Select or attach a file to get started</span>
        </div>
      )}

      {/* Attach File Modal Dialog */}
      {isAttachOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-sm w-full p-6 space-y-4 shadow-xl text-xs">
            <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <Plus className="h-4 w-4 text-amber-500" /> Attach Local File
            </h3>
            <form onSubmit={(e) => void handleAttachSubmit(e)} className="space-y-3">
              <div className="space-y-1">
                <label className="text-zinc-400 font-medium">Attachment Name</label>
                <input
                  type="text"
                  placeholder="e.g. Q3 Design Proposal"
                  value={attachName}
                  onChange={(e) => setAttachName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500/50"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-zinc-400 font-medium">Absolute Local File Path</label>
                <input
                  type="text"
                  placeholder="e.g. /home/user/Downloads/spec.pdf"
                  value={attachPath}
                  onChange={(e) => setAttachPath(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500/50"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-zinc-400 font-medium">File Type</label>
                <select
                  value={attachMime}
                  onChange={(e) => setAttachMime(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500/50"
                >
                  <option value="application/pdf">PDF Document (*.pdf)</option>
                  <option value="image/png">PNG Image (*.png)</option>
                  <option value="image/jpeg">JPEG Image (*.jpg, *.jpeg)</option>
                  <option value="audio/mpeg">MP3 Audio (*.mp3)</option>
                  <option value="video/mp4">MP4 Video (*.mp4)</option>
                </select>
              </div>

              {attachError && <div className="text-red-400 bg-red-950/30 border border-red-900/50 rounded p-2">{attachError}</div>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAttachOpen(false)}
                  className="bg-zinc-850 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 rounded px-3 py-1.5 cursor-pointer font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-500 text-zinc-950 rounded px-4 py-1.5 font-semibold cursor-pointer"
                >
                  Attach
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
