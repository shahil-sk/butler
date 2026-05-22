import { cn } from "@/shared/utils";

export interface ViewOption<T extends string> {
  value: T;
  icon: React.ElementType;
  label: string;
}

export function ViewSwitcher<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ViewOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-surface-2 border border-border/60 shrink-0">
      {options.map(({ value: v, icon: Icon, label }) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          title={label}
          aria-label={label}
          className={cn(
            "p-1.5 rounded transition-fast",
            value === v
              ? "bg-background text-foreground shadow-sm ring-1 ring-border/50"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Icon size={12} />
        </button>
      ))}
    </div>
  );
}
