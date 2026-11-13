"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/apiClient";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/store/toastStore";

type Props = {
  deviceId: string;
  /** When present on the DTO, only show for locked / under_repair. */
  operationalState?: string | null;
  onUnlocked?: () => void;
};

/**
 * R13 clinic unlock — posts note to /api/devices/:id/unlock.
 * Always offered when inventory:update; API rejects if repairs flag off / wrong state.
 */
export function UnlockDevicePanel({ deviceId, operationalState, onUnlocked }: Props) {
  const t = useTranslations("repairs.unlock");
  const { checkPermission } = usePermissions();
  const canUnlock = checkPermission("inventory:update");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [hidden, setHidden] = useState(false);

  const stateAllows =
    operationalState === "locked" || operationalState === "under_repair";

  if (!canUnlock || !stateAllows || hidden) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    setSaving(true);
    try {
      await api(`/api/devices/${deviceId}/unlock`, {
        method: "POST",
        body: JSON.stringify({ note: note.trim() }),
      });
      toast.success(t("success"));
      setNote("");
      onUnlocked?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("error");
      // Soft-hide when repairs feature is disabled for the tenant.
      if (/403|not enabled|forbidden/i.test(msg)) {
        setHidden(true);
        toast.error(t("hidden"));
      } else {
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="mt-4 space-y-3 rounded-md border border-border bg-card/40 p-4"
      onSubmit={onSubmit}
      data-testid="unlock-device-panel"
    >
      <div>
        <p className="text-sm font-medium text-foreground">{t("title")}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{t("subtitle")}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`unlock-note-${deviceId}`}>{t("note")}</Label>
        <Textarea
          id={`unlock-note-${deviceId}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          required
          rows={2}
          data-testid="unlock-note"
        />
      </div>
      <Button type="submit" size="sm" disabled={saving || !note.trim()} data-testid="unlock-submit">
        {saving ? t("saving") : t("submit")}
      </Button>
    </form>
  );
}
