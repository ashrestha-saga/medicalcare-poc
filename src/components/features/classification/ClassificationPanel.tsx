"use client";

import type { ClassificationPanelProps, ClassificationProposalDTO } from "@/interfaces";
import { INSPECTION_TYPES } from "@/constants/inspectionTypes";
import { useClassification } from "@/components/hooks/classification/useClassification";

export function ProposalBanner({ proposal }: { proposal: ClassificationProposalDTO }) {
  const { suggested, confKey } = useClassification(proposal);
  return (
    <div className="p-cls p-cls--compact" data-c={confKey} data-testid="proposal-banner">
      <div className="p-cls-h">
        <span className="p-cls-tag" data-c={confKey} data-testid="confidence-chip">
          {proposal.confidence}
        </span>
        {suggested.map((code) => (
          <span key={code} className="p-cls-sug" data-testid={`suggested-${code}`}>
            {code}
          </span>
        ))}
      </div>
      <p className="p-cls-lead">
        {proposal.confidence === "verified" && "Vorschlag aus bestätigter Klassifizierung — bitte prüfen und bestätigen."}
        {proposal.confidence === "derived" && "Ableitung aus der Gerätegruppe — bitte Leistung selbst wählen."}
        {proposal.confidence === "guess" && "Unsicherer Hinweis — bitte Leistung selbst wählen."}
      </p>
    </div>
  );
}

export function ClassificationConfirm({ proposal }: { proposal: ClassificationProposalDTO }) {
  const { confirmed, patch, overridden } = useClassification(proposal);
  return (
    <button
      type="button"
      className="p-cls-conf"
      aria-pressed={confirmed}
      onClick={() => patch({ proposalConfirmed: !confirmed })}
      data-testid="confirm-classification"
    >
      <span className="box">{confirmed ? "✓" : ""}</span>
      <span data-testid="confirm-row">
        {overridden ? "Vorschlag geprüft — andere Leistung gewählt." : "Ich bestätige die vorgeschlagene Leistung."}
        {proposal.confidence === "verified" && (
          <span style={{ display: "block", fontSize: 11, color: "var(--on-dark-soft)", fontWeight: 400, marginTop: 4 }}>
            Erforderlich vor dem Absenden.
          </span>
        )}
      </span>
    </button>
  );
}

export function ClassificationPanel({ proposal, error }: ClassificationPanelProps) {
  const { value, setType, suggested } = useClassification(proposal);

  return (
    <div data-testid="classification-panel">
      <div className="p-field" data-testid="inspection-list">
        <label htmlFor="service-type">
          Leistung <span className="p-req" aria-hidden="true">*</span>
        </label>
        <select
          id="service-type"
          value={value}
          onChange={(e) => setType(e.target.value)}
          data-testid="service-type-select"
        >
          <option value="">Leistung wählen…</option>
          {INSPECTION_TYPES.map((t) => (
            <option key={t.code} value={t.code}>
              {t.code}
              {suggested.includes(t.code) ? " · suggested" : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="sr-only" aria-hidden="true">
        {INSPECTION_TYPES.map((t) => (
          <button key={t.code} type="button" data-testid={`inspection-${t.code}`} onClick={() => setType(t.code)}>
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="p-err" data-testid="classification-error">
          {error}
        </p>
      )}
    </div>
  );
}
