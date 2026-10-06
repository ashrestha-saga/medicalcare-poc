"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ConsoleStaffListDTO, ConsoleStaffMemberDTO } from "@/interfaces/console";
import { api, ApiError } from "@/lib/http/apiClient";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { DataTable } from "@/components/features/shared/shadcn/DataTable";
import { useStaffColumns } from "@/components/hooks/partner/staff/useStaffColumns";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { staffSkillLevelMessageKey } from "@/lib/console/staffLabels";
import { usePermissions } from "@/lib/providers/PermissionProvider";

export function StaffScreen() {
  const t = useTranslations("console");
  const { checkPermission } = usePermissions();
  const canInviteUi = checkPermission("console:staff:invite");
  const [data, setData] = useState<ConsoleStaffListDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const columns = useStaffColumns();

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
    // Initial fetch — setState inside async refresh is intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load list on mount
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
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

  return (
    <div className="p-work" data-testid="console-staff">
      <main className="p-main">
        <ListPageShell
          title={t("staffTitle")}
          description={t("staffIntro")}
          headerExtra={
            canInviteUi && data?.canInvite ? (
              <Button asChild>
                <Link href="/partner/staff/new">{t("staffCreateCta")}</Link>
              </Button>
            ) : null
          }
        >
          {error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {data && data.expiringSoon.length > 0 ? (
            <Alert className="mb-4 border-amber-200 bg-amber-50 text-amber-950">
              <AlertDescription>
                <p className="mb-1 font-medium">{t("staffExpiryBannerTitle")}</p>
                <ul className="list-inside list-disc text-sm">
                  {data.expiringSoon.slice(0, 8).map((item) => {
                    const levelKey =
                      item.kind === "skill" && item.skillLevelCode
                        ? staffSkillLevelMessageKey(item.skillLevelCode)
                        : null;
                    const levelSuffix =
                      levelKey != null ? ` (${t(levelKey)})` : "";
                    return (
                      <li key={`${item.membershipId}-${item.kind}-${item.label}`}>
                        {item.personName}: {item.label}
                        {levelSuffix} ({item.validUntil})
                      </li>
                    );
                  })}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}
          <DataTable<ConsoleStaffMemberDTO, unknown>
            columns={columns}
            data={filtered}
            search
            visibility
            displayPagination
            keyword={keyword}
            setKeyword={setKeyword}
            isLoading={loading}
            getRowId={(row) => row.membershipId}
            emptyMessage={t("staffEmpty")}
          />
          <p className="mt-4 text-xs text-muted-foreground">{t("staffNote")}</p>
        </ListPageShell>
      </main>
    </div>
  );
}
