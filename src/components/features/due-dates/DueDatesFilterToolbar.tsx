"use client";

import { useTranslations } from "next-intl";
import { DropdownFilter, FilterToolbar } from "@/components/features/shared/filters";
import { Button } from "@/components/ui/button";
import type { DueDatesConfidenceFilter, DueDatesHorizon } from "@/interfaces";

const DUTY_KEY_OPTIONS = [
  "wartung",
  "stk",
  "mtk",
  "abnahme",
  "konstanz",
  "sv",
  "aerztl",
  "nuklear",
  "itsec",
  "install",
  "aufbereitung",
  "kontrolle",
  "validierung",
  "validierung_verweis",
  "einmalprodukt",
  "zubehoer",
  "vernetzung",
  "implantat",
  "dguv",
].map((value) => ({ value, label: value }));

const HORIZON_OPTIONS = [
  { value: "30", label: "30" },
  { value: "90", label: "90" },
];

const CONFIDENCE_OPTIONS = [
  { value: "unverified", labelKey: "confidenceUnverified" as const },
  { value: "verified", labelKey: "confidenceVerified" as const },
];

interface DueDatesFilterToolbarProps {
  dutyKey: string | null;
  onDutyKeyChange: (value: string | null) => void;
  horizon: DueDatesHorizon | null;
  onHorizonChange: (value: DueDatesHorizon | null) => void;
  confidence: DueDatesConfidenceFilter | null;
  onConfidenceChange: (value: DueDatesConfidenceFilter | null) => void;
  scheduled: boolean;
  onClearAll: () => void;
}

export function DueDatesFilterToolbar({
  dutyKey,
  onDutyKeyChange,
  horizon,
  onHorizonChange,
  confidence,
  onConfidenceChange,
  scheduled,
  onClearAll,
}: DueDatesFilterToolbarProps) {
  const t = useTranslations("filters");
  const hasActiveFilters = Boolean(dutyKey || horizon || confidence || scheduled);

  return (
    <FilterToolbar hasActiveFilters={hasActiveFilters} onClearAll={onClearAll}>
      <DropdownFilter
        label={t("dutyKey")}
        value={dutyKey}
        options={DUTY_KEY_OPTIONS}
        onChange={(value) => {
          const next = typeof value === "string" ? value : Array.isArray(value) ? value[0] : null;
          onDutyKeyChange(next ?? null);
        }}
      />
      <DropdownFilter
        label={t("horizon")}
        value={horizon == null ? null : String(horizon)}
        options={HORIZON_OPTIONS.map((o) => ({
          value: o.value,
          label: t("horizonDays", { days: o.value }),
        }))}
        onChange={(value) => {
          const raw = typeof value === "string" ? value : Array.isArray(value) ? value[0] : null;
          onHorizonChange(raw === "30" || raw === "90" ? (Number(raw) as DueDatesHorizon) : null);
        }}
      />
      <DropdownFilter
        label={t("confidence")}
        value={confidence}
        options={CONFIDENCE_OPTIONS.map((o) => ({
          value: o.value,
          label: t(o.labelKey),
        }))}
        onChange={(value) => {
          const next = typeof value === "string" ? value : Array.isArray(value) ? value[0] : null;
          onConfidenceChange(
            next === "unverified" ||
              next === "verified" ||
              next === "responsible" ||
              next === "determination" ||
              next === "derived" ||
              next === "not_applicable"
              ? next
              : null,
          );
        }}
      />
      {scheduled ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-8 pointer-events-none"
          data-testid="due-dates-filter-scheduled"
        >
          {t("scheduledOnly")}
        </Button>
      ) : null}
    </FilterToolbar>
  );
}
