import { cn } from "@/shared/utils";

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-border/60", className)} />;
}

export function ToolbarSeparator() {
  return <div className="w-px h-3.5 bg-border mx-0.5 shrink-0" />;
}
