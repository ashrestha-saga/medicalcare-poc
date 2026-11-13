"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { QuoteFilterStatus, RequestScope } from "@/interfaces";
import { DropdownFilter, FilterToolbar } from "@/components/features/shared/filters";
import { SERVICE_REQUEST_STATE_FILTER_OPTIONS } from "@/constants/serviceRequest";

const QUOTE_FILTER_OPTIONS: { value: QuoteFilterStatus; labelKey: string }[] = [
  { value: "none", labelKey: "status_none" },
  { value: "open", labelKey: "status_open" },
  { value: "approved", labelKey: "status_approved" },
  { value: "rejected", labelKey: "status_rejected" },
];

interface RequestsFilterToolbarProps {
  scopes: { id: RequestScope; label: string }[];
  scope: RequestScope;
  onScopeChange: (scope: RequestScope) => void;
  stateFilter: string[] | null;
  onStateChange: (value: string | string[] | null) => void;
  quoteFilter: string[] | null;
  onQuoteChange: (value: string | string[] | null) => void;
  onClearAll: () => void;
}

export function RequestsFilterToolbar({
  scopes,
  scope,
  onScopeChange,
  stateFilter,
  onStateChange,
  quoteFilter,
  onQuoteChange,
  onClearAll,
}: RequestsFilterToolbarProps) {
  const t = useTranslations("filters");
  const tStatus = useTranslations("status");
  const tQuote = useTranslations("repairs.quote");
  const hasActiveFilters = Boolean(stateFilter?.length || quoteFilter?.length);

  const statusOptions = useMemo(
    () =>
      SERVICE_REQUEST_STATE_FILTER_OPTIONS.map((o) => ({
        ...o,
        label: tStatus.has(o.value) ? tStatus(o.value) : o.label,
      })),
    [tStatus],
  );

  const quoteOptions = useMemo(
    () =>
      QUOTE_FILTER_OPTIONS.map((o) => ({
        value: o.value,
        label: tQuote(o.labelKey),
      })),
    [tQuote],
  );

  return (
    <FilterToolbar hasActiveFilters={hasActiveFilters} onClearAll={onClearAll}>
      <DropdownFilter
        label={t("scope")}
        value={scope}
        options={scopes.map((s) => ({ value: s.id, label: s.label }))}
        onChange={(value) => {
          const next = typeof value === "string" ? value : Array.isArray(value) ? value[0] : null;
          if (next === "mine" || next === "open" || next === "all") onScopeChange(next);
        }}
      />
      <DropdownFilter
        label={t("status")}
        value={stateFilter}
        options={statusOptions}
        onChange={onStateChange}
        multiple
      />
      <DropdownFilter
        label={t("quoteStatus")}
        value={quoteFilter}
        options={quoteOptions}
        onChange={onQuoteChange}
        multiple
      />
    </FilterToolbar>
  );
}
