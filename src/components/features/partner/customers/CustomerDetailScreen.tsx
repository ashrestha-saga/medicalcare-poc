"use client";

import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CONTRACT_SCOPE_TOKENS } from "@/constants/partnerPermissions";
import { useCustomerDetail } from "@/components/hooks/partner/customers/useCustomerDetail";
import {
  ContractLifecycleConfirmDialog,
  type ContractLifecycleConfirmAction,
} from "@/components/features/partner/customers/ContractLifecycleConfirmDialog";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/Loading";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { useQueryParam, useSyncQueryParams } from "@/lib/navigation/searchParams";
import { api } from "@/lib/http/apiClient";
import type { SetupProgressDTO, SetupStepDTO } from "@/services/setup/setupProgressService";
import type { ConsoleClinicDetailDTO } from "@/interfaces/console";
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

const SCOPE_HINT_KEYS: Record<
  string,
  | "scopeHintInventory"
  | "scopeHintDueDates"
  | "scopeHintInspection"
  | "scopeHintReprocessing"
  | "scopeHintTraining"
> = {
  inventory: "scopeHintInventory",
  "due-dates": "scopeHintDueDates",
  inspection: "scopeHintInspection",
  reprocessing: "scopeHintReprocessing",
  training: "scopeHintTraining",
};

const NEVER_RIGHTS = [
  { id: "reprocessing:release", titleKey: "neverRightRelease", hintKey: "neverRightReleaseHint" },
  { id: "authority:view", titleKey: "neverRightAuthority", hintKey: "neverRightAuthorityHint" },
  { id: "devicebook:view", titleKey: "neverRightDeviceBook", hintKey: "neverRightDeviceBookHint" },
  { id: "incidents:view", titleKey: "neverRightIncidents", hintKey: "neverRightIncidentsHint" },
  { id: "roles:view", titleKey: "neverRightRoles", hintKey: "neverRightRolesHint" },
] as const;

const ROLE_LABEL: Record<
  string,
  | "detailRoleAdmin"
  | "staffRoleServiceLead"
  | "detailRoleInspector"
  | "detailRoleOrder"
  | "staffRoleManagement"
> = {
  admin: "detailRoleAdmin",
  service_lead: "staffRoleServiceLead",
  inspector: "detailRoleInspector",
  order: "detailRoleOrder",
  management: "staffRoleManagement",
};

const ACCESS_LABEL: Record<
  string,
  | "accessAdmin"
  | "staffRoleServiceLead"
  | "accessInspector"
  | "accessOrder"
  | "staffRoleManagement"
> = {
  admin: "accessAdmin",
  service_lead: "staffRoleServiceLead",
  inspector: "accessInspector",
  order: "accessOrder",
  management: "staffRoleManagement",
};

type DetailTab = "overview" | "contract" | "sites" | "handover";

function parseTab(raw: string | null): DetailTab {
  if (raw === "contract" || raw === "sites" || raw === "handover" || raw === "overview") return raw;
  return "overview";
}

