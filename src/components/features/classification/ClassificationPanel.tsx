"use client";

import { INSPECTION_TYPES } from "@/constants/inspectionTypes";
import { useRequestStore } from "@/store/requestStore";

/** Manual service-type selection — no classification proposal engine. */
export function ClassificationPanel({ error }: { error?: string | null }) {
  const value = useRequestStore((s) => s.form.serviceType ?? "");
  const patch = useRequestStore((s) => s.patch);

  return (
    <div data-testid="classification-panel">
      <div className="p-field" data-testid="inspection-list">
        <label htmlFor="service-type">
          Service <span className="p-req" aria-hidden="true">
            *
          </span>
        </label>
        <select
          id="service-type"
          value={value}
          onChange={(e) => patch({ serviceType: e.target.value || null })}
          data-testid="service-type-select"
        >
          <option value="">Select service…</option>
          {INSPECTION_TYPES.map((t) => (
            <option key={t.code} value={t.code}>
              {t.label}
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
