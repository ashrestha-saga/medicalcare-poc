"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { RepairDeviceOption } from "@/components/hooks/repairs/useRepairDeviceOptions";

/**
 * Searchable device picker for repair clinic forms.
 * Same combobox pattern as TrainingModelSearchSelect / CatalogModelSearchSelect.
 */
export function RepairDeviceSearchSelect({
  options,
  value,
  onChange,
  disabled,
  loading,
  required,
  id,
  disabledPlaceholder,
  "data-testid": testId = "repair-device-search",
}: {
  options: RepairDeviceOption[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  loading?: boolean;
  required?: boolean;
  id?: string;
  /** Shown when the control is disabled (e.g. choose clinic first). */
  disabledPlaceholder?: string;
  "data-testid"?: string;
}) {
  const t = useTranslations("repairs.deviceSearch");
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.id === value) ?? null;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(selected?.label ?? "");

  useEffect(() => {
    if (!open) setQuery(selected?.label ?? "");
  }, [selected?.label, open, value]);

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
    if (!q) return options.slice(0, 80);
    return options
      .filter((o) => o.label.toLowerCase().includes(q) || o.id.toLowerCase().includes(q))
      .slice(0, 80);
  }, [options, query]);

  if (loading) {
    return (
      <input
        id={id}
        type="text"
        className="p-train__model-search-input"
        value=""
        disabled
        placeholder={t("loading")}
        data-testid={testId}
      />
    );
  }

  if (disabled) {
    return (
      <input
        id={id}
        type="text"
        className="p-train__model-search-input"
        value=""
        disabled
        placeholder={disabledPlaceholder ?? t("placeholder")}
        data-testid={testId}
      />
    );
  }

  if (options.length === 0) {
    return (
      <input
        id={id}
        type="text"
        className="p-train__model-search-input"
        value=""
        disabled
        placeholder={t("empty")}
        data-testid={testId}
      />
    );
  }

  return (
    <div className="p-train__model-search" ref={rootRef}>
      {/* Native required check — hidden, synced with searchable input */}
      <input type="text" value={value} required={required} tabIndex={-1} aria-hidden className="sr-only" readOnly />
      <input
        id={id}
        type="search"
        className="p-train__model-search-input"
        value={query}
        disabled={disabled}
        placeholder={t("placeholder")}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        data-testid={testId}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (selected && e.target.value !== selected.label) onChange("");
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            setQuery(selected?.label ?? "");
          }
          if (e.key === "Enter" && filtered.length === 1) {
            e.preventDefault();
            onChange(filtered[0]!.id);
            setQuery(filtered[0]!.label);
            setOpen(false);
          }
        }}
      />
      {open ? (
        <ul id={listId} className="p-train__model-search-list" role="listbox">
          {filtered.length === 0 ? (
            <li className="p-train__model-search-empty" role="presentation">
              {t("noMatch")}
            </li>
          ) : (
            filtered.map((o) => (
              <li key={o.id} role="option" aria-selected={o.id === value}>
                <button
                  type="button"
                  className={
                    o.id === value
                      ? "p-train__model-search-option is-selected"
                      : "p-train__model-search-option"
                  }
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(o.id);
                    setQuery(o.label);
                    setOpen(false);
                  }}
                >
                  {o.label}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
