"use client";

import { Check, Copy, Loader2 } from "lucide-react";
import Link from "next/link";
import { use, useState } from "react";
import { CRITICAL_PERMISSIONS, PERMISSION_GROUPS } from "@/constants/permissions";
import { ROLES, roleLabel } from "@/constants/roles";
import type { PermissionSlug } from "@/interfaces/permissions";
import type { UserRole } from "@/interfaces/session";
import { useEditUserForm } from "@/components/hooks/users/useEditUserForm";
import { useResourceAudit } from "@/components/hooks/audit/useResourceAudit";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { useSessionStore } from "@/store/sessionStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/Loading";
import { cn } from "@/lib/utils";

function RoleCards({
  selected,
  counts,
  busy,
  onSelect,
}: {
  selected: UserRole;
  counts: Record<string, number>;
  busy: boolean;
  onSelect: (role: UserRole) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" data-testid="user-role-cards">
      {ROLES.map((r) => {
        const isSelected = selected === r.value;
        return (
          <button
            key={r.value}
            type="button"
            aria-pressed={isSelected}
            disabled={busy}
            onClick={() => onSelect(r.value)}
            className={cn(
              "rounded-lg border border-border bg-muted/40 p-3.5 text-left transition-colors",
              "hover:border-primary",
              isSelected && "border-primary bg-primary/10",
            )}
            data-testid={`user-role-${r.value}`}
          >
            <span className="block text-sm font-semibold text-foreground">{r.label}</span>
            <code className="mt-0.5 block font-mono text-[11px] text-muted-foreground">{r.value}</code>
            <span className="mt-1.5 block text-xs leading-snug text-muted-foreground">
              {r.description}
            </span>
            <span className="mt-2 inline-block font-mono text-[11px] text-primary">
              {counts[r.value] ?? 0} permissions
            </span>
          </button>
        );
      })}
    </div>
  );
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function AccessPanel({
  isInvited,
  active,
  busy,
  isSelf,
  canResetPassword,
  canDelete,
  canCreate,
  onResetPassword,
  onLock,
  onUnlock,
  onResend,
  onWithdraw,
}: {
  isInvited: boolean;
  active: boolean;
  busy: boolean;
  isSelf: boolean;
  canResetPassword: boolean;
  canDelete: boolean;
  canCreate: boolean;
  onResetPassword: () => void;
  onLock: () => void;
  onUnlock: () => void;
  onResend: () => void;
  onWithdraw: () => void;
}) {
  return (
    <section className="rounded-lg border border-border bg-muted/30 p-4" data-testid="user-access-panel">
      <p className="text-sm font-semibold text-foreground">Access</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {isInvited ? (
          <>
            {canCreate && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={onResend}
                data-testid="user-resend-invite"
              >
                Send the invitation again
              </Button>
            )}
            {canDelete && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                className="text-destructive hover:text-destructive"
                onClick={onWithdraw}
                data-testid="user-withdraw-invite"
              >
                Withdraw the invitation
              </Button>
            )}
            {canDelete && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                className="text-destructive hover:text-destructive"
                onClick={onWithdraw}
                data-testid="user-lock-invite"
              >
                Lock
              </Button>
            )}
          </>
        ) : (
          <>
            {canResetPassword && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={onResetPassword}
                data-testid="user-trigger-reset"
              >
                Trigger a password reset
              </Button>
            )}
            {active ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy || isSelf}
                className="text-destructive hover:text-destructive"
                onClick={onLock}
                data-testid="user-lock"
              >
                Lock
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={onUnlock}
                data-testid="user-unlock"
              >
                Unlock
              </Button>
            )}
          </>
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {isInvited
          ? "A reset sends a link — it neither shows nor sets a password. Not even the superadmin ever sees one."
          : "A reset confirms your password, then sets a new one for this person. Locking yourself is not possible."}
      </p>
    </section>
  );
}

