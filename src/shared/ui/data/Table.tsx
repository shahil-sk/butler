import { type ReactNode, useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/shared/utils";

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <table className="w-full text-xs border-collapse">{children}</table>
    </div>
  );
}

export function Thead({ children }: { children: ReactNode }) {
  return <thead className="border-b border-border bg-surface-2">{children}</thead>;
}

export function Tbody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-border/50">{children}</tbody>;
}

export function Tr({
  children,
  onClick,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        "transition-colors",
        onClick && "cursor-pointer hover:bg-accent/50",
        className
      )}
    >
      {children}
    </tr>
  );
}

export function Th({
  children,
  sortKey,
  sortState,
  onSort,
  className,
}: {
  children: ReactNode;
  sortKey?: string;
  sortState?: { key: string; dir: "asc" | "desc" } | null;
  onSort?: (key: string) => void;
  className?: string;
}) {
  const active = sortState?.key === sortKey;
  return (
    <th
      className={cn(
        "px-3 py-2 text-left font-semibold text-muted-foreground uppercase tracking-wide text-[10px] whitespace-nowrap select-none",
        sortKey && "cursor-pointer hover:text-foreground",
        className
      )}
      onClick={() => sortKey && onSort?.(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sortKey && (
          <span className={cn("opacity-0", active && "opacity-100")}>
            {sortState?.dir === "asc" ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </span>
        )}
      </span>
    </th>
  );
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn("px-3 py-2 text-foreground/80", className)}>{children}</td>;
}

/** useSortableTable — simple client-side sort state helper */
export function useSortableTable(defaultKey = "") {
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: defaultKey, dir: "asc" });
  const toggle = (key: string) =>
    setSort((s) => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });
  return { sort, toggle };
}
