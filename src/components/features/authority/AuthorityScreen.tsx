"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  RecordNotificationModal,
  type NotificationSubject,
} from "@/components/features/authority/RecordNotificationModal";
import {
  OpenSessionDialog,
  SessionBanner,
  SessionCloseSummary,
  SessionsList,
  useDefaultSessionScope,
} from "@/components/features/authority/AuthoritySessionPanels";
import { AccessDenied } from "@/components/features/shared/AccessDenied";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { useSites } from "@/components/hooks/location/useSites";
import {
  useAuthorityList,
  type BegehTab,
  type FindingFilter,
  type PrepFilter,
} from "@/components/hooks/authority/useAuthorityList";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { dossierSectionLabel } from "@/constants/authorityDossier";
import type {
  AuthorityFindingDTO,
  AuthorityInspectionDTO,
  DisclosedEventDTO,
  DisclosureCloseSummaryDTO,
  DisclosureSessionDTO,
} from "@/interfaces";
import { cn } from "@/lib/utils";

const TAB_KEYS: BegehTab[] = ["vorbereitung", "begehungen", "sitzungen", "notifications"];
const PREP_FILTER_KEYS: PrepFilter[] = ["all", "bereit", "luecke", "aussen"];
const FINDING_FILTER_KEYS: FindingFilter[] = [
  "all",
  "offen",
  "ueberfaellig",
  "behoben",
  "nachgewiesen",
  "bestritten",
];

const KIND_FROM_CHECKLIST: Record<
  string,
  "health_office" | "device_authority" | "occupational_safety" | "other"
> = {
  health_office: "health_office",
  device_authority: "device_authority",
  occupational_safety: "occupational_safety",
};

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring";

function StatusPill({
  status,
  dueAt,
  label,
}: {
  status: string;
  dueAt?: string | null;
  label: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const overdue = status === "open" && dueAt && dueAt < today;
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium",
        overdue && "bg-destructive/15 text-destructive",
        status === "open" && !overdue && "bg-sky-500/15 text-sky-700 dark:text-sky-300",
        status === "remediated" && "bg-amber-500/15 text-amber-800 dark:text-amber-200",
        status === "proven" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
        status === "disputed" && "bg-violet-500/15 text-violet-700 dark:text-violet-300",
      )}
    >
      {label}
    </span>
  );
}

