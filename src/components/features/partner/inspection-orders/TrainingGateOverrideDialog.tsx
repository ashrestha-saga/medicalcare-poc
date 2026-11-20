"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/textarea";

export type TrainingGateOverridePending = {
  kind: "training";
  reference: string;
  manufacturer: string;
  assigneeUserId: string;
  assigneeName?: string | null;
};

export type ServiceTypeGateOverridePending = {
  kind: "service_type";
  reference: string;
  serviceType: string;
  qualificationCode: string;
  overridableBy: "service_lead" | "management";
  assigneeUserId: string;
  assigneeName?: string | null;
};

export type GateOverridePending = TrainingGateOverridePending | ServiceTypeGateOverridePending;

type Props = {
  pending: GateOverridePending | null;
  busy?: boolean;
  canOverride: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
};

/** E79 / E89 — override when manufacturer or service-type gate blocks assign. */
export function TrainingGateOverrideDialog({
  pending,
  busy,
  canOverride,
  onClose,
  onConfirm,
}: Props) {
  const t = useTranslations("console");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!pending) setReason("");
  }, [pending]);

  const open = Boolean(pending);
  const isServiceType = pending?.kind === "service_type";

  const title = isServiceType
    ? t("serviceTypeGateTitle", { serviceType: pending.serviceType })
    : t("trainingGateTitle", { manufacturer: pending?.manufacturer || "—" });

  const body = isServiceType
    ? t("serviceTypeGateBody", {
        name: pending?.assigneeName || "—",
        serviceType: pending?.serviceType || "—",
        qualification: pending?.qualificationCode || "—",
      })
    : t("trainingGateBody", {
        name: pending?.assigneeName || "—",
        manufacturer: pending?.kind === "training" ? pending.manufacturer : "—",
      });

  const remedies = isServiceType ? t("serviceTypeGateRemedies") : t("trainingGateRemedies");
  const noOverride = isServiceType ? t("serviceTypeGateNoOverride") : t("trainingGateNoOverride");

  return (
    <Modal
      open={open}
      title={title}
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
              data-testid={
                isServiceType ? "service-type-gate-override-confirm" : "training-gate-override-confirm"
              }
              onClick={() => onConfirm(reason.trim())}
            >
              {isServiceType ? t("serviceTypeGateOverride") : t("trainingGateOverride")}
            </Button>
          ) : null}
        </>
      }
    >
      <div className="grid gap-3 text-sm">
        <p>{body}</p>
        <p className="text-xs text-muted-foreground">{remedies}</p>
        {canOverride ? (
          <Field
            label={isServiceType ? t("serviceTypeGateReason") : t("trainingGateReason")}
            htmlFor="gate-override-reason"
            required
          >
            <Textarea
              id="gate-override-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              data-testid="training-gate-override-reason"
              placeholder={isServiceType ? t("serviceTypeGateReasonPh") : t("trainingGateReasonPh")}
            />
          </Field>
        ) : (
          <p className="text-xs text-amber-700 dark:text-amber-200">{noOverride}</p>
        )}
      </div>
    </Modal>
  );
}