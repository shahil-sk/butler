import { type ReactNode } from "react";

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex items-center px-1.5 py-0.5 rounded border border-border bg-surface-2 text-[10px] font-mono text-muted-foreground shadow-[0_1px_0_1px_hsl(var(--border))] select-none">
      {children}
    </kbd>
  );
}
