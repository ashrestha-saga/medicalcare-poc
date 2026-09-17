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
  const [responsiblePerson, setResponsiblePerson] = useState("");
  const [commissionedYear, setCommissionedYear] = useState(offer.commissionedYear);
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
      responsiblePerson,
      commissionedAt: commissionedYear,
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
      const res = await api<{ device: DeviceInstanceDTO }>("/api/devices", {
        method: "POST",
        body: JSON.stringify({
          modelId: offer.modelId,
          serialNumber: parsed.data.serialNumber,
          responsiblePerson: parsed.data.responsiblePerson?.trim() || null,
          areaId: offer.areaId,
          room: offer.room,
          commissionedAt: parsed.data.commissionedAt?.trim() || null,
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
    responsiblePerson,
    commissionedYear,
    duplicate,
    offer.modelId,
    offer.areaId,
    offer.room,
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
    responsiblePerson,
    setResponsiblePerson,
    commissionedYear,
    setCommissionedYear,
    duplicate,
    checking,
    busy,
    fieldErrors,
    error,
    skip,
    submit,
  };
}
