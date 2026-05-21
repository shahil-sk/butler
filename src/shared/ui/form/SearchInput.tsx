import React, { useRef } from "react";
import { cn } from "@/shared/utils";
import { debounce } from "@/shared/utils";

export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "type"> {
  value: string;
  onChange: (value: string) => void;
  debounceMs?: number;
  onClear?: () => void;
  className?: string;
}

export function SearchInput({ value, onChange, debounceMs, onClear, className, placeholder = "Search…", ...props }: SearchInputProps) {
  const debouncedOnChange = useRef(
    debounceMs ? debounce((v: unknown) => onChange(v as string), debounceMs) : (v: unknown) => onChange(v as string)
  ).current;

  return (
    <div className={cn("relative flex items-center", className)}>
      <svg
        className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none"
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(e) => debouncedOnChange(e.target.value)}
        className={cn(
          "w-full rounded-md border border-border bg-background pl-9 pr-8 py-2 text-sm",
          "placeholder:text-muted-foreground",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
        )}
        {...props}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => { onChange(""); onClear?.(); }}
          className="absolute right-3 text-muted-foreground hover:text-foreground"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
