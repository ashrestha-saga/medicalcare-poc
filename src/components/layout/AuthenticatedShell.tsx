"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { FormFactor } from "@/interfaces";
import { AuthGate } from "@/components/features/auth/AuthGate";
import { RouteGuard } from "@/components/guards/RouteGuard";
import { AppShell } from "@/components/layout/AppShell";
import { Toaster } from "@/components/ui/Toaster";
import { PermissionProvider } from "@/lib/providers/PermissionProvider";

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

/**
 * Client shell for the (app) route group:
 * session/PIN gate → PermissionProvider → RouteGuard → nav chrome → page.
 */
export function AuthenticatedShell({ children }: { children: ReactNode }) {
  const form = useFormFactorState();
  const pathname = usePathname();
  const accountSubtitle = pathname.startsWith("/devices")
    ? "Device inventory"
    : pathname.startsWith("/catalog")
      ? "Model catalog"
      : pathname.startsWith("/requests")
        ? "Service requests"
        : pathname.startsWith("/users")
          ? "User management"
          : pathname.startsWith("/locations")
            ? "Clinic locations"
            : pathname.startsWith("/roles")
              ? "Role catalog"
              : pathname.startsWith("/settings")
                ? "Settings"
                : undefined;
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
        <PermissionProvider>
          <AppShell form={form} accountSubtitle={accountSubtitle} testId={testId}>
            <RouteGuard>{children}</RouteGuard>
          </AppShell>
          <Toaster />
        </PermissionProvider>
      </AuthGate>
    </FormFactorContext.Provider>
  );
}
