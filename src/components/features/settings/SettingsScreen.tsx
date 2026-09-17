"use client";

import { roleLabel } from "@/constants/roles";
import { useSessionStore } from "@/store/sessionStore";
import { Spinner } from "@/components/ui/Loading";
import { oxidStatusLabel, useOxidSettings } from "@/components/hooks/settings/useOxidSettings";

export function SettingsScreen() {
  const user = useSessionStore((s) => s.user);
  const { status, busy, connect, disconnect } = useOxidSettings();

  return (
    <div className="p-work" data-testid="settings-page">
      <main className="p-main">
        <div className="p-settings" data-testid="settings-screen">
          <section className="p-devhead p-settings__head">
            <h2>Settings</h2>
            <div className="codes">
              <span>{user?.name}</span>
              <span>{roleLabel(user?.role)}</span>
            </div>
          </section>

          <div className="p-settings__body">
            <section className="p-settings__panel">
              <p className="p-sec-title">OXID shop connection</p>
              <p className="p-settings__intro">
                One OXID link per clinic. Used for catalog lookup and later for service dispatch / spare parts. Only a
                Superadmin can connect or disconnect.
              </p>

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
                          <dt>Shop</dt>
                          <dd>{status.companyName}</dd>
                        </div>
                      )}
                      {status.customerNumber && (
                        <div className="p-ext-row">
                          <dt>Customer</dt>
                          <dd>KD {status.customerNumber}</dd>
                        </div>
                      )}
                      {status.shopBaseUrl && (
                        <div className="p-ext-row">
                          <dt>URL</dt>
                          <dd className="p-settings__url">{status.shopBaseUrl}</dd>
                        </div>
                      )}
                      {status.connectedAt && (
                        <div className="p-ext-row">
                          <dt>Linked</dt>
                          <dd>{new Date(status.connectedAt).toLocaleString("de-DE")}</dd>
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
                      Server OXID env is not configured (OXID_CLIENT_ID / AUTHORIZE_URL / TOKEN_URL).
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
                          {busy ? <Spinner /> : "Connect OXID shop"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="p-cta ghost"
                          disabled={busy}
                          onClick={() => void disconnect()}
                          data-testid="oxid-disconnect"
                        >
                          {busy ? <Spinner /> : "Disconnect OXID"}
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="p-settings__hint">Ask a Superadmin to link OXID in Settings.</p>
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
