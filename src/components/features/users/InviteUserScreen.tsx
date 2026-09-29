"use client";

import { Check, Copy, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CRITICAL_PERMISSIONS, PERMISSION_GROUPS } from "@/constants/permissions";
import { ROLES, roleLabel } from "@/constants/roles";
import type { PermissionSlug } from "@/interfaces/permissions";
import type { UserRole } from "@/interfaces/session";
import { useInviteUserForm } from "@/components/hooks/users/useInviteUserForm";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function RoleCards({
  selected,
  counts,
  busy,
  onSelect,
}: {
  selected: UserRole | null;
  counts: Record<string, number>;
  busy: boolean;
  onSelect: (role: UserRole) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2" data-testid="user-role-cards">
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

export function InviteUserScreen() {
  const { checkPermission } = usePermissions();
  const canCreate = checkPermission("users:create");
  const form = useInviteUserForm();
  const [copied, setCopied] = useState(false);

  const counts = Object.fromEntries(
    form.roleCatalog.map((c) => [c.value, c.permissions.length]),
  ) as Record<string, number>;

  const preset = form.role ? form.presetFor(form.role) : [];

  if (!canCreate) {
    return (
      <div className="p-work" data-testid="invite-user-denied">
        <main className="p-main">
          <ListPageShell title="Create user" description="You don't have permission to invite users.">
            <Link
              href="/users"
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              ← To the user list
            </Link>
          </ListPageShell>
        </main>
      </div>
    );
  }

  return (
    <div className="p-work" data-testid="invite-user-page">
      <main className="p-main">
        <ListPageShell
          title="Create user"
          description="Choose a role, add the details, invite. The password is set by the person."
        >
          <p className="mb-4">
            <Link
              href="/users"
              className="text-sm text-primary underline-offset-4 hover:underline"
              data-testid="invite-back"
            >
              ← To the user list
            </Link>
          </p>

          <form
            className="grid gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (form.canSubmit) void form.submit();
            }}
          >
            <div className="grid gap-2">
              <Label required>Role</Label>
              <p className="text-xs text-muted-foreground">
                The role sets the permissions in one step. You can adjust them for this person
                after selecting.
              </p>
              <RoleCards
                selected={form.role}
                counts={counts}
                busy={form.busy}
                onSelect={form.selectRole}
              />
              {form.fieldErrors.role && (
                <p className="text-xs text-destructive">{form.fieldErrors.role}</p>
              )}
            </div>

            {form.roleSelected && form.role && (
              <>
                <div className="grid gap-4 sm:grid-cols-2" data-testid="invite-person-section">
                  <div className="grid gap-2">
                    <Label htmlFor="invite-name" required>
                      Full name
                    </Label>
                    <Input
                      id="invite-name"
                      value={form.name}
                      onChange={(e) => form.setName(e.target.value)}
                      disabled={form.busy}
                      data-testid="user-name"
                      autoComplete="name"
                    />
                    {form.fieldErrors.name && (
                      <p className="text-xs text-destructive">{form.fieldErrors.name}</p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="invite-email" required>
                      Work email
                    </Label>
                    <Input
                      id="invite-email"
                      type="email"
                      value={form.email}
                      onChange={(e) => form.setEmail(e.target.value)}
                      disabled={form.busy}
                      placeholder="vorname.name@clinic.example"
                      data-testid="user-email"
                      autoComplete="off"
                    />
                    {form.fieldErrors.email && (
                      <p className="text-xs text-destructive">{form.fieldErrors.email}</p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground sm:col-span-2">
                    The invitation goes to this address. Use a work address — access to evidence
                    records should end when the person leaves.
                  </p>
                </div>

                <div
                  className="rounded-lg border border-border bg-muted/30 p-4"
                  data-testid="invite-permissions-section"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Permissions</p>
                      <p className="text-xs text-muted-foreground">
                        Preset from <strong>{roleLabel(form.role)}</strong>. Changes apply only to
                        this individual.
                      </p>
                    </div>
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
                                  disabled={form.busy}
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

                  <p className="mt-3 text-xs text-muted-foreground">
                    {form.deviationCount === 0
                      ? "Unchanged from the preset."
                      : `${form.deviationCount} deviation${form.deviationCount === 1 ? "" : "s"} from the preset.`}
                  </p>
                </div>
              </>
            )}

            {form.lastInviteResult && (
              <div
                className="rounded-lg border border-dashed border-border bg-muted/30 p-4"
                data-testid="user-invite-result"
              >
                <p className="text-sm text-muted-foreground">
                  {form.lastInviteResult.emailSimulated
                    ? "Email simulated (SMTP not configured or SMTP_DISABLE=true)"
                    : "Invitation email sent"}
                </p>
                {form.lastInviteResult.emailSimulated && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <code className="break-all rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs">
                      {form.lastInviteResult.redeemUrl}
                    </code>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(form.lastInviteResult!.redeemUrl);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        } catch {
                          /* ignore */
                        }
                      }}
                      data-testid="user-copy-redeem"
                    >
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? "Copied" : "Copy link"}
                    </Button>
                  </div>
                )}
                <div className="mt-4">
                  <Button type="button" onClick={form.done} data-testid="invite-done">
                    Done
                  </Button>
                </div>
              </div>
            )}

            {!form.lastInviteResult && (
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" disabled={form.busy} asChild>
                  <Link href="/users">Cancel</Link>
                </Button>
                <Button type="submit" disabled={!form.canSubmit} data-testid="user-form-submit">
                  {form.busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create and invite
                </Button>
              </div>
            )}
          </form>
        </ListPageShell>
      </main>
    </div>
  );
}
