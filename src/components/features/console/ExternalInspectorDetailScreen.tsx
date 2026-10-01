"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ConsoleStaffMemberDTO } from "@/interfaces/console";
import { api, ApiError } from "@/lib/http/apiClient";
import { toast } from "@/store/toastStore";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/Loading";
import { usePermissions } from "@/lib/providers/PermissionProvider";

export function ExternalInspectorDetailScreen({ membershipId }: { membershipId: string }) {
  const t = useTranslations("console");
  const { checkPermission } = usePermissions();
  const canManage = checkPermission("console:external:manage");
  const [member, setMember] = useState<ConsoleStaffMemberDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [liability, setLiability] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ member: ConsoleStaffMemberDTO }>(
        `/api/partner/external-inspectors/${membershipId}`,
      );
      setMember(res.member);
      setFrom(res.member.commissionedFrom ?? "");
      setTo(res.member.commissionedTo ?? "");
      setLiability(res.member.liabilityUntil ?? "");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("externalLoadFailed"));
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
        `/api/partner/external-inspectors/${membershipId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            commissionedFrom: from,
            commissionedTo: to,
            liabilityUntil: liability,
          }),
        },
      );
      setMember(res.member);
      toast.success(t("externalSaved"));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("externalSaveFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-work" data-testid="console-external-detail">
      <main className="p-main">
        <ListPageShell title={member?.name ?? t("externalTitle")} description={t("externalIntro")}>
          <p className="mb-4">
            <Link
              href="/partner/external-inspectors"
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              ← {t("backToExternal")}
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
            <div className="grid max-w-lg gap-3">
              <p className="text-sm text-muted-foreground">{member.email}</p>
              <div className="grid gap-1.5">
                <Label>{t("externalFrom")}</Label>
                <Input
                  type="date"
                  value={from}
                  disabled={!canManage || busy}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("externalTo")}</Label>
                <Input
                  type="date"
                  value={to}
                  disabled={!canManage || busy}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("externalLiability")}</Label>
                <Input
                  type="date"
                  value={liability}
                  disabled={!canManage || busy}
                  onChange={(e) => setLiability(e.target.value)}
                />
              </div>
              {canManage ? (
                <Button type="button" disabled={busy} onClick={() => void save()}>
                  {t("externalSave")}
                </Button>
              ) : null}
            </div>
          ) : null}
        </ListPageShell>
      </main>
    </div>
  );
}
