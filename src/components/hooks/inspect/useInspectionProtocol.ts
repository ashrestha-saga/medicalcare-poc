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
  ratedStepCount,
  seedStepDraft,
  stepsPayloadFromDraft,
} from "./inspectionProtocolHelpers";

/** Orchestrates resolve → start → scan → steps → complete for one assignment. */
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
  const [scanCode, setScanCode] = useState("");
  const [occasionCode, setOccasionCode] = useState("");
  const [testEquipmentId, setTestEquipmentId] = useState("");
  const [result, setResult] = useState<InspectionResultCode>("passed");
  const [defects, setDefects] = useState("");
  const [stepDraft, setStepDraft] = useState<InspectionStepDraft>({});
  const [attachmentHintAck, setAttachmentHintAck] = useState(false);

  const ensureTenant = useCallback(() => {
    if (tenantId) {
      setActingTenant({ tenantId, tenantName: tenantName ?? tenantId });
    }
  }, [tenantId, tenantName, setActingTenant]);

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
  }, [reference, t, ensureTenant]);

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
  const canComplete =
    Boolean(catalogue?.noCatalogue) ||
    catalogueSteps.length === 0 ||
    catalogueRatedCount >= catalogueSteps.length;

  const startRun = useCallback(async () => {
    if (preview?.sealed) {
      toast.error(t("sealedTitle"));
      return;
    }
    setBusy(true);
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
      toast.success(t("startRun"));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("loadFailed"));
    } finally {
      setBusy(false);
    }
  }, [preview?.sealed, reference, occasionCode, testEquipmentId, t]);

  const confirmScan = useCallback(
    async (skip = false) => {
      if (!run) return;
      setBusy(true);
      try {
        await api(`/api/partner/inspection-runs/${run.id}/confirm-device`, {
          method: "POST",
          body: JSON.stringify(skip ? { skip: true } : { code: scanCode }),
        });
        setRun({ ...run, deviceConfirmed: true, deviceConfirmSkipped: skip });
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
    try {
      await saveSteps();
      toast.success(t("saveSteps"));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("saveFailed"));
    }
  }, [saveSteps, t]);

  const updateStepDraft = useCallback((stepId: string, next: InspectionStepDraft[string]) => {
    setStepDraft((prev) => ({
      ...prev,
      [stepId]: { ...prev[stepId], ...next },
    }));
  }, []);

  const completeRun = useCallback(async () => {
    if (!run) return;
    if (catalogue?.traceabilityRequired && testEquipmentId) {
      const eq = preview?.eligibleEquipment.find((e) => e.id === testEquipmentId);
      if (eq && !eq.traceabilityRef?.trim()) {
        toast.error(t("traceabilityHint"));
        return;
      }
    }
    setBusy(true);
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
      toast.error(e instanceof ApiError ? e.message : t("completeFailed"));
    } finally {
      setBusy(false);
    }
  }, [
    run,
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
    ratedCount,
    sealed: Boolean(preview?.sealed || run?.sealed),
    deviceOk: Boolean(run?.deviceConfirmed || run?.deviceConfirmSkipped),
    needsOccasion: Boolean(catalogue?.occasions.length && !occasionCode && !run && !preview?.sealed),
    blockedQual: Boolean(preview && !preview.qualificationGate.ok),
    blockedBaseline: Boolean(catalogue?.missingBaseline),
    noMatch: !catalogue,
    certificateOnly: Boolean(catalogue?.noCatalogue),
    startRun,
    confirmScan,
    saveStepsWithToast,
    completeRun,
    refresh,
  };
}
