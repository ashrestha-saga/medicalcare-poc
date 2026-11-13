"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/textarea";

export type TrainingGateOverridePending = {
  reference: string;
  manufacturer: string;
  assigneeUserId: string;
  assigneeName?: string | null;
};

type Props = {
  pending: TrainingGateOverridePending | null;
  busy?: boolean;
  canOverride: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
};

/** E79 — Serviceleitung/GF override when manufacturer training gate blocks assign. */
export function TrainingGateOverrideDialog({
  pending,
  busy,
  canOverride,
  onClose,
  onConfirm,
}: Props) {
  const t = useTranslations("console");
  const [reason, setReason] = useState("");

  const open = Boolean(pending);
  const manufacturer = pending?.manufacturer || "—";

  return (
    <Modal
      open={open}
      title={t("trainingGateTitle", { manufacturer })}
      onClose={() => {
        if (!busy) {
          setReason("");
          onClose();
        }
      }}
      footer={
        <>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            {t("cancel")}
          </Button>
          {canOverride ? (
            <Button
              type="button"
              disabled={busy || reason.trim().length < 3}
              data-testid="training-gate-override-confirm"
              onClick={() => onConfirm(reason.trim())}
            >
              {t("trainingGateOverride")}
            </Button>
          ) : null}
        </>
      }
    >
      <div className="grid gap-3 text-sm">
        <p>
          {t("trainingGateBody", {
            name: pending?.assigneeName || "—",
            manufacturer,
          })}
        </p>
        <p className="text-xs text-muted-foreground">{t("trainingGateRemedies")}</p>
        {canOverride ? (
          <Field label={t("trainingGateReason")} htmlFor="gate-override-reason" required>
            <Textarea
              id="gate-override-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              data-testid="training-gate-override-reason"
              placeholder={t("trainingGateReasonPh")}
            />
          </Field>
        ) : (
          <p className="text-xs text-amber-700 dark:text-amber-200">{t("trainingGateNoOverride")}</p>
        )}
      </div>
    </Modal>
  );
}
