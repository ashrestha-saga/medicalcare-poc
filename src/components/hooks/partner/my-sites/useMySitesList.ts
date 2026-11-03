"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { MySitesInstitutionDTO, MySitesListDTO } from "@/interfaces/console";
import { aggregateMySitesInstitutions } from "@/services/console/mySitesAggregate";
import { api, ApiError } from "@/lib/http/apiClient";
import { useQueryParam, useSyncQueryParams } from "@/lib/navigation/searchParams";
import { useSessionStore } from "@/store/sessionStore";

export type MySitesDueFilter = "alle" | "ueber" | "30" | "90";
export type MySitesDistanceFilter = "alle" | "nah" | "mittel" | "fern";

function parseDue(raw: string | null): MySitesDueFilter {
  if (raw === "ueber" || raw === "30" || raw === "90" || raw === "alle") return raw;
  return "alle";
}

/** Partner console — my sites list with filters (URL: ?due=ueber). */
export function useMySitesList() {
  const t = useTranslations("console");
  const router = useRouter();
  const dueParam = useQueryParam("due");
  const { sync } = useSyncQueryParams();
  const sessionUser = useSessionStore((s) => s.user);

  const [data, setData] = useState<MySitesListDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [distance, setDistance] = useState<MySitesDistanceFilter>("alle");
  const [due, setDueState] = useState<MySitesDueFilter>(() => parseDue(dueParam));
  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    setDueState(parseDue(dueParam));
  }, [dueParam]);

  const setDue = useCallback(
    (value: MySitesDueFilter) => {
      setDueState(value);
      sync({ due: value === "alle" ? null : value });
    },
    [sync],
  );

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
    // Strict: only institutions / counts for the signed-in user — never colleagues' jobs.
    return aggregateMySitesInstitutions(
      data.tenants,
      data.staffAssignments,
      data.inspections,
      "self",
      sessionUser.id,
    );
  }, [data, sessionUser]);

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
