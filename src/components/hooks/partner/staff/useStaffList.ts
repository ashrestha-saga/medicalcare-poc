"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { ConsoleStaffListDTO, ConsoleStaffMemberDTO } from "@/interfaces/console";
import { api, ApiError } from "@/lib/http/apiClient";

/** Partner console — staff list + keyword filter. */
export function useStaffList() {
  const t = useTranslations("console");
  const [data, setData] = useState<ConsoleStaffListDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");

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
    const q = keyword.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) =>
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
  }, [data, keyword]);

  return { data, filtered, error, loading, keyword, setKeyword, refresh };
}
