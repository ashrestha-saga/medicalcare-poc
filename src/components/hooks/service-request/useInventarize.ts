"use client";

import { useCallback, useEffect, useState } from "react";
import type { DeviceInstanceDTO, InventarizeOffer } from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { inventarizeFormSchema } from "@/schemas/device";
import { zodFieldErrors } from "@/schemas/formErrors";
import { useCapturerInventoryUi } from "@/store/capturerInventoryStore";
import { toast } from "@/store/toastStore";

/**
 * Post-request inventarize: Zod-validated serial, duplicate check, auto INV-#####.
 */
export function useInventarize(offer: InventarizeOffer, onDone: () => void) {
  const [serialNumber, setSerialNumber] = useState(offer.serialHint ?? "");
  const [responsibleUserId, setResponsibleUserId] = useState<string | null>(null);
  const [commissionedYear, setCommissionedYear] = useState(offer.commissionedYear);
  const [maintenanceCycleMonths, setMaintenanceCycleMonths] = useState(
    offer.maintenanceCycleMonths != null ? String(offer.maintenanceCycleMonths) : "",
  );
  const [duplicate, setDuplicate] = useState<DeviceInstanceDTO | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const setCount = useCapturerInventoryUi((s) => s.setCount);
  const count = useCapturerInventoryUi((s) => s.count);

  const artUndTyp =
    offer.tradeName?.trim() || offer.modelName?.trim() || "Gerät";

  useEffect(() => {
    const serial = serialNumber.trim();
    if (!serial) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear duplicate when serial emptied
      setDuplicate(null);
      return;
    }
    let alive = true;
    const t = setTimeout(() => {
      setChecking(true);
      void api<{ device: DeviceInstanceDTO | null }>(
        `/api/devices?serial=${encodeURIComponent(serial)}&modelId=${encodeURIComponent(offer.modelId)}`,
      )
        .then((res) => {
          if (alive) setDuplicate(res.device);
        })
        .catch(() => {
          if (alive) setDuplicate(null);
        })
        .finally(() => {
          if (alive) setChecking(false);
        });
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [serialNumber, offer.modelId]);

  const skip = useCallback(() => {
    onDone();
  }, [onDone]);

  const submit = useCallback(async () => {
    const parsed = inventarizeFormSchema.safeParse({
      serialNumber,
      responsibleUserId: responsibleUserId ?? undefined,
      commissionedAt: commissionedYear,
      maintenanceCycleMonths: maintenanceCycleMonths.trim() || undefined,
    });
    if (!parsed.success) {
      setFieldErrors(zodFieldErrors(parsed.error));
      setError(null);
      return;
    }
    setFieldErrors({});

    if (duplicate) {
      setError("Dieses Exemplar ist bereits im Bestandsverzeichnis.");
      return;
    }

    setError(null);
    setBusy(true);
    try {
      const cycleRaw = parsed.data.maintenanceCycleMonths?.trim();
      const cycle =
        cycleRaw && /^\d+$/.test(cycleRaw) ? Number(cycleRaw) : (offer.maintenanceCycleMonths ?? null);
      const res = await api<{ device: DeviceInstanceDTO }>("/api/devices", {
        method: "POST",
        body: JSON.stringify({
          modelId: offer.modelId,
          serialNumber: parsed.data.serialNumber,
          responsibleUserId: parsed.data.responsibleUserId ?? null,
          areaId: offer.areaId,
          room: offer.room,
          commissionedAt: parsed.data.commissionedAt?.trim() || null,
          maintenanceCycleMonths: cycle,
        }),
      });
      if (count != null) setCount(count + 1);
      toast.success(`Aufgenommen als ${res.device.inventoryNumber}.`);
      onDone();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const details = e.details as { device?: DeviceInstanceDTO; field?: string } | undefined;
        if (details?.device) setDuplicate(details.device);
        if (details?.field === "serialNumber") {
          setFieldErrors({ serialNumber: e.message });
        }
        setError(e.message);
      } else {
        setError(e instanceof ApiError ? e.message : "Aufnehmen fehlgeschlagen.");
      }
    } finally {
      setBusy(false);
    }
  }, [
    serialNumber,
    responsibleUserId,
    commissionedYear,
    maintenanceCycleMonths,
    duplicate,
    offer.modelId,
    offer.areaId,
    offer.room,
    offer.maintenanceCycleMonths,
    count,
    setCount,
    onDone,
  ]);

  return {
    artUndTyp,
    udiDi: offer.udiDi,
    locationText: offer.locationText,
    serialNumber,
    setSerialNumber,
    responsibleUserId,
    setResponsibleUserId,
    commissionedYear,
    setCommissionedYear,
    maintenanceCycleMonths,
    setMaintenanceCycleMonths,
    duplicate,
    checking,
    busy,
    fieldErrors,
    error,
    skip,
    submit,
  };
}
