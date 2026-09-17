"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface DropdownFilterOption {
  value: string;
  label: string;
  colorCode?: string;
}

interface DropdownFilterProps {
  label: string;
  value: string | string[] | null | undefined;
  options: DropdownFilterOption[];
  onChange: (value: string | string[] | null) => void;
  multiple?: boolean;
}

export function DropdownFilter({ label, value, options, onChange, multiple = false }: DropdownFilterProps) {
  const selectedValues = Array.isArray(value) ? value : value ? [value] : [];
  const selectedKey = selectedValues.join("\0");

  const [pending, setPending] = useState<string[]>(selectedValues);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) return;
    setPending((prev) => {
      const next = selectedKey ? selectedKey.split("\0") : [];
      if (prev.length === next.length && prev.every((v, i) => v === next[i])) return prev;
      return next;
    });
  }, [open, selectedKey]);

  const activeCount = selectedValues.length;

  const toggle = (optionValue: string) => {
    if (multiple) {
      setPending((prev) =>
        prev.includes(optionValue) ? prev.filter((v) => v !== optionValue) : [...prev, optionValue],
      );
    } else {
      setPending((prev) => (prev[0] === optionValue ? [] : [optionValue]));
    }
  };

  const apply = () => {
    if (multiple) onChange(pending.length ? pending : null);
    else onChange(pending[0] ?? null);
    setOpen(false);
  };

  const clear = () => {
    setPending([]);
    onChange(null);
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("h-8 gap-1.5", activeCount > 0 && "border-primary text-primary")}
          data-testid={`filter-${label.toLowerCase().replace(/\s+/g, "-")}`}
        >
          {label}
          {activeCount > 0 && (
            <Badge variant="secondary" className="h-5 rounded px-1.5 text-[10px]">
              {activeCount}
            </Badge>
          )}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-56 space-y-1 overflow-y-auto p-1">
          {options.map((option) => {
            const checked = pending.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted"
                onClick={() => toggle(option.value)}
              >
                {multiple ? (
                  <Checkbox checked={checked} className="pointer-events-none" tabIndex={-1} />
                ) : (
                  <span className="flex h-4 w-4 items-center justify-center">
                    {checked ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
                  </span>
                )}
                {option.colorCode && (
                  <span className="h-2 w-2 rounded-full" style={{ background: option.colorCode }} />
                )}
                <span className="truncate">{option.label}</span>
              </button>
            );
          })}
        </div>
        <DropdownMenuSeparator />
        <div className="flex items-center justify-between gap-2 p-1">
          <Button type="button" variant="ghost" size="sm" className="h-7" onClick={clear}>
            Clear
          </Button>
          <Button type="button" size="sm" className="h-7" onClick={apply}>
            Apply
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
