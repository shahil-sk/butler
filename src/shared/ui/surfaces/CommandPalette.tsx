import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";
import { cn } from "@/shared/utils";

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: React.ElementType;
  group?: string;
  shortcut?: string;
  onSelect: () => void;
}

export function CommandPalette({
  open,
  onClose,
  items,
  placeholder = "Type a command…",
}: {
  open: boolean;
  onClose: () => void;
  items: CommandItem[];
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? items.filter(
        (i) =>
          i.label.toLowerCase().includes(query.toLowerCase()) ||
          i.description?.toLowerCase().includes(query.toLowerCase())
      )
    : items;

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, filtered.length - 1)); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); return; }
      if (e.key === "Enter" && filtered[activeIdx]) { filtered[activeIdx].onSelect(); onClose(); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose, filtered, activeIdx]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-start justify-center pt-[15vh]">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[3px]" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[560px] mx-4 rounded-2xl border border-border bg-background shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
          <Search size={14} className="text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          {query && (
            <button onClick={() => setQuery("")} className="p-0.5 rounded hover:bg-accent text-muted-foreground">
              <X size={12} />
            </button>
          )}
        </div>
        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto py-1.5">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">No commands found</div>
          ) : (
            filtered.map((item, i) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => { item.onSelect(); onClose(); }}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5 text-xs text-left transition-colors",
                    i === activeIdx ? "bg-accent" : "hover:bg-accent/50"
                  )}
                >
                  {Icon ? (
                    <Icon size={14} className="shrink-0 text-muted-foreground" />
                  ) : (
                    <span className="w-[14px]" />
                  )}
                  <span className="flex-1">
                    <span className="text-foreground font-medium">{item.label}</span>
                    {item.description && (
                      <span className="ml-1.5 text-muted-foreground">{item.description}</span>
                    )}
                  </span>
                  {item.shortcut && (
                    <span className="text-muted-foreground/50 font-mono text-[10px]">{item.shortcut}</span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