function CustomerDetailBody({ contractId }: { contractId: string }) {
  const t = useTranslations("console");
  const tSetup = useTranslations("commissioning");
  const tCommon = useTranslations("common");
  const { checkPermission } = usePermissions();
  const canUpdate = checkPermission("console:contracts:update");
  const canLifecycle = checkPermission("console:contracts:lifecycle");
  const canAssignStaff = checkPermission("console:staff:assign");
  const detail = useCustomerDetail(contractId);
  const tabParam = useQueryParam("tab");
  const { sync } = useSyncQueryParams();
  const [tab, setTabState] = useState<DetailTab>(() => parseTab(tabParam));
  const [confirmAction, setConfirmAction] = useState<ContractLifecycleConfirmAction | null>(null);
  const [setup, setSetup] = useState<SetupProgressDTO | null>(null);
  const [setupLive, setSetupLive] = useState(true);
  const [setupLoading, setSetupLoading] = useState(false);

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

  useEffect(() => {
    setTabState(parseTab(tabParam));
  }, [tabParam]);

  const setTab = (next: DetailTab) => {
    setTabState(next);
    sync({ tab: next === "overview" ? null : next });
  };

  useEffect(() => {
    if (!clinic?.live) {
      setSetup(null);
      setSetupLive(false);
      return;
    }
    let cancelled = false;
    setSetupLoading(true);
    void api<{ live: boolean; progress: SetupProgressDTO | null }>(
      `/api/partner/clinics/${contractId}/setup`,
    )
      .then((res) => {
        if (cancelled) return;
        setSetupLive(res.live);
        setSetup(res.progress);
      })
      .catch(() => {
        if (!cancelled) {
          setSetup(null);
          setSetupLive(false);
        }
      })
      .finally(() => {
        if (!cancelled) setSetupLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clinic?.live, contractId]);

  async function confirmLifecycle() {
    if (!confirmAction) return;
    const ok = await lifecycle(confirmAction);
    if (ok) setConfirmAction(null);
  }

  const showHandover = Boolean(clinic?.validTo || clinic?.terminatedAt || clinic?.suspendedAt);

  const tabs = useMemo(() => {
    const items: { id: DetailTab; label: string; warn?: boolean }[] = [
      { id: "overview", label: t("detailTabOverview") },
      { id: "contract", label: t("detailTabContract") },
      {
        id: "sites",
        label: t("detailTabSites", { count: clinic?.siteCount ?? 0 }),
      },
    ];
    if (showHandover) items.push({ id: "handover", label: t("detailTabHandover"), warn: true });
    return items;
  }, [clinic?.siteCount, showHandover, t]);

  const stateLabel = clinic
    ? clinic.terminatedAt
      ? t("statusTerminated")
      : clinic.suspendedAt
        ? t("statusSuspended")
        : clinic.live
          ? t("stateRunning")
          : t("ended")
    : "";

  const openOrders =
    clinic?.assignments.filter((a) =>
      ["erfasst", "zugewiesen", "terminiert", "uebermittelt", "uebergeben", "warteschlange"].includes(
        a.displayState,
      ),
    ).length ?? 0;

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
            contentClassName="max-w-none"
          >
            <p className="mb-3">
              <Link
                href="/partner/customers"
                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                ← {t("backToCustomers")}
              </Link>
            </p>

            <div
              className="mb-5 flex flex-wrap gap-1 border-b border-border"
              role="tablist"
              aria-label={clinic.tenantName}
            >
              {tabs.map((item) => {
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    data-testid={`customer-tab-${item.id}`}
                    className={cn(
                      "-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm transition-colors",
                      active
                        ? "border-primary font-semibold text-foreground"
                        : "border-transparent font-medium text-muted-foreground hover:text-foreground",
                      item.warn && !active && "text-amber-800",
                    )}
                    onClick={() => setTab(item.id)}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            {tab === "overview" ? (
              <div className="grid gap-5">
                <SetupCard
                  live={setupLive}
                  loading={setupLoading}
                  progress={setup}
                  t={t}
                  tSetup={tSetup}
                  onGo={(href) => openBackoffice(href)}
                />
                <Section title={t("detailSectionKpis")}>
                  <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    <Kpi label={t("colDevices")} value={clinic.deviceCount} />
                    <Kpi label={t("colSites")} value={clinic.siteCount} />
                    <Kpi
                      label={t("kpiOverdue")}
                      value={clinic.overdueDuties ?? 0}
                      warn={(clinic.overdueDuties ?? 0) > 0}
                    />
                    <Kpi
                      label={t("kpiMpsb")}
                      value={clinic.openMpsb ?? 0}
                      warn={(clinic.openMpsb ?? 0) > 0}
                    />
                    <Kpi label={t("detailKpiOpenOrders")} value={openOrders} />
                    <Kpi label={t("detailKpiStaff")} value={clinic.staff.filter((s) => s.assigned).length} />
                  </div>
                </Section>
                <AssignmentsCard clinic={clinic} t={t} />
              </div>
            ) : null}

            {tab === "contract" ? (
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
                      {t("fieldScopeRights")}
                    </p>
                    <div className="divide-y divide-border/70">
                      {CONTRACT_SCOPE_TOKENS.map((token) => (
                        <label key={token} className="flex items-start gap-3 py-2.5 text-sm">
                          <Checkbox
                            className="mt-0.5"
                            checked={scope.includes(token)}
                            disabled={!canUpdate || busy}
                            onCheckedChange={() => toggleScope(token)}
                          />
                          <span className="min-w-0">
                            <span className="block font-semibold">
                              {t(SCOPE_KEYS[token] ?? "scopeInventory")}
                              <code className="ml-2 font-mono text-[10.5px] font-medium text-muted-foreground">
                                {token}
                              </code>
                            </span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {t(SCOPE_HINT_KEYS[token] ?? "scopeHintInventory")}
                            </span>
                          </span>
                        </label>
                      ))}
                      {NEVER_RIGHTS.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-start gap-3 py-2.5 text-sm opacity-80"
                          data-nie="1"
                        >
                          <span className="mt-0.5 shrink-0 rounded bg-destructive/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-destructive">
                            {t("scopeNever")}
                          </span>
                          <span className="min-w-0">
                            <span className="block font-semibold">
                              {t(r.titleKey)}
                              <code className="ml-2 font-mono text-[10.5px] font-medium text-muted-foreground">
                                {r.id}
                              </code>
                            </span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {t(r.hintKey)}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{t("fieldScopeRightsHint")}</p>
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
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <MasterRow label={t("colSites")} value={String(clinic.siteCount)} />
                  <MasterRow label={t("colDevices")} value={String(clinic.deviceCount)} />
                  <div className="grid gap-1.5">
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("colStatus")}
                    </dt>
                    <dd>
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
                    </dd>
                  </div>
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
                      onClick={() => setConfirmAction("suspend")}
                      data-testid="contract-suspend"
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
                      onClick={() => setConfirmAction("terminate")}
                      data-testid="contract-terminate"
                    >
                      {t("contractTerminate")}
                    </Button>
                  ) : null}
                  {clinic.live ? (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => openBackoffice()}
                      data-testid="open-backoffice"
                    >
                      {t("openBackoffice")}
                    </Button>
                  ) : null}
                </div>
                <Alert className="mt-4">
                  <AlertDescription>
                    {operatingModel === "institution_operated"
                      ? t("detailModelInstitutionNote")
                      : t("detailAccessBanner")}
                  </AlertDescription>
                </Alert>
              </Section>
            ) : null}

            {tab === "sites" ? (
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
                        {clinic.operatingModel !== "provider_operated" ? (
                          <span className="text-sm text-muted-foreground">{t("detailAvvNotRequired")}</span>
                        ) : clinic.avvMissing ? (
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

                <Section title={t("detailSectionSites", { count: clinic.siteCount })}>
                  {clinic.siteNames.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("detailSitesEmpty")}</p>
                  ) : (
                    <ul className="divide-y divide-border/70 text-sm">
                      {clinic.siteNames.map((name) => (
                        <li key={name} className="py-2">
                          {name}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-3 text-xs text-muted-foreground">{t("detailSitesHint")}</p>
                </Section>

                <StaffCard
                  clinic={clinic}
                  t={t}
                  canAssignStaff={canAssignStaff}
                  busy={busy}
                  setStaffAssigned={setStaffAssigned}
                />
              </div>
            ) : null}

            {tab === "handover" && showHandover ? (
              <Section title={t("detailSectionHandover")}>
                <p className="mb-4 text-sm text-muted-foreground">
                  {t("detailHandoverIntro", {
                    date: clinic.validTo || clinic.terminatedAt?.slice(0, 10) || "—",
                  })}
                </p>
                <div className="grid gap-3">
                  {[
                    { title: t("handoverExport"), body: t("handoverExportBody") },
                    { title: t("handoverData"), body: t("handoverDataBody") },
                    { title: t("handoverE9"), body: t("handoverE9Body") },
                  ].map((step) => (
                    <div key={step.title} className="rounded-md border border-border p-3">
                      <div className="font-semibold text-sm">{step.title}</div>
                      <p className="mt-1 text-xs text-muted-foreground">{step.body}</p>
                      <Button type="button" size="sm" className="mt-3 h-8" disabled>
                        {t("handoverRun")}
                      </Button>
                    </div>
                  ))}
                  <div className="rounded-md border border-border bg-muted/30 p-3">
                    <div className="font-semibold text-sm">
                      {t("handoverAccessEnds", {
                        date: clinic.validTo || clinic.terminatedAt?.slice(0, 10) || "—",
                      })}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{t("detailAccessBanner")}</p>
                  </div>
                </div>
              </Section>
            ) : null}
          </ListPageShell>
        ) : null}
        <ContractLifecycleConfirmDialog
          action={confirmAction}
          tenantName={clinic?.tenantName ?? ""}
          busy={busy}
          onClose={() => setConfirmAction(null)}
          onConfirm={() => void confirmLifecycle()}
        />
      </main>
    </div>
  );
}

function SetupCard({
  live,
  loading,
  progress,
  t,
  tSetup,
  onGo,
}: {
  live: boolean;
  loading: boolean;
  progress: SetupProgressDTO | null;
  t: ReturnType<typeof useTranslations<"console">>;
  tSetup: ReturnType<typeof useTranslations<"commissioning">>;
  onGo: (href: string) => void;
}) {
  if (!live) {
    return (
      <Section title={t("detailSetupTitle")}>
        <p className="text-sm text-muted-foreground">{t("detailSetupNoContract")}</p>
      </Section>
    );
  }
  if (loading) {
    return (
      <Section title={t("detailSetupTitle")}>
        <p className="text-sm text-muted-foreground">…</p>
      </Section>
    );
  }
  if (!progress) {
    return (
      <Section title={t("detailSetupTitle")}>
        <p className="text-sm text-muted-foreground">{t("detailSetupLoadFailed")}</p>
      </Section>
    );
  }
  const pct = Math.round((100 * progress.done) / Math.max(1, progress.total));
  return (
    <Section title={t("detailSetupProgress", { done: progress.done, total: progress.total })}>
      <div className="flex max-w-md items-center gap-2">
        <div className="h-1.5 min-w-[60px] flex-1 overflow-hidden rounded-sm bg-muted">
          <i
            className={cn(
              "block h-full rounded-sm",
              progress.complete ? "bg-emerald-600" : "bg-primary",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <b className="font-mono text-[11px] font-medium text-muted-foreground">
          {progress.done} / {progress.total}
        </b>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{t("detailSetupHint")}</p>
      <div className="p-setup__grid mt-3">
        {progress.steps.map((step, index) => (
          <SetupStep
            key={step.id}
            step={step}
            index={index}
            tSetup={tSetup}
            t={t}
            onGo={onGo}
          />
        ))}
      </div>
      {progress.complete ? (
        <Alert className="mt-4" data-t="ok">
          <AlertDescription>{t("detailSetupComplete")}</AlertDescription>
        </Alert>
      ) : null}
    </Section>
  );
}

function SetupStep({
  step,
  index,
  tSetup,
  t,
  onGo,
}: {
  step: SetupStepDTO;
  index: number;
  tSetup: ReturnType<typeof useTranslations<"commissioning">>;
  t: ReturnType<typeof useTranslations<"console">>;
  onGo: (href: string) => void;
}) {
  const title = tSetup(`steps.${step.titleKey}` as "steps.sites");
  const why = tSetup(`why.${step.whyKey}` as "why.sitesOk", step.whyParams ?? {});
  return (
    <div className="p-setup-step border-border bg-card" data-s={step.status}>
      <span className="p-setup-step__n" aria-hidden>
        {step.status === "ok" ? "✓" : index + 1}
      </span>
      <div className="min-w-0">
        <b className="p-setup-step__title text-foreground">{title}</b>
        <p className="p-setup-step__why text-muted-foreground">{why}</p>
        {step.status === "open" ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => onGo(step.href)}>
              {t("detailSetupGo")}
            </Button>
            <small className="text-[11px] text-muted-foreground">{t("detailSetupGoHint")}</small>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AssignmentsCard({
  clinic,
  t,
}: {
  clinic: ConsoleClinicDetailDTO;
  t: ReturnType<typeof useTranslations<"console">>;
}) {
  return (
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
                  <td className="py-2.5 pr-3 font-mono text-[12.5px] font-medium">{row.reference}</td>
                  <td className="py-2.5 pr-3">{row.deviceLabel}</td>
                  <td className="py-2.5 pr-3">{row.serviceType}</td>
                  <td className="py-2.5 pr-3 text-muted-foreground">{row.assigneeName ?? "—"}</td>
                  <td className="py-2.5 pr-3">
                    <StatusPill
                      tone="muted"
                      label={t(`displayState_${row.displayState}` as "displayState_erfasst")}
                    />
                  </td>
                  <td className="py-2.5 whitespace-nowrap font-mono text-[12px]">
                    {row.scheduledAt
                      ? new Date(row.scheduledAt).toLocaleString(undefined, {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </td>
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
  );
}

function StaffCard({
  clinic,
  t,
  canAssignStaff,
  busy,
  setStaffAssigned,
}: {
  clinic: ConsoleClinicDetailDTO;
  t: ReturnType<typeof useTranslations<"console">>;
  canAssignStaff: boolean;
  busy: boolean;
  setStaffAssigned: (membershipId: string, assigned: boolean) => Promise<void>;
}) {
  return (
    <Section title={t("detailSectionStaff")}>
      <p className="mb-3 text-xs text-muted-foreground">{t("detailStaffIntro")}</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="py-2 pr-3 font-semibold">{t("detailColStaff")}</th>
              <th className="py-2 pr-3 font-semibold">{t("detailColRole")}</th>
              <th className="py-2 pr-3 font-semibold">{t("staffColQualification")}</th>
              <th className="py-2 pr-3 font-semibold">{t("detailColAccess")}</th>
              <th className="py-2 font-semibold" />
            </tr>
          </thead>
          <tbody>
            {clinic.staff.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-3 text-muted-foreground">
                  {t("detailStaffEmpty")}
                </td>
              </tr>
            ) : (
              clinic.staff.map((row) => (
                <tr
                  key={row.membershipId}
                  className={cn("border-b border-border/70", !row.assigned && "opacity-55")}
                >
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
                    {row.qualifications.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {row.qualifications.map((q) => (
                          <span
                            key={q.id}
                            className="inline-block rounded-md border-transparent bg-[rgba(47,217,138,0.12)] px-2 py-0.5 text-[10px] text-[var(--green)]"
                          >
                            {q.label}
                          </span>
                        ))}
                      </div>
                    )}
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
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <h2 className="border-b border-border px-4 py-3 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:px-5">
        {title}
      </h2>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function MasterRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1.5">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

function Kpi({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={cn("mt-1 text-2xl font-semibold tabular-nums", warn && "text-destructive")}>
        {value}
      </div>
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

export function CustomerDetailScreen({ contractId }: { contractId: string }) {
  return (
    <Suspense fallback={<div className="p-work p-4 text-sm text-muted-foreground">…</div>}>
      <CustomerDetailBody contractId={contractId} />
    </Suspense>
  );
}
