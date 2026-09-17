"use client";

import { useCallback, useEffect, useState } from "react";
import type { TotpSetupConfirmDTO, TotpSetupStartDTO, TotpStatusDTO } from "@/interfaces";
import { api, ApiError } from "@/lib/http/apiClient";
import { RequiredMark } from "@/components/ui/RequiredMark";
import { Spinner } from "@/components/ui/Loading";
import { toast } from "@/store/toastStore";

export function useTotpSecurity() {
  const [status, setStatus] = useState<TotpStatusDTO | null>(null);
  const [setup, setSetup] = useState<TotpSetupStartDTO | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const res = await api<TotpStatusDTO>("/api/auth/2fa/status");
    setStatus(res);
  }, []);

  useEffect(() => {
    void refresh().catch(() => setStatus({ enabled: false, verifiedAt: null }));
  }, [refresh]);

  const startSetup = useCallback(async () => {
    setBusy(true);
    setBackupCodes(null);
    try {
      const res = await api<TotpSetupStartDTO>("/api/auth/2fa/setup", { method: "POST" });
      setSetup(res);
      setCode("");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not start 2FA setup.");
    } finally {
      setBusy(false);
    }
  }, []);

  const cancelSetup = useCallback(async () => {
    setBusy(true);
    try {
      await api("/api/auth/2fa/setup", { method: "DELETE" });
      setSetup(null);
      setCode("");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not cancel setup.");
    } finally {
      setBusy(false);
    }
  }, []);

  const confirmSetup = useCallback(async () => {
    setBusy(true);
    try {
      const res = await api<TotpSetupConfirmDTO>("/api/auth/2fa/setup", {
        method: "PUT",
        body: JSON.stringify({ code: code.trim() }),
      });
      setBackupCodes(res.backupCodes);
      setSetup(null);
      setCode("");
      await refresh();
      toast.success("Two-factor authentication enabled.");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Invalid code.");
    } finally {
      setBusy(false);
    }
  }, [code, refresh]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      await api("/api/auth/2fa/disable", {
        method: "POST",
        body: JSON.stringify({ password, code: code.trim() }),
      });
      setPassword("");
      setCode("");
      setBackupCodes(null);
      await refresh();
      toast.success("Two-factor authentication disabled.");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not disable 2FA.");
    } finally {
      setBusy(false);
    }
  }, [password, code, refresh]);

  return {
    status,
    setup,
    backupCodes,
    clearBackupCodes: () => setBackupCodes(null),
    code,
    setCode,
    password,
    setPassword,
    busy,
    startSetup,
    cancelSetup,
    confirmSetup,
    disable,
  };
}

export function SecurityScreen() {
  const form = useTotpSecurity();

  return (
    <div className="p-work" data-testid="security-page">
      <main className="p-main">
        <div className="p-settings" data-testid="security-screen">
          <section className="p-devhead p-settings__head">
            <h2>Security</h2>
            <div className="codes">
              <span>Two-factor authentication (TOTP)</span>
            </div>
          </section>

          <div className="p-settings__body">
            <section className="p-settings__panel">
              <p className="p-sec-title">Authenticator app</p>
              <p className="p-settings__intro">
                Protect your login with a 6-digit code from an authenticator app (Google Authenticator, Authy,
                1Password, etc.).
              </p>

              {!form.status ? (
                <div className="p-wait p-settings__loading">
                  <Spinner />
                </div>
              ) : form.status.enabled ? (
                <>
                  <div className="p-src p-settings__status" data-s="catalog" data-testid="totp-enabled">
                    Enabled
                    {form.status.verifiedAt
                      ? ` · since ${new Date(form.status.verifiedAt).toLocaleDateString("de-DE")}`
                      : ""}
                  </div>

                  <div className="p-field" style={{ marginTop: 16 }}>
                    <label htmlFor="totp-disable-password">
                      Password <RequiredMark />
                    </label>
                    <input
                      id="totp-disable-password"
                      type="password"
                      value={form.password}
                      onChange={(e) => form.setPassword(e.target.value)}
                      autoComplete="current-password"
                      data-testid="totp-disable-password"
                    />
                  </div>
                  <div className="p-field">
                    <label htmlFor="totp-disable-code">
                      Authenticator or backup code <RequiredMark />
                    </label>
                    <input
                      id="totp-disable-code"
                      className="t-mono"
                      value={form.code}
                      onChange={(e) => form.setCode(e.target.value)}
                      placeholder="123456"
                      autoComplete="one-time-code"
                      data-testid="totp-disable-code"
                    />
                  </div>
                  <button
                    type="button"
                    className="p-cta ghost"
                    disabled={form.busy}
                    onClick={() => void form.disable()}
                    data-testid="totp-disable"
                  >
                    {form.busy ? <Spinner /> : "Disable 2FA"}
                  </button>
                </>
              ) : form.setup ? (
                <>
                  <p className="p-settings__intro">Scan this QR code, then enter the 6-digit code to confirm.</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={form.setup.qrDataUrl}
                    alt="TOTP QR code"
                    width={220}
                    height={220}
                    style={{ borderRadius: 8, background: "#fff", margin: "12px 0" }}
                    data-testid="totp-qr"
                  />
                  <p className="p-settings__hint">
                    Manual secret: <span className="t-mono">{form.setup.secret}</span>
                  </p>
                  <div className="p-field">
                    <label htmlFor="totp-confirm-code">
                      Code <RequiredMark />
                    </label>
                    <input
                      id="totp-confirm-code"
                      className="t-mono"
                      value={form.code}
                      onChange={(e) => form.setCode(e.target.value)}
                      placeholder="123456"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      data-testid="totp-confirm-code"
                    />
                  </div>
                  <div className="p-settings__actions">
                    <button
                      type="button"
                      className="p-cta ghost"
                      disabled={form.busy}
                      onClick={() => void form.cancelSetup()}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="p-cta"
                      disabled={form.busy}
                      onClick={() => void form.confirmSetup()}
                      data-testid="totp-confirm"
                    >
                      {form.busy ? <Spinner /> : "Confirm & enable"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-src p-settings__status" data-s="beudamed" data-testid="totp-disabled">
                    Not enabled
                  </div>
                  <div className="p-settings__actions">
                    <button
                      type="button"
                      className="p-cta"
                      disabled={form.busy}
                      onClick={() => void form.startSetup()}
                      data-testid="totp-start"
                    >
                      {form.busy ? <Spinner /> : "Enable 2FA"}
                    </button>
                  </div>
                </>
              )}

              {form.backupCodes && (
                <div className="p-lead p-settings__alert" data-s="catalog" data-testid="totp-backup-codes" style={{ marginTop: 18 }}>
                  <strong>Save these backup codes now</strong> — they are shown only once.
                  <ul className="t-mono" style={{ margin: "10px 0 0", paddingLeft: 18, lineHeight: 1.7 }}>
                    {form.backupCodes.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="p-cta ghost"
                    style={{ marginTop: 12 }}
                    onClick={form.clearBackupCodes}
                  >
                    I saved them
                  </button>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
