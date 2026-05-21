// Re-export from the canonical location one level up.
// The barrel (ui.tsx) exports from here; the file at
// src/shared/ui/RichEditor.tsx is the actual implementation.
export { RichEditor, type RichEditorProps } from "../RichEditor";
