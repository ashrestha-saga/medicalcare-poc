"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DispatchRecordDTO, InventarizeOffer, ServiceRequestDTO } from "@/interfaces";
import { SERVICE_REQUEST_STATE_LABELS } from "@/constants/serviceRequest";
import { api } from "@/lib/http/apiClient";
import { useOfflineQueueStore } from "@/store/offlineQueueStore";
import { useScanStore } from "@/store/scanStore";

export function channelLabel(target: string): string {
  const type = target.split(":")[0] ?? target;
  switch (type) {
    case "mail":
      return "E-Mail";
    case "oxid":
      return "OXID API";
    case "webhook":
      return "Webhook";
    default:
      return target;
  }
}

export function dispatchHeadline(records: DispatchRecordDTO[]): string {
  if (records.length === 0) return "Serviceanfrage gespeichert";
  const ok = records.filter((r) => r.success).length;
  const fail = records.length - ok;
  if (fail === 0) return "Serviceanfrage übermittelt";
  if (ok === 0) return "Serviceanfrage gespeichert — Versand fehlgeschlagen";
  return "Serviceanfrage gespeichert — teilweise übermittelt";
}

export function serviceRequestStateLabel(state: string): string {
  return SERVICE_REQUEST_STATE_LABELS[state] ?? state;
}

/**
 * Success / queued screen: offline sync, poll detail, dispatch summary.
 * Catalog/BEUDAMED hits offer inventarize before the dispatch summary.
 */
export function useSuccessState() {
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
    const t = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(t);
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

  const title = !success
    ? ""
    : isQueued
      ? "Lokal gespeichert"
      : isService
        ? dispatchHeadline(records)
        : "Bestellanfrage übermittelt";

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
  };
}
