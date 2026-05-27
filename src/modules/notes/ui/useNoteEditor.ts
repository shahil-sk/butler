import { useState, useEffect, useRef, useMemo } from "react";
import { useNotesStore } from "../state/notesStore";
import { Note } from "../types";

interface UseNoteEditorProps {
  activeNote: Note;
  onSemanticLinksFound: (results: { note: Note; similarity: number }[]) => void;
}

export const useNoteEditor = ({ activeNote, onSemanticLinksFound }: UseNoteEditorProps) => {
  const { notes, updateNote, generateNoteEmbedding } = useNotesStore();

  const [localTitle, setLocalTitle] = useState("");
  const [localContent, setLocalContent] = useState("");
  const [localTags, setLocalTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [editMode, setEditMode] = useState<"edit" | "preview">("edit");

  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isFindingLinks, setIsFindingLinks] = useState(false);

  const [isAutocompleteOpen, setIsAutocompleteOpen] = useState(false);
  const [autocompleteSearch, setAutocompleteSearch] = useState("");
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync state when activeNote changes
  useEffect(() => {
    setLocalTitle(activeNote.title);
    setLocalContent(activeNote.content);
    setLocalTags(activeNote.tags || []);
    setSaveStatus("saved");
    setIsAutocompleteOpen(false);
  }, [activeNote]);

  // Debounced auto-save
  useEffect(() => {
    const hasChanged =
      localTitle !== activeNote.title ||
      localContent !== activeNote.content ||
      JSON.stringify(localTags) !== JSON.stringify(activeNote.tags);

    if (!hasChanged) return;
    setSaveStatus("unsaved");

    const timer = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        await updateNote(activeNote.id, localTitle, localContent, localTags, activeNote.metadata);
        setSaveStatus("saved");
        void generateNoteEmbedding(activeNote.id);
      } catch (e) {
        console.error(e);
        setSaveStatus("unsaved");
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [localTitle, localContent, localTags, activeNote, updateNote, generateNoteEmbedding]);

  const saveImmediately = async () => {
    const hasChanged =
      localTitle !== activeNote.title ||
      localContent !== activeNote.content ||
      JSON.stringify(localTags) !== JSON.stringify(activeNote.tags);

    if (hasChanged) {
      setSaveStatus("saving");
      try {
        await updateNote(activeNote.id, localTitle, localContent, localTags, activeNote.metadata);
        setSaveStatus("saved");
        void generateNoteEmbedding(activeNote.id);
      } catch (e) {
        console.error(e);
        setSaveStatus("unsaved");
      }
    }
  };

  const handleSummarize = async () => {
    if (!localContent.trim()) return;
    setIsSummarizing(true);
    try {
      const aiStore = (await import("../../../core/state/aiStore")).useAIStore.getState();
      const aiService = await import("../../../core/services/aiService");
      const config = {
        provider: aiStore.provider,
        apiKey: aiStore.apiKey,
        model: aiStore.model || "llama3",
      };
      const prompt = `Summarize the following note content in a concise, bullet-pointed summary. Add a short header: "### AI Summary".\n\n${localContent}`;
      const summary = await aiService.generateCompletion(prompt, "You are a note summarizer assistant.", config);
      
      const newContent = `${localContent}\n\n${summary}`;
      setLocalContent(newContent);
      setSaveStatus("saving");
      await updateNote(activeNote.id, localTitle, newContent, localTags, activeNote.metadata);
      setSaveStatus("saved");
      void generateNoteEmbedding(activeNote.id);
    } catch (err) {
      console.error("Failed to summarize note:", err);
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleFindSemanticLinks = async () => {
    setIsFindingLinks(true);
    try {
      const aiStore = (await import("../../../core/state/aiStore")).useAIStore.getState();
      const aiService = await import("../../../core/services/aiService");
      
      let currentEmbedding: number[] | null = null;
      try {
        const parsed = JSON.parse(activeNote.metadata || "{}");
        if (Array.isArray(parsed.embedding)) currentEmbedding = parsed.embedding;
      } catch {}

      if (!currentEmbedding && localContent.trim()) {
        const config = {
          provider: aiStore.provider,
          apiKey: aiStore.apiKey,
          model: aiStore.embeddingModel || "nomic-embed-text",
        };
        currentEmbedding = await aiService.generateEmbeddings(localContent, config);
        
        let parsedMetadata: any = {};
        try { parsedMetadata = JSON.parse(activeNote.metadata || "{}"); } catch {}
        parsedMetadata.embedding = currentEmbedding;
        const metaStr = JSON.stringify(parsedMetadata);
        await updateNote(activeNote.id, localTitle, localContent, localTags, metaStr);
      }

      if (!currentEmbedding) {
        onSemanticLinksFound([]);
        return;
      }

      const results: { note: Note; similarity: number }[] = [];
      for (const note of notes) {
        if (note.id === activeNote.id) continue;
        try {
          const parsed = JSON.parse(note.metadata || "{}");
          if (Array.isArray(parsed.embedding)) {
            const sim = aiService.calculateCosineSimilarity(currentEmbedding, parsed.embedding);
            if (sim > 0.1) results.push({ note, similarity: sim });
          }
        } catch {}
      }

      results.sort((a, b) => b.similarity - a.similarity);
      onSemanticLinksFound(results.slice(0, 5));
    } catch (err) {
      console.error("Failed to find semantic links:", err);
    } finally {
      setIsFindingLinks(false);
    }
  };

  const filteredNotes = useMemo(() => {
    if (!isAutocompleteOpen) return [];
    return notes
      .filter((n) => n.id !== activeNote.id)
      .filter((n) => n.title.toLowerCase().includes(autocompleteSearch.toLowerCase()))
      .slice(0, 5);
  }, [notes, activeNote.id, isAutocompleteOpen, autocompleteSearch]);

  const insertAutocomplete = (title: string) => {
    if (!textareaRef.current) return;
    const text = localContent;
    const selectionStart = textareaRef.current.selectionStart;
    const textBeforeCursor = text.substring(0, selectionStart);
    const textAfterCursor = text.substring(selectionStart);

    const lastTriggerIndex = textBeforeCursor.lastIndexOf("[[");
    if (lastTriggerIndex !== -1) {
      const newTextBefore = textBeforeCursor.substring(0, lastTriggerIndex) + `[[${title}]]`;
      const newText = newTextBefore + textAfterCursor;
      setLocalContent(newText);
      setIsAutocompleteOpen(false);

      const newCursorPos = newTextBefore.length;
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setLocalContent(text);

    const selectionStart = e.target.selectionStart;
    const textBeforeCursor = text.substring(0, selectionStart);
    const match = textBeforeCursor.match(/\[\[([^\]]*)$/);

    if (match) {
      setIsAutocompleteOpen(true);
      setAutocompleteSearch(match[1]);
      setAutocompleteIndex(0);
    } else {
      setIsAutocompleteOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isAutocompleteOpen && filteredNotes.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setAutocompleteIndex((prev) => (prev + 1) % filteredNotes.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setAutocompleteIndex((prev) => (prev - 1 + filteredNotes.length) % filteredNotes.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        insertAutocomplete(filteredNotes[autocompleteIndex].title);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setIsAutocompleteOpen(false);
      }
    }
  };

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !localTags.includes(trimmed)) {
      setLocalTags([...localTags, trimmed]);
    }
    setTagInput("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setLocalTags(localTags.filter((t) => t !== tagToRemove));
  };

  return {
    localTitle,
    setLocalTitle,
    localContent,
    setLocalContent,
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
  };
};
