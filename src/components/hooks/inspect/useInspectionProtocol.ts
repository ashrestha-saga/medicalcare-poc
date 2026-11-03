"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type {
  CataloguePreviewDTO,
  InspectionResultCode,
  InspectionRunDTO,
  InspectionStepDraft,
  InspectionStepResultDTO,
} from "@/interfaces/pruefpartner";
import { api, ApiError } from "@/lib/http/apiClient";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useActingTenantStore } from "@/store/actingTenantStore";
import { useInspectQueueStore } from "@/store/inspectQueueStore";
import { useOfflineQueueStore } from "@/store/offlineQueueStore";
import { toast } from "@/store/toastStore";
import {
  buildSealNote,
  failedStepsMissingEvidence,
  ratedStepCount,
  seedStepDraft,
  signatureKindsSatisfied,
  stepsPayloadFromDraft,
} from "./inspectionProtocolHelpers";

type FieldErrors = {
  visitId?: string;
  signatures?: string;
  noPhotoReason?: string;
  general?: string;
};

function fieldFromApiError(e: unknown): FieldErrors {
  if (!(e instanceof ApiError)) return { general: String(e) };
  const details = e.details as { field?: string } | undefined;
  const field = details?.field;
  if (field === "visitId") return { visitId: e.message };
  if (field === "signatures") return { signatures: e.message };
  if (field === "noPhotoReason") return { noPhotoReason: e.message };
  return { general: e.message };
}

const ROLE_KEYS = ["mfa", "verantwortlich", "technik", "leitung", "sonstige"] as const;

function institutionRoleLabel(
  role: string,
  t: ReturnType<typeof useTranslations<"pruefpartner">>,
): string | null {
  const code = role.trim();
  if (!code) return null;
  if ((ROLE_KEYS as readonly string[]).includes(code)) {
    return t(`signerRole_${code}` as "signerRole_mfa");
  }
  return code;
}

