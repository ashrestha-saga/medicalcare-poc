"use client";

import { useLocale, useTranslations } from "next-intl";
import { Spinner } from "@/components/ui/Loading";
import { shopStatusLabel, useShopSettings } from "@/components/hooks/settings/useShopSettings";
import { formatDateTime } from "@/lib/format";
import type { AppLocale } from "@/lib/locale";
import { usePermissions } from "@/lib/providers/PermissionProvider";

export function ShopSettingsPanel() {
  const t = useTranslations("settings");
  const locale = useLocale() as AppLocale;
  const { checkPermission } = usePermissions();
  const canManagePerm = checkPermission("settings:oxid");
  const { status, busy, form, patchForm, saveConfig, connect, disconnect } = useShopSettings();

  if (!canManagePerm && !status) {
    return null;
  }

  return (
    <section className="p-settings__panel" data-testid="shop-settings-panel">
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
            {shopStatusLabel(status.status)}
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
              {status.hasSubUsers && (
                <div className="p-ext-row">
                  <dt>{t("shopSubUsers")}</dt>
                  <dd>{t("shopSubUsersYes")}</dd>
                </div>
              )}
            </dl>
          )}

          {status.lastError && (
            <div className="p-lead p-settings__alert" data-s="manual">
              {status.lastError}
            </div>
          )}

          {status.canManage ? (
            <>
              <div className="p-settings__form" style={{ display: "grid", gap: 10, marginTop: 12 }}>
                <div className="p-field">
                  <label htmlFor="shop-base-url">{t("shopBaseUrl")}</label>
                  <input
                    id="shop-base-url"
                    value={form.shopBaseUrl}
                    onChange={(e) => patchForm({ shopBaseUrl: e.target.value })}
                    placeholder="https://shop.example.com"
                    data-testid="shop-base-url"
                  />
                </div>
                <div className="p-field">
                  <label htmlFor="shop-client-id">{t("shopClientId")}</label>
                  <input
                    id="shop-client-id"
                    value={form.clientId}
                    onChange={(e) => patchForm({ clientId: e.target.value })}
                    data-testid="shop-client-id"
                  />
                </div>
                <div className="p-field">
                  <label htmlFor="shop-client-secret">{t("shopClientSecret")}</label>
                  <input
                    id="shop-client-secret"
                    type="password"
                    autoComplete="new-password"
                    value={form.clientSecret}
                    onChange={(e) => patchForm({ clientSecret: e.target.value })}
                    placeholder={status.hasClientSecret ? t("shopClientSecretKeep") : undefined}
                    data-testid="shop-client-secret"
                  />
                </div>
                <div className="p-field">
                  <label htmlFor="shop-scope">{t("shopScope")}</label>
                  <input
                    id="shop-scope"
                    value={form.scope}
                    onChange={(e) => patchForm({ scope: e.target.value })}
                    data-testid="shop-scope"
                  />
                </div>
              </div>

              <div className="p-settings__actions" style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="p-cta ghost"
                  disabled={busy || !form.shopBaseUrl.trim() || !form.clientId.trim()}
                  onClick={() => void saveConfig()}
                  data-testid="shop-save-config"
                >
                  {busy ? <Spinner /> : t("shopSave")}
                </button>
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
            </>
          ) : (
            <p className="p-settings__hint">{t("askSuperadmin")}</p>
          )}
        </>
      )}
    </section>
  );
}
