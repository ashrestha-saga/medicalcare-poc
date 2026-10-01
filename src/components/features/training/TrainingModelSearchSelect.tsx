"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { TrainingModelOptionDTO } from "@/interfaces";

/**
 * Searchable device-model picker for the training form.
 * Native <select> cannot filter; this keeps the same field styling.
 */
export function TrainingModelSearchSelect({
  models,
  value,
  onChange,
  disabled,
}: {
  models: TrainingModelOptionDTO[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = models.find((m) => m.id === value) ?? null;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(selected?.name ?? "");

  useEffect(() => {
    if (!open) setQuery(selected?.name ?? "");
  }, [selected?.name, open, value]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return models;
    return models.filter((m) => m.name.toLowerCase().includes(q));
  }, [models, query]);

  if (models.length === 0) {
    return (
      <input
        type="text"
        className="p-train__model-search-input"
        value=""
        disabled
        placeholder="No inventory models"
        data-testid="training-subject-model"
      />
    );
  }

  return (
    <div className="p-train__model-search" ref={rootRef}>
      <input
        type="search"
        className="p-train__model-search-input"
        value={query}
        disabled={disabled}
        placeholder="Search device model…"
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        data-testid="training-subject-model"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (selected && e.target.value !== selected.name) onChange("");
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            setQuery(selected?.name ?? "");
          }
          if (e.key === "Enter" && filtered.length === 1) {
            e.preventDefault();
            onChange(filtered[0]!.id);
            setQuery(filtered[0]!.name);
            setOpen(false);
          }
        }}
      />
      {open ? (
        <ul id={listId} className="p-train__model-search-list" role="listbox">
          {filtered.length === 0 ? (
            <li className="p-train__model-search-empty" role="presentation">
              No matching models
            </li>
          ) : (
            filtered.map((m) => (
              <li key={m.id} role="option" aria-selected={m.id === value}>
                <button
                  type="button"
                  className={
                    m.id === value
                      ? "p-train__model-search-option is-selected"
                      : "p-train__model-search-option"
                  }
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(m.id);
                    setQuery(m.name);
                    setOpen(false);
                  }}
                >
                  {m.name}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
