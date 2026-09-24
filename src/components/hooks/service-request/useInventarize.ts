"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DeviceInstanceDTO, InventarizeOffer } from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { inventarizeFormSchema } from "@/schemas/device";
import { zodFieldErrors } from "@/schemas/formErrors";
import { useCapturerInventoryUi } from "@/store/capturerInventoryStore";
import { toast } from "@/store/toastStore";

type InventarizeCreateResult = DeviceInstanceDTO & { registrationPath?: string };

/**
 * Post-request inventarize: creates a draft instance and deep-links to Erstanlage.
 * Maintenance cycle is left unset — derived later on Erstanlage release.
 */
export function useInventarize(offer: InventarizeOffer, onDone: () => void) {
  const router = useRouter();
  const [serialNumber, setSerialNumber] = useState(offer.serialHint ?? "");
  const [responsibleUserId, setResponsibleUserId] = useState<string | null>(null);
  const [commissionedYear, setCommissionedYear] = useState(offer.commissionedYear);
  const [duplicate, setDuplicate] = useState<DeviceInstanceDTO | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const setCount = useCapturerInventoryUi((s) => s.setCount);
  const count = useCapturerInventoryUi((s) => s.count);

  const artUndTyp =
    offer.tradeName?.trim() || offer.modelName?.trim() || offer.udiDi?.trim() || "Device";

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
    });
    if (!parsed.success) {
      setFieldErrors(zodFieldErrors(parsed.error));
      setError(null);
      return;
    }
    setFieldErrors({});

    if (duplicate) {
      setError("This unit is already in the inventory.");
      return;
    }

    setError(null);
    setBusy(true);
    try {
      const res = await api<{ device: InventarizeCreateResult }>("/api/devices", {
        method: "POST",
        body: JSON.stringify({
          modelId: offer.modelId,
          serialNumber: parsed.data.serialNumber,
          responsibleUserId: parsed.data.responsibleUserId ?? null,
          areaId: offer.areaId,
          room: offer.room,
          commissionedAt: parsed.data.commissionedAt?.trim() || null,
        }),
      });
      if (count != null) setCount(count + 1);
      toast.success(`Draft ${res.device.inventoryNumber} created — continue to registration.`);
      const path = res.device.registrationPath ?? `/registration/${res.device.id}`;
      router.push(path);
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
        setError(e instanceof ApiError ? e.message : "Failed to add device.");
      }
    } finally {
      setBusy(false);
    }
  }, [
    serialNumber,
    responsibleUserId,
    commissionedYear,
    duplicate,
    offer.modelId,
    offer.areaId,
    offer.room,
    count,
    setCount,
    onDone,
    router,
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
    duplicate,
    checking,
    busy,
    fieldErrors,
    error,
    skip,
    submit,
  };
}
