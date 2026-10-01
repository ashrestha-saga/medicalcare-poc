"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
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

export function ExternalInspectorsScreen() {
  const t = useTranslations("console");
  const { checkPermission } = usePermissions();
  const canManage = checkPermission("console:external:manage");
  const [data, setData] = useState<ConsoleStaffListDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [liability, setLiability] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api<ConsoleStaffListDTO>("/api/partner/external-inspectors"));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("externalLoadFailed"));
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
      const res = await api<{ invite: { redeemUrl: string; emailSimulated: boolean } }>(
        "/api/partner/external-inspectors",
        {
          method: "POST",
          body: JSON.stringify({
            email,
            name: name || null,
            commissionedFrom: from,
            commissionedTo: to,
            liabilityUntil: liability,
          }),
        },
      );
      toast.success(
        res.invite.emailSimulated
          ? t("staffInviteSimulated", { url: res.invite.redeemUrl })
          : t("externalInvited"),
      );
      setEmail("");
      setName("");
      await refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("externalInviteFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-work" data-testid="console-external">
      <main className="p-main">
        <ListPageShell title={t("externalTitle")} description={t("externalIntro")}>
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
          {canManage ? (
            <section className="mb-6 grid max-w-xl gap-3 rounded-md border border-border p-4">
              <h2 className="text-sm font-semibold">{t("externalInviteTitle")}</h2>
              <div className="grid gap-1.5">
                <Label>{t("staffEmail")}</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("staffName")}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid gap-1.5 sm:grid-cols-3 sm:gap-3">
                <div>
                  <Label>{t("externalFrom")}</Label>
                  <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div>
                  <Label>{t("externalTo")}</Label>
                  <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
                <div>
                  <Label>{t("externalLiability")}</Label>
                  <Input
                    type="date"
                    value={liability}
                    onChange={(e) => setLiability(e.target.value)}
                  />
                </div>
              </div>
              <Button
                type="button"
                disabled={busy || !email || !from || !to || !liability}
                onClick={() => void invite()}
              >
                {t("externalInviteSubmit")}
              </Button>
            </section>
          ) : null}
          {!loading && data && data.members.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("externalEmpty")}</p>
          ) : null}
          {data && data.members.length > 0 ? (
            <ul className="divide-y divide-border rounded-md border border-border">
              {data.members.map((m) => (
                <li key={m.membershipId} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <Link
                      href={`/partner/external-inspectors/${m.membershipId}`}
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {m.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {m.email} · {m.commissionedFrom} — {m.commissionedTo} · HP {m.liabilityUntil}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </ListPageShell>
      </main>
    </div>
  );
}
