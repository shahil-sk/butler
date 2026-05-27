import React from "react";

interface MarkdownPreviewProps {
  content: string;
}

export const generateSlug = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
};

export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ content }) => {
  const parseInline = (line: string): React.ReactNode[] => {
    const tokens: React.ReactNode[] = [];
    const regex = /\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`/g;
    
    let match;
    let lastIndex = 0;
    let matchCount = 0;
    
    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        tokens.push(line.substring(lastIndex, match.index));
      }
      
      const key = `${match.index}-${matchCount++}`;
      if (match[0].startsWith("**")) {
        tokens.push(<strong key={key} className="font-bold text-zinc-100">{match[1]}</strong>);
      } else if (match[0].startsWith("*")) {
        tokens.push(<em key={key} className="italic text-zinc-300">{match[2]}</em>);
      } else if (match[0].startsWith("`")) {
        tokens.push(<code key={key} className="bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-200 text-xs font-mono">{match[3]}</code>);
      }
      
      lastIndex = regex.lastIndex;
    }
    
    if (lastIndex < line.length) {
      tokens.push(line.substring(lastIndex));
    }
    
    return tokens.length > 0 ? tokens : [line];
  };

  const renderContent = () => {
    const lines = content.split("\n");
    const elements: React.ReactNode[] = [];
    let inList = false;
    let listItems: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Code blocks
      if (line.startsWith("```")) {
        if (inCodeBlock) {
          elements.push(
            <pre key={`code-${i}`} className="bg-zinc-950/60 border border-zinc-800 rounded-lg p-3 text-xs font-mono text-zinc-300 overflow-x-auto my-3">
              <code>{codeLines.join("\n")}</code>
            </pre>
          );
          inCodeBlock = false;
          codeLines = [];
        } else {
          inCodeBlock = true;
        }
        continue;
      }

      if (inCodeBlock) {
        codeLines.push(line);
        continue;
      }

      // Bullet points
      if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
        const contentVal = line.trim().substring(2);
        if (!inList) {
          inList = true;
          listItems = [];
        }
        listItems.push(
          <li key={`li-${i}`} className="text-zinc-350 text-sm leading-relaxed mb-1 pl-1">
            {parseInline(contentVal)}
          </li>
        );
        continue;
      } else if (inList && line.trim() !== "") {
        if (!line.startsWith(" ") && !line.startsWith("\t")) {
          elements.push(
            <ul key={`ul-${i}`} className="list-disc pl-5 my-2 space-y-1 text-zinc-400">
              {[...listItems]}
            </ul>
          );
          inList = false;
        }
      } else if (inList && line.trim() === "") {
        elements.push(
          <ul key={`ul-${i}`} className="list-disc pl-5 my-2 space-y-1 text-zinc-400">
            {[...listItems]}
          </ul>
        );
        inList = false;
      }

      // Headers
      if (line.startsWith("# ")) {
        const text = line.substring(2);
        const slug = generateSlug(text);
        elements.push(
          <h1 id={slug} key={`h1-${i}`} className="text-xl font-extrabold text-zinc-150 mt-6 mb-3 border-b border-zinc-800 pb-1 scroll-mt-6">
            {parseInline(text)}
          </h1>
        );
      } else if (line.startsWith("## ")) {
        const text = line.substring(3);
        const slug = generateSlug(text);
        elements.push(
          <h2 id={slug} key={`h2-${i}`} className="text-lg font-bold text-zinc-200 mt-5 mb-2 scroll-mt-6">
            {parseInline(text)}
          </h2>
        );
      } else if (line.startsWith("### ")) {
        const text = line.substring(4);
        const slug = generateSlug(text);
        elements.push(
          <h3 id={slug} key={`h3-${i}`} className="text-base font-semibold text-zinc-300 mt-4 mb-2 scroll-mt-6">
            {parseInline(text)}
          </h3>
        );
      } else if (line.trim() === "") {
        elements.push(<div key={`br-${i}`} className="h-2" />);
      } else {
        elements.push(
          <p key={`p-${i}`} className="text-zinc-350 text-sm leading-relaxed my-2">
            {parseInline(line)}
          </p>
        );
      }
    }

    if (inList) {
      elements.push(
        <ul key="ul-end" className="list-disc pl-5 my-2 space-y-1 text-zinc-400">
          {listItems}
        </ul>
      );
    }

    return elements;
  };

  return (
    <div className="prose prose-zinc prose-invert max-w-none pb-24">
      {renderContent()}
    </div>
  );
};
