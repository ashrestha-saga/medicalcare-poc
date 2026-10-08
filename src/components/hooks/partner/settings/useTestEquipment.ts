"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { TestEquipmentDTO } from "@/interfaces/pruefpartner";
import { api, ApiError } from "@/lib/http/apiClient";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { toast } from "@/store/toastStore";

/** Partner settings — list / create test equipment. */
export function useTestEquipment() {
  const t = useTranslations("pruefpartner");
  const { checkPermission } = usePermissions();
  const canManage = checkPermission("testequipment:manage");

  const [items, setItems] = useState<TestEquipmentDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [classCode, setClassCode] = useState("sicherheitstester");
  const [label, setLabel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [calibratedUntil, setCalibratedUntil] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ items: TestEquipmentDTO[] }>("/api/partner/test-equipment");
      setItems(res.items);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addItem = useCallback(async () => {
    if (!canManage || !label.trim()) return;
    setBusy(true);
    try {
      await api("/api/partner/test-equipment", {
        method: "POST",
        body: JSON.stringify({
          classCode,
          label: label.trim(),
          serialNumber: serialNumber.trim() || null,
          calibratedUntil: calibratedUntil || null,
        }),
      });
      setLabel("");
      setSerialNumber("");
      setCalibratedUntil("");
      toast.success(t("testEquipmentSaved"));
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("testEquipmentSaveFailed"));
    } finally {
      setBusy(false);
    }
  }, [canManage, label, classCode, serialNumber, calibratedUntil, t, refresh]);

  return {
    canManage,
    items,
    loading,
    busy,
    classCode,
    setClassCode,
    label,
    setLabel,
    serialNumber,
    setSerialNumber,
    calibratedUntil,
    setCalibratedUntil,
    addItem,
    refresh,
  };
}
