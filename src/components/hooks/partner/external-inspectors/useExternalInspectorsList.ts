"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { ConsoleExternalListDTO, ConsoleStaffMemberDTO } from "@/interfaces/console";
import { api, ApiError } from "@/lib/http/apiClient";
import { useQueryParam, useSyncQueryParams } from "@/lib/navigation/searchParams";

/** Partner console — external inspectors grouped by employer (URL: ?ready=1). */
export function useExternalInspectorsList() {
  const t = useTranslations("console");
  const readyParam = useQueryParam("ready");
  const { sync } = useSyncQueryParams();
  const [data, setData] = useState<ConsoleExternalListDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [readyOnly, setReadyOnlyState] = useState(readyParam === "1");

  useEffect(() => {
    setReadyOnlyState(readyParam === "1");
  }, [readyParam]);

  const setReadyOnly = useCallback(
    (value: boolean) => {
      setReadyOnlyState(value);
      sync({ ready: value ? "1" : null });
    },
    [sync],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api<ConsoleExternalListDTO>("/api/partner/external-inspectors"));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("externalLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const groups = useMemo(() => {
    const members = (data?.members ?? []).filter((m) => (readyOnly ? m.deployable === true : true));
    const map = new Map<string, { key: string; title: string; members: ConsoleStaffMemberDTO[] }>();
    for (const m of members) {
      const key = m.employerOrganisationId ?? "unknown";
      const title = m.employerName ?? t("externalUnknownEmployer");
      const g = map.get(key) ?? { key, title, members: [] };
      g.members.push(m);
      map.set(key, g);
    }
    return [...map.values()].sort((a, b) => a.title.localeCompare(b.title));
  }, [data, readyOnly, t]);

  return { data, groups, error, loading, refresh, readyOnly, setReadyOnly };
}
