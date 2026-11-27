"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useSessionStore } from "@/store/sessionStore";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { LanguagePanel } from "./LanguagePanel";
import { ThemeAppearancePanel } from "./ThemeAppearancePanel";
import { SmtpSettingsPanel } from "./SmtpSettingsPanel";
import { DispatchChannelsPanel } from "./DispatchChannelsPanel";
import { ShopSettingsPanel } from "./ShopSettingsPanel";

export function SettingsScreen() {
  const t = useTranslations("settings");
  const tRoles = useTranslations("roles");
  const user = useSessionStore((s) => s.user);
  const { checkPermission } = usePermissions();
  const canSecurity = checkPermission("account:security");
  const roleKey = user?.role;
  const roleText = roleKey ? tRoles(roleKey) : "—";

  return (
    <div className="p-work" data-testid="settings-page">
      <main className="p-main">
        <div className="p-settings" data-testid="settings-screen">
          <section className="p-devhead p-settings__head">
            <h2>{t("title")}</h2>
            <div className="codes">
              <span>{user?.name}</span>
              <span>{roleText}</span>
            </div>
          </section>

          <div className="p-settings__body">
            <LanguagePanel />
            <ThemeAppearancePanel />
            {canSecurity && (
              <section className="p-settings__panel" data-testid="settings-security-panel">
                <p className="p-sec-title">{t("securityTitle")}</p>
                <p className="p-settings__intro">{t("securityIntro")}</p>
                <div className="p-settings__actions">
                  <Link href="/security" className="p-cta" data-testid="settings-security-link">
                    {t("securityOpen")}
                  </Link>
                </div>
              </section>
            )}
            <SmtpSettingsPanel />
            <DispatchChannelsPanel />
            <ShopSettingsPanel />
          </div>
        </div>
      </main>
    </div>
  );
}
