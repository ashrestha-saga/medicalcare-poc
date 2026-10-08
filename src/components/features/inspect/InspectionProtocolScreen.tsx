"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { InspectionStepDraft, InspectionStepResultDTO } from "@/interfaces/pruefpartner";
import { useInspectionProtocol } from "@/components/hooks/inspect/useInspectionProtocol";
import { Spinner } from "@/components/ui/Loading";
import { Input } from "@/components/ui/input";

export function InspectionProtocolScreen({ reference }: { reference: string }) {
  const t = useTranslations("pruefpartner");
  const p = useInspectionProtocol(reference);

  if (!p.tenantId) {
    return (
      <div className="pp-page">
        <p className="pp-sub">{t("queueEmpty")}</p>
        <Link className="pp-back" href="/partner/my-sites">
          ← {t("backToConsole")}
        </Link>
      </div>
    );
  }

  if (p.loading && !p.preview) {
    return (
      <div className="pp-wait">
        <Spinner />
      </div>
    );
  }

  if (p.error || !p.preview) {
    return (
      <div className="pp-page">
        <div className="pp-err">{p.error ?? t("loadFailed")}</div>
        <Link className="pp-back" href="/inspect">
          ← {t("backToList")}
        </Link>
      </div>
    );
  }

  const { preview, catalogue, run } = p;

  return (
    <div className="pp-page" data-testid="inspect-protocol">
      <Link className="pp-back" href="/inspect">
        ← {t("backToList")}
      </Link>
      <h1 className="pp-title">{preview.deviceLabel}</h1>
      <p className="pp-sub mono">
        {preview.reference} · {catalogue?.label ?? preview.serviceType} · {p.tenantName ?? p.tenantId}
      </p>

      <section className="pp-card">
        <h4>{t("cardAuftrag")}</h4>
        <div className="pp-card__body">
          <div className="pp-kv">
            <div>
              <span className="pp-kv__k">{t("fieldType")}</span>
              <span className="pp-kv__v">{preview.modelName ?? preview.deviceLabel}</span>
            </div>
            <div>
              <span className="pp-kv__k">{t("fieldSerial")}</span>
              <span className="pp-kv__v mono">{preview.serialNumber ?? "—"}</span>
            </div>
            <div>
              <span className="pp-kv__k">{t("fieldInventory")}</span>
              <span className="pp-kv__v mono">{preview.inventoryNumber}</span>
            </div>
            <div>
              <span className="pp-kv__k">{t("fieldManufacturer")}</span>
              <span className="pp-kv__v">{preview.manufacturer ?? "—"}</span>
            </div>
          </div>
          <p className="pp-meta">
            <strong>{t("fieldLocation")}:</strong> {preview.locationText}
          </p>
          <p className="pp-meta">
            <strong>{t("due")}:</strong> {preview.dueAt ?? "—"}
          </p>
          {preview.accessHint ? (
            <div className="pp-access">
              <span className="pp-access__k">{t("accessHint")}</span>
              <p>{preview.accessHint}</p>
            </div>
          ) : null}
        </div>
      </section>

      {catalogue ? (
        <section className="pp-card">
          <h4>{t("cardKatalog")}</h4>
          <div className="pp-card__body">
            <div className="pp-kv">
              <div>
                <span className="pp-kv__k">{t("catalogue")}</span>
                <span className="pp-kv__v">{catalogue.label}</span>
              </div>
              <div>
                <span className="pp-kv__k">{t("fieldLegalBasis")}</span>
                <span className="pp-kv__v">{catalogue.legalBasis ?? "—"}</span>
              </div>
              <div>
                <span className="pp-kv__k">{t("fieldAppliedPart")}</span>
                <span className="pp-kv__v">
                  {catalogue.appliedPartLabel ?? catalogue.appliedPartCode ?? "—"}
                </span>
              </div>
              <div>
                <span className="pp-kv__k">{t("fieldEquipmentClass")}</span>
                <span className="pp-kv__v">
                  {catalogue.testEquipmentClassLabel ?? catalogue.testEquipmentClass ?? "—"}
                </span>
              </div>
              <div>
                <span className="pp-kv__k">{t("fieldRetention")}</span>
                <span className="pp-kv__v">{catalogue.retention ?? "—"}</span>
              </div>
            </div>
            {preview.qualificationGate.required.length > 0 ? (
              <div className="pp-quals">
                {preview.qualificationGate.required.map((q) => (
                  <span key={q.code} className="pp-tag" data-t="art">
                    {q.label}
                  </span>
                ))}
              </div>
            ) : null}
            {catalogue.draft ? (
              <div className="pp-note" data-t="warn">
                {t("draftBadge")}
              </div>
            ) : null}
            {catalogue.note ? <p className="pp-hint">{catalogue.note}</p> : null}
          </div>
        </section>
      ) : (
        <div className="pp-note" data-t="stop">
          <strong>{t("noCatalogueMatch")}</strong>
          <p>{t("noCatalogueMatchHint")}</p>
        </div>
      )}

      {p.blockedQual ? (
        <div className="pp-note" data-t="stop">
          <strong>{t("qualificationBlocked")}</strong>
          <p>{t("qualificationBlockedHint")}</p>
          <ul>
            {preview.qualificationGate.missing.map((m) => (
              <li key={m.code}>{m.label}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {p.blockedBaseline ? (
        <div className="pp-note" data-t="stop">
          {t("baselineMissing")}
        </div>
      ) : null}

      {p.needsOccasion && !p.blockedQual ? (
        <section className="pp-card">
          <h4>{t("occasionTitle")}</h4>
          <div className="pp-card__body pp-res">
            {catalogue!.occasions.map((code) => (
              <label key={code} className="pp-res__opt">
                <input
                  type="radio"
                  name="occasion"
                  checked={p.occasionCode === code}
                  onChange={() => p.setOccasionCode(code)}
                />
                <span>{t(`occasion_${code}` as "occasion_erst")}</span>
              </label>
            ))}
          </div>
        </section>
      ) : null}

      {!run && !p.sealed && catalogue && !p.blockedQual && !p.blockedBaseline && !p.noMatch && !p.needsOccasion ? (
        <>
          {!p.certificateOnly && catalogue.testEquipmentClass ? (
            <section className="pp-card">
              <h4>{catalogue.label}</h4>
              <div className="pp-card__body">
                <p className="pp-kv__k">
                  {t("equipmentRequired")} — {catalogue.testEquipmentClassLabel}
                </p>
                <select
                  className="pp-select"
                  value={p.testEquipmentId}
                  onChange={(e) => p.setTestEquipmentId(e.target.value)}
                >
                  <option value="">{t("equipmentSelect")}</option>
                  {p.eligibleEquipment.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.label}
                      {eq.calibratedUntil ? ` (${eq.calibratedUntil})` : ""}
                    </option>
                  ))}
                </select>
                <p className="pp-hint">{t("equipmentClassHint")}</p>
                {catalogue.traceabilityRequired ? (
                  <p className="pp-hint">{t("traceabilityHint")}</p>
                ) : null}
                {preview.equipmentGate.blockedReason ? (
                  <p className="pp-flag">{preview.equipmentGate.blockedReason}</p>
                ) : null}
              </div>
            </section>
          ) : null}
          <button
            type="button"
            className="pp-btn pp-btn--primary"
            disabled={!p.canStart || p.busy}
            onClick={() => void p.startRun()}
          >
            {preview.draftRunId ? t("resumeRun") : t("startRun")}
          </button>
        </>
      ) : null}

      {run && !p.sealed ? (
        <>
          {!p.deviceOk ? (
            <section className="pp-card">
              <h4>{t("scanTitle")}</h4>
              <div className="pp-card__body">
                <p className="pp-hint">
                  {t("scanHint")}
                  <br />
                  <span className="mono">
                    {preview.inventoryNumber}
                    {preview.serialNumber ? ` · ${preview.serialNumber}` : ""}
                  </span>
                </p>
                <div className="pp-scan">
                  <Input
                    value={p.scanCode}
                    onChange={(e) => p.setScanCode(e.target.value)}
                    placeholder={t("scanPlaceholder")}
                  />
                  <button
                    type="button"
                    className="pp-btn pp-btn--primary"
                    disabled={p.busy}
                    onClick={() => void p.confirmScan(false)}
                  >
                    {t("scanMatch")}
                  </button>
                </div>
                <button
                  type="button"
                  className="pp-btn"
                  disabled={p.busy}
                  onClick={() => void p.confirmScan(true)}
                >
                  {t("scanSkip")}
                </button>
                <p className="pp-hint">{t("scanSkipHint")}</p>
              </div>
            </section>
          ) : (
            <div className="pp-note" data-t="ok">
              {run.deviceConfirmSkipped ? t("scanSkippedNote") : t("scanConfirmed")}
            </div>
          )}

          {p.deviceOk && p.certificateOnly ? (
            <section className="pp-card">
              <h4>{t("certificateTitle")}</h4>
              <div className="pp-card__body">
                <p className="pp-hint">{t("certificateHint")}</p>
              </div>
            </section>
          ) : null}

          {p.deviceOk && !p.certificateOnly ? (
            <section className="pp-card">
              <h4>{catalogue?.label ?? t("assignmentTitle")}</h4>
              <div className="pp-card__body">
                {catalogue?.testEquipmentClass ? (
                  <>
                    <p className="pp-kv__k">
                      {t("fieldEquipmentClass")} — {catalogue.testEquipmentClassLabel}
                    </p>
                    <select className="pp-select" value={p.testEquipmentId} disabled>
                      {preview.eligibleEquipment
                        .filter((e) => e.id === (run.testEquipmentId ?? p.testEquipmentId))
                        .map((eq) => (
                          <option key={eq.id} value={eq.id}>
                            {eq.label}
                          </option>
                        ))}
                    </select>
                  </>
                ) : null}

                <h5 className="pp-steps-title">{t("stepsTitle")}</h5>
                <p className="pp-hint">
                  {t("stepsProgress", {
                    done: p.ratedCount,
                    total: p.displaySteps.length,
                  })}
                </p>
                <div className="pp-steps">
                  {p.displaySteps.map((step) => (
                    <StepRow
                      key={step.stepId}
                      step={step}
                      draft={p.stepDraft[step.stepId]}
                      onChange={(next) => p.updateStepDraft(step.stepId, next)}
                    />
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {p.deviceOk ? (
            <>
              <section className="pp-card">
                <h4>{t("defectsTitle")}</h4>
                <div className="pp-card__body">
                  <textarea
                    className="pp-textarea"
                    rows={3}
                    value={p.defects}
                    onChange={(e) => p.setDefects(e.target.value)}
                    placeholder={t("defectsPlaceholder")}
                  />
                </div>
              </section>

              <section className="pp-card">
                <h4>{t("resultTitle")}</h4>
                <div className="pp-card__body pp-res">
                  {(
                    [
                      ["passed", "result_passed", "result_passed_hint"],
                      [
                        "passed_with_conditions",
                        "result_passed_with_conditions",
                        "result_conditions_hint",
                      ],
                      ["failed", "result_failed", "result_failed_hint"],
                    ] as const
                  ).map(([value, labelKey, hintKey]) => (
                    <label key={value} className="pp-res__opt">
                      <input
                        type="radio"
                        name="result"
                        checked={p.result === value}
                        onChange={() => p.setResult(value)}
                      />
                      <span>
                        <strong>{t(labelKey)}</strong>
                        <br />
                        <em className="pp-hint">{t(hintKey)}</em>
                      </span>
                    </label>
                  ))}
                </div>
              </section>

              <section className="pp-card">
                <h4>{t("attachmentsTitle")}</h4>
                <div className="pp-card__body">
                  <p className="pp-hint">{t("attachmentsHint")}</p>
                  <label className="pp-check">
                    <input
                      type="checkbox"
                      checked={p.attachmentHintAck}
                      onChange={(e) => p.setAttachmentHintAck(e.target.checked)}
                    />
                    {t("attachmentsAck")}
                  </label>
                </div>
              </section>

              <div className="pp-note" data-t="warn">
                {t("sealImmutable")}
              </div>

              <div className="pp-actions">
                <Link className="pp-btn" href="/inspect">
                  {t("back")}
                </Link>
                <button
                  type="button"
                  className="pp-btn"
                  disabled={p.busy}
                  onClick={() => void p.saveStepsWithToast()}
                >
                  {t("saveSteps")}
                </button>
                <button
                  type="button"
                  className="pp-btn pp-btn--primary"
                  disabled={p.busy || !p.canComplete}
                  onClick={() => void p.completeRun()}
                >
                  {t("completeProtocol")}
                </button>
              </div>
            </>
          ) : null}
        </>
      ) : null}

      {p.sealed ? (
        <section className="pp-card pp-sealed">
          <h4>{t("sealedTitle")}</h4>
          <div className="pp-card__body">
            <div className="pp-lock">
              <span className="pp-seal">{t("sealLabel")}</span>
            </div>
            <p>{t("sealedHint")}</p>
            {run ? (
              <p className="mono pp-hint">
                {t("idempotencyKey")}: {run.idempotencyKey ?? "—"}
              </p>
            ) : null}
            {catalogue?.draft ? <p className="pp-hint">{t("draftSealedNote")}</p> : null}
            <Link className="pp-btn pp-btn--primary" href="/inspect">
              {t("backToList")}
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function StepRow({
  step,
  draft,
  onChange,
}: {
  step: InspectionStepResultDTO;
  draft?: InspectionStepDraft[string];
  onChange: (next: InspectionStepDraft[string]) => void;
}) {
  const t = useTranslations("pruefpartner");
  const rating = draft?.rating ?? null;
  const measurePlaceholder = step.unit
    ? t("stepMeasureWithUnit", { unit: step.unit })
    : t("stepMeasure");

  return (
    <div className="pp-step" data-measure={step.isMeasurement ? "1" : "0"}>
      <div className="pp-step__label">
        <p className="pp-step__title">{step.label}</p>
        {step.limitText ? (
          <p className="pp-step__meta">
            {t("limitHint")} {step.limitText}
            {step.unit ? ` ${step.unit}` : ""}
            {step.limitSource ? ` · ${step.limitSource}` : ""}
            {step.baselineValue ? ` · ${t("baselineHint")}: ${step.baselineValue}` : ""}
          </p>
        ) : null}
        {step.triggerNote ? <p className="pp-trigger">{step.triggerNote}</p> : null}
        {step.withinLimit === false ? (
          <p className="pp-flag">{t("outsideLimit")}</p>
        ) : step.withinLimit === true ? (
          <p className="pp-ok-line">{t("withinLimit")}</p>
        ) : null}
        {step.baselineFlag ? <p className="pp-flag">{t("baselineFlag")}</p> : null}
        {!step.baselineValue &&
        (step.comparedToBaseline || step.limitSource === "baseline") ? (
          <p className="pp-trigger">{t("noBaselineRecorded")}</p>
        ) : null}
        {step.isMeasurement ? (
          <div className="pp-step__measure">
            <Input
              value={draft?.measuredValue ?? ""}
              onChange={(e) => onChange({ measuredValue: e.target.value })}
              placeholder={measurePlaceholder}
              aria-label={measurePlaceholder}
            />
          </div>
        ) : null}
      </div>
      <div className="pp-sw" role="group" aria-label={t("stepRatingAria")}>
        <button
          type="button"
          className="pp-sw__btn"
          data-tone="ok"
          data-on={rating === "ok" ? "1" : "0"}
          onClick={() => onChange({ rating: "ok", confirmed: true })}
        >
          {t("stepOk")}
        </button>
        <button
          type="button"
          className="pp-sw__btn"
          data-tone="fail"
          data-on={rating === "defect" ? "1" : "0"}
          onClick={() => onChange({ rating: "defect", confirmed: false })}
        >
          {t("stepDefect")}
        </button>
      </div>
    </div>
  );
}
