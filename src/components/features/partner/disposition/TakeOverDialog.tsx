"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ConsoleRequestRowDTO } from "@/interfaces/console";
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

interface TakeOverDialogProps {
  row: ConsoleRequestRowDTO | null;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function TakeOverDialog({
  row,
  busy = false,
  onClose,
  onConfirm,
}: TakeOverDialogProps) {
  const t = useTranslations("console");
  const contractor = row?.executorCode ?? row?.executorName ?? "—";

  return (
    <AlertDialog
      open={Boolean(row)}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <AlertDialogContent data-testid="disposition-takeover-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>{t("dispositionTakeOverTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {row
              ? t("dispositionTakeOverBody", {
                  reference: row.reference,
                  contractor,
                  institution: row.tenantName,
                })
              : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t("dispositionTakeOverCancel")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            data-testid="disposition-takeover-confirm"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("dispositionTakeOverConfirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
