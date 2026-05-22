import React from "react";
import { cn } from "@/shared/utils";

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
}

export function Checkbox({ label, className, id, ...props }: CheckboxProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <label htmlFor={inputId} className="flex items-center gap-2 cursor-pointer select-none">
      <input
        type="checkbox"
        id={inputId}
        className={cn(
          "w-4 h-4 rounded border-border accent-primary cursor-pointer",
          className
        )}
        {...props}
      />
      {label && <span className="text-sm text-foreground">{label}</span>}
    </label>
  );
}

export interface CheckboxGroupProps {
  label?: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (values: string[]) => void;
  className?: string;
}

export function CheckboxGroup({ label, options, value, onChange, className }: CheckboxGroupProps) {
  const toggle = (v: string) =>
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <fieldset className={cn("flex flex-col gap-2", className)}>
      {label && <legend className="text-sm font-medium text-foreground mb-1">{label}</legend>}
      {options.map((o) => (
        <Checkbox
          key={o.value}
          label={o.label}
          checked={value.includes(o.value)}
          onChange={() => toggle(o.value)}
        />
      ))}
    </fieldset>
  );
}
