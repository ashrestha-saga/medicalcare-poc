"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CONTRACT_SCOPE_TOKENS } from "@/constants/partnerPermissions";
import { useCustomerDetail } from "@/components/hooks/console/useCustomerDetail";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/Loading";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { cn } from "@/lib/utils";

const SCOPE_KEYS: Record<
  string,
  "scopeInventory" | "scopeDueDates" | "scopeInspection" | "scopeReprocessing" | "scopeTraining"
> = {
  inventory: "scopeInventory",
  "due-dates": "scopeDueDates",
  inspection: "scopeInspection",
  reprocessing: "scopeReprocessing",
  training: "scopeTraining",
};

const ROLE_LABEL: Record<string, "detailRoleAdmin" | "detailRoleInspector" | "detailRoleOrder"> = {
  admin: "detailRoleAdmin",
  inspector: "detailRoleInspector",
  order: "detailRoleOrder",
};

const ACCESS_LABEL: Record<string, "accessAdmin" | "accessInspector" | "accessOrder"> = {
  admin: "accessAdmin",
  inspector: "accessInspector",
  order: "accessOrder",
};

export function CustomerDetailScreen({ contractId }: { contractId: string }) {
  const t = useTranslations("console");
  const tCommon = useTranslations("common");
  const { checkPermission } = usePermissions();
  const canUpdate = checkPermission("console:contracts:update");
  const canLifecycle = checkPermission("console:contracts:lifecycle");
  const canAssignStaff = checkPermission("console:staff:assign");
  const detail = useCustomerDetail(contractId);
  const {
    clinic,
    error,
    loading,
    busy,
    validFrom,
    setValidFrom,
    validTo,
    setValidTo,
    billingRef,
    setBillingRef,
    avvRef,
    setAvvRef,
    operatingModel,
    setOperatingModel,
    scope,
    toggleScope,
    save,
    lifecycle,
    setStaffAssigned,
    openBackoffice,
  } = detail;

  const stateLabel = clinic
    ? clinic.terminatedAt
      ? t("statusTerminated")
      : clinic.suspendedAt
        ? t("statusSuspended")
        : clinic.live
          ? t("stateRunning")
          : t("ended")
    : "";

  return (
    <div className="p-work" data-testid="console-customer-detail">
      <main className="p-main">
        {loading ? (
          <div className="p-wait">
            <Spinner />
          </div>
        ) : null}
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {clinic ? (
          <ListPageShell
            title={clinic.tenantName}
            description={[clinic.city, clinic.tenantCode].filter(Boolean).join(" · ")}
          >
            <p className="mb-4">
              <Link
                href="/partner/customers"
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                ← {t("backToCustomers")}
              </Link>
            </p>

            <div className="grid gap-5">
              <Section title={t("detailSectionInstitution")}>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <MasterRow label={t("detailAddress")} value={clinic.address || t("detailNotRecorded")} />
                  <MasterRow label={t("detailContact")} value={clinic.contact || t("detailNotRecorded")} />
                  <div className="grid gap-1.5">
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("detailMpsb")}
                    </dt>
                    <dd>
                      <StatusPill
                        tone={clinic.mpsbStatus === "open" ? "warn" : "ok"}
                        label={
                          clinic.mpsbStatus === "open"
                            ? t("detailMpsbOpen")
                            : clinic.mpsbName || t("detailMpsbAppointed")
                        }
                      />
                    </dd>
                  </div>
                  <div className="grid gap-1.5">
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("fieldAvv")}
                    </dt>
                    <dd>
                      {clinic.avvMissing ? (
                        <StatusPill tone="danger" label={t("detailAvvMissing")} />
                      ) : (
                        <span className="text-sm">{clinic.avvRef || t("detailNotRecorded")}</span>
                      )}
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  {t("detailInstitutionNote")}
                </p>
              </Section>

              <Section title={t("detailSectionContract")}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("fieldValidFrom")}
                    </Label>
                    <Input
                      type="date"
                      value={validFrom}
                      disabled={!canUpdate || busy}
                      onChange={(e) => setValidFrom(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("fieldValidTo")}
                    </Label>
                    <Input
                      type="date"
                      value={validTo}
                      disabled={!canUpdate || busy}
                      placeholder={t("fieldValidToHint")}
                      onChange={(e) => setValidTo(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">{t("fieldValidToHint")}</p>
                  </div>
                  <div className="grid gap-1.5 sm:col-span-2">
                    <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("fieldModel")}
                    </Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-border bg-transparent px-3 text-sm"
                      value={operatingModel}
                      disabled={!canUpdate || busy}
                      onChange={(e) =>
                        setOperatingModel(e.target.value as "provider_operated" | "institution_operated")
                      }
                    >
                      <option value="provider_operated">{t("modelProvider")}</option>
                      <option value="institution_operated">{t("modelInstitution")}</option>
                    </select>
                    <p className="text-xs text-muted-foreground">{t("detailModelHint")}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("fieldScope")}
                    </p>
                    <div className="grid gap-2">
                      {CONTRACT_SCOPE_TOKENS.map((token) => (
                        <label key={token} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={scope.includes(token)}
                            disabled={!canUpdate || busy}
                            onCheckedChange={() => toggleScope(token)}
                          />
                          {t(SCOPE_KEYS[token] ?? "scopeInventory")}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-1.5 sm:col-span-2">
                    <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("fieldBilling")}
                    </Label>
                    <Input
                      value={billingRef}
                      disabled={!canUpdate || busy}
                      onChange={(e) => setBillingRef(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5 sm:col-span-2">
                    <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("fieldAvv")}
                    </Label>
                    <Input
                      value={avvRef}
                      disabled={!canUpdate || busy}
                      onChange={(e) => setAvvRef(e.target.value)}
                    />
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                  <span>
                    {t("colSites")}: <strong>{clinic.siteCount}</strong>
                  </span>
                  <span>
                    {t("colDevices")}: <strong>{clinic.deviceCount}</strong>
                  </span>
                  <StatusPill
                    tone={
                      clinic.live && !clinic.suspendedAt
                        ? "ok"
                        : clinic.terminatedAt
                          ? "danger"
                          : "warn"
                    }
                    label={stateLabel}
                  />
                </div>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
                  {canUpdate ? (
                    <Button type="button" disabled={busy} onClick={() => void save()} data-testid="contract-save">
                      {busy ? tCommon("loading") : t("contractSave")}
                    </Button>
                  ) : null}
                  {canLifecycle && clinic.live && !clinic.suspendedAt ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void lifecycle("suspend")}
                    >
                      {t("contractSuspend")}
                    </Button>
                  ) : null}
                  {canLifecycle && clinic.suspendedAt && !clinic.terminatedAt ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void lifecycle("resume")}
                    >
                      {t("contractResume")}
                    </Button>
                  ) : null}
                  {canLifecycle && !clinic.terminatedAt ? (
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={busy}
                      onClick={() => void lifecycle("terminate")}
                    >
                      {t("contractTerminate")}
                    </Button>
                  ) : null}
                  {clinic.live ? (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={busy}
                      onClick={openBackoffice}
                      data-testid="open-backoffice"
                    >
                      {t("openBackoffice")}
                    </Button>
                  ) : null}
                </div>
              </Section>

              <Alert>
                <AlertDescription>{t("detailAccessBanner")}</AlertDescription>
              </Alert>

              <Section title={t("detailSectionStaff")}>
                <p className="mb-3 text-xs text-muted-foreground">{t("detailStaffIntro")}</p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[36rem] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        <th className="py-2 pr-3 font-semibold">{t("detailColStaff")}</th>
                        <th className="py-2 pr-3 font-semibold">{t("detailColRole")}</th>
                        <th className="py-2 pr-3 font-semibold">{t("detailColAccess")}</th>
                        <th className="py-2 font-semibold" />
                      </tr>
                    </thead>
                    <tbody>
                      {clinic.staff.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-3 text-muted-foreground">
                            {t("detailStaffEmpty")}
                          </td>
                        </tr>
                      ) : (
                        clinic.staff.map((row) => (
                          <tr key={row.membershipId} className="border-b border-border/70">
                            <td className="py-2.5 pr-3">
                              <div className="font-medium">{row.name}</div>
                              <div className="text-xs text-muted-foreground">{row.email}</div>
                            </td>
                            <td className="py-2.5 pr-3">
                              {t(ROLE_LABEL[row.appRole] ?? "detailRoleInspector")}
                              {row.jobTitle ? (
                                <div className="text-xs text-muted-foreground">{row.jobTitle}</div>
                              ) : null}
                            </td>
                            <td className="py-2.5 pr-3">
                              {row.assigned ? (
                                <StatusPill
                                  tone="ok"
                                  label={t(ACCESS_LABEL[row.appRole] ?? "accessInspector")}
                                />
                              ) : (
                                <StatusPill tone="muted" label={t("accessNone")} />
                              )}
                            </td>
                            <td className="py-2.5 text-right">
                              {row.accessLocked ? (
                                <span className="text-xs text-muted-foreground">{t("staffAssignAdminNote")}</span>
                              ) : canAssignStaff && clinic.live ? (
                                <Button
                                  type="button"
                                  variant="link"
                                  className="h-auto p-0 text-sm"
                                  disabled={busy}
                                  onClick={() => void setStaffAssigned(row.membershipId, !row.assigned)}
                                >
                                  {row.assigned ? t("staffRevoke") : t("staffAssign")}
                                </Button>
                              ) : null}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Section>

              <Section title={t("detailSectionAssignments")}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[40rem] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        <th className="py-2 pr-3 font-semibold">{t("detailColAssignment")}</th>
                        <th className="py-2 pr-3 font-semibold">{t("detailColDevice")}</th>
                        <th className="py-2 pr-3 font-semibold">{t("detailColService")}</th>
                        <th className="py-2 pr-3 font-semibold">{t("detailColPerformedBy")}</th>
                        <th className="py-2 pr-3 font-semibold">{t("colState")}</th>
                        <th className="py-2 font-semibold">{t("detailColAppointment")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clinic.assignments.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-3 text-muted-foreground">
                            {t("detailAssignmentsEmpty")}
                          </td>
                        </tr>
                      ) : (
                        clinic.assignments.map((row) => (
                          <tr key={row.reference} className="border-b border-border/70">
                            <td className="py-2.5 pr-3 font-medium">{row.reference}</td>
                            <td className="py-2.5 pr-3">{row.deviceLabel}</td>
                            <td className="py-2.5 pr-3">{row.serviceType}</td>
                            <td className="py-2.5 pr-3 text-muted-foreground">
                              {row.assigneeName ?? "—"}
                            </td>
                            <td className="py-2.5 pr-3">
                              <StatusPill
                                tone="muted"
                                label={t(`displayState_${row.displayState}` as "displayState_erfasst")}
                              />
                            </td>
                            <td className="py-2.5">{row.scheduledAt ?? "—"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 border-l-2 border-primary/40 pl-3 text-xs leading-relaxed text-muted-foreground">
                  {t("detailAssignmentsNote")}
                </p>
              </Section>
            </div>
          </ListPageShell>
        ) : null}
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

function MasterRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1.5">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

function StatusPill({
  tone,
  label,
}: {
  tone: "ok" | "warn" | "danger" | "muted";
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-0.5 text-xs font-medium",
        tone === "ok" && "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
        tone === "warn" && "bg-amber-500/15 text-amber-900 dark:text-amber-200",
        tone === "danger" && "bg-destructive/15 text-destructive",
        tone === "muted" && "bg-muted text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}
