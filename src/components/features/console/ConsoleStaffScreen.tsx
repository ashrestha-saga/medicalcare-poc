"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { ConsoleStaffListDTO } from "@/interfaces/console";
import { api, ApiError } from "@/lib/http/apiClient";
import { toast } from "@/store/toastStore";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/Loading";
import { usePermissions } from "@/lib/providers/PermissionProvider";

export function ConsoleStaffScreen() {
  const t = useTranslations("console");
  const tCommon = useTranslations("common");
  const { checkPermission } = usePermissions();
  const canInviteUi = checkPermission("console:staff:invite");
  const [data, setData] = useState<ConsoleStaffListDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [appRole, setAppRole] = useState<"admin" | "inspector" | "order">("inspector");
  const [busy, setBusy] = useState(false);

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

  async function invite() {
    setBusy(true);
    try {
      const res = await api<{ invite: { redeemUrl: string; emailSimulated: boolean } }>("/api/partner/staff", {
        method: "POST",
        body: JSON.stringify({ email, name: name || null, appRole }),
      });
      toast.success(
        res.invite.emailSimulated ? t("staffInviteSimulated", { url: res.invite.redeemUrl }) : t("staffInvited"),
      );
      setEmail("");
      setName("");
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("staffInviteFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-work" data-testid="console-staff">
      <main className="p-main">
        <ListPageShell title={t("staffTitle")} description={t("staffIntro")}>
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
          {canInviteUi && data?.canInvite ? (
            <section className="mb-6 grid max-w-xl gap-3 rounded-md border border-border p-4">
              <h2 className="text-sm font-semibold">{t("staffInviteTitle")}</h2>
              <div className="grid gap-1.5">
                <Label>{t("staffEmail")}</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("staffName")}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("staffRole")}</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-border bg-transparent px-3 text-sm"
                  value={appRole}
                  onChange={(e) => setAppRole(e.target.value as "admin" | "inspector" | "order")}
                >
                  <option value="admin">admin</option>
                  <option value="inspector">inspector</option>
                  <option value="order">order</option>
                </select>
              </div>
              <Button type="button" disabled={busy || !email.trim()} onClick={() => void invite()}>
                {busy ? tCommon("loading") : t("staffInviteSubmit")}
              </Button>
            </section>
          ) : null}
          {data ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">{t("staffName")}</th>
                    <th className="py-2 pr-3 font-medium">{t("staffEmail")}</th>
                    <th className="py-2 pr-3 font-medium">{t("staffRole")}</th>
                    <th className="py-2 font-medium">{t("staffAssigned")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.members.map((m) => (
                    <tr key={m.membershipId} className="border-b border-border/70">
                      <td className="py-2 pr-3">
                        <div className="font-medium">{m.name}</div>
                        <div className="text-xs text-muted-foreground">{m.jobTitle ?? "—"}</div>
                      </td>
                      <td className="py-2 pr-3 text-xs">{m.email}</td>
                      <td className="py-2 pr-3 text-xs">{m.appRole}</td>
                      <td className="py-2 text-xs">
                        {m.assignedTenantIds.length} / {data.clinics.filter((c) => c.live).length} {t("staffLiveClinics")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.members.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">{t("staffEmpty")}</p>
              ) : null}
            </div>
          ) : null}
          <p className="mt-4 text-xs text-muted-foreground">{t("staffNote")}</p>
        </ListPageShell>
      </main>
    </div>
  );
}
