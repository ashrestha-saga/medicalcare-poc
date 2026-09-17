"use client";

import { Loader2 } from "lucide-react";
import { ROLES } from "@/constants/roles";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type FormApi = ReturnType<typeof useUserForm>;

export function UserFormModal({ form }: { form: FormApi }) {
  const isCreate = form.mode === "create";

  return (
    <Dialog
      open={form.open}
      onOpenChange={(open) => {
        if (!open && !form.busy) form.close();
      }}
    >
      <DialogContent className="sm:max-w-md" data-testid="user-form-dialog">
        <DialogHeader>
          <DialogTitle>{isCreate ? "Add user" : "Edit user"}</DialogTitle>
          <DialogDescription>
            {isCreate
              ? "Create a clinic account and assign a role."
              : "Update name, role, or account status."}
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void form.submit();
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="user-email" required={isCreate}>
              Email
            </Label>
            <Input
              id="user-email"
              type="email"
              value={form.email}
              onChange={(e) => form.setEmail(e.target.value)}
              disabled={!isCreate || form.busy}
              data-testid="user-email"
              autoComplete="off"
            />
            {form.fieldErrors.email && (
              <p className="text-xs text-destructive">{form.fieldErrors.email}</p>
            )}
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

          <div className="grid gap-2">
            <Label htmlFor="user-role" required>
              Role
            </Label>
            <Select
              value={form.role}
              onValueChange={(value) => form.setRole(value as UserRole)}
              disabled={form.busy}
            >
              <SelectTrigger id="user-role" data-testid="user-role">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.fieldErrors.role && (
              <p className="text-xs text-destructive">{form.fieldErrors.role}</p>
            )}
          </div>

          {!isCreate && (
            <div className="grid gap-2">
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
          )}

          {isCreate && (
            <>
              <div className="grid gap-2">
                <Label htmlFor="user-password" required>
                  Password
                </Label>
                <Input
                  id="user-password"
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => form.setPassword(e.target.value)}
                  disabled={form.busy}
                  data-testid="user-password"
                />
                <p className="text-xs text-muted-foreground">At least 8 characters.</p>
                {form.fieldErrors.password && (
                  <p className="text-xs text-destructive">{form.fieldErrors.password}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="user-confirm" required>
                  Confirm password
                </Label>
                <Input
                  id="user-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={(e) => form.setConfirmPassword(e.target.value)}
                  disabled={form.busy}
                  data-testid="user-confirm"
                />
                {form.fieldErrors.confirmPassword && (
                  <p className="text-xs text-destructive">{form.fieldErrors.confirmPassword}</p>
                )}
              </div>
            </>
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" disabled={form.busy} onClick={form.close}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.busy} data-testid="user-form-submit">
              {form.busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {isCreate ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