function HistoryPanel({
  resourceId,
}: {
  resourceId: string | null;
}) {
  const audit = useResourceAudit("user", resourceId);

  return (
    <section className="rounded-lg border border-border bg-muted/30 p-4" data-testid="user-history-panel">
      <p className="text-sm font-semibold text-foreground">History</p>
      {!audit.canView ? (
        <p className="mt-3 text-xs text-muted-foreground">You need audit:view to see history.</p>
      ) : audit.loading ? (
        <div className="mt-3 flex justify-center py-2">
          <Spinner />
        </div>
      ) : audit.events.length === 0 ? (
        <p className="mt-3 font-mono text-xs text-muted-foreground">No history yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {audit.events.map((e) => (
            <li key={e.id} className="py-2 font-mono text-xs text-muted-foreground first:pt-0 last:pb-0">
              {formatWhen(e.occurredAt)} {e.summary}
              {e.actorName ? ` durch ${e.actorName}` : ""}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function EditUserScreen({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = use(params);
  const userId = decodeURIComponent(rawId);
  const { checkPermission } = usePermissions();
  const sessionUser = useSessionStore((s) => s.user);
  const form = useEditUserForm(userId);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [copiedReset, setCopiedReset] = useState(false);

  const canUpdate = checkPermission("users:update");
  const canView = checkPermission("users:view");
  const canCreate = checkPermission("users:create");
  const canDelete = checkPermission("users:delete");
  const canResetPassword = checkPermission("users:resetpassword");

  const counts = Object.fromEntries(
    form.roleCatalog.map((c) => [c.value, c.permissions.length]),
  ) as Record<string, number>;
  const preset = form.presetFor(form.role);
  const isSelf = Boolean(form.user && sessionUser && form.user.id === sessionUser.id);
  const historyId = form.isInvited
    ? (form.user?.invitationId ?? null)
    : (form.user?.id ?? null);

  if (!canView) {
    return (
      <div className="p-work" data-testid="edit-user-denied">
        <main className="p-main">
          <ListPageShell title="Edit user" description="You don't have permission to view users.">
            <Link href="/users" className="text-sm text-primary underline-offset-4 hover:underline">
              ← To the user list
            </Link>
          </ListPageShell>
        </main>
      </div>
    );
  }

  if (form.loading) {
    return (
      <div className="p-work" data-testid="edit-user-loading">
        <main className="p-main">
          <ListPageShell title="Edit user">
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          </ListPageShell>
        </main>
      </div>
    );
  }

  if (!form.user) {
    return (
      <div className="p-work" data-testid="edit-user-missing">
        <main className="p-main">
          <ListPageShell title="Edit user" description="This user was not found.">
            <Link href="/users" className="text-sm text-primary underline-offset-4 hover:underline">
              ← To the user list
            </Link>
          </ListPageShell>
        </main>
      </div>
    );
  }

  const readOnlyInvite = form.isInvited;

  return (
    <div className="p-work" data-testid="edit-user-page">
      <main className="p-main">
        <ListPageShell
          title={form.user.name}
          description={
            form.isInvited
              ? `Pending invitation · ${form.user.email}`
              : `${form.user.email} · ${form.active ? "Active" : "Inactive"}`
          }
        >
          <p className="mb-4">
            <Link
              href="/users"
              className="text-sm text-primary underline-offset-4 hover:underline"
              data-testid="edit-back"
            >
              ← To the user list
            </Link>
          </p>

          <form
            className="grid gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (!readOnlyInvite && canUpdate) void form.submit();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="edit-name" required>
                  Full name
                </Label>
                <Input
                  id="edit-name"
                  value={form.name}
                  onChange={(e) => form.setName(e.target.value)}
                  disabled={form.busy || readOnlyInvite || !canUpdate}
                  data-testid="user-name"
                  autoComplete="name"
                />
                {form.fieldErrors.name && (
                  <p className="text-xs text-destructive">{form.fieldErrors.name}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-email">Work email</Label>
                <Input id="edit-email" value={form.user.email} disabled data-testid="user-email" />
              </div>
            </div>

            <div className="grid gap-2">
              <Label required>Role</Label>
              <RoleCards
                selected={form.role}
                counts={counts}
                busy={form.busy || readOnlyInvite || !canUpdate || isSelf}
                onSelect={form.selectRole}
              />
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-4" data-testid="edit-permissions-section">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">Permissions</p>
                  <p className="text-xs text-muted-foreground">
                    Preset from <strong>{roleLabel(form.role)}</strong>. Changes apply only to this
                    individual.
                  </p>
                </div>
                {!readOnlyInvite && canUpdate && !isSelf && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={form.busy || form.deviationCount === 0}
                    onClick={form.resetToPreset}
                    data-testid="user-reset-preset"
                  >
                    Reset to the preset
                  </Button>
                )}
              </div>

              <div className="space-y-4" data-testid="user-permission-matrix">
                {PERMISSION_GROUPS.map((group) => (
                  <div
                    key={group.label}
                    className="border-t border-border pt-3 first:border-t-0 first:pt-0"
                  >
                    <h4 className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                      {group.label}
                      {group.critical ? " · critical" : ""}
                    </h4>
                    <div className="flex flex-wrap gap-x-3 gap-y-2">
                      {group.items.map((item) => {
                        const checked = form.permissions.includes(item.slug);
                        const inPreset = preset.includes(item.slug);
                        const critical = CRITICAL_PERMISSIONS.has(item.slug);
                        return (
                          <label
                            key={item.slug}
                            className="inline-flex w-[min(340px,100%)] cursor-pointer items-start gap-2 text-sm"
                          >
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={checked}
                              disabled={form.busy || readOnlyInvite || !canUpdate || isSelf}
                              onChange={() => form.togglePermission(item.slug as PermissionSlug)}
                              data-testid={`perm-${item.slug}`}
                            />
                            <span>
                              <code
                                className={cn(
                                  "font-mono text-xs text-muted-foreground",
                                  critical && "text-amber-600 dark:text-amber-400",
                                  checked && !inPreset && "text-emerald-700 dark:text-emerald-400",
                                  !checked && inPreset && "text-destructive line-through",
                                )}
                              >
                                {item.slug}
                              </code>
                              <em className="mt-0.5 block text-xs not-italic text-muted-foreground">
                                {item.description}
                              </em>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <AccessPanel
              isInvited={form.isInvited}
              active={form.active}
              busy={form.busy}
              isSelf={isSelf}
              canResetPassword={canResetPassword}
              canDelete={canDelete}
              canCreate={canCreate}
              onResetPassword={() => void form.triggerPasswordReset()}
              onLock={() => void form.lock()}
              onUnlock={() => void form.unlock()}
              onResend={() => void form.resendInvite()}
              onWithdraw={() => void form.withdrawInvite()}
            />

            {form.lastResend?.emailSimulated && (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground">Email simulated — copy the invite link:</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <code className="break-all rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs">
                    {form.lastResend.redeemUrl}
                  </code>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(form.lastResend!.redeemUrl);
                        setCopiedInvite(true);
                        setTimeout(() => setCopiedInvite(false), 2000);
                      } catch {
                        /* ignore */
                      }
                    }}
                  >
                    {copiedInvite ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedInvite ? "Copied" : "Copy link"}
                  </Button>
                </div>
              </div>
            )}

            {form.lastPasswordReset?.emailSimulated && (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground">Email simulated — copy the reset link:</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <code className="break-all rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs">
                    {form.lastPasswordReset.resetUrl}
                  </code>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(form.lastPasswordReset!.resetUrl);
                        setCopiedReset(true);
                        setTimeout(() => setCopiedReset(false), 2000);
                      } catch {
                        /* ignore */
                      }
                    }}
                  >
                    {copiedReset ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedReset ? "Copied" : "Copy link"}
                  </Button>
                </div>
              </div>
            )}

            <HistoryPanel resourceId={historyId} />

            {!readOnlyInvite && canUpdate && (
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" disabled={form.busy} asChild>
                  <Link href="/users">Cancel</Link>
                </Button>
                <Button type="submit" disabled={form.busy} data-testid="user-form-submit">
                  {form.busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save
                </Button>
              </div>
            )}
          </form>
        </ListPageShell>
      </main>
    </div>
  );
}
