"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCreateClinic } from "@/components/hooks/partner/customers/useCreateClinic";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { cn } from "@/lib/utils";

const SCOPES = [
  { id: "inventory", key: "scopeInventory" as const },
  { id: "due-dates", key: "scopeDueDates" as const },
  { id: "inspection", key: "scopeInspection" as const },
  { id: "reprocessing", key: "scopeReprocessing" as const },
  { id: "training", key: "scopeTraining" as const },
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
        <ListPageShell
          title={t("createTitle")}
          description={t("createIntro")}
          contentClassName="max-w-none"
        >
          <p className="mb-4">
            <Link href="/partner/customers" className="text-sm text-primary underline-offset-4 hover:underline">
              ← {t("backToCustomers")}
            </Link>
          </p>
          <form
            noValidate
            className="grid w-full gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <Section title={t("createSectionInstitution")}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  fieldKey="name"
                  label={t("fieldName")}
                  error={fieldErrors.name}
                  required
                  className="sm:col-span-2"
                >
                  <Input
                    value={form.name}
                    onChange={(e) => patch("name", e.target.value)}
                    aria-invalid={Boolean(fieldErrors.name)}
                    data-testid="clinic-name"
                  />
                </Field>
                <Field
                  fieldKey="tenantCode"
                  label={t("fieldTenantCode")}
                  error={fieldErrors.tenantCode}
                  required
                >
                  <Input
                    value={form.tenantCode}
                    placeholder="T-XXX"
                    onChange={(e) => patch("tenantCode", e.target.value)}
                    aria-invalid={Boolean(fieldErrors.tenantCode)}
                    data-testid="clinic-tenant-code"
                  />
                </Field>
                <Field
                  fieldKey="street"
                  label={t("fieldStreet")}
                  error={fieldErrors.street}
                >
                  <Input
                    value={form.street ?? ""}
                    onChange={(e) => patch("street", e.target.value)}
                    aria-invalid={Boolean(fieldErrors.street)}
                    data-testid="clinic-street"
                  />
                </Field>
                <Field
                  fieldKey="postalCode"
                  label={t("fieldPostalCode")}
                  error={fieldErrors.postalCode}
                  required
                >
                  <Input
                    value={form.postalCode ?? ""}
                    placeholder="53111"
                    onChange={(e) => patch("postalCode", e.target.value)}
                    aria-invalid={Boolean(fieldErrors.postalCode)}
                    data-testid="clinic-postal"
                  />
                </Field>
                <Field fieldKey="city" label={t("fieldCity")} error={fieldErrors.city} required>
                  <Input
                    value={form.city}
                    onChange={(e) => patch("city", e.target.value)}
                    aria-invalid={Boolean(fieldErrors.city)}
                    data-testid="clinic-city"
                  />
                </Field>
                <Field
                  fieldKey="siteName"
                  label={t("fieldSite")}
                  error={fieldErrors.siteName}
                  required
                >
                  <Input
                    value={form.siteName}
                    placeholder="Haus A"
                    onChange={(e) => patch("siteName", e.target.value)}
                    aria-invalid={Boolean(fieldErrors.siteName)}
                    data-testid="clinic-site"
                  />
                </Field>
                <Field
                  fieldKey="contactName"
                  label={t("fieldContact")}
                  error={fieldErrors.contactName}
                >
                  <Input
                    value={form.contactName ?? ""}
                    onChange={(e) => patch("contactName", e.target.value)}
                    aria-invalid={Boolean(fieldErrors.contactName)}
                    data-testid="clinic-contact"
                  />
                </Field>
                <Field
                  fieldKey="contactEmail"
                  label={t("fieldContactEmail")}
                  error={fieldErrors.contactEmail}
                  required
                  hint={t("fieldContactEmailHint")}
                >
                  <Input
                    type="email"
                    value={form.contactEmail ?? ""}
                    onChange={(e) => patch("contactEmail", e.target.value)}
                    aria-invalid={Boolean(fieldErrors.contactEmail)}
                    data-testid="clinic-contact-email"
                  />
                </Field>
                <Field
                  fieldKey="mpsbName"
                  label={t("fieldMpsb")}
                  error={fieldErrors.mpsbName}
                  hint={t("fieldMpsbHint")}
                >
                  <Input
                    value={form.mpsbName ?? ""}
                    placeholder={t("fieldMpsbPlaceholder")}
                    onChange={(e) => patch("mpsbName", e.target.value)}
                    aria-invalid={Boolean(fieldErrors.mpsbName)}
                    data-testid="clinic-mpsb"
                  />
                </Field>
              </div>
            </Section>

            <Section title={t("createSectionContract")}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  fieldKey="validFrom"
                  label={t("fieldValidFrom")}
                  error={fieldErrors.validFrom}
                  required
                >
                  <Input
                    type="date"
                    value={form.validFrom}
                    onChange={(e) => patch("validFrom", e.target.value)}
                    aria-invalid={Boolean(fieldErrors.validFrom)}
                    data-testid="clinic-valid-from"
                  />
                </Field>
                <Field
                  fieldKey="billingRef"
                  label={t("fieldBilling")}
                  error={fieldErrors.billingRef}
                >
                  <Input
                    value={form.billingRef ?? ""}
                    onChange={(e) => patch("billingRef", e.target.value)}
                    aria-invalid={Boolean(fieldErrors.billingRef)}
                    data-testid="clinic-billing"
                  />
                </Field>
                <Field
                  fieldKey="operatingModel"
                  label={t("fieldModel")}
                  error={fieldErrors.operatingModel}
                  required
                >
                  <select
                    className="flex h-9 w-full rounded-md border border-border bg-transparent px-3 text-sm"
                    value={form.operatingModel}
                    onChange={(e) =>
                      patch("operatingModel", e.target.value as "provider_operated" | "institution_operated")
                    }
                    aria-invalid={Boolean(fieldErrors.operatingModel)}
                    data-testid="clinic-model"
                  >
                    <option value="provider_operated">{t("modelProvider")}</option>
                    <option value="institution_operated">{t("modelInstitution")}</option>
                  </select>
                </Field>
                <div className="sm:col-span-2" data-field="scope">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("fieldScope")}
                  </p>
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
                </div>
                <Field
                  fieldKey="avvRef"
                  label={t("fieldAvv")}
                  error={fieldErrors.avvRef}
                  required={form.operatingModel === "provider_operated"}
                  hint={
                    form.operatingModel === "provider_operated" ? t("fieldAvvHint") : undefined
                  }
                  className="sm:col-span-2"
                >
                  <Input
                    value={form.avvRef ?? ""}
                    placeholder={t("fieldAvvPlaceholder")}
                    onChange={(e) => patch("avvRef", e.target.value)}
                    aria-invalid={Boolean(fieldErrors.avvRef)}
                    data-testid="clinic-avv"
                  />
                </Field>
              </div>
            </Section>

            <div className="flex gap-2">
              <Button type="button" variant="outline" asChild>
                <Link href="/partner/customers">{tCommon("cancel")}</Link>
              </Button>
              <Button type="submit" disabled={busy} data-testid="clinic-submit">
                {busy ? tCommon("loading") : t("createSubmit")}
              </Button>
            </div>
          </form>
        </ListPageShell>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4 sm:p-5">
      <h2 className="mb-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({
  label,
  error,
  required,
  hint,
  className,
  fieldKey,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
  className?: string;
  fieldKey?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("grid gap-1.5", className)} data-field={fieldKey}>
      <Label required={required} className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {!error && hint ? <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
