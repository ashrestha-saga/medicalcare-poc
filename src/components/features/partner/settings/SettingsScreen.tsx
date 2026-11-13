"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { AccessDenied } from "@/components/features/shared/AccessDenied";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { SmtpSettingsPanel } from "@/components/features/settings/SmtpSettingsPanel";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/lib/providers/PermissionProvider";

/** Partner organisation settings — SMTP used for staff invites. */
export function SettingsScreen() {
  const t = useTranslations("console");
  const tCommon = useTranslations("common");
  const { checkPermission, permissionsLoading } = usePermissions();
  const canView = checkPermission("console:settings:view");
  const canTestEquipment = checkPermission("testequipment:manage");

  if (!permissionsLoading && !canView) {
    return (
      <AccessDenied
        title={t("settingsTitle")}
        description={tCommon("denied")}
        hint={tCommon("contactAdmin")}
        testId="console-settings-denied"
      />
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
            {canTestEquipment ? (
              <section className="rounded-lg border border-border bg-card p-4">
                <h2 className="text-sm font-semibold">{t("testEquipmentSettingsTitle")}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("testEquipmentSettingsHint")}
                </p>
                <Button asChild className="mt-3" variant="secondary">
                  <Link href="/partner/test-equipment">{t("testEquipmentSettingsCta")}</Link>
                </Button>
              </section>
            ) : null}
          </div>
        </ListPageShell>
      </main>
    </div>
  );
}
