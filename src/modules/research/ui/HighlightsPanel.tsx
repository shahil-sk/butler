import { EmptyState } from "@/shared/ui";

export function HighlightsPanel({
  highlights,
  onDelete,
}: {
  highlights: any[];
  onDelete: (id: string) => void;
}) {
  if (highlights.length === 0) {
    return (
      <EmptyState
        title="No highlights"
        subtitle="Select text in a chunk then click ★ to highlight."
      />
    );
  }
  return (
    <div className="px-3 py-2 space-y-2">
      {highlights.map((h) => (
        <div
          key={h.id}
          className="group rounded-md border border-amber-500/20 bg-amber-500/[0.05] px-3 py-2"
        >
          <p className="text-[11px] text-foreground/80 leading-relaxed line-clamp-3">{h.text}</p>
          {h.note && (
            <p className="text-[10px] text-muted-foreground mt-1 italic">{h.note}</p>
          )}
          <button
            type="button"
            onClick={() => onDelete(h.id)}
            className="mt-1.5 opacity-0 group-hover:opacity-100 text-[10px] text-red-400 hover:text-red-500 transition-fast"
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}