/** Orchestrates resolve → start → visit → scan → steps → signatures → complete. */
export function useInspectionProtocol(reference: string) {
  const t = useTranslations("pruefpartner");
  const online = useOnlineStatus();
  const tenantId = useInspectQueueStore((s) => s.tenantId);
  const tenantName = useInspectQueueStore((s) => s.tenantName);
  const markDone = useInspectQueueStore((s) => s.markDone);
  const setActingTenant = useActingTenantStore((s) => s.setActingTenant);
  const enqueueInspectionComplete = useOfflineQueueStore((s) => s.enqueueInspectionComplete);

  const [preview, setPreview] = useState<CataloguePreviewDTO | null>(null);
  const [run, setRun] = useState<InspectionRunDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [scanCode, setScanCode] = useState("");
  const [occasionCode, setOccasionCode] = useState("");
  const [testEquipmentId, setTestEquipmentId] = useState("");
  const [result, setResult] = useState<InspectionResultCode>("passed");
  const [defects, setDefects] = useState("");
  const [stepDraft, setStepDraft] = useState<InspectionStepDraft>({});
  const [attachmentHintAck, setAttachmentHintAck] = useState(false);

  const [inspectorAbsent, setInspectorAbsent] = useState(false);
  const [inspectorName, setInspectorName] = useState("");
  const [inspectorAbsentReason, setInspectorAbsentReason] = useState("");
  const [institutionAbsent, setInstitutionAbsent] = useState(false);
  const [institutionName, setInstitutionName] = useState("");
  const [institutionRole, setInstitutionRole] = useState("");
  const [institutionAbsentReason, setInstitutionAbsentReason] = useState("");

  const ensureTenant = useCallback(() => {
    if (tenantId) {
      setActingTenant({ tenantId, tenantName: tenantName ?? tenantId });
    }
  }, [tenantId, tenantName, setActingTenant]);

  const hydrateSignatures = useCallback((r: InspectionRunDTO) => {
    const insp = r.signatures?.find((s) => s.kind === "inspector");
    const inst = r.signatures?.find((s) => s.kind === "institution");
    if (insp) {
      setInspectorAbsent(insp.absent);
      setInspectorName(insp.signerName ?? "");
      setInspectorAbsentReason(insp.absentReason ?? "");
    }
    if (inst) {
      setInstitutionAbsent(inst.absent);
      setInstitutionName(inst.signerName ?? "");
      setInstitutionRole(inst.signerRole ?? "");
      setInstitutionAbsentReason(inst.absentReason ?? "");
    }
  }, []);

  const refresh = useCallback(async () => {
    ensureTenant();
    setLoading(true);
    setError(null);
    try {
      const p = await api<CataloguePreviewDTO>(
        `/api/partner/inspection-runs/resolve?reference=${encodeURIComponent(reference)}`,
      );
      setPreview(p);
      if (p.catalogue?.occasions.length === 1) {
        setOccasionCode(p.catalogue.occasions[0]!);
      }
      const runId = p.sealed ? p.sealedRunId : p.draftRunId;
      if (runId) {
        const res = await api<{ run: InspectionRunDTO }>(
          `/api/partner/inspection-runs/${encodeURIComponent(runId)}`,
        );
        setRun(res.run);
        setStepDraft(seedStepDraft(res.run.steps));
        hydrateSignatures(res.run);
        if (res.run.testEquipmentId) setTestEquipmentId(res.run.testEquipmentId);
        if (res.run.occasionCode) setOccasionCode(res.run.occasionCode);
        if (
          res.run.result === "passed" ||
          res.run.result === "passed_with_conditions" ||
          res.run.result === "failed"
        ) {
          setResult(res.run.result);
        }
        if (res.run.note) setDefects(res.run.note);
      } else {
        setRun(null);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [reference, t, ensureTenant, hydrateSignatures]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const catalogue = preview?.catalogue ?? null;
  const catalogueSteps: InspectionStepResultDTO[] =
    run?.steps ?? catalogue?.steps.filter((s) => s.source === "catalogue") ?? [];
  const familySteps: InspectionStepResultDTO[] =
    catalogue?.steps.filter((s) => s.source === "family") ?? [];
  const displaySteps: InspectionStepResultDTO[] = [...catalogueSteps, ...familySteps];

  const eligibleEquipment = useMemo(() => {
    const list = preview?.eligibleEquipment ?? [];
    if (!catalogue?.traceabilityRequired) return list;
    return list.filter((e) => Boolean(e.traceabilityRef?.trim()));
  }, [preview, catalogue?.traceabilityRequired]);

  const visitStarted = Boolean(run?.visitStartedAt);
  const signaturesOk = signatureKindsSatisfied(run?.signatures);
  const missingEvidence = failedStepsMissingEvidence(catalogueSteps, stepDraft);

  const canStart = useMemo(() => {
    if (!catalogue) return false;
    if (preview?.sealed) return false;
    if (!preview?.qualificationGate.ok) return false;
    if (catalogue.missingBaseline) return false;
    if (catalogue.occasions.length > 0 && !occasionCode) return false;
    if (catalogue.testEquipmentClass && !testEquipmentId && !catalogue.noCatalogue) return false;
    if (catalogue.traceabilityRequired && testEquipmentId) {
      const eq = preview?.eligibleEquipment.find((e) => e.id === testEquipmentId);
      if (eq && !eq.traceabilityRef?.trim()) return false;
    }
    return true;
  }, [catalogue, preview, occasionCode, testEquipmentId]);

  const ratedCount = ratedStepCount(stepDraft, displaySteps);
  const catalogueRatedCount = ratedStepCount(stepDraft, catalogueSteps);
  const stepsComplete =
    Boolean(catalogue?.noCatalogue) ||
    catalogueSteps.length === 0 ||
    catalogueRatedCount >= catalogueSteps.length;

  const canComplete =
    stepsComplete &&
    visitStarted &&
    signaturesOk &&
    missingEvidence.length === 0 &&
    Boolean(run?.deviceConfirmed || run?.deviceConfirmSkipped);

  const startRun = useCallback(async () => {
    if (preview?.sealed) {
      toast.error(t("sealedTitle"));
      return;
    }
    setBusy(true);
    setFieldErrors({});
    try {
      const res = await api<{ run: InspectionRunDTO }>("/api/partner/inspection-runs", {
        method: "POST",
        body: JSON.stringify({
          reference,
          occasionCode: occasionCode || null,
          testEquipmentId: testEquipmentId || null,
        }),
      });
      setRun(res.run);
      setStepDraft(seedStepDraft(res.run.steps));
      hydrateSignatures(res.run);
      toast.success(t("startRun"));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("loadFailed"));
    } finally {
      setBusy(false);
    }
  }, [preview?.sealed, reference, occasionCode, testEquipmentId, t, hydrateSignatures]);

  const startVisit = useCallback(async () => {
    if (!run) return;
    setBusy(true);
    setFieldErrors({});
    try {
      const res = await api<{ visit: { visitId: string; startedAt: string } }>(
        `/api/partner/inspection-runs/${run.id}/visit/start`,
        { method: "POST", body: "{}" },
      );
      setRun({
        ...run,
        visitId: res.visit.visitId,
        visitStartedAt: res.visit.startedAt,
      });
      toast.success(t("visitStarted"));
    } catch (e) {
      setFieldErrors(fieldFromApiError(e));
      toast.error(e instanceof ApiError ? e.message : t("visitStartFailed"));
    } finally {
      setBusy(false);
    }
  }, [run, t]);

  const saveSignature = useCallback(
    async (kind: "inspector" | "institution", imageDataUrl?: string | null) => {
      if (!run) return;
      setBusy(true);
      setFieldErrors({});
      try {
        const absent = kind === "inspector" ? inspectorAbsent : institutionAbsent;
        const absentReason =
          kind === "inspector" ? inspectorAbsentReason : institutionAbsentReason;
        if (absent && !absentReason.trim()) {
          setFieldErrors({ signatures: t("absentReasonRequired") });
          toast.error(t("absentReasonRequired"));
          return;
        }
        await api(`/api/partner/inspection-runs/${run.id}/signatures`, {
          method: "PUT",
          body: JSON.stringify({
            kind,
            absent,
            absentReason: absent ? absentReason.trim() : null,
            signerName: absent
              ? null
              : kind === "inspector"
                ? inspectorName.trim() || null
                : institutionName.trim() || null,
            signerRole:
              kind === "institution" && !absent
                ? institutionRoleLabel(institutionRole, t)
                : null,
            signedAt: absent ? null : new Date().toISOString(),
            imageDataUrl: absent ? null : imageDataUrl ?? null,
          }),
        });
        const res = await api<{ run: InspectionRunDTO }>(`/api/partner/inspection-runs/${run.id}`);
        setRun(res.run);
        hydrateSignatures(res.run);
        toast.success(t("signatureSaved"));
      } catch (e) {
        setFieldErrors(fieldFromApiError(e));
        toast.error(e instanceof ApiError ? e.message : t("signatureSaveFailed"));
      } finally {
        setBusy(false);
      }
    },
    [
      run,
      inspectorAbsent,
      inspectorAbsentReason,
      inspectorName,
      institutionAbsent,
      institutionAbsentReason,
      institutionName,
      institutionRole,
      t,
      hydrateSignatures,
    ],
  );

  const submitPartnerHints = useCallback(async () => {
    if (!run) return;
    const steps = run.steps;
    for (const s of steps) {
      const d = stepDraft[s.stepId];
      if (!d?.mpsbHint) continue;
      const text = d.mpsbText?.trim();
      if (!text) continue;
      await api(`/api/partner/inspection-runs/${run.id}/partner-hint`, {
        method: "POST",
        body: JSON.stringify({ text, stepLabel: s.label }),
      });
    }
  }, [run, stepDraft]);

  const confirmScan = useCallback(
    async (skip = false, codeOverride?: string) => {
      if (!run) return;
      const code = (codeOverride ?? scanCode).trim();
      if (!skip && !code) return;
      setBusy(true);
      try {
        await api(`/api/partner/inspection-runs/${run.id}/confirm-device`, {
          method: "POST",
          body: JSON.stringify(skip ? { skip: true } : { code }),
        });
        setRun({ ...run, deviceConfirmed: true, deviceConfirmSkipped: skip });
        setScanCode("");
        toast.success(skip ? t("scanSkippedNote") : t("scanConfirmed"));
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : t("scanMismatch"));
      } finally {
        setBusy(false);
      }
    },
    [run, scanCode, t],
  );

  const saveSteps = useCallback(async () => {
    if (!run) return;
    await api(`/api/partner/inspection-runs/${run.id}/steps`, {
      method: "PATCH",
      body: JSON.stringify({ steps: stepsPayloadFromDraft(stepDraft) }),
    });
    const res = await api<{ run: InspectionRunDTO }>(`/api/partner/inspection-runs/${run.id}`);
    setRun(res.run);
    setStepDraft(seedStepDraft(res.run.steps));
  }, [run, stepDraft]);

  const saveStepsWithToast = useCallback(async () => {
    if (!visitStarted) {
      setFieldErrors({ visitId: t("visitRequiredBeforeSteps") });
      toast.error(t("visitRequiredBeforeSteps"));
      return;
    }
    try {
      await saveSteps();
      toast.success(t("saveSteps"));
    } catch (e) {
      setFieldErrors(fieldFromApiError(e));
      toast.error(e instanceof ApiError ? e.message : t("saveFailed"));
    }
  }, [saveSteps, t, visitStarted]);

  const updateStepDraft = useCallback((stepId: string, next: InspectionStepDraft[string]) => {
    setStepDraft((prev) => ({
      ...prev,
      [stepId]: { ...prev[stepId], ...next },
    }));
  }, []);

  const uploadStepPhoto = useCallback(
    async (stepId: string, file: File) => {
      if (!run) return;
      setBusy(true);
      setFieldErrors({});
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("read failed"));
          reader.readAsDataURL(file);
        });
        await api(`/api/partner/inspection-runs/${run.id}/steps/${encodeURIComponent(stepId)}/photo`, {
          method: "POST",
          body: JSON.stringify({ dataUrl }),
        });
        const res = await api<{ run: InspectionRunDTO }>(`/api/partner/inspection-runs/${run.id}`);
        setRun(res.run);
        setStepDraft(seedStepDraft(res.run.steps));
        toast.success(t("photoUploaded"));
      } catch (e) {
        setFieldErrors(fieldFromApiError(e));
        toast.error(e instanceof ApiError ? e.message : t("photoUploadFailed"));
      } finally {
        setBusy(false);
      }
    },
    [run, t],
  );

  const completeRun = useCallback(async () => {
    if (!run) return;
    if (!visitStarted) {
      setFieldErrors({ visitId: t("visitRequiredBeforeSeal") });
      toast.error(t("visitRequiredBeforeSeal"));
      return;
    }
    if (!signaturesOk) {
      setFieldErrors({ signatures: t("signaturesRequired") });
      toast.error(t("signaturesRequired"));
      return;
    }
    if (missingEvidence.length > 0) {
      setFieldErrors({ noPhotoReason: t("failedStepEvidenceRequired") });
      toast.error(t("failedStepEvidenceRequired"));
      return;
    }
    if (catalogue?.traceabilityRequired && testEquipmentId) {
      const eq = preview?.eligibleEquipment.find((e) => e.id === testEquipmentId);
      if (eq && !eq.traceabilityRef?.trim()) {
        toast.error(t("traceabilityHint"));
        return;
      }
    }
    setBusy(true);
    setFieldErrors({});
    const idempotencyKey = `pp-${run.id}-${Date.now()}`;
    const note = buildSealNote({ defects, familySteps, stepDraft });
    try {
      if (!online) {
        await enqueueInspectionComplete({
          runId: run.id,
          reference,
          idempotencyKey,
          result,
          note,
          stepDraft: Object.fromEntries(
            Object.entries(stepDraft)
              .filter(([k]) => !k.startsWith("family-"))
              .map(([k, v]) => [
                k,
                {
                  confirmed: v.rating === "ok" ? true : v.rating === "defect" ? false : v.confirmed,
                  measuredValue: v.measuredValue,
                },
              ]),
          ),
        });
        toast.info(t("offlineQueued"));
        markDone(reference);
        return;
      }
      await saveSteps();
      try {
        await submitPartnerHints();
      } catch {
        /* hint is advisory — do not block seal if clarification write fails */
      }
      const res = await api<{ run: InspectionRunDTO }>(
        `/api/partner/inspection-runs/${run.id}/complete`,
        {
          method: "POST",
          headers: { "Idempotency-Key": idempotencyKey },
          body: JSON.stringify({ result, note }),
        },
      );
      setRun(res.run);
      markDone(reference);
      toast.success(t("sealedTitle"));
    } catch (e) {
      setFieldErrors(fieldFromApiError(e));
      toast.error(e instanceof ApiError ? e.message : t("completeFailed"));
    } finally {
      setBusy(false);
    }
  }, [
    run,
    visitStarted,
    signaturesOk,
    missingEvidence,
    catalogue,
    testEquipmentId,
    preview,
    t,
    online,
    enqueueInspectionComplete,
    reference,
    result,
    defects,
    familySteps,
    stepDraft,
    markDone,
    saveSteps,
    submitPartnerHints,
  ]);

  return {
    tenantId,
    tenantName,
    preview,
    run,
    catalogue,
    catalogueSteps,
    familySteps,
    displaySteps,
    eligibleEquipment,
    loading,
    busy,
    error,
    fieldErrors,
    scanCode,
    setScanCode,
    occasionCode,
    setOccasionCode,
    testEquipmentId,
    setTestEquipmentId,
    result,
    setResult,
    defects,
    setDefects,
    stepDraft,
    updateStepDraft,
    attachmentHintAck,
    setAttachmentHintAck,
    canStart,
    canComplete,
    stepsComplete,
    ratedCount,
    visitStarted,
    signaturesOk,
    missingEvidence,
    inspectorAbsent,
    setInspectorAbsent,
    inspectorName,
    setInspectorName,
    inspectorAbsentReason,
    setInspectorAbsentReason,
    institutionAbsent,
    setInstitutionAbsent,
    institutionName,
    setInstitutionName,
    institutionRole,
    setInstitutionRole,
    institutionAbsentReason,
    setInstitutionAbsentReason,
    sealed: Boolean(preview?.sealed || run?.sealed),
    deviceOk: Boolean(run?.deviceConfirmed || run?.deviceConfirmSkipped),
    needsOccasion: Boolean(catalogue?.occasions.length && !occasionCode && !run && !preview?.sealed),
    blockedQual: Boolean(preview && !preview.qualificationGate.ok),
    blockedBaseline: Boolean(catalogue?.missingBaseline),
    noMatch: !catalogue,
    certificateOnly: Boolean(catalogue?.noCatalogue),
    startRun,
    startVisit,
    saveSignature,
    uploadStepPhoto,
    confirmScan,
    saveStepsWithToast,
    completeRun,
    refresh,
  };
}
