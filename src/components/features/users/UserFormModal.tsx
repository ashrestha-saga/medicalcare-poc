"use client";

import { Loader2 } from "lucide-react";
import { CRITICAL_PERMISSIONS, PERMISSION_GROUPS } from "@/constants/permissions";
import { ROLES } from "@/constants/roles";
import type { PermissionSlug } from "@/interfaces/permissions";
import type { UserRole } from "@/interfaces/session";
import type { useUserForm } from "@/components/hooks/users/useUserForm";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AuditTimeline } from "@/components/features/audit/AuditTimeline";
import { useResourceAudit } from "@/components/hooks/audit/useResourceAudit";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type FormApi = ReturnType<typeof useUserForm>;

function presetCount(form: FormApi, role: UserRole): number {
  return form.roleCatalog.find((c) => c.value === role)?.permissions.length ?? 0;
}

/** Edit-user dialog (create/invite is `/users/new`). */
export function UserFormModal({ form }: { form: FormApi }) {
  const audit = useResourceAudit("user", form.editing?.id ?? null);
  const preset = form.roleCatalog.find((c) => c.value === form.role)?.permissions ?? [];

  return (
    <Dialog
      open={form.open && form.mode === "edit"}
      onOpenChange={(open) => {
        if (!open && !form.busy) form.close();
      }}
    >
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-3xl"
        data-testid="user-form-dialog"
      >
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>Update name, role, permissions, or account status.</DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            void form.submit();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="user-email">Email</Label>
              <Input
                id="user-email"
                type="email"
                value={form.email}
                disabled
                data-testid="user-email"
                autoComplete="off"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="user-name" required>
                Full name
              </Label>
              <Input
                id="user-name"
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
          </div>

          <div className="grid max-w-xs gap-2">
            <Label htmlFor="user-active">Status</Label>
            <Select
              value={form.active ? "active" : "inactive"}
              onValueChange={(value) => form.setActive(value === "active")}
              disabled={form.busy}
            >
              <SelectTrigger id="user-active" data-testid="user-active">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label required>Role</Label>
            <p className="text-xs text-muted-foreground">
              Changing the role resets permissions to the new preset.
            </p>
            <div className="grid gap-2 sm:grid-cols-2" data-testid="user-role-cards">
              {ROLES.map((r) => {
                const selected = form.role === r.value;
                const count = presetCount(form, r.value);
                return (
                  <button
                    key={r.value}
                    type="button"
                    aria-pressed={selected}
                    disabled={form.busy}
                    onClick={() => form.selectRole(r.value)}
                    className={cn(
                      "rounded-lg border border-border bg-muted/40 p-3.5 text-left transition-colors",
                      "hover:border-[var(--accent)]",
                      selected && "border-[var(--accent)] bg-[rgba(30,127,224,0.08)]",
                    )}
                    data-testid={`user-role-${r.value}`}
                  >
                    <span className="block text-sm font-semibold text-foreground">{r.label}</span>
                    <code className="mt-0.5 block font-mono text-[11px] text-muted-foreground">
                      {r.value}
                    </code>
                    <span className="mt-1.5 block text-xs leading-snug text-muted-foreground">
                      {r.description}
                    </span>
                    <span className="mt-2 inline-block font-mono text-[11px] text-[var(--accent)]">
                      {count} permissions
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground">Permissions</p>
                <p className="text-xs text-muted-foreground">
                  {form.deviationCount === 0
                    ? "Unchanged from the preset."
                    : `${form.deviationCount} deviation${form.deviationCount === 1 ? "" : "s"} from the preset.`}
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
                <div key={group.label} className="border-t border-border pt-3 first:border-t-0 first:pt-0">
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
                          className="inline-flex w-[min(340px,100%)] cursor-pointer items-start gap-2 text-[13px]"
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
                                critical && "text-[var(--warn)]",
                                checked && !inPreset && "text-[var(--ok,#1d7a4f)]",
                                !checked && inPreset && "text-destructive line-through",
                              )}
                            >
                              {item.slug}
                            </code>
                            <em className="mt-0.5 block text-[11.5px] not-italic text-muted-foreground">
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

          {audit.canView ? (
            <div className="border-t border-border pt-3" data-testid="user-audit">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Activity
              </p>
              <AuditTimeline events={audit.events} loading={audit.loading} />
            </div>
          ) : null}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" disabled={form.busy} onClick={form.close}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.busy} data-testid="user-form-submit">
              {form.busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
