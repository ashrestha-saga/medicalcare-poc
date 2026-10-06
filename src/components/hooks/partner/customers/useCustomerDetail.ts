"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ConsoleClinicDetailDTO, OperatingModel } from "@/interfaces/console";
import { api, ApiError } from "@/lib/http/apiClient";
import { useActingTenantStore } from "@/store/actingTenantStore";
import { toast } from "@/store/toastStore";

export function useCustomerDetail(contractId: string) {
  const t = useTranslations("console");
  const router = useRouter();
  const setActingTenant = useActingTenantStore((s) => s.setActingTenant);
  const [clinic, setClinic] = useState<ConsoleClinicDetailDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");
  const [billingRef, setBillingRef] = useState("");
  const [avvRef, setAvvRef] = useState("");
  const [operatingModel, setOperatingModel] = useState<OperatingModel>("provider_operated");
  const [scope, setScope] = useState<string[]>([]);

  const applyClinic = useCallback((next: ConsoleClinicDetailDTO) => {
    setClinic(next);
    setValidFrom(next.validFrom);
    setValidTo(next.validTo ?? "");
    setBillingRef(next.billingRef ?? "");
    setAvvRef(next.avvRef ?? "");
    setOperatingModel(next.operatingModel as OperatingModel);
    setScope(next.scope);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ clinic: ConsoleClinicDetailDTO }>(`/api/partner/clinics/${contractId}`);
      applyClinic(res.clinic);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("detailLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [applyClinic, contractId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleScope(token: string) {
    setScope((prev) => (prev.includes(token) ? prev.filter((s) => s !== token) : [...prev, token]));
  }

  async function save() {
    setBusy(true);
    try {
      const res = await api<{ clinic: ConsoleClinicDetailDTO }>(`/api/partner/clinics/${contractId}`, {
        method: "PATCH",
        body: JSON.stringify({
          validFrom,
          validTo: validTo || null,
          billingRef: billingRef || null,
          avvRef: avvRef || null,
          operatingModel,
          scope,
        }),
      });
      applyClinic(res.clinic);
      toast.success(t("contractSaved"));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("contractSaveFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function lifecycle(action: "suspend" | "resume" | "terminate") {
    setBusy(true);
    try {
      await api(`/api/partner/contracts/${contractId}/${action}`, { method: "POST" });
      toast.success(t(`lifecycle_${action}` as "lifecycle_suspend"));
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("lifecycleFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function setStaffAssigned(membershipId: string, assigned: boolean) {
    setBusy(true);
    try {
      const res = await api<{ clinic: ConsoleClinicDetailDTO }>(
        `/api/partner/clinics/${contractId}/staff`,
        {
          method: "PUT",
          body: JSON.stringify({ membershipId, assigned }),
        },
      );
      applyClinic(res.clinic);
      toast.success(assigned ? t("staffAssigned") : t("staffRevoked"));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("staffAssignFailed"));
    } finally {
      setBusy(false);
    }
  }

  function openBackoffice() {
    if (!clinic?.live) return;
    setActingTenant({
      tenantId: clinic.tenantId,
      tenantName: clinic.tenantName,
      tenantCode: clinic.tenantCode,
      contractId: clinic.contractId,
    });
    router.push("/");
  }

  return {
    clinic,
    error,
    loading,
    busy,
    validFrom,
    setValidFrom,
    validTo,
    setValidTo,
    billingRef,
    setBillingRef,
    avvRef,
    setAvvRef,
    operatingModel,
    setOperatingModel,
    scope,
    toggleScope,
    save,
    lifecycle,
    setStaffAssigned,
    openBackoffice,
  };
}
