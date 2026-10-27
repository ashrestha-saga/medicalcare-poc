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

export type ContractLifecycleConfirmAction = "suspend" | "terminate";

interface ContractLifecycleConfirmDialogProps {
  action: ContractLifecycleConfirmAction | null;
  tenantName: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ContractLifecycleConfirmDialog({
  action,
  tenantName,
  busy = false,
  onClose,
  onConfirm,
}: ContractLifecycleConfirmDialogProps) {
  const t = useTranslations("console");
  const tCommon = useTranslations("common");
  const isTerminate = action === "terminate";

  return (
    <AlertDialog
      open={Boolean(action)}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <AlertDialogContent data-testid="contract-lifecycle-confirm">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isTerminate ? t("lifecycleConfirmTerminateTitle") : t("lifecycleConfirmSuspendTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isTerminate
              ? t("lifecycleConfirmTerminateBody", { tenant: tenantName })
              : t("lifecycleConfirmSuspendBody", { tenant: tenantName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{tCommon("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            className={
              isTerminate
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : undefined
            }
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            data-testid="contract-lifecycle-confirm-action"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isTerminate ? t("contractTerminate") : t("contractSuspend")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
