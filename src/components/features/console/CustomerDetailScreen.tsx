"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ConsoleClinicDetailDTO, OperatingModel } from "@/interfaces/console";
import { CONTRACT_SCOPE_TOKENS } from "@/constants/partnerPermissions";
import { api, ApiError } from "@/lib/http/apiClient";
import { useActingTenantStore } from "@/store/actingTenantStore";
import { toast } from "@/store/toastStore";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/Loading";
import { usePermissions } from "@/lib/providers/PermissionProvider";

const SCOPE_KEYS: Record<string, "scopeInventory" | "scopeDueDates" | "scopeInspection"> = {
  inventory: "scopeInventory",
  "due-dates": "scopeDueDates",
  inspection: "scopeInspection",
};

export function CustomerDetailScreen({ contractId }: { contractId: string }) {
  const t = useTranslations("console");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const setActingTenant = useActingTenantStore((s) => s.setActingTenant);
  const { checkPermission } = usePermissions();
  const canUpdate = checkPermission("console:contracts:update");
  const canLifecycle = checkPermission("console:contracts:lifecycle");
  const [clinic, setClinic] = useState<ConsoleClinicDetailDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [validFrom, setValidFrom] = useState("");
  const [validTo, setValidTo] = useState("");
  const [billingRef, setBillingRef] = useState("");
  const [operatingModel, setOperatingModel] = useState<OperatingModel>("provider_operated");
  const [scope, setScope] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ clinic: ConsoleClinicDetailDTO }>(`/api/partner/clinics/${contractId}`);
      setClinic(res.clinic);
      setValidFrom(res.clinic.validFrom);
      setValidTo(res.clinic.validTo ?? "");
      setBillingRef(res.clinic.billingRef ?? "");
      setOperatingModel(res.clinic.operatingModel as OperatingModel);
      setScope(res.clinic.scope);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("detailLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [contractId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setBusy(true);
    try {
      const res = await api<{ clinic: ConsoleClinicDetailDTO }>(`/api/partner/clinics/${contractId}`, {
        method: "PATCH",
        body: JSON.stringify({
          validFrom,
          validTo: validTo || null,
          billingRef: billingRef || null,
          operatingModel,
          scope,
        }),
      });
      setClinic(res.clinic);
      toast.success(t("contractSaved"));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("contractSaveFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function lifecycle(action: "suspend" | "resume" | "terminate") {
    setBusy(true);
    try {
      await api(`/api/partner/contracts/${contractId}/${action}`, { method: "POST" });
      toast.success(t(`lifecycle_${action}` as "lifecycle_suspend"));
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("lifecycleFailed"));
    } finally {
      setBusy(false);
    }
  }

  function openBackoffice() {
    if (!clinic?.live) return;
    setActingTenant({
      tenantId: clinic.tenantId,
      tenantName: clinic.tenantName,
      tenantCode: clinic.tenantCode,
      contractId: clinic.contractId,
    });
    router.push("/");
  }

  function toggleScope(token: string) {
    setScope((prev) => (prev.includes(token) ? prev.filter((s) => s !== token) : [...prev, token]));
  }

  return (
    <div className="p-work" data-testid="console-customer-detail">
      <main className="p-main">
        <p className="mb-3">
          <Link href="/partner/customers" className="text-sm text-primary underline-offset-4 hover:underline">
            ← {t("backToCustomers")}
          </Link>
        </p>
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
            <section className="grid max-w-2xl gap-4 rounded-md border border-border p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {t("contractCard")}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label>{t("fieldValidFrom")}</Label>
                  <Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label>{t("fieldValidTo")}</Label>
                  <Input type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} />
                </div>
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label>{t("fieldModel")}</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-border bg-transparent px-3 text-sm"
                    value={operatingModel}
                    onChange={(e) => setOperatingModel(e.target.value as OperatingModel)}
                  >
                    <option value="provider_operated">{t("modelProvider")}</option>
                    <option value="institution_operated">{t("modelInstitution")}</option>
                  </select>
                </div>
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label>{t("fieldBilling")}</Label>
                  <Input value={billingRef} onChange={(e) => setBillingRef(e.target.value)} />
                </div>
              </div>
              <fieldset>
                <legend className="mb-2 text-sm font-medium">{t("fieldScope")}</legend>
                <div className="grid gap-2">
                  {CONTRACT_SCOPE_TOKENS.map((token) => (
                    <label key={token} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={scope.includes(token)} onCheckedChange={() => toggleScope(token)} />
                      {t(SCOPE_KEYS[token] ?? "scopeInventory")}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>
                  {t("colSites")}: {clinic.siteCount}
                </span>
                <span>
                  {t("colDevices")}: {clinic.deviceCount}
                </span>
                <span>
                  {clinic.live ? t("active") : clinic.terminatedAt ? t("statusTerminated") : clinic.suspendedAt ? t("statusSuspended") : t("ended")}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                {canUpdate ? (
                  <Button type="button" disabled={busy} onClick={() => void save()} data-testid="contract-save">
                    {busy ? tCommon("loading") : t("contractSave")}
                  </Button>
                ) : null}
                {canLifecycle && clinic.live && !clinic.suspendedAt ? (
                  <Button type="button" variant="outline" disabled={busy} onClick={() => void lifecycle("suspend")}>
                    {t("contractSuspend")}
                  </Button>
                ) : null}
                {canLifecycle && clinic.suspendedAt && !clinic.terminatedAt ? (
                  <Button type="button" variant="outline" disabled={busy} onClick={() => void lifecycle("resume")}>
                    {t("contractResume")}
                  </Button>
                ) : null}
                {canLifecycle && !clinic.terminatedAt ? (
                  <Button type="button" variant="destructive" disabled={busy} onClick={() => void lifecycle("terminate")}>
                    {t("contractTerminate")}
                  </Button>
                ) : null}
                {clinic.live ? (
                  <Button type="button" variant="secondary" disabled={busy} onClick={openBackoffice} data-testid="open-backoffice">
                    {t("openBackoffice")}
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">{t("contractEndNote")}</p>
            </section>
          </ListPageShell>
        ) : null}
      </main>
    </div>
  );
}
