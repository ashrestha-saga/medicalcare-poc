"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { CatalogModelListItemDTO } from "@/interfaces";
import { api } from "@/lib/http/apiClient";

/**
 * Server-backed searchable catalog model picker for Erstanlage step 1.
 */
export function CatalogModelSearchSelect({
  value,
  onSelect,
  disabled,
}: {
  value: string | null;
  onSelect: (model: CatalogModelListItemDTO) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("registration");
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogModelListItemDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState("");

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    let alive = true;
    const timer = setTimeout(() => {
      setLoading(true);
      void api<{ models: CatalogModelListItemDTO[] }>(
        `/api/catalog/models?q=${encodeURIComponent(q)}`,
      )
        .then((res) => {
          if (alive) setResults(res.models.slice(0, 40));
        })
        .catch(() => {
          if (alive) setResults([]);
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, open]);

  useEffect(() => {
    if (!value) setSelectedLabel("");
  }, [value]);

  return (
    <div className="p-train__model-search" ref={rootRef}>
      <input
        type="search"
        className="p-train__model-search-input"
        value={open ? query : selectedLabel || query}
        disabled={disabled}
        placeholder={t("catalogSearchPlaceholder")}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        data-testid="registration-catalog-search"
        onFocus={() => {
          setOpen(true);
          if (selectedLabel) setQuery(selectedLabel);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
      />
      {open ? (
        <ul id={listId} className="p-train__model-search-list" role="listbox">
          {loading ? (
            <li className="p-train__model-search-empty">{t("catalogSearchLoading")}</li>
          ) : results.length === 0 ? (
            <li className="p-train__model-search-empty">{t("catalogSearchEmpty")}</li>
          ) : (
            results.map((m) => (
              <li key={m.id} role="option" aria-selected={m.id === value}>
                <button
                  type="button"
                  className={`p-train__model-search-option${m.id === value ? " is-selected" : ""}`}
                  onClick={() => {
                    setSelectedLabel(m.displayName);
                    setQuery(m.displayName);
                    setOpen(false);
                    onSelect(m);
                  }}
                >
                  <span className="p-reg__catalog-option-title">{m.displayName}</span>
                  <span className="p-reg__catalog-option-meta">
                    {[m.manufacturer, m.udiDi || m.basicUdiDi].filter(Boolean).join(" · ")}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
