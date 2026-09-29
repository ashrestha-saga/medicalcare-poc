"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PARTNER_HOME } from "@/constants/authRoutes";
import { useActingTenantStore } from "@/store/actingTenantStore";
import { useSessionStore } from "@/store/sessionStore";
import { isPartnerSession } from "@/interfaces/session";
import { Button } from "@/components/ui/button";

/** Context chrome when a partner user is acting inside a managed clinic. */
export function PartnerActingBar() {
  const t = useTranslations("console");
  const router = useRouter();
  const user = useSessionStore((s) => s.user);
  const tenantId = useActingTenantStore((s) => s.tenantId);
  const tenantName = useActingTenantStore((s) => s.tenantName);
  const tenantCode = useActingTenantStore((s) => s.tenantCode);
  const clearActingTenant = useActingTenantStore((s) => s.clearActingTenant);

  if (!isPartnerSession(user) || !tenantId || !tenantName) return null;

  const orgLabel = user.organisationName ?? user.name;
  const tenantLabel = tenantCode ? `${tenantName} (${tenantCode})` : tenantName;

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm"
      data-testid="partner-acting-bar"
      role="status"
    >
      <p className="min-w-0 text-amber-950 dark:text-amber-100">
        {t("actingBar", { org: orgLabel, tenant: tenantLabel })}
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        data-testid="leave-acting-tenant"
        onClick={() => {
          clearActingTenant();
          router.push(PARTNER_HOME);
        }}
      >
        {t("actingLeave")}
      </Button>
    </div>
  );
}
