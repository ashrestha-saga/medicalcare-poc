"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { DispatchRecordDTO, InventarizeOffer, ServiceRequestDTO } from "@/interfaces";
import { api } from "@/lib/http/apiClient";
import { useOfflineQueueStore } from "@/store/offlineQueueStore";
import { useScanStore } from "@/store/scanStore";

/**
 * Success / queued screen: offline sync, poll detail, dispatch summary.
 * Catalog/BEUDAMED hits offer inventarize before the dispatch summary.
 */
export function useSuccessState() {
  const t = useTranslations("scan");
  const tStatus = useTranslations("status");
  const success = useScanStore((s) => s.success);
  const phase = useScanStore((s) => s.phase);
  const reset = useScanStore((s) => s.reset);
  const succeeded = useScanStore((s) => s.succeeded);
  const recentlySynced = useOfflineQueueStore((s) => s.recentlySynced);
  const online = useOfflineQueueStore((s) => s.online);
  const [detail, setDetail] = useState<ServiceRequestDTO | null>(success?.request ?? null);
  const [inventarizeDone, setInventarizeDone] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset inventarize gate when a new success payload arrives
    setInventarizeDone(false);
  }, [success?.idempotencyKey]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync detail when success payload includes request
    if (success?.request) setDetail(success.request);
  }, [success?.request]);

  useEffect(() => {
    if (phase !== "queued" || !success) return;
    const hit = recentlySynced.find((r) => r.idempotencyKey === success.idempotencyKey);
    if (hit) succeeded({ ...success, reference: hit.reference, state: "captured", queued: false });
  }, [phase, success, recentlySynced, succeeded]);

  useEffect(() => {
    if (phase !== "success" || !success?.reference || success.kind !== "service-request") return;
    let alive = true;
    const load = () =>
      api<ServiceRequestDTO>(`/api/service-requests/${success.reference}`)
        .then((d) => alive && setDetail(d))
        .catch(() => undefined);
    void load();
    const timer = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [phase, success]);

  const records = useMemo(() => detail?.dispatchRecords ?? [], [detail?.dispatchRecords]);
  const dispatchSummary = useMemo(() => {
    if (records.length === 0) return null;
    const ok = records.filter((r) => r.success).length;
    return { ok, fail: records.length - ok, total: records.length };
  }, [records]);

  const isQueued = phase === "queued";
  const isService = success?.kind === "service-request";
  const inventarizeOffer: InventarizeOffer | undefined = success?.inventarize;
  const showInventarize = Boolean(
    !isQueued && isService && inventarizeOffer && !inventarizeDone,
  );

  const finishInventarize = useCallback(() => {
    setInventarizeDone(true);
  }, []);

  const channelLabel = useCallback(
    (target: string): string => {
      const type = target.split(":")[0] ?? target;
      switch (type) {
        case "mail":
          return t("channelEmail");
        case "oxid":
          return t("channelOxid");
        case "webhook":
          return t("channelWebhook");
        default:
          return target;
      }
    },
    [t],
  );

  const dispatchHeadline = useCallback(
    (recs: DispatchRecordDTO[]): string => {
      if (recs.length === 0) return t("successSaved");
      const ok = recs.filter((r) => r.success).length;
      const fail = recs.length - ok;
      if (fail === 0) return t("successTransmitted");
      if (ok === 0) return t("successDispatchFailed");
      return t("successPartial");
    },
    [t],
  );

  const stateLabel = useCallback(
    (state: string): string => {
      const known = [
        "captured",
        "queued",
        "transmitted",
        "acknowledged",
        "in_progress",
        "completed",
        "rejected",
      ] as const;
      return (known as readonly string[]).includes(state)
        ? tStatus(state as (typeof known)[number])
        : state;
    },
    [tStatus],
  );

  const title = !success
    ? ""
    : isQueued
      ? t("successQueuedTitle")
      : isService
        ? dispatchHeadline(records)
        : t("successOrderTitle");

  const checkTone =
    isQueued || (dispatchSummary && dispatchSummary.fail > 0 && dispatchSummary.ok === 0)
      ? "warn"
      : dispatchSummary && dispatchSummary.fail > 0
        ? "mixed"
        : "ok";

  return {
    success,
    detail,
    records,
    dispatchSummary,
    online,
    isQueued,
    isService,
    title,
    checkTone,
    reset,
    showInventarize,
    inventarizeOffer,
    finishInventarize,
    channelLabel,
    stateLabel,
    deviceFallbackTitle: t("deviceFallbackTitle"),
    queuedOnlineSub: t("queuedOnlineSub"),
    queuedOfflineSub: t("queuedOfflineSub"),
    dispatchChannels: t("dispatchChannels"),
    noDispatchTargets: t("noDispatchTargets"),
    httpAttempt: (status: number, count: number) => t("httpAttempt", { status, count }),
    attemptOnly: (count: number) => t("attemptOnly", { count }),
    channelsSummary: (ok: number, total: number) => t("channelsSummary", { ok, total }),
    channelsFailedSuffix: (fail: number) => t("channelsFailedSuffix", { fail }),
    scanNext: t("scanNext"),
  };
}
