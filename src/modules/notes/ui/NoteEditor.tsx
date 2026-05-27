import React from "react";
import { Edit3, Eye, Tag, X, Sparkles, Wand2, FileText } from "lucide-react";
import { Note } from "../types";
import { MarkdownPreview } from "./MarkdownPreview";
import { useNoteEditor } from "./useNoteEditor";

interface NoteEditorProps {
  activeNote: Note;
  onWikilinkClick: (title: string) => Promise<void>;
  onSemanticLinksFound: (results: { note: Note; similarity: number }[]) => void;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({
  activeNote,
  onWikilinkClick,
  onSemanticLinksFound,
}) => {
  const {
    localTitle,
    setLocalTitle,
    localContent,
    localTags,
    tagInput,
    setTagInput,
    saveStatus,
    editMode,
    setEditMode,
    isSummarizing,
    isFindingLinks,
    isAutocompleteOpen,
    autocompleteIndex,
    textareaRef,
    saveImmediately,
    handleSummarize,
    handleFindSemanticLinks,
    filteredNotes,
    insertAutocomplete,
    handleTextareaChange,
    handleKeyDown,
    handleAddTag,
    handleRemoveTag,
  } = useNoteEditor({ activeNote, onSemanticLinksFound });

  return (
    <div className="lg:col-span-2 bg-zinc-900/10 border border-zinc-850 rounded-2xl p-5 flex flex-col h-full overflow-hidden relative">
      <div className="flex items-center justify-between border-b border-zinc-850 pb-4 mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex bg-zinc-950 border border-zinc-800 rounded-xl p-0.5">
            <button
              onClick={() => setEditMode("edit")}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                editMode === "edit" ? "bg-zinc-800 text-zinc-100 shadow-sm" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" /> Edit
            </button>
            <button
              onClick={() => { void saveImmediately(); setEditMode("preview"); }}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                editMode === "preview" ? "bg-zinc-800 text-zinc-100 shadow-sm" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Eye className="w-3.5 h-3.5" /> Preview
            </button>
          </div>
          
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
            <span className={`w-1.5 h-1.5 rounded-full ${
              saveStatus === "saved" ? "bg-emerald-500" : saveStatus === "saving" ? "bg-amber-500 animate-pulse" : "bg-rose-500"
            }`} />
            <span className="capitalize">{saveStatus === "saving" ? "Saving..." : saveStatus}</span>
          </div>
        </div>

        {/* AI Actions Toolbar */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleSummarize}
            disabled={isSummarizing || !localContent.trim()}
            className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 disabled:opacity-40 disabled:hover:bg-amber-500/10 flex items-center gap-1 transition-all cursor-pointer"
            title="Summarize Note via LLM"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isSummarizing ? "animate-spin" : ""}`} />
            {isSummarizing ? "Summarizing..." : "Summarize"}
          </button>

          <button
            onClick={handleFindSemanticLinks}
            disabled={isFindingLinks}
            className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold bg-zinc-800 hover:bg-zinc-750 text-zinc-350 disabled:opacity-40 disabled:hover:bg-zinc-850 flex items-center gap-1 transition-all cursor-pointer"
            title="Find semantic context links"
          >
            <Wand2 className={`w-3.5 h-3.5 ${isFindingLinks ? "animate-pulse text-amber-500" : ""}`} />
            {isFindingLinks ? "Matching..." : "Find Similar"}
          </button>
        </div>
      </div>

      <input
        type="text"
        value={localTitle}
        onChange={(e) => setLocalTitle(e.target.value)}
        placeholder="Note title..."
        className="text-xl font-bold bg-transparent text-zinc-100 outline-none w-full pb-2 mb-3 shrink-0"
      />

      <div className="flex flex-wrap items-center gap-1.5 mb-4 border-b border-zinc-850/50 pb-3 shrink-0">
        <Tag className="w-3.5 h-3.5 text-zinc-500" />
        {localTags.map((tag) => (
          <span
            key={tag}
            className="text-[10px] bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 pl-2 pr-1.5 py-0.5 rounded-lg flex items-center gap-1 transition-all"
          >
            #{tag}
            <button type="button" onClick={() => handleRemoveTag(tag)} className="text-zinc-500 hover:text-rose-400 cursor-pointer">
              <X className="w-2.5 h-2.5" />
            </button>
          </span>
        ))}
        <form onSubmit={handleAddTag} className="inline-block">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            placeholder="Add tag..."
            className="bg-transparent border-0 outline-none text-[10px] text-zinc-400 placeholder-zinc-650 w-24"
          />
        </form>
      </div>

      <div className="flex-1 flex flex-col overflow-y-auto min-h-0 relative">
        {editMode === "edit" ? (
          <>
            <textarea
              ref={textareaRef}
              value={localContent}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="Start writing... Use [[Note Title]] to link other notes."
              className="bg-transparent text-zinc-200 text-xs outline-none resize-none flex-1 font-mono leading-relaxed"
            />

            {isAutocompleteOpen && filteredNotes.length > 0 && (
              <div className="absolute left-2 top-8 z-50 w-64 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl p-1 backdrop-blur-md">
                <div className="text-[9px] text-zinc-500 px-2 py-1 uppercase font-bold tracking-wider border-b border-zinc-900">
                  Wiki Autocomplete
                </div>
                {filteredNotes.map((item, idx) => (
                  <div
                    key={item.id}
                    onClick={() => insertAutocomplete(item.title)}
                    className={`p-2 rounded-lg text-[10px] font-semibold cursor-pointer flex items-center gap-1.5 transition-all ${
                      idx === autocompleteIndex ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 text-zinc-500" />
                    {item.title}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <MarkdownPreview content={localContent} onWikilinkClick={onWikilinkClick} />
        )}
      </div>
    </div>
  );
};
