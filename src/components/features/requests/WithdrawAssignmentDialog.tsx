"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
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

interface WithdrawAssignmentDialogProps {
  open: boolean;
  reference: string;
  busy?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function WithdrawAssignmentDialog({
  open,
  reference,
  busy = false,
  onOpenChange,
  onConfirm,
}: WithdrawAssignmentDialogProps) {
  const t = useTranslations("requestsDetail");
  const tCommon = useTranslations("common");

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
    >
      <AlertDialogContent data-testid="withdraw-assignment-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>{t("withdrawDialogTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("withdrawConfirm", { reference })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{tCommon("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            data-testid="withdraw-assignment-confirm"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("withdraw")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
