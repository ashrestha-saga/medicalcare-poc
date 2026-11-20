"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/textarea";
import {
  POST_REPAIR_CHECK_SERVICE_TYPE,
  REPAIR_SERVICE_TYPE,
  canonicalServiceType,
} from "@/constants/repairs";
import { api } from "@/lib/apiClient";
import { displayEuroText, formatEuroPlain, normalizeEuroText, parseEuro } from "@/lib/euro";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { useActingTenantStore } from "@/store/actingTenantStore";
import { toast } from "@/store/toastStore";
import type { PartnerOrderDetailDTO } from "@/services/repairs/partnerOrderDetailService";

type Props = { reference: string };

type Tone = "default" | "secondary" | "outline" | "success" | "warning" | "destructive";

function Section({
  title,
  children,
  testId,
  className,
}: {
  title: string;
  children: ReactNode;
  testId?: string;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border border-border bg-card p-4 sm:p-5",
        className,
      )}
      data-testid={testId}
    >
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  if (value == null || value === "") return null;
  return (
    <div className="grid gap-1 border-b border-border/70 py-2.5 last:border-0 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}

function MetaChip({
  label,
  value,
  tone = "outline",
}: {
  label: string;
  value: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-md border border-border/80 bg-background/40 px-3 py-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <Badge variant={tone} className="w-fit max-w-full truncate font-normal">
        {value}
      </Badge>
    </div>
  );
}

function enumLabel(
  t: ReturnType<typeof useTranslations<"repairs.orderDetail">>,
  group: string,
  code: string | null | undefined,
  fallback: string | null | undefined = "—",
): string {
  if (!code) return fallback || "—";
  const key = `${group}.${code}`;
  return t.has(key) ? t(key as never) : code;
}

function stateTone(state: string): Tone {
  switch (state) {
    case "completed":
      return "success";
    case "in_progress":
    case "handed_off":
    case "transmitted":
    case "received":
      return "warning";
    case "scheduled":
    case "assigned":
    case "allocated":
      return "default";
    case "rejected":
    case "cancelled":
      return "destructive";
    default:
      return "secondary";
  }
}

function consequenceTone(code: string | null | undefined): Tone {
  if (code === "out_of_service" || code === "ausser_betrieb") return "destructive";
  if (code === "restricted" || code === "eingeschraenkt") return "warning";
  return "secondary";
}

function opsTone(code: string | null | undefined): Tone {
  if (code === "locked" || code === "gesperrt") return "destructive";
  if (code === "in_repair" || code === "in_instandsetzung") return "warning";
  if (code === "in_service" || code === "in_betrieb") return "success";
  return "secondary";
}

function isRepairFamily(serviceType: string): boolean {
  const st = canonicalServiceType(serviceType);
  return st === REPAIR_SERVICE_TYPE || st === POST_REPAIR_CHECK_SERVICE_TYPE;
}

type SendStepKey = "shipped" | "atWorkshop" | "returned" | "arrived";

const SEND_STEPS: { key: SendStepKey; dateKey: keyof PartnerOrderDetailDTO["sendIn"] }[] = [
  { key: "shipped", dateKey: "shippedAt" },
  { key: "atWorkshop", dateKey: "atWorkshopAt" },
  { key: "returned", dateKey: "returnedAt" },
  { key: "arrived", dateKey: "arrivedAt" },
];

/** Partner order detail — type-aware cards (v15 / v15-1 composition). */
export function OrderDetailScreen({ reference }: Props) {
  const t = useTranslations("repairs.orderDetail");
  const { checkPermission } = usePermissions();
  const canEdit = checkPermission("console:disposition:assign");
  const setActingTenant = useActingTenantStore((s) => s.setActingTenant);

  const [order, setOrder] = useState<PartnerOrderDetailDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scopeText, setScopeText] = useState("");
  const [amountText, setAmountText] = useState("");
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [savingQuote, setSavingQuote] = useState(false);
  const [discardNote, setDiscardNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ order: PartnerOrderDetailDTO }>(
        `/api/partner/orders/${encodeURIComponent(reference)}`,
      );
      setOrder(res.order);
      setScopeText(res.order.quote?.scopeText ?? "");
      setAmountText(res.order.quote?.amountText ?? "");
      setActingTenant({
        tenantId: res.order.tenantId,
        tenantName: res.order.tenantName,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error"));
      setOrder(null);
    } finally {
      setLoading(false);
    }
  }, [reference, setActingTenant, t]);

  useEffect(() => {
    void load();
  }, [load]);

  function openQuoteModal() {
    setScopeText(order?.quote?.scopeText ?? "");
    const existing = order?.quote?.amountText ?? "";
    const parsed = parseEuro(existing);
    setAmountText(parsed != null ? formatEuroPlain(parsed) : existing);
    setQuoteModalOpen(true);
  }

  async function saveQuote(e: React.FormEvent) {
    e.preventDefault();
    if (!order) return;
    const amount = normalizeEuroText(amountText);
    if (!amount) {
      toast.error(t("quoteAmountInvalid"));
      return;
    }
    setSavingQuote(true);
    try {
      await api(`/api/partner/requests/${encodeURIComponent(order.id)}/quote`, {
        method: "PUT",
        body: JSON.stringify({ scopeText: scopeText.trim(), amountText: amount }),
      });
      toast.success(t("quoteSaved"));
      setQuoteModalOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error"));
    } finally {
      setSavingQuote(false);
    }
  }

  async function confirmProposal() {
    if (!order) return;
    try {
      await api(`/api/partner/requests/${encodeURIComponent(order.id)}/confirm-proposal`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      toast.success(t("proposalConfirmed"));
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error"));
    }
  }

  async function discardProposal() {
    if (!order || !discardNote.trim()) {
      toast.error(t("discardNoteRequired"));
      return;
    }
    try {
      await api(`/api/partner/requests/${encodeURIComponent(order.id)}/discard-proposal`, {
        method: "POST",
        body: JSON.stringify({ note: discardNote.trim() }),
      });
      toast.success(t("proposalDiscarded"));
      setDiscardNote("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error"));
    }
  }

  const nextSendStepIndex = useMemo(() => {
    if (!order || order.fulfilment !== "send_in") return -1;
    return SEND_STEPS.findIndex((s) => !order.sendIn[s.dateKey]);
  }, [order]);

  if (loading) {
    return (
      <div className="p-work" data-testid="order-detail-loading">
        <main className="p-main">
          <ListPageShell title={t("title")}>
            <p className="text-sm text-muted-foreground">{t("loading")}</p>
          </ListPageShell>
        </main>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="p-work">
        <main className="p-main">
          <ListPageShell
            title={t("title")}
            headerExtra={
              <Button asChild variant="outline" size="sm" className="h-8">
                <Link href="/partner/orders?tab=disposition">{t("back")}</Link>
              </Button>
            }
          >
            <Alert variant="destructive">
              <AlertDescription>{error ?? t("error")}</AlertDescription>
            </Alert>
          </ListPageShell>
        </main>
      </div>
    );
  }

  const faultPhoto = order.attachments.find((a) => a.kind === "fault_photo");
  const repairFamily = isRepairFamily(order.serviceType);
  const showFault =
    Boolean(order.faultDescription) ||
    Boolean(order.faultConsequence) ||
    Boolean(order.faultSince) ||
    Boolean(order.faultReportedBy) ||
    Boolean(faultPhoto);
  const showQuote = repairFamily || Boolean(order.quote);
  const showProposal = order.proposalState === "proposed" || order.mandatory;
  const showLinks = Boolean(order.parentReference) || order.childReferences.length > 0;
  const serviceLabel = enumLabel(t, "serviceType", order.serviceType, order.serviceType);
  const appointmentLabel =
    order.fulfilment === "send_in"
      ? t("appointmentNa")
      : order.scheduledAt
        ? new Date(order.scheduledAt).toLocaleString()
        : t("unassigned");
  const devicePrimary =
    order.device?.tradeName ||
    order.device?.modelName ||
    order.device?.inventoryNumber ||
    order.locationText;

  return (
    <div className="p-work" data-testid="order-detail-page">
      <main className="p-main">
        <ListPageShell
          title={order.reference}
          description={`${order.tenantName} · ${serviceLabel}`}
          contentClassName="max-w-none"
          headerExtra={
            <div className="flex flex-wrap gap-2">
              {order.fulfilment === "send_in" ? (
                <Button asChild variant="secondary" size="sm" className="h-8">
                  <Link href={`/partner/orders/${encodeURIComponent(order.reference)}/send-in`}>
                    {t("openSendIn")}
                  </Link>
                </Button>
              ) : null}
              <Button asChild variant="outline" size="sm" className="h-8">
                <Link href="/partner/orders?tab=disposition">{t("back")}</Link>
              </Button>
            </div>
          }
        >
          <div className="grid w-full gap-4">
            {order.proposalState === "proposed" ? (
              <Alert data-testid="order-detail-proposal-banner">
                <AlertDescription>{t("proposalBanner")}</AlertDescription>
              </Alert>
            ) : null}
            {order.mandatory && order.proposalState !== "proposed" ? (
              <Alert variant="destructive" data-testid="order-detail-mandatory-banner">
                <AlertDescription>{t("mandatoryBanner")}</AlertDescription>
              </Alert>
            ) : null}

            <section
              className="rounded-lg border border-border bg-card p-4 sm:p-5"
              data-testid="order-detail-head"
            >
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t("cardHead")}
                  </p>
                  <h3 className="mt-1 truncate text-base font-semibold text-foreground">
                    {devicePrimary}
                  </h3>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                    {order.device?.inventoryNumber ?? order.locationText}
                    {order.device?.manufacturer
                      ? ` · ${order.device.manufacturer}`
                      : ""}
                  </p>
                </div>
                <Badge variant={stateTone(order.state)} className="shrink-0">
                  {enumLabel(t, "stateCode", order.state, order.state)}
                </Badge>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <MetaChip label={t("clinic")} value={order.tenantName} tone="secondary" />
                <MetaChip
                  label={t("reason")}
                  value={enumLabel(t, "reasonCode", order.reason, order.reason ?? "—")}
                  tone="secondary"
                />
                <MetaChip
                  label={t("fulfilment")}
                  value={enumLabel(t, "fulfilmentCode", order.fulfilment, order.fulfilment)}
                  tone={order.fulfilment === "send_in" ? "warning" : "outline"}
                />
                <MetaChip label={t("appointment")} value={appointmentLabel} tone="outline" />
                <MetaChip
                  label={t("assignee")}
                  value={order.assigneeName ?? t("unassigned")}
                  tone="outline"
                />
                <MetaChip
                  label={t("raisedBy")}
                  value={order.raisedBy ?? t("unassigned")}
                  tone="outline"
                />
              </div>

              {order.gateOverride ? (
                <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm">
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <span className="font-medium">{t("overridden")}</span>
                    {order.gateOverride.kind ? (
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {order.gateOverride.kind === "service_type"
                          ? t("gateKindServiceType")
                          : t("gateKindTraining")}
                      </Badge>
                    ) : null}
                  </span>
                  <span className="text-muted-foreground">
                    {" · "}
                    {[order.gateOverride.by, order.gateOverride.reason].filter(Boolean).join(" · ")}
                  </span>
                </div>
              ) : null}
            </section>

            {order.fulfilment === "send_in" ? (
              <Section title={t("cardSendIn")} testId="order-detail-send-in">
                <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {SEND_STEPS.map((step, index) => {
                    const doneAt = order.sendIn[step.dateKey];
                    const done = Boolean(doneAt);
                    const isNext = index === nextSendStepIndex;
                    return (
                      <li
                        key={step.key}
                        className={cn(
                          "rounded-md border px-3 py-3",
                          done
                            ? "border-emerald-500/30 bg-emerald-500/5"
                            : isNext
                              ? "border-primary/40 bg-primary/5"
                              : "border-border bg-background/30",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            {t(step.key)}
                          </span>
                          <Badge
                            variant={done ? "success" : isNext ? "default" : "secondary"}
                            className="font-normal"
                          >
                            {done ? "✓" : isNext ? "→" : "·"}
                          </Badge>
                        </div>
                        <p className="mt-2 font-mono text-sm">
                          {doneAt ?? "—"}
                        </p>
                        {step.key === "shipped" && order.sendIn.trackingRef ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t("tracking")}: {order.sendIn.trackingRef}
                          </p>
                        ) : null}
                        {isNext && canEdit ? (
                          <Button asChild size="sm" className="mt-3 h-8" variant="default">
                            <Link
                              href={`/partner/orders/${encodeURIComponent(order.reference)}/send-in`}
                            >
                              {t("captureStep")}
                            </Link>
                          </Button>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
                <p className="mt-3 text-xs text-muted-foreground">{t("sendInHint")}</p>
              </Section>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-2">
              {showFault ? (
                <Section title={t("cardFault")} testId="order-detail-fault">
                  <dl>
                    <Row label={t("faultDescription")} value={order.faultDescription} />
                    <Row label={t("faultSince")} value={order.faultSince} />
                    <Row
                      label={t("faultConsequence")}
                      value={
                        order.faultConsequence ? (
                          <Badge variant={consequenceTone(order.faultConsequence)}>
                            {enumLabel(
                              t,
                              "consequenceCode",
                              order.faultConsequence,
                              order.faultConsequence,
                            )}
                          </Badge>
                        ) : null
                      }
                    />
                    <Row label={t("faultReportedBy")} value={order.faultReportedBy} />
                  </dl>
                  {faultPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={faultPhoto.url}
                      alt={t("faultPhoto")}
                      className="mt-3 max-h-48 rounded-md border border-border object-contain"
                    />
                  ) : null}
                </Section>
              ) : null}

              {showQuote ? (
                <Section title={t("cardQuote")} testId="order-detail-quote">
                  {order.quote ? (
                    <dl className="mb-4">
                      <Row
                        label={t("quoteAmount")}
                        value={
                          <span className="font-semibold">
                            {displayEuroText(order.quote.amountText)}
                          </span>
                        }
                      />
                      <Row label={t("quoteScope")} value={order.quote.scopeText} />
                      <Row
                        label={t("quoteDecision")}
                        value={
                          <Badge
                            variant={
                              order.quote.decision === "approved" ||
                              order.quote.decision === "freigegeben"
                                ? "success"
                                : order.quote.decision === "rejected" ||
                                    order.quote.decision === "abgelehnt"
                                  ? "destructive"
                                  : "warning"
                            }
                          >
                            {enumLabel(
                              t,
                              "quoteDecisionCode",
                              order.quote.decision,
                              order.quote.decision,
                            )}
                          </Badge>
                        }
                      />
                      <Row label={t("quoteDecidedBy")} value={order.quote.decidedBy} />
                      <Row label={t("quoteNote")} value={order.quote.decisionNote} />
                    </dl>
                  ) : (
                    <p className="mb-4 text-sm text-muted-foreground">{t("quoteEmpty")}</p>
                  )}
                  {canEdit ? (
                    <div className="border-t border-border pt-4">
                      <Button
                        type="button"
                        size="sm"
                        variant={order.quote ? "outline" : "default"}
                        className={
                          order.quote
                            ? "border-primary text-primary hover:bg-primary/10 hover:text-primary"
                            : undefined
                        }
                        onClick={openQuoteModal}
                        data-testid="order-quote-edit"
                      >
                        {order.quote ? t("quoteEdit") : t("quoteCreate")}
                      </Button>
                    </div>
                  ) : null}
                </Section>
              ) : null}

              {order.device ? (
                <Section title={t("cardDevice")} testId="order-detail-device">
                  <dl>
                    <Row label={t("deviceTrade")} value={order.device.tradeName} />
                    <Row label={t("deviceModel")} value={order.device.modelName} />
                    <Row label={t("deviceManufacturer")} value={order.device.manufacturer} />
                    <Row
                      label={t("opsState")}
                      value={
                        <Badge variant={opsTone(order.device.operationalState)}>
                          {enumLabel(
                            t,
                            "opsStateCode",
                            order.device.operationalState,
                            order.device.operationalState,
                          )}
                        </Badge>
                      }
                    />
                    <Row label={t("lockSource")} value={order.device.lockSource} />
                    <Row
                      label={t("loaner")}
                      value={
                        order.device.loanerInventoryNumber
                          ? `${order.device.loanerInventoryNumber}${
                              order.device.loanerLender
                                ? ` · ${order.device.loanerLender}`
                                : ""
                            }`
                          : "—"
                      }
                    />
                  </dl>
                </Section>
              ) : null}

              {showProposal ? (
                <Section title={t("cardProposal")} testId="order-detail-proposal">
                  <dl className="mb-4">
                    <Row
                      label={t("proposalState")}
                      value={enumLabel(
                        t,
                        "proposalCode",
                        order.proposalState,
                        order.proposalState,
                      )}
                    />
                    <Row label={t("mandatory")} value={order.mandatory ? t("yes") : t("no")} />
                    <Row
                      label={t("checkType")}
                      value={enumLabel(t, "checkTypeCode", order.checkType, order.checkType)}
                    />
                    <Row label={t("followUpNeeds")} value={order.followUpNeeds} />
                  </dl>
                  {canEdit && order.proposalState === "proposed" ? (
                    <div className="flex flex-wrap items-end gap-3 border-t border-border pt-4">
                      <Button type="button" size="sm" onClick={() => void confirmProposal()}>
                        {t("confirmProposal")}
                      </Button>
                      <div className="flex min-w-[14rem] flex-1 flex-col gap-2">
                        <Input
                          value={discardNote}
                          onChange={(e) => setDiscardNote(e.target.value)}
                          placeholder={t("discardNotePlaceholder")}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void discardProposal()}
                        >
                          {t("discardProposal")}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </Section>
              ) : null}
            </div>

            {order.maintenanceEvents.length > 0 ? (
              <Section title={t("cardReport")} testId="order-detail-report">
                {order.maintenanceEvents.map((ev) => (
                  <dl
                    key={ev.id}
                    className="mb-3 border-b border-border pb-3 last:mb-0 last:border-0 last:pb-0"
                  >
                    <Row
                      label={t("performedAt")}
                      value={new Date(ev.performedAt).toLocaleString()}
                    />
                    <Row
                      label={t("startedAt")}
                      value={
                        ev.startedAt ? new Date(ev.startedAt).toLocaleString() : null
                      }
                    />
                    <Row
                      label={t("completedAt")}
                      value={
                        ev.completedAt ? new Date(ev.completedAt).toLocaleString() : null
                      }
                    />
                    <Row label={t("performedBy")} value={ev.performedBy} />
                    <Row label={t("action")} value={ev.action} />
                    <Row label={t("cause")} value={ev.cause} />
                    <Row label={t("result")} value={ev.result} />
                    <Row
                      label={t("postRepairCheck")}
                      value={enumLabel(
                        t,
                        "checkTypeCode",
                        ev.postRepairCheck,
                        ev.postRepairCheck,
                      )}
                    />
                    <Row
                      label={t("laborMinutes")}
                      value={ev.laborMinutes != null ? String(ev.laborMinutes) : null}
                    />
                  </dl>
                ))}
              </Section>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-2">
              {showLinks ? (
                <Section title={t("cardLinks")} testId="order-detail-links">
                  <dl>
                    <Row
                      label={t("parent")}
                      value={
                        order.parentReference ? (
                          <Link
                            className="text-primary underline-offset-2 hover:underline"
                            href={`/partner/orders/${encodeURIComponent(order.parentReference)}`}
                          >
                            {order.parentReference}
                          </Link>
                        ) : null
                      }
                    />
                    <Row
                      label={t("children")}
                      value={
                        order.childReferences.length
                          ? order.childReferences.map((ref) => (
                              <Link
                                key={ref}
                                className="mr-2 text-primary underline-offset-2 hover:underline"
                                href={`/partner/orders/${encodeURIComponent(ref)}`}
                              >
                                {ref}
                              </Link>
                            ))
                          : null
                      }
                    />
                  </dl>
                </Section>
              ) : null}

              {order.partsProposals.length > 0 ? (
                <Section title={t("cardParts")} testId="order-detail-parts">
                  <ul className="space-y-3 text-sm">
                    {order.partsProposals.map((p) => (
                      <li key={p.id} className="rounded-md border border-border px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-2 font-medium">
                          <Badge variant="secondary">
                            {enumLabel(t, "partsStatusCode", p.status, p.status)}
                          </Badge>
                          {p.orderRef ? <span className="font-mono text-xs">{p.orderRef}</span> : null}
                          {p.triggeredVia === "devicecare" ? (
                            <span className="text-xs text-muted-foreground">
                              {t("viaDeviceCare")}
                            </span>
                          ) : null}
                        </div>
                        <ul className="mt-1 list-inside list-disc text-muted-foreground">
                          {p.lines.map((l, i) => (
                            <li key={`${p.id}-${i}`}>
                              {l.description}
                              {l.partNo ? ` (${l.partNo})` : ""} × {l.qty}
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 border-t border-border pt-4">
                    <Button asChild size="sm" variant="outline">
                      <Link href="/partner/parts-proposals">{t("openPartsProposals")}</Link>
                    </Button>
                  </div>
                </Section>
              ) : null}
            </div>

            <Section title={t("cardHistory")} testId="order-detail-history">
              {order.statusEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("emptyHistory")}</p>
              ) : (
                <ul className="space-y-0 text-sm">
                  {order.statusEvents.map((e, i) => (
                    <li
                      key={`${e.at}-${i}`}
                      className="grid gap-1 border-b border-border/70 py-3 last:border-0 sm:grid-cols-[11rem_1fr] sm:gap-4"
                    >
                      <div className="font-mono text-xs text-muted-foreground">
                        {new Date(e.at).toLocaleString()}
                      </div>
                      <div>
                        <div className="font-medium">
                          {enumLabel(t, "stateCode", e.state, e.state)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {[e.source, e.actor, e.note].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </ListPageShell>
      </main>

      <Modal
        open={quoteModalOpen}
        title={order?.quote ? t("quoteEditTitle") : t("quoteCreateTitle")}
        onClose={() => {
          if (!savingQuote) setQuoteModalOpen(false);
        }}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              disabled={savingQuote}
              onClick={() => setQuoteModalOpen(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              form="order-quote-form"
              disabled={savingQuote}
              data-testid="order-quote-save"
            >
              {savingQuote ? t("saving") : t("quoteSave")}
            </Button>
          </>
        }
      >
        <form id="order-quote-form" className="grid gap-4" onSubmit={saveQuote}>
          <p className="text-xs text-muted-foreground">{t("quoteEditHint")}</p>
          <Field label={t("quoteAmount")} htmlFor="quote-amount" required>
            <div className="relative">
              <Input
                id="quote-amount"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                onBlur={() => {
                  const parsed = parseEuro(amountText);
                  if (parsed != null) setAmountText(formatEuroPlain(parsed));
                }}
                required
                inputMode="decimal"
                autoComplete="off"
                placeholder={t("quoteAmountPlaceholder")}
                data-testid="quote-amount-input"
                className="pr-10"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                €
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{t("quoteAmountHint")}</p>
          </Field>
          <Field label={t("quoteScope")} htmlFor="quote-scope" required>
            <Textarea
              id="quote-scope"
              value={scopeText}
              onChange={(e) => setScopeText(e.target.value)}
              required
              rows={3}
              data-testid="quote-scope-input"
            />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
