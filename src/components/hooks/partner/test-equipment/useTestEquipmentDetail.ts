"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type {
  TestEquipmentAssigneeOptionDTO,
  TestEquipmentClassDTO,
  TestEquipmentDTO,
} from "@/interfaces/pruefpartner";
import { api, ApiError } from "@/lib/http/apiClient";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { toast } from "@/store/toastStore";

export function useTestEquipmentDetail(id: string) {
  const t = useTranslations("pruefpartner");
  const router = useRouter();
  const { checkPermission } = usePermissions();
  const canManage = checkPermission("testequipment:manage");

  const [item, setItem] = useState<TestEquipmentDTO | null>(null);
  const [classes, setClasses] = useState<TestEquipmentClassDTO[]>([]);
  const [assignees, setAssignees] = useState<TestEquipmentAssigneeOptionDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [classCode, setClassCode] = useState("");
  const [label, setLabel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [calibratedUntil, setCalibratedUntil] = useState("");
  const [traceabilityRef, setTraceabilityRef] = useState("");
  const [active, setActive] = useState(true);
  const [assignedMembershipId, setAssignedMembershipId] = useState("");

  const applyItem = useCallback((next: TestEquipmentDTO) => {
    setItem(next);
    setClassCode(next.classCode);
    setLabel(next.label);
    setSerialNumber(next.serialNumber ?? "");
    setCalibratedUntil(next.calibratedUntil ?? "");
    setTraceabilityRef(next.traceabilityRef ?? "");
    setActive(next.active);
    setAssignedMembershipId(next.assignedMembershipId ?? "");
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{
        item: TestEquipmentDTO;
        classes: TestEquipmentClassDTO[];
        assignees: TestEquipmentAssigneeOptionDTO[];
      }>(`/api/partner/test-equipment/${encodeURIComponent(id)}`);
      applyItem(res.item);
      setClasses(res.classes);
      setAssignees(res.assignees);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("testEquipmentLoadFailed"));
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [id, applyItem, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async () => {
    if (!canManage || !label.trim()) return;
    setBusy(true);
    try {
      const res = await api<{ item: TestEquipmentDTO }>(
        `/api/partner/test-equipment/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            classCode,
            label: label.trim(),
            serialNumber: serialNumber.trim() || null,
            calibratedUntil: calibratedUntil || null,
            traceabilityRef: traceabilityRef.trim() || null,
            active,
            assignedMembershipId: assignedMembershipId || null,
          }),
        },
      );
      applyItem(res.item);
      toast.success(t("testEquipmentSaved"));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("testEquipmentSaveFailed"));
    } finally {
      setBusy(false);
    }
  }, [
    canManage,
    id,
    classCode,
    label,
    serialNumber,
    calibratedUntil,
    traceabilityRef,
    active,
    assignedMembershipId,
    applyItem,
    t,
  ]);

  const back = useCallback(() => {
    router.push("/partner/test-equipment");
  }, [router]);

  return {
    item,
    classes,
    assignees,
    error,
    loading,
    busy,
    canManage,
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
    active,
    setActive,
    assignedMembershipId,
    setAssignedMembershipId,
    save,
    back,
    refresh: load,
  };
}
