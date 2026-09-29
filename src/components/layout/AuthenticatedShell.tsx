"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { FormFactor } from "@/interfaces";
import { AuthGate } from "@/components/features/auth/AuthGate";
import { RouteGuard } from "@/components/guards/RouteGuard";
import { AppShell } from "@/components/layout/AppShell";
import { Toaster } from "@/components/ui/Toaster";
import { Loading } from "@/components/ui/Loading";
import { PermissionProvider } from "@/lib/providers/PermissionProvider";
import { useSessionStore } from "@/store/sessionStore";
import { useActingTenantStore } from "@/store/actingTenantStore";
import { PARTNER_HOME } from "@/constants/authRoutes";
import { isPartnerSession } from "@/interfaces/session";

export type { FormFactor };

const FormFactorContext = createContext<FormFactor>("phone");

export function useFormFactor(): FormFactor {
  return useContext(FormFactorContext);
}

function useFormFactorState(): FormFactor {
  const [form, setForm] = useState<FormFactor>("phone");
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w >= 1100) setForm("full");
      else if (w >= 720) setForm("tablet");
      else setForm("phone");
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return form;
}

/** Partners may enter the clinic shell only while an acting tenant is set. */
function BouncePartners({ children }: { children: ReactNode }) {
  const user = useSessionStore((s) => s.user);
  const status = useSessionStore((s) => s.status);
  const actingTenantId = useActingTenantStore((s) => s.tenantId);
  const hydrated = useActingTenantHydrated();

  useEffect(() => {
    if (!hydrated) return;
    if (status === "signed-in" && isPartnerSession(user) && !actingTenantId) {
      window.location.replace(PARTNER_HOME);
    }
  }, [status, user, actingTenantId, hydrated]);

  if (!hydrated && status === "signed-in" && isPartnerSession(user)) {
    return <Loading label="Restoring acting context…" />;
  }

  if (status === "signed-in" && isPartnerSession(user) && !actingTenantId) {
    return <Loading label="Opening partner portal…" />;
  }
  return <>{children}</>;
}

function useActingTenantHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useActingTenantStore.persist.hasHydrated());
  useEffect(() => {
    const unsub = useActingTenantStore.persist.onFinishHydration(() => setHydrated(true));
    setHydrated(useActingTenantStore.persist.hasHydrated());
    return unsub;
  }, []);
  return hydrated;
}

function useAccountSubtitle(pathname: string): string | undefined {
  const t = useTranslations("nav");
  if (pathname.startsWith("/devices")) return t("subtitleInventory");
  if (pathname.startsWith("/catalog")) return t("subtitleCatalog");
  if (pathname.startsWith("/requests")) return t("subtitleRequests");
  if (pathname.startsWith("/users")) return t("subtitleUsers");
  if (pathname.startsWith("/locations")) return t("subtitleLocations");
  if (pathname.startsWith("/roles")) return t("subtitleRoles");
  if (pathname.startsWith("/settings")) return t("subtitleSettings");
  if (pathname.startsWith("/management")) return t("subtitleManagement");
  if (pathname.startsWith("/activity")) return t("subtitleActivity");
  if (pathname.startsWith("/due-dates")) return t("subtitleDueDates");
  if (pathname.startsWith("/training")) return t("subtitleTraining");
  if (pathname.startsWith("/registration")) return t("subtitleRegistration");
  if (pathname.startsWith("/clarifications")) return t("subtitleClarifications");
  if (pathname.startsWith("/security")) return t("subtitleSecurity");
  return undefined;
}

/**
 * Client shell for the (app) route group:
 * session/PIN gate → PermissionProvider → RouteGuard → nav chrome → page.
 */
export function AuthenticatedShell({ children }: { children: ReactNode }) {
  const form = useFormFactorState();
  const pathname = usePathname();
  const accountSubtitle = useAccountSubtitle(pathname);
  const testId = pathname.startsWith("/devices")
    ? "devices-shell"
    : pathname.startsWith("/catalog")
      ? "catalog-shell"
      : pathname.startsWith("/requests")
        ? "requests-page"
        : pathname.startsWith("/users")
          ? "users-shell"
          : pathname.startsWith("/locations")
            ? "locations-shell"
            : pathname.startsWith("/roles")
              ? "roles-shell"
              : pathname.startsWith("/settings")
                ? "settings-shell"
                : undefined;

  return (
    <FormFactorContext.Provider value={form}>
      <AuthGate>
        <BouncePartners>
          <PermissionProvider>
            <AppShell form={form} accountSubtitle={accountSubtitle} testId={testId}>
              <RouteGuard>{children}</RouteGuard>
            </AppShell>
            <Toaster />
          </PermissionProvider>
        </BouncePartners>
      </AuthGate>
    </FormFactorContext.Provider>
  );
}
