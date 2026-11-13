"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { TestEquipmentListDTO, TestEquipmentDTO } from "@/interfaces/pruefpartner";
import { api, ApiError } from "@/lib/http/apiClient";
import { toast } from "@/store/toastStore";

export type TestEquipmentFilter = "all" | "active" | "due" | "lapsed" | "inactive";

export function useTestEquipmentList() {
  const t = useTranslations("pruefpartner");
  const [data, setData] = useState<TestEquipmentListDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [filter, setFilter] = useState<TestEquipmentFilter>("all");
  const [classFilter, setClassFilter] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [classCode, setClassCode] = useState("sicherheitstester");
  const [label, setLabel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [calibratedUntil, setCalibratedUntil] = useState("");
  const [traceabilityRef, setTraceabilityRef] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<TestEquipmentListDTO>("/api/partner/test-equipment");
      setData(res);
      setClassCode((prev) =>
        res.classes.some((c) => c.code === prev) ? prev : (res.classes[0]?.code ?? prev),
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("testEquipmentLoadFailed"));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    if (!data) return [] as TestEquipmentDTO[];
    const q = keyword.trim().toLowerCase();
    return data.items.filter((item) => {
      if (filter === "active" && !item.active) return false;
      if (filter === "inactive" && item.active) return false;
      if (filter === "due" && item.status !== "due") return false;
      if (filter === "lapsed" && item.status !== "lapsed") return false;
      if (classFilter && item.classCode !== classFilter) return false;
      if (!q) return true;
      const hay = [
        item.label,
        item.classCode,
        item.classLabel ?? "",
        item.serialNumber ?? "",
        item.assigneeName ?? "",
        item.traceabilityRef ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [data, keyword, filter, classFilter]);

  const addItem = useCallback(async () => {
    if (!data?.canManage || !label.trim()) return;
    setBusy(true);
    try {
      await api("/api/partner/test-equipment", {
        method: "POST",
        body: JSON.stringify({
          classCode,
          label: label.trim(),
          serialNumber: serialNumber.trim() || null,
          calibratedUntil: calibratedUntil || null,
          traceabilityRef: traceabilityRef.trim() || null,
        }),
      });
      setLabel("");
      setSerialNumber("");
      setCalibratedUntil("");
      setTraceabilityRef("");
      setCreateOpen(false);
      toast.success(t("testEquipmentSaved"));
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("testEquipmentSaveFailed"));
    } finally {
      setBusy(false);
    }
  }, [
    data?.canManage,
    label,
    classCode,
    serialNumber,
    calibratedUntil,
    traceabilityRef,
    t,
    refresh,
  ]);

  return {
    data,
    error,
    loading,
    busy,
    filtered,
    keyword,
    setKeyword,
    filter,
    setFilter,
    classFilter,
    setClassFilter,
    createOpen,
    setCreateOpen,
    classCode,
    setClassCode,
    label,
    setLabel,
    serialNumber,
    setSerialNumber,
    calibratedUntil,
    setCalibratedUntil,
    traceabilityRef,
    setTraceabilityRef,
    addItem,
    refresh,
  };
}
