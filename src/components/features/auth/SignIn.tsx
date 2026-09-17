"use client";

import type { SignInProps } from "@/interfaces";
import { Spinner } from "@/components/ui/Loading";
import { RequiredMark } from "@/components/ui/RequiredMark";
import { useSignIn } from "@/components/hooks/auth/useSignIn";

/** Clinic email/password sign-in (OXID is linked later in Settings by superadmin). */
export function SignIn({ notice }: SignInProps) {
  const {
    email,
    setEmail,
    password,
    setPassword,
    code,
    setCode,
    needs2fa,
    busy,
    fieldErrors,
    submitPassword,
    submitTotp,
    backToPassword,
  } = useSignIn();

  return (
    <div className="p-stage">
      <div className="p-auth">
        <div className="p-auth-card">
          <div style={{ marginBottom: 28 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: "var(--accent)",
                display: "grid",
                placeItems: "center",
                fontWeight: 700,
                marginBottom: 14,
              }}
            >
              DC
            </div>
            <h1 className="t-display">DeviceCare</h1>
            <p style={{ marginTop: 6, fontSize: 12.5, color: "var(--on-dark-soft)", lineHeight: 1.55 }}>
              {needs2fa
                ? "Enter the code from your authenticator app."
                : "Scan a device, identify it, raise a request."}
            </p>
          </div>

          {notice && !needs2fa && (
            <p className="p-lead" data-s="manual" style={{ margin: "0 0 16px" }}>
              {notice}
            </p>
          )}

          {needs2fa ? (
            <form onSubmit={(e) => void submitTotp(e)} data-testid="totp-form">
              <div className="p-field">
                <label htmlFor="login-totp">
                  Authentication code <RequiredMark />
                </label>
                <input
                  id="login-totp"
                  className="t-mono"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456 or backup code"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  autoFocus
                  data-testid="login-totp"
                />
                {fieldErrors.code && <p className="p-err">{fieldErrors.code}</p>}
              </div>
              <button type="submit" className="p-cta" style={{ marginTop: 18 }} disabled={busy} data-testid="totp-submit">
                {busy ? <Spinner /> : "Verify"}
              </button>
              <button
                type="button"
                className="p-cta ghost"
                style={{ marginTop: 10 }}
                disabled={busy}
                onClick={backToPassword}
                data-testid="totp-back"
              >
                Back
              </button>
            </form>
          ) : (
            <form onSubmit={(e) => void submitPassword(e)} data-testid="login-form">
              <div className="p-field">
                <label htmlFor="login-email">
                  Email <RequiredMark />
                </label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  aria-required="true"
                  data-testid="login-email"
                />
                {fieldErrors.email && <p className="p-err">{fieldErrors.email}</p>}
              </div>
              <div className="p-field" style={{ marginTop: 12 }}>
                <label htmlFor="login-password">
                  Password <RequiredMark />
                </label>
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  aria-required="true"
                  data-testid="login-password"
                />
                {fieldErrors.password && <p className="p-err">{fieldErrors.password}</p>}
              </div>
              <button type="submit" className="p-cta" style={{ marginTop: 18 }} disabled={busy} data-testid="login-submit">
                {busy ? <Spinner /> : "Sign in"}
              </button>
            </form>
          )}

          {!needs2fa && (
            <p style={{ marginTop: 14, fontSize: 11.5, color: "var(--on-dark-soft)", lineHeight: 1.5 }}>
              Demo: anna@demo.local / demo (device admin) · admin@demo.local / demo (superadmin)
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
