"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSessionStore } from "@/store/sessionStore";
import { Spinner } from "@/components/ui/Loading";
import { oxidStatusLabel, useOxidSettings } from "@/components/hooks/settings/useOxidSettings";
import { formatDateTime } from "@/lib/format";
import type { AppLocale } from "@/lib/locale";
import { LanguagePanel } from "./LanguagePanel";
import { ThemeAppearancePanel } from "./ThemeAppearancePanel";

export function SettingsScreen() {
  const t = useTranslations("settings");
  const tRoles = useTranslations("roles");
  const locale = useLocale() as AppLocale;
  const user = useSessionStore((s) => s.user);
  const { status, busy, connect, disconnect } = useOxidSettings();
  const roleKey = user?.role;
  const roleText = roleKey ? tRoles(roleKey) : "—";

  return (
    <div className="p-work" data-testid="settings-page">
      <main className="p-main">
        <div className="p-settings" data-testid="settings-screen">
          <section className="p-devhead p-settings__head">
            <h2>{t("title")}</h2>
            <div className="codes">
              <span>{user?.name}</span>
              <span>{roleText}</span>
            </div>
          </section>

          <div className="p-settings__body">
            <LanguagePanel />
            <ThemeAppearancePanel />

            <section className="p-settings__panel">
              <p className="p-sec-title">{t("oxidTitle")}</p>
              <p className="p-settings__intro">{t("oxidIntro")}</p>

              {!status ? (
                <div className="p-wait p-settings__loading">
                  <Spinner />
                </div>
              ) : (
                <>
                  <div
                    className="p-src p-settings__status"
                    data-s={
                      status.status === "connected" ? "catalog" : status.status === "error" ? "manual" : "beudamed"
                    }
                    data-testid="oxid-connection-status"
                  >
                    {oxidStatusLabel(status.status)}
                  </div>

                  {(status.companyName || status.customerNumber || status.connectedAt || status.shopBaseUrl) && (
                    <dl className="p-ext-dl p-settings__meta">
                      {status.companyName && (
                        <div className="p-ext-row">
                          <dt>{t("shop")}</dt>
                          <dd>{status.companyName}</dd>
                        </div>
                      )}
                      {status.customerNumber && (
                        <div className="p-ext-row">
                          <dt>{t("customer")}</dt>
                          <dd>KD {status.customerNumber}</dd>
                        </div>
                      )}
                      {status.shopBaseUrl && (
                        <div className="p-ext-row">
                          <dt>{t("url")}</dt>
                          <dd className="p-settings__url">{status.shopBaseUrl}</dd>
                        </div>
                      )}
                      {status.connectedAt && (
                        <div className="p-ext-row">
                          <dt>{t("linked")}</dt>
                          <dd>{formatDateTime(status.connectedAt, locale)}</dd>
                        </div>
                      )}
                    </dl>
                  )}

                  {status.lastError && (
                    <div className="p-lead p-settings__alert" data-s="manual">
                      {status.lastError}
                    </div>
                  )}

                  {!status.configured && (
                    <div className="p-lead p-settings__alert" data-s="manual">
                      {t("oxidEnvMissing")}
                    </div>
                  )}

                  {status.canManage ? (
                    <div className="p-settings__actions">
                      {status.status !== "connected" ? (
                        <button
                          type="button"
                          className="p-cta"
                          disabled={busy || !status.configured}
                          onClick={() => void connect()}
                          data-testid="oxid-connect"
                        >
                          {busy ? <Spinner /> : t("connect")}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="p-cta ghost"
                          disabled={busy}
                          onClick={() => void disconnect()}
                          data-testid="oxid-disconnect"
                        >
                          {busy ? <Spinner /> : t("disconnect")}
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="p-settings__hint">{t("askSuperadmin")}</p>
                  )}
                </>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
