"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { MySitesInstitutionDTO, MySitesListDTO } from "@/interfaces/console";
import { aggregateMySitesInstitutions } from "@/services/console/mySitesAggregate";
import { api, ApiError } from "@/lib/http/apiClient";
import { useSessionStore } from "@/store/sessionStore";

export type MySitesDueFilter = "alle" | "ueber" | "30" | "90";
export type MySitesDistanceFilter = "alle" | "nah" | "mittel" | "fern";

/** Partner console — my sites list with filters. */
export function useMySitesList() {
  const t = useTranslations("console");
  const router = useRouter();
  const sessionUser = useSessionStore((s) => s.user);
  const isAdmin = sessionUser?.appRole === "admin";

  const [data, setData] = useState<MySitesListDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [responsibility, setResponsibility] = useState<string>(isAdmin ? "all" : "self");
  const [distance, setDistance] = useState<MySitesDistanceFilter>("alle");
  const [due, setDue] = useState<MySitesDueFilter>("alle");
  const [keyword, setKeyword] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api<MySitesListDTO>("/api/partner/my-sites"));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("mySitesLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openTenant = useCallback(
    (row: MySitesInstitutionDTO) => {
      router.push(`/partner/my-sites/${encodeURIComponent(row.tenantId)}`);
    },
    [router],
  );

  const institutions = useMemo(() => {
    if (!data || !sessionUser) return [];
    return aggregateMySitesInstitutions(
      data.tenants,
      data.staffAssignments,
      data.inspections,
      responsibility,
      sessionUser.id,
    );
  }, [data, responsibility, sessionUser]);

  const filtered = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const inDays = (iso: string | null, max: number) => {
      if (!iso) return false;
      const d = new Date(`${iso}T00:00:00`);
      const diff = (d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000);
      return diff >= 0 && diff <= max;
    };
    return institutions.filter((row) => {
      if (distance !== "alle" && row.distanceBand !== distance) return false;
      if (due === "ueber" && row.overdueCount === 0) return false;
      if (due === "30" && !inDays(row.nextDue, 30)) return false;
      if (due === "90" && !inDays(row.nextDue, 90)) return false;
      const q = keyword.trim().toLowerCase();
      if (!q) return true;
      const hay = [
        row.tenantName,
        row.tenantCode ?? "",
        row.location ?? "",
        ...row.assignees.map((a) => a.name),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [institutions, distance, due, keyword]);

  const summaryCount = filtered.reduce((n, r) => n + r.inspectionCount, 0);

  return {
    data,
    error,
    loading,
    isAdmin,
    responsibility,
    setResponsibility,
    distance,
    setDistance,
    due,
    setDue,
    keyword,
    setKeyword,
    filtered,
    summaryCount,
    openTenant,
    refresh,
  };
}
