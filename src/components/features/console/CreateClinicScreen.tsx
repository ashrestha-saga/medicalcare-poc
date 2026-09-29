"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCreateClinic } from "@/components/hooks/console/useCreateClinic";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePermissions } from "@/lib/providers/PermissionProvider";

const SCOPES = [
  { id: "inventory", key: "scopeInventory" as const },
  { id: "due-dates", key: "scopeDueDates" as const },
  { id: "inspection", key: "scopeInspection" as const },
];

export function CreateClinicScreen() {
  const t = useTranslations("console");
  const tCommon = useTranslations("common");
  const { form, patch, toggleScope, fieldErrors, busy, submit } = useCreateClinic();
  const { checkPermission, permissionsLoading } = usePermissions();

  if (!permissionsLoading && !checkPermission("console:customers:create")) {
    return (
      <div className="p-work" data-testid="console-create-denied">
        <main className="p-main">
          <ListPageShell title={t("createTitle")} description={tCommon("denied")}>
            <Link href="/partner/customers" className="text-sm text-primary underline-offset-4 hover:underline">
              ← {t("backToCustomers")}
            </Link>
          </ListPageShell>
        </main>
      </div>
    );
  }

  return (
    <div className="p-work" data-testid="console-create-clinic-page">
      <main className="p-main">
        <ListPageShell title={t("createTitle")} description={t("createIntro")}>
          <p className="mb-4">
            <Link href="/partner/customers" className="text-sm text-primary underline-offset-4 hover:underline">
              ← {t("backToCustomers")}
            </Link>
          </p>
          <form
            className="grid max-w-2xl gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <section className="grid gap-3 sm:grid-cols-2">
              <Field label={t("fieldName")} error={fieldErrors.name} required>
                <Input
                  value={form.name}
                  onChange={(e) => patch("name", e.target.value)}
                  data-testid="clinic-name"
                />
              </Field>
              <Field label={t("fieldStreet")} error={fieldErrors.street}>
                <Input
                  value={form.street ?? ""}
                  onChange={(e) => patch("street", e.target.value)}
                  data-testid="clinic-street"
                />
              </Field>
              <Field label={t("fieldPostalCode")} error={fieldErrors.postalCode}>
                <Input
                  value={form.postalCode ?? ""}
                  onChange={(e) => patch("postalCode", e.target.value)}
                  data-testid="clinic-postal"
                />
              </Field>
              <Field label={t("fieldCity")} error={fieldErrors.city} required>
                <Input
                  value={form.city}
                  onChange={(e) => patch("city", e.target.value)}
                  data-testid="clinic-city"
                />
              </Field>
              <Field label={t("fieldCountry")} error={fieldErrors.country}>
                <Input
                  value={form.country ?? "DE"}
                  onChange={(e) => patch("country", e.target.value)}
                  data-testid="clinic-country"
                  maxLength={2}
                />
              </Field>
              <Field label={t("fieldTenantCode")} error={fieldErrors.tenantCode} required>
                <Input
                  value={form.tenantCode}
                  placeholder="T-XXX"
                  onChange={(e) => patch("tenantCode", e.target.value)}
                  data-testid="clinic-tenant-code"
                />
              </Field>
              <Field label={t("fieldSite")} error={fieldErrors.siteName} required>
                <Input
                  value={form.siteName}
                  onChange={(e) => patch("siteName", e.target.value)}
                  data-testid="clinic-site"
                />
              </Field>
            </section>

            <section className="grid gap-3 sm:grid-cols-2">
              <Field label={t("fieldValidFrom")} error={fieldErrors.validFrom} required>
                <Input
                  type="date"
                  value={form.validFrom}
                  onChange={(e) => patch("validFrom", e.target.value)}
                  data-testid="clinic-valid-from"
                />
              </Field>
              <Field label={t("fieldBilling")} error={fieldErrors.billingRef}>
                <Input
                  value={form.billingRef ?? ""}
                  onChange={(e) => patch("billingRef", e.target.value)}
                  data-testid="clinic-billing"
                />
              </Field>
              <Field label={t("fieldModel")} error={fieldErrors.operatingModel} required>
                <select
                  className="flex h-9 w-full rounded-md border border-border bg-transparent px-3 text-sm"
                  value={form.operatingModel}
                  onChange={(e) =>
                    patch("operatingModel", e.target.value as CreateClinicScreenModel)
                  }
                  data-testid="clinic-model"
                >
                  <option value="provider_operated">{t("modelProvider")}</option>
                  <option value="institution_operated">{t("modelInstitution")}</option>
                </select>
              </Field>
            </section>

            <fieldset>
              <legend className="mb-2 text-sm font-medium">{t("fieldScope")}</legend>
              {fieldErrors.scope ? (
                <p className="mb-2 text-xs text-destructive">{fieldErrors.scope}</p>
              ) : null}
              <div className="grid gap-2">
                {SCOPES.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.scope.includes(s.id)}
                      onCheckedChange={() => toggleScope(s.id)}
                    />
                    {t(s.key)}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="flex gap-2">
              <Button type="submit" disabled={busy} data-testid="clinic-submit">
                {busy ? tCommon("loading") : t("createSubmit")}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/partner/customers">{tCommon("cancel")}</Link>
              </Button>
            </div>
          </form>
        </ListPageShell>
      </main>
    </div>
  );
}

type CreateClinicScreenModel = "provider_operated" | "institution_operated";

function Field({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label required={required}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
