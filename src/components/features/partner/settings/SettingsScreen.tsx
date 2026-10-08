"use client";

import { useTranslations } from "next-intl";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { SmtpSettingsPanel } from "@/components/features/settings/SmtpSettingsPanel";
import { TestEquipmentPanel } from "@/components/features/partner/settings/TestEquipmentPanel";
import { usePermissions } from "@/lib/providers/PermissionProvider";

/** Partner organisation settings — SMTP used for staff invites. */
export function SettingsScreen() {
  const t = useTranslations("console");
  const tCommon = useTranslations("common");
  const { checkPermission, permissionsLoading } = usePermissions();
  const canView = checkPermission("console:settings:view");

  if (!permissionsLoading && !canView) {
    return (
      <div className="p-work" data-testid="console-settings-denied">
        <main className="p-main">
          <ListPageShell title={t("settingsTitle")} description={tCommon("denied")}>
            <p className="text-sm text-muted-foreground">{tCommon("contactAdmin")}</p>
          </ListPageShell>
        </main>
      </div>
    );
  }

  return (
    <div className="p-work" data-testid="console-settings-page">
      <main className="p-main">
        <ListPageShell title={t("settingsTitle")} description={t("settingsIntro")}>
          <div className="p-settings space-y-6">
            <SmtpSettingsPanel
              apiBase="/api/partner/settings/smtp"
              viewPermission="console:settings:view"
              managePermission="console:settings:smtp"
              introKey="smtpIntroPartner"
            />
            <TestEquipmentPanel />
          </div>
        </ListPageShell>
      </main>
    </div>
  );
}
