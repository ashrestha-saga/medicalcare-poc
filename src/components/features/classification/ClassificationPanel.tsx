"use client";

import { useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  classificationFlagsFromResolution,
  serviceTypesForClassification,
} from "@/lib/serviceTypesFromClassification";
import { useRequestStore } from "@/store/requestStore";
import { useScanStore } from "@/store/scanStore";

/** Service-type selection filtered by catalog classification (+ always-on types). */
export function ClassificationPanel({ error }: { error?: string | null }) {
  const t = useTranslations("scan");
  const tTypes = useTranslations("inspectionTypes");
  const value = useRequestStore((s) => s.form.serviceType ?? "");
  const patch = useRequestStore((s) => s.patch);
  const resolution = useScanStore((s) => s.resolution);

  const options = useMemo(() => {
    const flags = classificationFlagsFromResolution(resolution);
    return serviceTypesForClassification(flags);
  }, [resolution]);

  useEffect(() => {
    if (!value) return;
    if (!options.some((o) => o.code === value)) {
      patch({ serviceType: null });
    }
  }, [value, options, patch]);

  return (
    <div data-testid="classification-panel">
      <div className="p-field" data-testid="inspection-list">
        <label htmlFor="service-type">
          {t("serviceTypeLabel")}{" "}
          <span className="p-req" aria-hidden="true">
            *
          </span>
        </label>
        <select
          id="service-type"
          value={value}
          onChange={(e) => patch({ serviceType: e.target.value || null })}
          data-testid="service-type-select"
        >
          <option value="">{t("selectService")}</option>
          {options.map((item) => (
            <option key={item.code} value={item.code}>
              {tTypes(`${item.code}.label`)}
            </option>
          ))}
        </select>
        {error ? (
          <p className="p-err" data-testid="service-type-error">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
