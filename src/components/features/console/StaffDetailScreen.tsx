"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ConsoleStaffListDTO, ConsoleStaffMemberDTO } from "@/interfaces/console";
import { api, ApiError } from "@/lib/http/apiClient";
import { toast } from "@/store/toastStore";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/Loading";
import { usePermissions } from "@/lib/providers/PermissionProvider";

export function StaffDetailScreen({ membershipId }: { membershipId: string }) {
  const t = useTranslations("console");
  const { checkPermission } = usePermissions();
  const canAssign = checkPermission("console:staff:assign");
  const [member, setMember] = useState<ConsoleStaffMemberDTO | null>(null);
  const [clinics, setClinics] = useState<ConsoleStaffListDTO["clinics"]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [detail, staff] = await Promise.all([
        api<{ member: ConsoleStaffMemberDTO }>(
          `/api/partner/staff/${membershipId}/assignments`,
        ),
        api<ConsoleStaffListDTO>("/api/partner/staff"),
      ]);
      setMember(detail.member);
      setSelected(detail.member.assignedTenantIds);
      setClinics(staff.clinics.filter((c) => c.live));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("staffLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [membershipId, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function save() {
    setBusy(true);
    try {
      const res = await api<{ member: ConsoleStaffMemberDTO }>(
        `/api/partner/staff/${membershipId}/assignments`,
        { method: "PUT", body: JSON.stringify({ tenantIds: selected }) },
      );
      setMember(res.member);
      setSelected(res.member.assignedTenantIds);
      toast.success(t("staffAssignSaved"));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("staffAssignFailed"));
    } finally {
      setBusy(false);
    }
  }

  function toggle(tenantId: string) {
    setSelected((prev) =>
      prev.includes(tenantId) ? prev.filter((id) => id !== tenantId) : [...prev, tenantId],
    );
  }

  const isAdmin = member?.appRole === "admin" && !member.isExternal;

  return (
    <div className="p-work" data-testid="console-staff-detail">
      <main className="p-main">
        <ListPageShell title={member?.name ?? t("staffTitle")} description={t("staffAssignIntro")}>
          <p className="mb-4">
            <Link href="/partner/staff" className="text-sm text-primary underline-offset-4 hover:underline">
              ← {t("backToStaff")}
            </Link>
          </p>
          {loading ? (
            <div className="p-wait">
              <Spinner />
            </div>
          ) : null}
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {member ? (
            <div className="mb-4 text-sm">
              <p>
                {member.email} · {member.appRole}
              </p>
            </div>
          ) : null}
          {isAdmin ? (
            <p className="text-sm text-muted-foreground">{t("staffAssignAdminNote")}</p>
          ) : (
            <>
              <ul className="mb-4 space-y-2">
                {clinics.map((c) => (
                  <li key={c.tenantId} className="flex items-center gap-2">
                    <Checkbox
                      checked={selected.includes(c.tenantId)}
                      disabled={!canAssign || busy}
                      onCheckedChange={() => toggle(c.tenantId)}
                    />
                    <span>
                      {c.tenantName}
                      {c.tenantCode ? ` (${c.tenantCode})` : ""}
                    </span>
                  </li>
                ))}
              </ul>
              {canAssign ? (
                <Button type="button" disabled={busy} onClick={() => void save()}>
                  {t("staffAssignSave")}
                </Button>
              ) : null}
            </>
          )}
        </ListPageShell>
      </main>
    </div>
  );
}
