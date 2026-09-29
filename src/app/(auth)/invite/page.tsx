"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loading } from "@/components/ui/Loading";
import { ApiError, api } from "@/lib/http/apiClient";

function InviteRedeemForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [name, setName] = useState("");
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
      const result = await api<{ ok: true; accountKind: string }>("/api/auth/invite/redeem", {
        method: "POST",
        body: JSON.stringify({
          token,
          password,
          confirmPassword,
          name: name.trim() || null,
        }),
      });
      setDone({ accountKind: result.accountKind });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not accept invitation.");
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
        <h1 className="text-2xl font-semibold">Invalid invitation</h1>
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
        <h1 className="text-2xl font-semibold">Account ready</h1>
        <p className="text-sm text-muted-foreground">Your password is set. You can sign in now.</p>
        <Button asChild>
          <Link href={loginHref}>Sign in</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Accept invitation</h1>
      <p className="text-sm text-muted-foreground">Choose a password to activate your account.</p>
      <form className="grid gap-4" onSubmit={(e) => void submit(e)}>
        <div className="grid gap-1.5">
          <Label htmlFor="invite-name">Name (optional)</Label>
          <Input id="invite-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="invite-password" required>
            Password
          </Label>
          <Input
            id="invite-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="invite-confirm" required>
            Confirm password
          </Label>
          <Input
            id="invite-confirm"
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
          {busy ? "Saving…" : "Activate account"}
        </Button>
      </form>
    </main>
  );
}

/** /invite — redeem UserInvitation token and set password. */
export default function InvitePage() {
  return (
    <Suspense fallback={<Loading label="Loading…" />}>
      <InviteRedeemForm />
    </Suspense>
  );
}
