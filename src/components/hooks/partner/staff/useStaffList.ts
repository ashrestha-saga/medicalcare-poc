"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { ConsoleStaffListDTO, ConsoleStaffMemberDTO } from "@/interfaces/console";
import { api, ApiError } from "@/lib/http/apiClient";
import { useQueryParam, useSyncQueryParams } from "@/lib/navigation/searchParams";

/** Partner console — staff list + keyword / expiring filters (URL: ?expiring=1). */
export function useStaffList() {
  const t = useTranslations("console");
  const expiringParam = useQueryParam("expiring");
  const { sync } = useSyncQueryParams();
  const [data, setData] = useState<ConsoleStaffListDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [expiringOnly, setExpiringOnlyState] = useState(expiringParam === "1");

  useEffect(() => {
    setExpiringOnlyState(expiringParam === "1");
  }, [expiringParam]);

  const setExpiringOnly = useCallback(
    (value: boolean) => {
      setExpiringOnlyState(value);
      sync({ expiring: value ? "1" : null });
    },
    [sync],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api<ConsoleStaffListDTO>("/api/partner/staff"));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("staffLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo((): ConsoleStaffMemberDTO[] => {
    const members = data?.members ?? [];
    const expiringIds = new Set((data?.expiringSoon ?? []).map((x) => x.membershipId));
    let list = members;
    if (expiringOnly) {
      list = list.filter((m) => {
        if (expiringIds.has(m.membershipId)) return true;
        const horizon = Date.now() + 90 * 86400000;
        const now = Date.now();
        const soon = (iso: string | null | undefined) => {
          if (!iso) return false;
          const t0 = new Date(iso).getTime();
          return t0 >= now && t0 <= horizon;
        };
        return (
          soon(m.validTo) ||
          soon(m.commissionedTo) ||
          soon(m.liabilityUntil) ||
          m.qualifications.some((q) => soon(q.validUntil)) ||
          m.skills.some((s) => soon(s.validUntil))
        );
      });
    }
    const q = keyword.trim().toLowerCase();
    if (!q) return list;
    return list.filter((m) =>
      [
        m.name,
        m.email,
        m.jobTitle ?? "",
        m.appRole,
        m.status,
        ...m.qualifications.map((x) => x.label),
        ...m.assignedClinicNames,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [data, keyword, expiringOnly]);

  return {
    data,
    filtered,
    error,
    loading,
    keyword,
    setKeyword,
    expiringOnly,
    setExpiringOnly,
    refresh,
  };
}
