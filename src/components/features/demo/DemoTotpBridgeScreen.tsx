"use client";

/**
 * DEMO_SHARED_TOTP — secret setup UI for the shared authenticator.
 * Removal: docs/DEMO_SHARED_TOTP.md
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/http/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/Loading";

type RosterRow = {
  email: string;
  name: string;
  accountKind: "clinic" | "partner";
  tenantName: string | null;
  tenantCode: string | null;
  mode: "shared" | "personal";
};

type BridgePayload = {
  enabled: boolean;
  issuer: string;
  otpauthUrl: string;
  qrDataUrl: string;
  secret: string;
  roster: RosterRow[];
  sharedCount: number;
  personalCount: number;
  clinicCount: number;
  partnerCount: number;
  path: string;
};

export function DemoTotpBridgeScreen() {
  const [pass, setPass] = useState("");
  const [passInput, setPassInput] = useState("");
  const [data, setData] = useState<BridgePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsPass, setNeedsPass] = useState(false);

  const load = useCallback(async (bridgePass: string) => {
    setLoading(true);
    setError(null);
    try {
      const q = bridgePass ? `?pass=${encodeURIComponent(bridgePass)}` : "";
      const res = await api<BridgePayload>(`/api/demo/totp-bridge${q}`);
      setData(res);
      setNeedsPass(false);
      setPass(bridgePass);
    } catch (e) {
      setData(null);
      if (e instanceof ApiError && e.status === 404) {
        setError(
          "Demo shared TOTP is off. Set DEMO_SHARED_TOTP_ENABLED=true and DEMO_SHARED_TOTP_SECRET on this host, then restart.",
        );
        setNeedsPass(false);
      } else if (e instanceof ApiError && e.status === 403) {
        setNeedsPass(true);
        setError("Passphrase required (DEMO_BRIDGE_PASS).");
      } else {
        setError(e instanceof ApiError ? e.message : "Could not load bridge.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const fromQuery =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("pass") ?? ""
        : "";
    void load(fromQuery);
  }, [load]);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      className="mx-auto flex h-dvh max-w-2xl flex-col overflow-hidden px-4 py-6"
      data-testid="demo-totp-bridge-page"
    >
      <header className="shrink-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Demo showcase · DEMO_SHARED_TOTP
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Shared authenticator bridge</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          One Authenticator entry unlocks clinic and partner users who have not enabled personal 2FA.
          Clinic users who enroll on <code className="text-xs">/security</code> use only their own
          secret afterward. Same code works on <code className="text-xs">/login</code> and{" "}
          <code className="text-xs">/login/partner</code>.
        </p>
      </header>

      {needsPass ? (
        <form
          className="mt-4 flex shrink-0 flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void load(passInput.trim());
          }}
        >
          <div className="min-w-[12rem] flex-1">
            <Label htmlFor="bridge-pass">Bridge passphrase</Label>
            <Input
              id="bridge-pass"
              type="password"
              className="mt-1"
              value={passInput}
              onChange={(e) => setPassInput(e.target.value)}
              autoComplete="off"
            />
          </div>
          <Button type="submit">Unlock</Button>
        </form>
      ) : null}

      {loading ? (
        <div className="mt-10 flex flex-1 items-center justify-center">
          <Spinner />
        </div>
      ) : error && !data ? (
        <p className="mt-6 shrink-0 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : data ? (
        <div className="mt-6 flex min-h-0 flex-1 flex-col gap-5">
          <section className="shrink-0 rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold">Scan once</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Issuer: {data.issuer}. Add this to your phone Authenticator before the demo.
            </p>
            <div className="mt-4 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={data.qrDataUrl}
                alt="Shared TOTP QR code"
                className="rounded-md border border-border bg-white p-2"
                width={200}
                height={200}
              />
              <div className="space-y-2 text-sm">
                <Button type="button" variant="outline" size="sm" onClick={() => void copy(data.secret)}>
                  Copy secret
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="ml-0 sm:ml-2"
                  onClick={() => void copy(data.otpauthUrl)}
                >
                  Copy otpauth URL
                </Button>
                <p className="break-all font-mono text-[11px] text-muted-foreground">{data.secret}</p>
              </div>
            </div>
          </section>

          <section className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold">Users</h2>
              <p className="text-xs text-muted-foreground">
                Clinic: {data.clinicCount} · Partner: {data.partnerCount} · Shared: {data.sharedCount}{" "}
                · Personal: {data.personalCount}
              </p>
            </div>
            <ul className="mt-3 min-h-0 flex-1 divide-y divide-border overflow-y-auto overscroll-contain rounded-lg border border-border">
              {data.roster.map((row) => (
                <li
                  key={`${row.accountKind}:${row.email}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {row.name}
                      <span className="ml-2 text-[11px] font-normal uppercase tracking-wide text-muted-foreground">
                        {row.accountKind}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.email}
                      {row.tenantName ? ` · ${row.tenantName}` : ""}
                    </p>
                  </div>
                  <span
                    className={
                      row.mode === "shared"
                        ? "rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900"
                        : "rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800"
                    }
                  >
                    {row.mode === "shared" ? "Shared bridge" : "Personal 2FA"}
                  </span>
                </li>
              ))}
            </ul>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2 shrink-0 self-start"
              onClick={() => void load(pass)}
            >
              Refresh roster
            </Button>
          </section>

          <p className="shrink-0 text-xs text-muted-foreground">
            Removal checklist: <code>docs/DEMO_SHARED_TOTP.md</code>. Not linked from app navigation.
          </p>
        </div>
      ) : null}

      <p className="mt-4 shrink-0 text-sm">
        <Link href="/login" className="underline underline-offset-2">
          ← Clinic sign-in
        </Link>
        {" · "}
        <Link href="/login/partner" className="underline underline-offset-2">
          Partner sign-in
        </Link>
      </p>
    </div>
  );
}
