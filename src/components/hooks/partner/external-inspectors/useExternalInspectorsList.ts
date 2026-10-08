"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { ConsoleExternalListDTO, ConsoleStaffMemberDTO } from "@/interfaces/console";
import { api, ApiError } from "@/lib/http/apiClient";

/** Partner console — external inspectors grouped by employer. */
export function useExternalInspectorsList() {
  const t = useTranslations("console");
  const [data, setData] = useState<ConsoleExternalListDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
    const members = data?.members ?? [];
    const map = new Map<string, { key: string; title: string; members: ConsoleStaffMemberDTO[] }>();
    for (const m of members) {
      const key = m.employerOrganisationId ?? "unknown";
      const title = m.employerName ?? t("externalUnknownEmployer");
      const g = map.get(key) ?? { key, title, members: [] };
      g.members.push(m);
      map.set(key, g);
    }
    return [...map.values()].sort((a, b) => a.title.localeCompare(b.title));
  }, [data, t]);

  return { data, groups, error, loading, refresh };
}
