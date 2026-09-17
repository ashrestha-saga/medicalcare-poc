"use client";

import { Loader2 } from "lucide-react";
import type { AdminUserDTO } from "@/interfaces";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DeleteUserDialogProps {
  user: AdminUserDTO | null;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteUserDialog({ user, busy = false, onClose, onConfirm }: DeleteUserDialogProps) {
  return (
    <AlertDialog
      open={Boolean(user)}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <AlertDialogContent data-testid="delete-user-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete user</AlertDialogTitle>
          <AlertDialogDescription>
            {user ? (
              <>
                Delete <span className="font-medium text-foreground">{user.name}</span> (
                {user.email})? This cannot be undone.
              </>
            ) : (
              "This cannot be undone."
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            data-testid="user-delete-confirm"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