export function AuthorityScreen() {
  const list = useAuthorityList();
  const sites = useSites();
  const t = useTranslations("pages.authority");
  const tn = useTranslations("pages.authorityNotification");
  const locale = useLocale();
  const dossierLocale = locale.startsWith("de") ? "de" : "en";

  const [remediateTarget, setRemediateTarget] = useState<AuthorityFindingDTO | null>(null);
  const [disputeTarget, setDisputeTarget] = useState<AuthorityFindingDTO | null>(null);
  const [note, setNote] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [notifyRecipient, setNotifyRecipient] = useState("");
  const [discloseOpen, setDiscloseOpen] = useState(false);
  const [closeSummary, setCloseSummary] = useState<DisclosureCloseSummaryDTO | null>(null);
  const [disclosedBySession, setDisclosedBySession] = useState<
    Record<string, DisclosedEventDTO[]>
  >({});
  const [busy, setBusy] = useState(false);
  const [notifySubject, setNotifySubject] = useState<NotificationSubject | null>(null);
  const [docRefByItem, setDocRefByItem] = useState<Record<string, string>>({});

  const [recordOpen, setRecordOpen] = useState(false);
  const [addFindingFor, setAddFindingFor] = useState<string | null>(null);

  const [inspName, setInspName] = useState("");
  const [inspVisited, setInspVisited] = useState(() => new Date().toISOString().slice(0, 10));
  const [inspAnnounced, setInspAnnounced] = useState("");
  const [inspSite, setInspSite] = useState("");
  const [inspProtocolAt, setInspProtocolAt] = useState("");
  const [inspProtocolRef, setInspProtocolRef] = useState("");
  const [inspFee, setInspFee] = useState("");
  const [inspLegal, setInspLegal] = useState("");
  const [inspSessionId, setInspSessionId] = useState("");

  const [fNo, setFNo] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fBasis, setFBasis] = useState("");
  const [fDue, setFDue] = useState("");

  const defaultScope = useDefaultSessionScope(
    list.activeChecklist?.items.map((i) => i.mapsToSection) ?? [],
  );

  const prepItems = useMemo(() => {
    const items = list.preparation?.items ?? [];
    if (list.prepFilter === "bereit") return items.filter((i) => i.state === "ready");
    if (list.prepFilter === "luecke") return items.filter((i) => i.state === "gap");
    if (list.prepFilter === "aussen") return items.filter((i) => i.state === "external");
    return items;
  }, [list.preparation, list.prepFilter]);

  const inspectionsForList = useMemo(() => {
    const kind = list.activeChecklist?.authorityKind;
    return list.inspections.filter(
      (i) =>
        i.checklistCode === list.activeListCode ||
        (!i.checklistCode && kind && i.authorityKind === kind),
    );
  }, [list.inspections, list.activeListCode, list.activeChecklist]);

  const findingsByInspection = useMemo(() => {
    const map = new Map<string, AuthorityFindingDTO[]>();
    for (const f of list.findings) {
      const arr = map.get(f.inspectionId) ?? [];
      arr.push(f);
      map.set(f.inspectionId, arr);
    }
    return map;
  }, [list.findings]);

  const today = new Date().toISOString().slice(0, 10);
  const overdueOpen = useMemo(() => {
    return list.allFindings.filter((f) => {
      if (f.status !== "open" || !f.dueAt || f.dueAt >= today) return false;
      const insp = list.inspections.find((i) => i.id === f.inspectionId);
      const kind = list.activeChecklist?.authorityKind;
      return (
        insp?.checklistCode === list.activeListCode ||
        (!insp?.checklistCode && kind && insp?.authorityKind === kind)
      );
    }).length;
  }, [list.allFindings, list.inspections, list.activeListCode, list.activeChecklist, today]);

  useEffect(() => {
    const active = Boolean(list.activeSession);
    document.body.dataset.sitzung = active ? "1" : "0";
    return () => {
      delete document.body.dataset.sitzung;
    };
  }, [list.activeSession]);

  useEffect(() => {
    const session = list.activeSession;
    if (!session) return;
    const label = `Authority · ${list.tab}`;
    void (async () => {
      await list.recordShown(session.id, {
        resource: "AuthorityView",
        resourceId: `begehung:${list.tab}`,
        label,
      });
      try {
        const rows = await list.listDisclosed(session.id);
        setDisclosedBySession((prev) => ({ ...prev, [session.id]: rows }));
      } catch {
        /* ignore */
      }
    })();
  }, [list.activeSession?.id, list.tab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (list.tab !== "sitzungen" || list.sessions.length === 0) return;
    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        list.sessions.map(async (s) => {
          try {
            const rows = await list.listDisclosed(s.id);
            return [s.id, rows] as const;
          } catch {
            return [s.id, [] as DisclosedEventDTO[]] as const;
          }
        }),
      );
      if (!cancelled) {
        setDisclosedBySession(Object.fromEntries(entries));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [list.tab, list.sessions]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeShownCount = list.activeSession
    ? (disclosedBySession[list.activeSession.id]?.length ??
      list.activeSession.disclosedCount ??
      0)
    : 0;

  const findingStatusLabel = (status: string, dueAt?: string | null) => {
    const overdue = status === "open" && dueAt && dueAt < today;
    if (overdue) return t("status.overdue");
    if (status === "remediated") return t("status.remediated");
    if (status === "proven") return t("status.proven");
    if (status === "disputed") return t("status.disputed");
    if (status === "open") return t("status.open");
    return status;
  };

  if (!list.canView) {
    return (
      <AccessDenied
        title={t("deniedTitle")}
        description={t("deniedDescription")}
        hint={t("deniedHint")}
        testId="authority-denied"
      />
    );
  }

  const ov = list.overview;
  const locked = Boolean(list.activeSession);

  const resetInspectionForm = () => {
    setInspName("");
    setInspVisited(new Date().toISOString().slice(0, 10));
    setInspAnnounced("");
    setInspSite("");
    setInspProtocolAt("");
    setInspProtocolRef("");
    setInspFee("");
    setInspLegal("");
    setInspSessionId("");
    setRecordOpen(false);
  };

  const resetFindingForm = () => {
    setFNo("");
    setFDesc("");
    setFBasis("");
    setFDue("");
    setAddFindingFor(null);
  };

  const submitInspection = async () => {
    if (!inspName.trim() || !inspVisited) return;
    const kindRaw = list.activeChecklist?.authorityKind ?? "other";
    const authorityKind = KIND_FROM_CHECKLIST[kindRaw] ?? "other";
    setBusy(true);
    try {
      await list.createInspection({
        authorityName: inspName.trim(),
        authorityKind,
        visitedAt: inspVisited,
        announcedAt: inspAnnounced || null,
        siteId: inspSite || null,
        checklistCode: list.activeListCode,
        protocolReceivedAt: inspProtocolAt || null,
        protocolRef: inspProtocolRef.trim() || null,
        feeEur: inspFee ? Number(inspFee) : null,
        legalBasis: inspLegal.trim() || null,
        disclosureSessionId: inspSessionId || null,
      });
      resetInspectionForm();
    } finally {
      setBusy(false);
    }
  };

  const submitFinding = async () => {
    if (!addFindingFor || !fDesc.trim()) return;
    setBusy(true);
    try {
      await list.addFinding(addFindingFor, {
        itemNo: fNo.trim() || null,
        description: fDesc.trim(),
        legalBasis: fBasis.trim() || null,
        dueAt: fDue || null,
      });
      resetFindingForm();
    } finally {
      setBusy(false);
    }
  };

  const prefillInspectionFromSession = (session: DisclosureSessionDTO) => {
    setInspName(session.audience);
    setInspVisited(session.openedAt.slice(0, 10));
    setInspSite(session.siteId ?? "");
    setInspSessionId(session.id);
    setInspLegal(session.purpose ?? "");
    setRecordOpen(true);
    list.setTab("begehungen");
  };

  const handleCloseSession = async () => {
    if (!list.activeSession) return;
    setBusy(true);
    try {
      const summary = await list.closeDisclosure(list.activeSession.id);
      setCloseSummary(summary);
      list.setTab("sitzungen");
    } finally {
      setBusy(false);
    }
  };

  const checklistSub =
    list.activeChecklist?.label?.replace(/^[^,]*,\s*/, "") ??
    list.activeChecklist?.label ??
    list.activeListCode;

  const openFindings = ov?.findingsOpen ?? 0;
  const evidencePending = ov?.findingsRemediated ?? 0;
  const gap = ov?.gap ?? 0;
  const external = ov?.external ?? 0;

  const kpis: {
    key: string;
    label: string;
    value: number;
    hint: string;
    tab: BegehTab;
    filter: string | null;
    tone: "neutral" | "warn" | "danger" | "ok";
    active: boolean;
  }[] = [
    {
      key: "items",
      label: t("kpi.items"),
      value: ov?.items ?? 0,
      hint: checklistSub,
      tab: "vorbereitung",
      filter: null,
      tone: "neutral",
      active: list.tab === "vorbereitung" && list.prepFilter === "all",
    },
    {
      key: "ready",
      label: t("kpi.ready"),
      value: ov?.ready ?? 0,
      hint: t("kpiHint.ready"),
      tab: "vorbereitung",
      filter: "bereit",
      tone: "neutral",
      active: list.tab === "vorbereitung" && list.prepFilter === "bereit",
    },
    {
      key: "gap",
      label: t("kpi.gap"),
      value: gap,
      hint: t("kpiHint.gap"),
      tab: "vorbereitung",
      filter: "luecke",
      tone: gap > 0 ? "warn" : "ok",
      active: list.tab === "vorbereitung" && list.prepFilter === "luecke",
    },
    {
      key: "outside",
      label: t("kpi.outside"),
      value: external,
      hint: t("kpiHint.outside"),
      tab: "vorbereitung",
      filter: "aussen",
      tone: external > 0 ? "warn" : "ok",
      active: list.tab === "vorbereitung" && list.prepFilter === "aussen",
    },
    {
      key: "open",
      label: t("kpi.openFindings"),
      value: openFindings,
      hint:
        openFindings > 0 && overdueOpen > 0
          ? t("kpiHint.openFindingsOverdue", { count: overdueOpen })
          : t("kpiHint.openFindings"),
      tab: "begehungen",
      filter: "offen",
      tone: openFindings > 0 ? "danger" : "ok",
      active: list.tab === "begehungen" && list.findingFilter === "offen",
    },
    {
      key: "evidence",
      label: t("kpi.evidencePending"),
      value: evidencePending,
      hint: t("kpiHint.evidencePending"),
      tab: "begehungen",
      filter: "behoben",
      tone: evidencePending > 0 ? "warn" : "ok",
      active: list.tab === "begehungen" && list.findingFilter === "behoben",
    },
  ];

  return (
    <div className="p-work" data-testid="authority-page" data-sitzung={list.activeSession ? "1" : "0"}>
      <main className="p-main">
        <ListPageShell
          title={t("title")}
          description={t("description")}
          testId="authority-screen"
          headerExtra={
            <div className="flex w-full flex-col gap-3">
              <div className="flex flex-wrap gap-1.5">
                {list.checklists.map((c) => (
                  <Button
                    key={c.code}
                    type="button"
                    size="sm"
                    variant={c.code === list.activeListCode ? "default" : "outline"}
                    onClick={() => list.setList(c.code)}
                    data-testid={`authority-list-${c.code}`}
                  >
                    {c.label.replace(/,.*/, "")}
                  </Button>
                ))}
              </div>
              <SessionBanner
                active={list.activeSession}
                canManage={list.canManage}
                shownCount={activeShownCount}
                onOpen={() => setDiscloseOpen(true)}
                onClose={() => void handleCloseSession()}
              />
            </div>
          }
        >
          <div className="space-y-6">
            {closeSummary ? (
              <SessionCloseSummary
                summary={closeSummary}
                onDismiss={() => setCloseSummary(null)}
                onRecordInspection={() => {
                  prefillInspectionFromSession(closeSummary.session);
                  setCloseSummary(null);
                }}
              />
            ) : null}

            <div
              className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6"
              data-testid="authority-kpis"
            >
              {kpis.map((tile) => (
                <button
                  key={tile.key}
                  type="button"
                  onClick={() => list.goTo(tile.tab, tile.filter)}
                  aria-pressed={tile.active}
                  data-testid={`authority-kpi-${tile.key}`}
                  className={cn(
                    "rounded-md border bg-card px-3 py-3 text-left transition hover:bg-muted/40",
                    tile.active ? "border-foreground/30 ring-1 ring-foreground/15" : "border-border",
                  )}
                >
                  <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                    {tile.label}
                  </p>
                  <p
                    className={cn(
                      "mt-1 text-3xl font-semibold tabular-nums leading-none",
                      tile.tone === "danger" && "text-destructive",
                      tile.tone === "warn" && "text-amber-700 dark:text-amber-300",
                      tile.tone === "ok" && "text-emerald-700 dark:text-emerald-300",
                    )}
                  >
                    {tile.value}
                  </p>
                  <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                    {tile.hint}
                  </p>
                </button>
              ))}
            </div>

            {ov && ov.otherLists.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                {t("otherAuthorities")}{" "}
                {ov.otherLists
                  .map((o) => t("otherAuthorityOpen", { name: o.authorityName, count: o.open }))
                  .join(" · ")}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-1.5 border-b border-border pb-3">
              {TAB_KEYS.map((key) => {
                const count =
                  key === "vorbereitung"
                    ? list.preparation?.progress.total
                    : key === "begehungen"
                      ? inspectionsForList.length
                      : key === "sitzungen"
                        ? list.sessions.length
                        : list.notifications.length;
                return (
                  <Button
                    key={key}
                    type="button"
                    size="sm"
                    variant={list.tab === key ? "default" : "ghost"}
                    onClick={() => list.setTab(key)}
                  >
                    {t(`tabs.${key}`)}
                    {count != null ? (
                      <span className="ml-1 opacity-60">{count}</span>
                    ) : null}
                  </Button>
                );
              })}
            </div>

            {list.tab === "vorbereitung" ? (
              <section className="space-y-4" data-testid="authority-prep">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground">
                    {list.preparation
                      ? t("prep.progress", {
                          ready: list.preparation.progress.ready,
                          total: list.preparation.progress.total,
                        })
                      : t("emDash")}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {PREP_FILTER_KEYS.map((key) => (
                      <Button
                        key={key}
                        type="button"
                        size="sm"
                        variant={list.prepFilter === key ? "secondary" : "ghost"}
                        onClick={() => list.setFilter(key)}
                      >
                        {t(`prepFilter.${key}`)}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-2 font-medium">{t("prep.colPosition")}</th>
                        <th className="px-3 py-2 font-medium">{t("prep.colItem")}</th>
                        <th className="hidden px-3 py-2 font-medium md:table-cell">
                          {t("prep.colSection")}
                        </th>
                        <th className="px-3 py-2 font-medium">{t("prep.colStatus")}</th>
                        <th className="px-3 py-2 font-medium">{t("prep.colAction")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prepItems.map((row) => (
                        <tr key={row.itemId} className="border-b border-border last:border-0">
                          <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                            {row.position}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="font-medium">{row.label}</div>
                            {row.legalBasis ? (
                              <div className="text-xs text-muted-foreground">{row.legalBasis}</div>
                            ) : null}
                          </td>
                          <td className="hidden px-3 py-2.5 text-xs text-muted-foreground md:table-cell">
                            {row.mapsToSection
                              ? dossierSectionLabel(row.mapsToSection, dossierLocale)
                              : t("emDash")}
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className={cn(
                                "rounded-md px-2 py-0.5 text-[11px]",
                                row.state === "ready" &&
                                  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
                                row.state === "gap" &&
                                  "bg-amber-500/15 text-amber-800 dark:text-amber-200",
                                row.state === "external" && "bg-muted text-muted-foreground",
                              )}
                            >
                              {row.state === "gap"
                                ? t("prep.stateGap", { count: row.gapCount })
                                : row.state === "ready"
                                  ? t("prep.stateReady")
                                  : t("prep.stateExternal")}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            {row.state === "gap" && row.gapTarget ? (
                              <Link
                                href={row.gapTarget}
                                className="text-xs underline underline-offset-2"
                              >
                                {t("open")}
                              </Link>
                            ) : null}
                            {!row.covered ? (
                              <div className="flex max-w-[12rem] flex-col gap-1">
                                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(row.readiness?.externalReady)}
                                    disabled={!list.canManage || locked}
                                    onChange={(e) =>
                                      void list.setReadiness(
                                        row.itemId,
                                        e.target.checked,
                                        docRefByItem[row.itemId] ?? row.readiness?.documentRef,
                                      )
                                    }
                                  />
                                  {t("prep.laidOut")}
                                </label>
                                <Input
                                  className="h-8 text-xs"
                                  placeholder={t("prep.documentRef")}
                                  value={
                                    docRefByItem[row.itemId] ?? row.readiness?.documentRef ?? ""
                                  }
                                  disabled={!list.canManage}
                                  onChange={(e) =>
                                    setDocRefByItem((prev) => ({
                                      ...prev,
                                      [row.itemId]: e.target.value,
                                    }))
                                  }
                                  onBlur={() => {
                                    if (!list.canManage) return;
                                    const ref = docRefByItem[row.itemId];
                                    if (ref == null) return;
                                    void list.setReadiness(
                                      row.itemId,
                                      Boolean(row.readiness?.externalReady),
                                      ref,
                                    );
                                  }}
                                />
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {(list.preparation?.unmapped.length ?? 0) > 0 ? (
                  <div className="rounded-md border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                    <p className="mb-2 text-xs uppercase tracking-wide">{t("prep.otherOpenStates")}</p>
                    <ul className="space-y-1">
                      {list.preparation!.unmapped.map((u) => (
                        <li key={u.code}>
                          <Link href={u.target} className="underline underline-offset-2">
                            {u.label} ({u.count})
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>
            ) : null}

            {list.tab === "begehungen" ? (
              <section className="space-y-4" data-testid="authority-inspections">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-1">
                    {FINDING_FILTER_KEYS.map((key) => (
                      <Button
                        key={key}
                        type="button"
                        size="sm"
                        variant={list.findingFilter === key ? "secondary" : "ghost"}
                        onClick={() => list.setFilter(key)}
                      >
                        {t(`findingFilter.${key}`)}
                      </Button>
                    ))}
                  </div>
                  {list.canManage ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={locked}
                      onClick={() => setRecordOpen((v) => !v)}
                      data-testid="authority-record-inspection"
                    >
                      {recordOpen ? t("cancel") : t("inspections.record")}
                    </Button>
                  ) : null}
                </div>

                {recordOpen ? (
                  <div className="space-y-4 rounded-md border border-border bg-muted/20 p-4">
                    <div>
                      <h3 className="text-sm font-medium">{t("inspections.record")}</h3>
                      <p className="text-xs text-muted-foreground">{t("inspections.recordHint")}</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-xs">{t("inspections.authorityName")}</Label>
                        <Input
                          value={inspName}
                          onChange={(e) => setInspName(e.target.value)}
                          placeholder={t("inspections.authorityNamePlaceholder")}
                          data-testid="insp-name"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">{t("inspections.visited")}</Label>
                        <Input
                          type="date"
                          value={inspVisited}
                          onChange={(e) => setInspVisited(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">{t("inspections.announced")}</Label>
                        <Input
                          type="date"
                          value={inspAnnounced}
                          onChange={(e) => setInspAnnounced(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">{t("inspections.site")}</Label>
                        <select
                          className={selectClass}
                          value={inspSite}
                          onChange={(e) => setInspSite(e.target.value)}
                        >
                          <option value="">{t("emDash")}</option>
                          {sites.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">{t("inspections.checklist")}</Label>
                        <Input value={list.activeListCode} disabled />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">{t("inspections.protocolReceived")}</Label>
                        <Input
                          type="date"
                          value={inspProtocolAt}
                          onChange={(e) => setInspProtocolAt(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">{t("inspections.protocolRef")}</Label>
                        <Input
                          value={inspProtocolRef}
                          onChange={(e) => setInspProtocolRef(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">{t("inspections.fee")}</Label>
                        <Input
                          value={inspFee}
                          onChange={(e) => setInspFee(e.target.value)}
                          inputMode="decimal"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">{t("inspections.legalBasis")}</Label>
                        <Input
                          value={inspLegal}
                          onChange={(e) => setInspLegal(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-xs">{t("inspections.session")}</Label>
                        <select
                          className={selectClass}
                          value={inspSessionId}
                          onChange={(e) => setInspSessionId(e.target.value)}
                        >
                          <option value="">{t("noSession")}</option>
                          {list.sessions
                            .filter((s) => !s.active)
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.audience} · {s.openedAt.slice(0, 10)}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={busy || !inspName.trim() || !inspVisited}
                        onClick={() => void submitInspection()}
                        data-testid="insp-save"
                      >
                        {t("save")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={resetInspectionForm}
                      >
                        {t("cancel")}
                      </Button>
                    </div>
                  </div>
                ) : null}

                {inspectionsForList.length === 0 && !recordOpen ? (
                  <p className="text-sm text-muted-foreground">
                    {t("inspections.empty")}
                    {list.canManage ? t("inspections.emptyHint") : null}
                  </p>
                ) : null}

                {inspectionsForList.map((insp: AuthorityInspectionDTO) => {
                  const rows = findingsByInspection.get(insp.id) ?? [];
                  const showAdd = addFindingFor === insp.id;
                  return (
                    <article
                      key={insp.id}
                      className="space-y-3 rounded-md border border-border p-4"
                      data-testid={`authority-insp-${insp.id}`}
                    >
                      <div>
                        <h3 className="font-medium">{insp.authorityName}</h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {[
                            insp.legalBasis,
                            insp.siteName
                              ? t("inspections.metaSite", { name: insp.siteName })
                              : null,
                            insp.announcedAt
                              ? t("inspections.metaAnnounced", { date: insp.announcedAt })
                              : null,
                            t("inspections.metaVisited", { date: insp.visitedAt }),
                            insp.protocolReceivedAt
                              ? t("inspections.metaProtocol", {
                                  date: insp.protocolReceivedAt,
                                })
                              : null,
                            insp.feeEur != null ? `€${insp.feeEur}` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>

                      {rows.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                                <th className="pb-2 pr-3 font-medium">{t("inspections.findingNo")}</th>
                                <th className="pb-2 pr-3 font-medium">{t("inspections.finding")}</th>
                                <th className="hidden pb-2 pr-3 font-medium md:table-cell">
                                  {t("inspections.due")}
                                </th>
                                <th className="pb-2 pr-3 font-medium">{t("inspections.status")}</th>
                                <th className="pb-2 font-medium">{t("inspections.action")}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((f) => (
                                <tr key={f.id} className="border-t border-border">
                                  <td className="py-2.5 pr-3 font-mono text-xs text-muted-foreground">
                                    {f.itemNo ?? t("emDash")}
                                  </td>
                                  <td className="py-2.5 pr-3">
                                    <div>{f.description}</div>
                                    {f.legalBasis ? (
                                      <div className="text-xs text-muted-foreground">
                                        {f.legalBasis}
                                      </div>
                                    ) : null}
                                  </td>
                                  <td className="hidden py-2.5 pr-3 text-xs text-muted-foreground md:table-cell">
                                    {f.dueAt ?? t("emDash")}
                                  </td>
                                  <td className="py-2.5 pr-3">
                                    <StatusPill
                                      status={f.status}
                                      dueAt={f.dueAt}
                                      label={findingStatusLabel(f.status, f.dueAt)}
                                    />
                                  </td>
                                  <td className="py-2.5">
                                    <div className="flex flex-wrap gap-2 text-xs">
                                      {list.canManage &&
                                      (f.status === "open" || f.status === "disputed") ? (
                                        <button
                                          type="button"
                                          className="underline disabled:opacity-40"
                                          disabled={locked}
                                          onClick={() => setRemediateTarget(f)}
                                        >
                                          {t("inspections.remediate")}
                                        </button>
                                      ) : null}
                                      {list.canManage && f.status === "open" ? (
                                        <button
                                          type="button"
                                          className="underline disabled:opacity-40"
                                          disabled={locked}
                                          onClick={() => setDisputeTarget(f)}
                                        >
                                          {t("inspections.dispute")}
                                        </button>
                                      ) : null}
                                      {list.canManage && f.status === "remediated" ? (
                                        <button
                                          type="button"
                                          className="underline disabled:opacity-40"
                                          disabled={locked}
                                          onClick={() =>
                                            void list.prove(
                                              f.id,
                                              new Date().toISOString().slice(0, 10),
                                            )
                                          }
                                        >
                                          {t("inspections.confirm")}
                                        </button>
                                      ) : null}
                                      {f.status === "remediated" ? (
                                        <button
                                          type="button"
                                          className="text-muted-foreground underline"
                                          onClick={() =>
                                            setNotifySubject({ type: "finding", id: f.id })
                                          }
                                        >
                                          {tn("record")}
                                        </button>
                                      ) : null}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">{t("inspections.noFindings")}</p>
                      )}

                      {list.canManage ? (
                        showAdd ? (
                          <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
                            <p className="text-xs font-medium">{t("inspections.addFinding")}</p>
                            <div className="grid gap-2 sm:grid-cols-2">
                              <Input
                                placeholder={t("inspections.findingNo")}
                                value={fNo}
                                onChange={(e) => setFNo(e.target.value)}
                              />
                              <Input
                                type="date"
                                value={fDue}
                                onChange={(e) => setFDue(e.target.value)}
                              />
                              <Textarea
                                className="min-h-[72px] sm:col-span-2"
                                placeholder={t("inspections.finding")}
                                value={fDesc}
                                onChange={(e) => setFDesc(e.target.value)}
                                data-testid="finding-desc"
                              />
                              <Input
                                className="sm:col-span-2"
                                placeholder={t("inspections.legalBasis")}
                                value={fBasis}
                                onChange={(e) => setFBasis(e.target.value)}
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                size="sm"
                                disabled={busy || !fDesc.trim() || locked}
                                onClick={() => void submitFinding()}
                                data-testid="finding-save"
                              >
                                {t("save")}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={resetFindingForm}
                              >
                                {t("cancel")}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={locked}
                            className="text-xs text-muted-foreground underline underline-offset-2 disabled:opacity-40"
                            onClick={() => {
                              setAddFindingFor(insp.id);
                              setFNo(String((rows.length || 0) + 1));
                            }}
                            data-testid={`authority-add-finding-${insp.id}`}
                          >
                            {t("inspections.addFinding")}
                          </button>
                        )
                      ) : null}
                    </article>
                  );
                })}
              </section>
            ) : null}

            {list.tab === "sitzungen" ? (
              <section className="space-y-2" data-testid="authority-sessions">
                <SessionsList
                  sessions={list.sessions}
                  disclosedBySession={disclosedBySession}
                  canManage={list.canManage}
                  locked={locked}
                  onRecordInspection={prefillInspectionFromSession}
                />
              </section>
            ) : null}

            {list.tab === "notifications" ? (
              <section className="space-y-2" data-testid="authority-notifications">
                {list.notifications.map((n) => (
                  <div key={n.id} className="rounded-md border border-border px-4 py-3 text-sm">
                    <p className="font-medium">{n.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      {(["incident", "finding_remediation", "radiation", "accident", "metrology", "other"] as const).includes(
                        n.kind as "other",
                      )
                        ? tn(`kinds.${n.kind as "other"}`)
                        : n.kind}{" "}
                      · {n.state} · {n.recipientName}
                    </p>
                  </div>
                ))}
                {list.notifications.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("notifications.empty")}</p>
                ) : null}
              </section>
            ) : null}
          </div>
        </ListPageShell>
      </main>

      <Dialog open={Boolean(remediateTarget)} onOpenChange={(o) => !o && setRemediateTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dialog.remediateTitle")}</DialogTitle>
            <DialogDescription>{t("dialog.remediateHint")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
            <Input
              placeholder={t("dialog.notifyRecipient")}
              value={notifyRecipient}
              onChange={(e) => setNotifyRecipient(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              disabled={busy || !note.trim()}
              onClick={async () => {
                if (!remediateTarget || !note.trim()) return;
                setBusy(true);
                try {
                  await list.remediate(remediateTarget.id, note.trim(), {
                    notifyRecipient: notifyRecipient.trim() || null,
                  });
                  setRemediateTarget(null);
                  setNote("");
                  setNotifyRecipient("");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(disputeTarget)} onOpenChange={(o) => !o && setDisputeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("dialog.disputeTitle")}</DialogTitle>
            <DialogDescription>{t("dialog.disputeHint")}</DialogDescription>
          </DialogHeader>
          <Textarea value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} />
          <DialogFooter>
            <Button
              type="button"
              disabled={busy || !disputeReason.trim()}
              onClick={async () => {
                if (!disputeTarget || !disputeReason.trim()) return;
                setBusy(true);
                try {
                  await list.dispute(disputeTarget.id, disputeReason.trim());
                  setDisputeTarget(null);
                  setDisputeReason("");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t("dialog.disputeAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OpenSessionDialog
        open={discloseOpen}
        onOpenChange={setDiscloseOpen}
        busy={busy}
        defaultAudience={
          list.activeChecklist?.label?.replace(/,.*/, "").trim() || list.activeListCode
        }
        defaultChecklistCode={list.activeListCode}
        sites={sites}
        defaultScope={defaultScope}
        onSubmit={async (input) => {
          setBusy(true);
          try {
            await list.openDisclosure(input);
            setDiscloseOpen(false);
            list.setTab("sitzungen");
          } finally {
            setBusy(false);
          }
        }}
      />

      <RecordNotificationModal
        open={Boolean(notifySubject)}
        onOpenChange={(o) => {
          if (!o) setNotifySubject(null);
        }}
        subject={notifySubject}
        onRecorded={() => void list.refresh()}
      />
    </div>
  );
}
