"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { PermissionSlug } from "@/interfaces/permissions";
import { api, ApiError } from "@/lib/http/apiClient";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { toast } from "@/store/toastStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/Loading";

type SmtpDto = {
  configured: boolean;
  host: string | null;
  port: number | null;
  secure: boolean;
  user: string | null;
  from: string | null;
  passwordSet: boolean;
  updatedAt: string | null;
  canManage: boolean;
};

type SmtpSettingsPanelProps = {
  /** Default clinic endpoints; partner uses `/api/partner/settings/smtp`. */
  apiBase?: string;
  viewPermission?: PermissionSlug;
  managePermission?: PermissionSlug;
  /** next-intl key under `settings` for the intro paragraph. */
  introKey?: "smtpIntro" | "smtpIntroPartner";
};

export function SmtpSettingsPanel({
  apiBase = "/api/settings/smtp",
  viewPermission = "settings:view",
  managePermission = "settings:smtp",
  introKey = "smtpIntro",
}: SmtpSettingsPanelProps = {}) {
  const t = useTranslations("settings");
  const { checkPermission } = usePermissions();
  const canView = checkPermission(viewPermission);
  const canManagePerm = checkPermission(managePermission);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [smtp, setSmtp] = useState<SmtpDto | null>(null);

  const [host, setHost] = useState("");
  const [port, setPort] = useState("587");
  const [secure, setSecure] = useState(false);
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [from, setFrom] = useState("");

  const canEdit = canManagePerm && Boolean(smtp?.canManage);
  const load = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api<{ smtp: SmtpDto }>(apiBase);
      setSmtp(res.smtp);
      setHost(res.smtp.host ?? "");
      setPort(String(res.smtp.port ?? 587));
      setSecure(Boolean(res.smtp.secure));
      setUser(res.smtp.user ?? "");
      setFrom(res.smtp.from ?? "");
      setPassword("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("smtpLoadFailed"));
      setSmtp(null);
    } finally {
      setLoading(false);
    }
  }, [canView, apiBase, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async () => {
    setBusy(true);
    try {
      const res = await api<{ smtp: SmtpDto }>(apiBase, {
        method: "PUT",
        body: JSON.stringify({
          host,
          port: Number(port),
          secure,
          user,
          from,
          password: password.trim() || null,
        }),
      });
      setSmtp(res.smtp);
      setPassword("");
      toast.success(t("smtpSaved"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("smtpSaveFailed"));
    } finally {
      setBusy(false);
    }
  }, [apiBase, host, port, secure, user, from, password, t]);

  const sendTest = useCallback(async () => {
    setTesting(true);
    try {
      const res = await api<{ result: { simulated: boolean; source: string; to: string } }>(
        `${apiBase}/test`,
        { method: "POST", body: JSON.stringify({}) },
      );
      if (res.result.simulated) {
        toast.warning(t("smtpTestSimulated", { source: res.result.source }));
      } else {
        toast.success(t("smtpTestSent", { to: res.result.to }));
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("smtpTestFailed"));
    } finally {
      setTesting(false);
    }
  }, [apiBase, t]);

  if (!canView) return null;

  return (
    <section className="p-settings__panel" data-testid="smtp-settings-panel">
      <p className="p-sec-title">{t("smtpTitle")}</p>
      <p className="p-settings__intro">{t(introKey)}</p>

      {loading || !smtp ? (
        <div className="p-wait p-settings__loading">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="smtp-host">{t("smtpHost")}</Label>
              <Input
                id="smtp-host"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                disabled={!canEdit || busy}
                data-testid="smtp-host"
                autoComplete="off"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="smtp-port">{t("smtpPort")}</Label>
              <Input
                id="smtp-port"
                type="number"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                disabled={!canEdit || busy}
                data-testid="smtp-port"
              />
            </div>
            <div className="flex items-end gap-2 pb-2">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={secure}
                  onChange={(e) => setSecure(e.target.checked)}
                  disabled={!canEdit || busy}
                  data-testid="smtp-secure"
                />
                {t("smtpSecure")}
              </label>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="smtp-user">{t("smtpUser")}</Label>
              <Input
                id="smtp-user"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                disabled={!canEdit || busy}
                data-testid="smtp-user"
                autoComplete="off"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="smtp-password">{t("smtpPassword")}</Label>
              <Input
                id="smtp-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={!canEdit || busy}
                placeholder={smtp.passwordSet ? t("smtpPasswordKeep") : undefined}
                data-testid="smtp-password"
                autoComplete="new-password"
              />
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="smtp-from">{t("smtpFrom")}</Label>
              <Input
                id="smtp-from"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                disabled={!canEdit || busy}
                data-testid="smtp-from"
                autoComplete="off"
              />
            </div>
          </div>

          {canEdit ? (
            <div className="p-settings__actions mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={busy || testing}
                onClick={() => void save()}
                data-testid="smtp-save"
              >
                {busy ? <Spinner /> : t("smtpSave")}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy || testing || !smtp.configured}
                onClick={() => void sendTest()}
                data-testid="smtp-test"
              >
                {testing ? <Spinner /> : t("smtpTest")}
              </Button>
            </div>
          ) : (
            <p className="p-settings__hint mt-3">{t("smtpAskSuperadmin")}</p>
          )}
        </>
      )}
    </section>
  );
}
