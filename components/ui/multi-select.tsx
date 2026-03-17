"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type MultiSelectOption<T extends string> = {
  value: T;
  label: string;
};

interface MultiSelectProps<T extends string> {
  label: string;
  options: MultiSelectOption<T>[];
  value: T[];
  onChange: (next: T[]) => void;
  size?: "sm" | "default";
  className?: string;
  disabled?: boolean;
}

function sortByOptionsOrder<T extends string>(
  options: MultiSelectOption<T>[],
  values: T[]
): T[] {
  const order = new Map(options.map((o, i) => [o.value, i] as const));
  return [...values].sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999));
}

export function MultiSelect<T extends string>({
  label,
  options,
  value,
  onChange,
  size = "sm",
  className,
  disabled,
}: MultiSelectProps<T>) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  const selected = useMemo(() => sortByOptionsOrder(options, value), [options, value]);
  const selectedLabels = useMemo(() => {
    const byValue = new Map(options.map((o) => [o.value, o.label] as const));
    return selected.map((v) => byValue.get(v) ?? v);
  }, [options, selected]);

  const buttonText =
    selected.length === 0
      ? `${label}: Todos`
      : selected.length === options.length
        ? `${label}: Todos`
        : `${label}: ${selectedLabels.join(", ")}`;

  const toggleValue = (v: T) => {
    const has = value.includes(v);
    const next = has ? value.filter((x) => x !== v) : [...value, v];
    onChange(sortByOptionsOrder(options, next));
  };

  const selectAll = () => onChange(options.map((o) => o.value));
  const clearAll = () => onChange([]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <Button
        id={id}
        type="button"
        variant="outline"
        size={size}
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className="max-w-[18rem] justify-start text-left"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{buttonText}</span>
      </Button>

      {open && (
        <div
          role="listbox"
          aria-labelledby={id}
          className="absolute right-0 z-50 mt-2 w-72 rounded-lg border bg-popover p-2 text-popover-foreground shadow-md"
        >
          <div className="flex items-center justify-between gap-2 px-1 pb-2">
            <span className="text-xs font-medium text-muted-foreground">{label}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                onClick={selectAll}
              >
                Selecionar todos
              </button>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                onClick={clearAll}
              >
                Limpar
              </button>
            </div>
          </div>

          <div className="max-h-64 overflow-auto pr-1">
            {options.map((opt) => {
              const checked = value.includes(opt.value);
              return (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleValue(opt.value)}
                    className="size-4"
                  />
                  <span className="text-sm">{opt.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

