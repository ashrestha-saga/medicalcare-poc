"use client";

import { Loader2 } from "lucide-react";
import type { SiteDTO } from "@/interfaces";
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

interface DeleteLocationDialogProps {
  site: SiteDTO | null;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteLocationDialog({
  site,
  busy = false,
  onClose,
  onConfirm,
}: DeleteLocationDialogProps) {
  return (
    <AlertDialog
      open={Boolean(site)}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <AlertDialogContent data-testid="delete-location-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete location</AlertDialogTitle>
          <AlertDialogDescription>
            {site ? (
              <>
                Delete <span className="font-medium text-foreground">{site.name}</span>
                {site.code ? ` (${site.code})` : ""}? Areas without devices will be removed. This cannot be
                undone.
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
            data-testid="location-delete-confirm"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
