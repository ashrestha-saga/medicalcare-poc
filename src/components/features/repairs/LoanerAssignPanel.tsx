"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/apiClient";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/store/toastStore";

type Props = {
  deviceId: string;
  operationalState?: string | null;
  replacedById?: string | null;
  loanerLender?: string | null;
  onAssigned?: () => void;
};

/** R14 — assign a loaner / replacement to a locked or under-repair device. */
export function LoanerAssignPanel({
  deviceId,
  operationalState,
  replacedById,
  loanerLender,
  onAssigned,
}: Props) {
  const t = useTranslations("repairs.loaner");
  const { checkPermission } = usePermissions();
  const canEdit = checkPermission("inventory:update");
  const [inventoryNumber, setInventoryNumber] = useState("");
  const [lender, setLender] = useState("");
  const [saving, setSaving] = useState(false);

  const eligible =
    operationalState === "locked" ||
    operationalState === "under_repair" ||
    operationalState === "replaced";

  if (!canEdit || !eligible) return null;

  if (replacedById) {
    return (
      <div
        className="mt-4 rounded-md border border-border bg-card/40 p-4 text-sm"
        data-testid="loaner-assigned"
      >
        <p className="font-medium">{t("assignedTitle")}</p>
        <p className="mt-1 text-muted-foreground">
          {t("assignedBody", { lender: loanerLender ?? "—" })}
        </p>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inventoryNumber.trim() || !lender.trim()) return;
    setSaving(true);
    try {
      await api(`/api/devices/${deviceId}/replacement`, {
        method: "POST",
        body: JSON.stringify({
          create: {
            inventoryNumber: inventoryNumber.trim(),
            loanerLender: lender.trim(),
          },
        }),
      });
      toast.success(t("success"));
      setInventoryNumber("");
      setLender("");
      onAssigned?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="mt-4 space-y-3 rounded-md border border-border bg-card/40 p-4"
      onSubmit={onSubmit}
      data-testid="loaner-assign-panel"
    >
      <div>
        <p className="text-sm font-medium text-foreground">{t("title")}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{t("subtitle")}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`loaner-inv-${deviceId}`}>{t("inventoryNumber")}</Label>
        <Input
          id={`loaner-inv-${deviceId}`}
          value={inventoryNumber}
          onChange={(e) => setInventoryNumber(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`loaner-lender-${deviceId}`}>{t("lender")}</Label>
        <Input
          id={`loaner-lender-${deviceId}`}
          value={lender}
          onChange={(e) => setLender(e.target.value)}
          required
        />
      </div>
      <Button
        type="submit"
        size="sm"
        disabled={saving || !inventoryNumber.trim() || !lender.trim()}
      >
        {saving ? t("saving") : t("submit")}
      </Button>
    </form>
  );
}
