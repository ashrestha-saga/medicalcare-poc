"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loading } from "@/components/ui/Loading";
import { ApiError, api } from "@/lib/http/apiClient";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ accountKind: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ ok: true; accountKind: string }>("/api/auth/reset-password/redeem", {
        method: "POST",
        body: JSON.stringify({ token, password, confirmPassword }),
      });
      setDone({ accountKind: result.accountKind });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reset password.");
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
        <h1 className="text-2xl font-semibold">Invalid reset link</h1>
        <p className="text-sm text-muted-foreground">This link is missing a token.</p>
        <Link href="/login" className="text-sm text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
      </main>
    );
  }

  if (done) {
    const loginHref = done.accountKind === "partner" ? "/login/partner" : "/login";
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
        <h1 className="text-2xl font-semibold">Password updated</h1>
        <p className="text-sm text-muted-foreground">You can sign in with your new password.</p>
        <Button asChild>
          <Link href={loginHref}>Sign in</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Reset password</h1>
      <p className="text-sm text-muted-foreground">Choose a new password for your account.</p>
      <form className="grid gap-4" onSubmit={(e) => void submit(e)}>
        <div className="grid gap-1.5">
          <Label htmlFor="reset-password" required>
            New password
          </Label>
          <Input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="reset-confirm" required>
            Confirm password
          </Label>
          <Input
            id="reset-confirm"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Update password"}
        </Button>
      </form>
    </main>
  );
}

/** /reset-password — redeem PasswordResetToken and set a new password. */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<Loading label="Loading…" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
