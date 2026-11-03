"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { InspectionStepDraft, InspectionStepResultDTO } from "@/interfaces/pruefpartner";
import { protocolChecklist, type ProtocolGateId } from "@/components/hooks/inspect/inspectionProtocolHelpers";
import { useInspectionProtocol } from "@/components/hooks/inspect/useInspectionProtocol";
import { BarcodeCapture } from "@/components/features/shared/barcode-capture";
import { FollowUpCard } from "@/components/features/inspect/FollowUpCard";
import { SignaturePad } from "@/components/features/inspect/SignaturePad";
import { Spinner } from "@/components/ui/Loading";
import { Input } from "@/components/ui/input";

export function InspectionProtocolScreen({ reference }: { reference: string }) {
  const t = useTranslations("pruefpartner");
  const p = useInspectionProtocol(reference);

  if (!p.tenantId) {
    return (
      <div className="pp-page">
        <p className="pp-sub">{t("sessionEmpty")}</p>
        <p className="pp-hint">{t("sessionEmptyHint")}</p>
        <Link className="pp-btn pp-btn--primary" href="/partner/my-sites">
          {t("backToConsole")}
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
        <Link className="pp-back" href="/inspect/heute">
          ← {t("backToList")}
        </Link>
      </div>
    );
  }

  const { preview, catalogue, run } = p;
  const gates = protocolChecklist({
    visitStarted: p.visitStarted,
    deviceOk: p.deviceOk,
    stepsComplete: p.stepsComplete,
    missingEvidence: p.missingEvidence.length,
    signatures: run?.signatures,
  });
  const nextGate = gates.find((g) => !g.done);
  const closeoutReady = p.visitStarted && p.deviceOk;
  const siteVisitAlready = Boolean(preview.visitStartedAt);

  return (
    <div className="pp-page" data-testid="inspect-protocol">
      <Link className="pp-back" href="/inspect/heute">
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
                <p className="pp-kv__k" id="pp-equipment-label">
                  {t("equipmentRequired")} — {catalogue.testEquipmentClassLabel}
                </p>
                <select
                  id="pp-equipment"
                  className="pp-select"
                  aria-labelledby="pp-equipment-label"
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
          <ol className="pp-gates" data-testid="inspect-checklist">
            {gates.map((g) => (
              <li key={g.id} data-done={g.done ? "1" : "0"}>
                {t(GATE_LABEL[g.id])}
              </li>
            ))}
          </ol>

          <section className="pp-card" data-testid="inspect-visit">
            <h4>{t("visitTitle")}</h4>
            <div className="pp-card__body">
              <p className="pp-hint">{t("visitHint")}</p>
              {p.fieldErrors.visitId ? <div className="pp-err">{p.fieldErrors.visitId}</div> : null}
              {p.visitStarted ? (
                <div className="pp-note" data-t="ok">
                  {t("visitStarted")}
                  {run.visitStartedAt ? (
                    <span className="mono"> · {run.visitStartedAt}</span>
                  ) : null}
                </div>
              ) : (
                <>
                  {siteVisitAlready ? (
                    <div className="pp-note" data-t="ok">
                      {t("visitStartedAtSite")}
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className="pp-btn pp-btn--primary"
                    disabled={p.busy}
                    onClick={() => void p.startVisit()}
                  >
                    {siteVisitAlready ? t("visitContinueJob") : t("visitStartForJob")}
                  </button>
                </>
              )}
            </div>
          </section>

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
                  <BarcodeCapture
                    data-testid="inspect-device-scan"
                    placeholder={t("scanPlaceholder")}
                    submitLabel={t("scanMatch")}
                    busy={p.busy}
                    allowedKinds={["inventory", "serial", "udi-di", "gtin", "unknown"]}
                    onCapture={(result) => {
                      p.setScanCode(result.raw);
                      void p.confirmScan(false, result.raw);
                    }}
                  />
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
                    <p className="pp-kv__k" id="pp-equipment-preview-label">
                      {t("fieldEquipmentClass")} — {catalogue.testEquipmentClassLabel}
                    </p>
                    <select
                      id="pp-equipment-preview"
                      className="pp-select"
                      aria-labelledby="pp-equipment-preview-label"
                      value={p.testEquipmentId}
                      disabled
                    >
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
                {p.fieldErrors.noPhotoReason ? (
                  <div className="pp-err">{p.fieldErrors.noPhotoReason}</div>
                ) : null}
                <div className="pp-steps">
                  {p.displaySteps.map((step) => (
                    <StepRow
                      key={step.stepId}
                      step={step}
                      draft={p.stepDraft[step.stepId]}
                      onChange={(next) => p.updateStepDraft(step.stepId, next)}
                      onUploadPhoto={(file) => void p.uploadStepPhoto(step.stepId, file)}
                      busy={p.busy}
                      visitStarted={p.visitStarted}
                    />
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {closeoutReady ? (
            <ProtocolCloseout p={p} reference={reference} nextGate={nextGate} t={t} />
          ) : (
            <details className="pp-stage">
              <summary>{t("stageCloseout")}</summary>
              <p className="pp-hint pp-stage__hint">
                {p.visitStarted ? t("stageNextDevice") : t("stageNextVisit")}
              </p>
              <ProtocolCloseout p={p} reference={reference} nextGate={nextGate} t={t} />
            </details>
          )}
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
            <Link className="pp-btn pp-btn--primary" href="/inspect/heute">
              {t("backToList")}
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}

const GATE_LABEL: Record<ProtocolGateId, "gateVisit" | "gateDevice" | "gateSteps" | "gateEvidence" | "gateInspector" | "gateInstitution"> = {
  visit: "gateVisit",
  device: "gateDevice",
  steps: "gateSteps",
  evidence: "gateEvidence",
  inspector: "gateInspector",
  institution: "gateInstitution",
};

function ProtocolCloseout({
  p,
  reference,
  nextGate,
  t,
}: {
  p: ReturnType<typeof useInspectionProtocol>;
  reference: string;
  nextGate: { id: ProtocolGateId } | undefined;
  t: ReturnType<typeof useTranslations<"pruefpartner">>;
}) {
  return (
    <>
      <section className="pp-card" data-testid="inspect-signatures">
        <h4>{t("signaturesTitle")}</h4>
        <div className="pp-card__body">
          <p className="pp-hint">{t("signaturesHint")}</p>
          {p.fieldErrors.signatures ? (
            <div className="pp-err">{p.fieldErrors.signatures}</div>
          ) : null}
          <SignatureBlock
            title={t("signatureInspector")}
            hint={t("signatureInspectorHint")}
            absent={p.inspectorAbsent}
            onAbsentChange={p.setInspectorAbsent}
            name={p.inspectorName}
            onNameChange={p.setInspectorName}
            absentReason={p.inspectorAbsentReason}
            onAbsentReasonChange={p.setInspectorAbsentReason}
            showRole={false}
            role=""
            onRoleChange={() => undefined}
            onSave={(img) => void p.saveSignature("inspector", img)}
            busy={p.busy}
            t={t}
          />
          <SignatureBlock
            title={t("signatureInstitution")}
            hint={t("signatureInstitutionHint")}
            absent={p.institutionAbsent}
            onAbsentChange={p.setInstitutionAbsent}
            name={p.institutionName}
            onNameChange={p.setInstitutionName}
            absentReason={p.institutionAbsentReason}
            onAbsentReasonChange={p.setInstitutionAbsentReason}
            showRole
            role={p.institutionRole}
            onRoleChange={p.setInstitutionRole}
            onSave={(img) => void p.saveSignature("institution", img)}
            busy={p.busy}
            t={t}
          />
          {p.signaturesOk ? (
            <div className="pp-note" data-t="ok">
              {t("signatureSaved")}
            </div>
          ) : null}
        </div>
      </section>

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

      {p.missingEvidence.length > 0 ||
      Object.values(p.stepDraft).some((d) => d?.rating === "defect") ? (
        <FollowUpCard reference={reference} disabled={p.busy || !p.visitStarted} />
      ) : null}

      <section className="pp-card">
        <h4>{t("resultTitle")}</h4>
        <div className="pp-card__body pp-res">
          {(
            [
              ["passed", "result_passed", "result_passed_hint"],
              ["passed_with_conditions", "result_passed_with_conditions", "result_conditions_hint"],
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
      {p.fieldErrors.general ? <div className="pp-err">{p.fieldErrors.general}</div> : null}
      {!p.canComplete && nextGate ? (
        <div className="pp-err" data-testid="inspect-seal-blocked">
          {t("gateNext", { item: t(GATE_LABEL[nextGate.id]) })}
        </div>
      ) : null}

      <div className="pp-actions">
        <Link className="pp-btn" href="/inspect/heute">
          {t("back")}
        </Link>
        <button
          type="button"
          className="pp-btn"
          disabled={p.busy || !p.visitStarted}
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
  );
}

function SignatureBlock({
  title,
  hint,
  absent,
  onAbsentChange,
  name,
  onNameChange,
  absentReason,
  onAbsentReasonChange,
  showRole,
  role,
  onRoleChange,
  onSave,
  busy,
  t,
}: {
  title: string;
  hint: string;
  absent: boolean;
  onAbsentChange: (v: boolean) => void;
  name: string;
  onNameChange: (v: string) => void;
  absentReason: string;
  onAbsentReasonChange: (v: string) => void;
  showRole: boolean;
  role: string;
  onRoleChange: (v: string) => void;
  onSave: (imageDataUrl: string | null) => void;
  busy: boolean;
  t: ReturnType<typeof useTranslations<"pruefpartner">>;
}) {
  const [pad, setPad] = useState<string | null>(null);

  return (
    <div className="pp-sig">
      <h5 className="pp-steps-title">{title}</h5>
      <p className="pp-hint">{hint}</p>
      <label className="pp-check">
        <input
          type="checkbox"
          checked={absent}
          onChange={(e) => onAbsentChange(e.target.checked)}
        />
        {t("markAbsent")}
      </label>
      {absent ? (
        <textarea
          className="pp-textarea"
          rows={2}
          value={absentReason}
          onChange={(e) => onAbsentReasonChange(e.target.value)}
          placeholder={t("absentReason")}
        />
      ) : (
        <>
          <div className="pp-gegen__grid">
            <Input
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder={t("signerName")}
              aria-label={t("signerName")}
            />
            {showRole ? (
              <label className="pp-gegen__role">
                <span className="sr-only">{t("signerRole")}</span>
                <select
                  value={
                    ["mfa", "verantwortlich", "technik", "leitung", "sonstige"].includes(role)
                      ? role
                      : role
                        ? "sonstige"
                        : ""
                  }
                  onChange={(e) => onRoleChange(e.target.value)}
                  aria-label={t("signerRole")}
                  disabled={busy}
                >
                  <option value="" disabled>
                    {t("signerRole")}
                  </option>
                  <option value="mfa">{t("signerRole_mfa")}</option>
                  <option value="verantwortlich">{t("signerRole_verantwortlich")}</option>
                  <option value="technik">{t("signerRole_technik")}</option>
                  <option value="leitung">{t("signerRole_leitung")}</option>
                  <option value="sonstige">{t("signerRole_sonstige")}</option>
                </select>
              </label>
            ) : null}
          </div>
          <SignaturePad value={pad} onChange={setPad} disabled={busy} />
        </>
      )}
      <button
        type="button"
        className="pp-btn"
        disabled={busy}
        onClick={() => onSave(absent ? null : pad)}
      >
        {t("saveSignature")}
      </button>
    </div>
  );
}

function StepRow({
  step,
  draft,
  onChange,
  onUploadPhoto,
  busy,
  visitStarted,
}: {
  step: InspectionStepResultDTO;
  draft?: InspectionStepDraft[string];
  onChange: (next: InspectionStepDraft[string]) => void;
  onUploadPhoto: (file: File) => void;
  busy: boolean;
  visitStarted: boolean;
}) {
  const t = useTranslations("pruefpartner");
  const rating = draft?.rating ?? null;
  const measurePlaceholder = t("stepMeasure");
  const outsideLimit = step.withinLimit === false;
  const isDefect = rating === "defect" || step.confirmed === false;
  const failed = isDefect;
  /** Red wash: fail rating or over-limit measurement. */
  const highlightFail = isDefect || outsideLimit;
  const photoCount = step.photoCount ?? 0;
  const hasPhoto = photoCount > 0;
  const reasonText = draft?.noPhotoReason ?? "";
  const overrideText = draft?.limitOverrideReason ?? "";
  const [noPhotoMode, setNoPhotoMode] = useState(() => Boolean(reasonText.trim()) && !hasPhoto);
  const okBlocked = outsideLimit && !overrideText.trim();

  return (
    <div
      className="pp-step"
      data-measure={step.isMeasurement ? "1" : "0"}
      data-state={highlightFail ? "fail" : rating === "ok" ? "ok" : undefined}
      data-testid={failed ? "inspect-step-fail" : "inspect-step"}
    >
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
        {outsideLimit ? (
          <p className="pp-flag">{t("outsideLimit")}</p>
        ) : step.withinLimit === true ? (
          <p className="pp-ok-line">{t("withinLimit")}</p>
        ) : null}
        {step.baselineFlag ? <p className="pp-flag">{t("baselineFlag")}</p> : null}
        {!step.baselineValue &&
        (step.comparedToBaseline || step.limitSource === "baseline") ? (
          <p className="pp-trigger">{t("noBaselineRecorded")}</p>
        ) : null}
      </div>

      <div
        className="pp-step__measure"
        data-invalid={outsideLimit ? "1" : "0"}
      >
        {step.isMeasurement ? (
          <>
            <Input
              value={draft?.measuredValue ?? ""}
              onChange={(e) => onChange({ measuredValue: e.target.value })}
              placeholder={measurePlaceholder}
              aria-label={measurePlaceholder}
              aria-invalid={outsideLimit}
              disabled={!visitStarted}
            />
            {step.unit ? <span className="pp-unit">{step.unit}</span> : null}
          </>
        ) : null}
      </div>

      <div className="pp-sw" role="group" aria-label={t("stepRatingAria")}>
        <button
          type="button"
          className="pp-sw__btn"
          data-tone="ok"
          data-on={rating === "ok" ? "1" : "0"}
          disabled={!visitStarted || okBlocked}
          title={okBlocked ? t("outsideLimitOkNeedsReason") : undefined}
          onClick={() => {
            setNoPhotoMode(false);
            onChange({
              rating: "ok",
              confirmed: true,
              noPhotoReason: null,
              mpsbHint: false,
              mpsbText: null,
            });
          }}
        >
          {t("stepOk")}
        </button>
        <button
          type="button"
          className="pp-sw__btn"
          data-tone="fail"
          data-on={isDefect ? "1" : "0"}
          disabled={!visitStarted}
          onClick={() => onChange({ rating: "defect", confirmed: false })}
        >
          {t("stepDefect")}
        </button>
      </div>

      {isDefect ? <p className="pp-fail-line">{t("failEvidenceLine")}</p> : null}

      {outsideLimit ? (
        <div className="pp-begr">
          <label>{t("outsideLimitWarn")}</label>
          <textarea
            className="pp-mangel__textarea"
            rows={2}
            value={overrideText}
            onChange={(e) => onChange({ limitOverrideReason: e.target.value })}
            placeholder={t("limitOverridePh")}
            disabled={!visitStarted}
          />
        </div>
      ) : null}

      {failed ? (
        <>
          <div className="pp-foto" data-ok={hasPhoto || (noPhotoMode && reasonText.trim()) ? "1" : "0"} data-testid="inspect-mangelbild">
            <div className="pp-foto__row">
              <b>{t("mangelbildTitle")}</b>
              <label className="pp-btn pp-mangel__photo">
                {t("uploadPhoto")}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  hidden
                  disabled={busy || !visitStarted}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setNoPhotoMode(false);
                      onUploadPhoto(file);
                    }
                    e.target.value = "";
                  }}
                />
              </label>
              {!hasPhoto ? (
                <label className="pp-mangel__check">
                  <input
                    type="checkbox"
                    checked={noPhotoMode}
                    disabled={!visitStarted}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setNoPhotoMode(on);
                      if (!on) onChange({ noPhotoReason: null });
                    }}
                  />
                  <span>{t("notPhotographable")}</span>
                </label>
              ) : null}
            </div>
            {hasPhoto ? (
              <p className="pp-mangel__ok">{t("photoCount", { count: photoCount })}</p>
            ) : null}
            {noPhotoMode && !hasPhoto ? (
              <textarea
                className="pp-mangel__textarea"
                value={reasonText}
                onChange={(e) => onChange({ noPhotoReason: e.target.value })}
                placeholder={t("noPhotoReasonPh")}
                rows={2}
                disabled={!visitStarted}
              />
            ) : null}
            {!hasPhoto && !noPhotoMode ? (
              <p className="pp-mangel__hint">{t("mangelbildHint")}</p>
            ) : null}
          </div>

          <div className="pp-mpsb">
            <label className="pp-mangel__check">
              <input
                type="checkbox"
                checked={Boolean(draft?.mpsbHint)}
                disabled={!visitStarted}
                onChange={(e) =>
                  onChange({
                    mpsbHint: e.target.checked,
                    mpsbText: e.target.checked ? draft?.mpsbText ?? "" : null,
                  })
                }
              />
              <span>{t("mpsbHintLabel")}</span>
            </label>
            {draft?.mpsbHint ? (
              <>
                <textarea
                  className="pp-mangel__textarea"
                  rows={2}
                  value={draft.mpsbText ?? ""}
                  onChange={(e) => onChange({ mpsbText: e.target.value })}
                  placeholder={t("mpsbHintPh")}
                  disabled={!visitStarted}
                />
                <p className="pp-hint">{t("mpsbHintHelp")}</p>
              </>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
