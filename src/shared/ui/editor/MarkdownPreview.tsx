import React from "react";
import { cn } from "@/shared/utils";

interface MarkdownPreviewProps {
  content: string;
  className?: string;
}

/**
 * Render-only markdown preview.
 * Renders raw markdown as pre-formatted text until a full
 * markdown renderer (e.g. remark) is wired in.
 * Used by Research module for chunk/document display.
 */
export function MarkdownPreview({ content, className }: MarkdownPreviewProps) {
  return (
    <pre
      className={cn(
        "whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground",
        className
      )}
    >
      {content}
    </pre>
  );
}
