import React from "react";
import { Compass, FileText, Sparkles } from "lucide-react";
import { Note, Backlink } from "../types";

interface NoteBacklinksProps {
  activeNote: Note | null;
  backlinks: Backlink[];
  semanticLinks: { note: Note; similarity: number }[];
  onWikilinkClick: (title: string) => Promise<void>;
}

export const NoteBacklinks: React.FC<NoteBacklinksProps> = ({
  activeNote,
  backlinks,
  semanticLinks,
  onWikilinkClick,
}) => {
  return (
    <div className="lg:col-span-1 bg-zinc-900/5 border border-zinc-850 rounded-2xl p-5 flex flex-col h-full overflow-hidden gap-6">
      {/* Structural Wiki Backlinks */}
      <div className="flex-1 flex flex-col min-h-0">
        <h3 className="text-xs font-bold text-zinc-300 flex items-center gap-2 border-b border-zinc-850 pb-3 mb-3 shrink-0 uppercase tracking-wider">
          <Compass className="w-4 h-4 text-amber-500" />
          Wiki Backlinks
          {backlinks.length > 0 && (
            <span className="text-[10px] bg-zinc-900 border border-zinc-850 text-zinc-400 px-1.5 py-0.2 rounded-full font-bold">
              {backlinks.length}
            </span>
          )}
        </h3>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {!activeNote ? (
            <div className="text-center py-6 text-zinc-650 text-xs">
              Select a note.
            </div>
          ) : backlinks.length === 0 ? (
            <div className="text-center py-6 text-zinc-650 text-[11px] leading-relaxed">
              No back references yet. Use <code className="bg-zinc-950 px-1 py-0.5 rounded text-zinc-500 font-mono">[[{activeNote.title}]]</code> elsewhere.
            </div>
          ) : (
            backlinks.map((link) => (
              <div
                key={link.id}
                onClick={() => void onWikilinkClick(link.title)}
                className="p-2 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 rounded-xl cursor-pointer transition-all flex items-center gap-2 hover:bg-zinc-900/30 group"
              >
                <FileText className="w-3.5 h-3.5 text-zinc-500 group-hover:text-amber-500 transition-colors" />
                <span className="text-[11px] font-semibold text-zinc-400 group-hover:text-zinc-200 truncate">
                  {link.title}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Semantic Connections (AI Embeddings) */}
      <div className="flex-1 flex flex-col min-h-0">
        <h3 className="text-xs font-bold text-zinc-300 flex items-center gap-2 border-b border-zinc-850 pb-3 mb-3 shrink-0 uppercase tracking-wider">
          <Sparkles className="w-4 h-4 text-amber-500" />
          Semantic Links
          {semanticLinks.length > 0 && (
            <span className="text-[10px] bg-zinc-900 border border-zinc-850 text-zinc-400 px-1.5 py-0.2 rounded-full font-bold">
              {semanticLinks.length}
            </span>
          )}
        </h3>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {!activeNote ? (
            <div className="text-center py-6 text-zinc-650 text-xs">
              Select a note.
            </div>
          ) : semanticLinks.length === 0 ? (
            <div className="text-center py-6 text-zinc-650 text-[11px] leading-relaxed">
              Click "Find Similar" in the editor toolbar to discover semantic relationships.
            </div>
          ) : (
            semanticLinks.map(({ note, similarity }) => (
              <div
                key={note.id}
                onClick={() => void onWikilinkClick(note.title)}
                className="p-2 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 rounded-xl cursor-pointer transition-all flex items-center justify-between gap-2 hover:bg-zinc-900/30 group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-3.5 h-3.5 text-zinc-500 group-hover:text-amber-500 transition-colors" />
                  <span className="text-[11px] font-semibold text-zinc-400 group-hover:text-zinc-200 truncate">
                    {note.title}
                  </span>
                </div>
                <span className="text-[9px] font-bold text-amber-500/80 shrink-0 font-mono">
                  {Math.round(similarity * 100)}%
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
