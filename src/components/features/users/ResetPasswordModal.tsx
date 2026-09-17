"use client";

import { Loader2 } from "lucide-react";
import type { useResetPasswordForm } from "@/components/hooks/users/useUserForm";
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

type FormApi = ReturnType<typeof useResetPasswordForm>;

export function ResetPasswordModal({ form }: { form: FormApi }) {
  return (
    <Dialog
      open={form.open}
      onOpenChange={(open) => {
        if (!open && !form.busy) form.close();
      }}
    >
      <DialogContent className="sm:max-w-md" data-testid="reset-password-dialog">
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>
            {form.target
              ? `Set a new password for ${form.target.name}.`
              : "Set a new password for this user."}
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
            <Label htmlFor="admin-password" required>
              Your admin password
            </Label>
            <Input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              value={form.adminPassword}
              onChange={(e) => form.setAdminPassword(e.target.value)}
              disabled={form.busy}
              data-testid="admin-password"
            />
            {form.fieldErrors.adminPassword && (
              <p className="text-xs text-destructive">{form.fieldErrors.adminPassword}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="new-password" required>
              New password
            </Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={form.newPassword}
              onChange={(e) => form.setNewPassword(e.target.value)}
              disabled={form.busy}
              data-testid="new-password"
            />
            <p className="text-xs text-muted-foreground">At least 8 characters.</p>
            {form.fieldErrors.newPassword && (
              <p className="text-xs text-destructive">{form.fieldErrors.newPassword}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="confirm-new-password" required>
              Confirm new password
            </Label>
            <Input
              id="confirm-new-password"
              type="password"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={(e) => form.setConfirmPassword(e.target.value)}
              disabled={form.busy}
              data-testid="confirm-new-password"
            />
            {form.fieldErrors.confirmPassword && (
              <p className="text-xs text-destructive">{form.fieldErrors.confirmPassword}</p>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" disabled={form.busy} onClick={form.close}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.busy} data-testid="reset-password-submit">
              {form.busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Reset
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
