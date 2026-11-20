"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AccessDenied } from "@/components/features/shared/AccessDenied";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { RepairDeviceSearchSelect } from "@/components/features/repairs/RepairDeviceSearchSelect";
import type { RepairDeviceOption } from "@/components/hooks/repairs/useRepairDeviceOptions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/apiClient";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { toast } from "@/store/toastStore";
import type { ConsoleClinicDTO } from "@/interfaces/console";

type ClinicList = { clinics: ConsoleClinicDTO[] };
type DeviceRow = {
  id: string;
  label: string;
  manufacturer: string | null;
};
type Assignee = { userId: string; name: string };

type Consequence = "out_of_service" | "restricted" | "usable";
type Urgency = "immediate" | "with_next_due" | "at_appointment";
type Fulfilment = "on_site" | "send_in" | "external";
type Reason = "stoerung" | "instandsetzung" | "faelligkeit" | "befund" | "rueckruf";

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `partner-order:${crypto.randomUUID()}`;
  }
  return `partner-order:${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Partner console — Auftrag anlegen (phone-path create order). */
export function CreateOrderScreen() {
  const t = useTranslations("repairs.createOrder");
  const router = useRouter();
  const { checkPermission, permissionsLoading } = usePermissions();
  const canCreate = checkPermission("console:disposition:assign");

  const [clinics, setClinics] = useState<ConsoleClinicDTO[]>([]);
  const [contractId, setContractId] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [deviceInstanceId, setDeviceInstanceId] = useState("");
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [serviceType, setServiceType] = useState("repair");
  const [reason, setReason] = useState<Reason>("stoerung");
  const [faultDescription, setFaultDescription] = useState("");
  const [faultSince, setFaultSince] = useState(() => new Date().toISOString().slice(0, 10));
  const [faultConsequence, setFaultConsequence] = useState<Consequence>("restricted");
  const [faultReportedBy, setFaultReportedBy] = useState("");
  const [urgency, setUrgency] = useState<Urgency>("with_next_due");
  const [fulfilment, setFulfilment] = useState<Fulfilment>("on_site");
  const [workshopName, setWorkshopName] = useState("");
  const [externalOrgName, setExternalOrgName] = useState("");
  const [externalCommissionedAt, setExternalCommissionedAt] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [appointmentAt, setAppointmentAt] = useState("");
  const [assigneeUserId, setAssigneeUserId] = useState("");
  const [saving, setSaving] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  const faultRequired = reason === "stoerung";

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await api<ClinicList>("/api/partner/clinics");
        if (!cancelled) setClinics(list.clinics.filter((c) => c.live));
      } catch {
        if (!cancelled) setClinics([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadDevices = useCallback(async (cid: string) => {
    if (!cid) {
      setDevices([]);
      setTenantId("");
      return;
    }
    setDevicesLoading(true);
    try {
      const res = await api<{ tenantId: string; devices: DeviceRow[] }>(
        `/api/partner/clinics/${encodeURIComponent(cid)}/devices`,
      );
      setTenantId(res.tenantId);
      setDevices(res.devices);
    } catch {
      setDevices([]);
    } finally {
      setDevicesLoading(false);
    }
  }, []);

  useEffect(() => {
    setDeviceInstanceId("");
    void loadDevices(contractId);
  }, [contractId, loadDevices]);

  useEffect(() => {
    if (!tenantId) {
      setAssignees([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const data = await api<{ assignees: Assignee[] }>(
          `/api/partner/disposition/assignees?tenantId=${encodeURIComponent(tenantId)}`,
        );
        if (!cancelled) setAssignees(data.assignees);
      } catch {
        if (!cancelled) setAssignees([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const deviceOptions: RepairDeviceOption[] = useMemo(
    () => devices.map((d) => ({ id: d.id, label: d.label })),
    [devices],
  );

  if (permissionsLoading) {
    return (
      <div className="p-work" data-testid="create-order-loading">
        <main className="p-main">
          <ListPageShell variant="compose" title={t("title")}>
            <p className="text-sm text-muted-foreground">…</p>
          </ListPageShell>
        </main>
      </div>
    );
  }

  if (!canCreate) {
    return <AccessDenied title={t("title")} testId="create-order-denied" />;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantId || !deviceInstanceId) {
      toast.error(t("errorRequired"));
      return;
    }
    setSaving(true);
    setResultMsg(null);
    try {
      const res = await api<{
        request: { reference: string } | null;
        created: boolean;
        clarificationId: string | null;
        entryId: string | null;
        gateHint: boolean;
      }>("/api/partner/orders", {
        method: "POST",
        body: JSON.stringify({
          idempotencyKey: newIdempotencyKey(),
          tenantId,
          deviceInstanceId,
          serviceType,
          reason,
          fulfilment,
          urgency,
          faultDescription: faultRequired ? faultDescription.trim() : null,
          faultSince: faultRequired ? faultSince : null,
          faultConsequence: faultRequired ? faultConsequence : null,
          faultReportedBy: faultRequired ? faultReportedBy.trim() : null,
          photoDataUrl: null,
          workshopName: fulfilment === "send_in" ? workshopName.trim() : null,
          externalOrgName: fulfilment === "external" ? externalOrgName.trim() : null,
          externalCommissionedAt:
            fulfilment === "external" ? externalCommissionedAt : null,
          appointmentAt:
            fulfilment === "on_site" && appointmentAt
              ? new Date(`${appointmentAt}T12:00:00`).toISOString()
              : null,
          assigneeUserId: fulfilment === "external" ? null : assigneeUserId || null,
          note: null,
        }),
      });

      if (res.gateHint) toast.success(t("gateHint"));

      if (res.request?.reference) {
        const msg = t("createdOrder", { ref: res.request.reference });
        setResultMsg(msg);
        toast.success(msg);
        router.push(`/partner/orders/${encodeURIComponent(res.request.reference)}`);
        return;
      }
      if (res.clarificationId) {
        const msg = t("createdTriage");
        setResultMsg(msg);
        toast.success(msg);
        return;
      }
      const msg = t("createdBookOnly");
      setResultMsg(msg);
      toast.success(msg);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-work" data-testid="create-order-page">
      <main className="p-main">
        <ListPageShell
          variant="compose"
          title={t("title")}
          description={t("subtitle")}
          headerExtra={
            <Button asChild variant="outline" size="sm" className="h-8">
              <Link href="/partner/orders?tab=disposition">{t("back")}</Link>
            </Button>
          }
        >
          <p className="mb-4 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {t("cardTitle")}
          </p>

          <form className="w-full space-y-4" onSubmit={onSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="create-order-clinic">{t("clinic")}</Label>
                <select
                  id="create-order-clinic"
                  className={selectClass}
                  value={contractId}
                  onChange={(e) => {
                    const next = e.target.value;
                    setContractId(next);
                    const clinic = clinics.find((c) => c.contractId === next);
                    setTenantId(clinic?.tenantId ?? "");
                  }}
                  required
                  data-testid="create-order-clinic"
                >
                  <option value="">{t("clinicPlaceholder")}</option>
                  {clinics.map((c) => (
                    <option key={c.contractId} value={c.contractId}>
                      {c.tenantName}
                      {c.city ? ` · ${c.city}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="create-order-device">{t("device")}</Label>
                <RepairDeviceSearchSelect
                  id="create-order-device"
                  options={deviceOptions}
                  value={deviceInstanceId}
                  onChange={setDeviceInstanceId}
                  disabled={!contractId}
                  disabledPlaceholder={t("deviceNeedsClinic")}
                  loading={Boolean(contractId) && devicesLoading}
                  required
                  data-testid="create-order-device"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="create-order-service">{t("serviceType")}</Label>
                <select
                  id="create-order-service"
                  className={selectClass}
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                >
                  <option value="repair">{t("serviceRepair")}</option>
                  <option value="post_repair_check">{t("servicePostRepair")}</option>
                  <option value="STK">STK</option>
                  <option value="MTK">MTK</option>
                  <option value="DGUV">DGUV</option>
                  <option value="OTHER">{t("serviceOther")}</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="create-order-reason">{t("reason")}</Label>
                <select
                  id="create-order-reason"
                  className={selectClass}
                  value={reason}
                  onChange={(e) => setReason(e.target.value as Reason)}
                >
                  <option value="stoerung">{t("reasonStoerung")}</option>
                  <option value="instandsetzung">{t("reasonInstandsetzung")}</option>
                  <option value="faelligkeit">{t("reasonFaelligkeit")}</option>
                  <option value="befund">{t("reasonBefund")}</option>
                  <option value="rueckruf">{t("reasonRueckruf")}</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-order-fault">{t("faultDescription")}</Label>
              <Input
                id="create-order-fault"
                value={faultDescription}
                onChange={(e) => setFaultDescription(e.target.value)}
                placeholder={t("faultDescriptionPlaceholder")}
                required={faultRequired}
                data-testid="create-order-fault"
              />
              <p className="text-xs text-muted-foreground">{t("faultDescriptionHint")}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="create-order-since">{t("faultSince")}</Label>
                <Input
                  id="create-order-since"
                  type="date"
                  value={faultSince}
                  onChange={(e) => setFaultSince(e.target.value)}
                  required={faultRequired}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="create-order-consequence">{t("faultConsequence")}</Label>
                <select
                  id="create-order-consequence"
                  className={selectClass}
                  value={faultConsequence}
                  onChange={(e) => setFaultConsequence(e.target.value as Consequence)}
                >
                  <option value="out_of_service">{t("outOfService")}</option>
                  <option value="restricted">{t("restricted")}</option>
                  <option value="usable">{t("usable")}</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-order-reported">{t("faultReportedBy")}</Label>
              <Input
                id="create-order-reported"
                value={faultReportedBy}
                onChange={(e) => setFaultReportedBy(e.target.value)}
                placeholder={t("reportedByPlaceholder")}
                required={faultRequired}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("fulfilment")}</Label>
              <div
                className="p-create-order__seg"
                role="group"
                aria-label={t("fulfilment")}
                data-testid="create-order-fulfilment"
              >
                {(
                  [
                    ["on_site", t("fulfilmentOnSite")],
                    ["send_in", t("fulfilmentSendIn")],
                    ["external", t("fulfilmentExternal")],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={fulfilment === value}
                    className={
                      fulfilment === value
                        ? "p-create-order__seg-btn is-on"
                        : "p-create-order__seg-btn"
                    }
                    onClick={() => setFulfilment(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="create-order-urgency">{t("urgency")}</Label>
                <select
                  id="create-order-urgency"
                  className={selectClass}
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value as Urgency)}
                >
                  <option value="immediate">{t("urgencyImmediate")}</option>
                  <option value="with_next_due">{t("urgencyNextDue")}</option>
                  <option value="at_appointment">{t("urgencyAppointment")}</option>
                </select>
              </div>

              {fulfilment === "send_in" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="create-order-workshop">{t("workshop")}</Label>
                  <Input
                    id="create-order-workshop"
                    value={workshopName}
                    onChange={(e) => setWorkshopName(e.target.value)}
                    required
                    data-testid="create-order-workshop"
                  />
                </div>
              ) : fulfilment === "external" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="create-order-external-org">{t("externalOrg")}</Label>
                  <Input
                    id="create-order-external-org"
                    value={externalOrgName}
                    onChange={(e) => setExternalOrgName(e.target.value)}
                    required
                    data-testid="create-order-external-org"
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="create-order-appointment">{t("appointmentOptional")}</Label>
                  <Input
                    id="create-order-appointment"
                    type="date"
                    value={appointmentAt}
                    onChange={(e) => setAppointmentAt(e.target.value)}
                    required={urgency === "at_appointment"}
                  />
                </div>
              )}
            </div>

            {fulfilment === "external" ? (
              <div className="space-y-1.5">
                <Label htmlFor="create-order-external-at">{t("externalCommissionedAt")}</Label>
                <Input
                  id="create-order-external-at"
                  type="date"
                  value={externalCommissionedAt}
                  onChange={(e) => setExternalCommissionedAt(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">{t("externalOrgHint")}</p>
              </div>
            ) : null}

            {fulfilment === "send_in" ? (
              <p className="text-xs text-muted-foreground">{t("workshopHint")}</p>
            ) : null}

            {fulfilment !== "external" ? (
              <div className="space-y-1.5">
                <Label htmlFor="create-order-assignee">{t("assigneeOptional")}</Label>
                <select
                  id="create-order-assignee"
                  className={selectClass}
                  value={assigneeUserId}
                  onChange={(e) => setAssigneeUserId(e.target.value)}
                  disabled={!contractId}
                >
                  <option value="">{t("assigneeNone")}</option>
                  {assignees.map((a) => (
                    <option key={a.userId} value={a.userId}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">{t("assigneeGateHint")}</p>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <Button asChild type="button" variant="outline">
                <Link href="/partner/orders?tab=disposition">{t("cancel")}</Link>
              </Button>
              <Button type="submit" disabled={saving} data-testid="create-order-submit">
                {saving ? t("saving") : t("submit")}
              </Button>
            </div>

            {resultMsg ? (
              <p className="text-sm text-muted-foreground" role="status">
                {resultMsg}
              </p>
            ) : null}
          </form>
        </ListPageShell>
      </main>
    </div>
  );
}
