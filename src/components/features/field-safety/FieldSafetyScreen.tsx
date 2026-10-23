"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AccessDenied } from "@/components/features/shared/AccessDenied";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import {
  useFieldSafetyList,
  type FieldSafetyView,
} from "@/components/hooks/field-safety/useFieldSafetyList";
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
import type { FieldSafetyActionDTO, FieldSafetyDeviceActionDTO } from "@/interfaces";
import { api } from "@/lib/http/apiClient";
import { cn } from "@/lib/utils";

const VIEWS: FieldSafetyView[] = ["all", "open", "unmatched"];

type DeviceOpt = { id: string; inventoryNumber: string };
type ModelOpt = { id: string; displayName: string; basicUdiDi: string | null };

type ScopeDraft = {
  deviceModelId: string | null;
  modelLabel: string;
  basicUdiDi: string;
  serialFrom: string;
  serialTo: string;
};

const today = () => new Date().toISOString().slice(0, 10);

const emptyScope = (): ScopeDraft => ({
  deviceModelId: null,
  modelLabel: "",
  basicUdiDi: "",
  serialFrom: "",
  serialTo: "",
});

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

function formatScope(m: {
  modelLabel: string | null;
  basicUdiDi: string | null;
  serialFrom: string | null;
  serialTo: string | null;
  lotNumber: string | null;
}): string {
  const parts = [
    m.modelLabel,
    m.basicUdiDi ? `UDI ${m.basicUdiDi}` : null,
    m.serialFrom || m.serialTo
      ? `SN ${m.serialFrom ?? "…"}–${m.serialTo ?? "…"}`
      : null,
    m.lotNumber ? `Lot ${m.lotNumber}` : null,
  ].filter(Boolean);
  return parts.join(" · ") || "—";
}

function StatusChip({ open }: { open: boolean }) {
  const t = useTranslations("pages.fieldSafety");
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium lowercase",
        open
          ? "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100"
          : "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100",
      )}
    >
      {open ? t("status.open") : t("status.closed")}
    </span>
  );
}

function AffectedChip({
  affected,
}: {
  affected: boolean | null;
}) {
  const t = useTranslations("pages.fieldSafety");
  if (affected === null) {
    return (
      <span className="inline-flex rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
        {t("affected.check")}
      </span>
    );
  }
  if (affected) {
    return (
      <span className="inline-flex rounded-md bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-900 dark:bg-red-950/50 dark:text-red-100">
        {t("affected.yes")}
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
      {t("affected.no")}
    </span>
  );
}

function TernaryAffected({
  value,
  disabled,
  onChange,
}: {
  value: boolean | null;
  disabled?: boolean;
  onChange: (v: boolean | null) => void;
}) {
  const t = useTranslations("pages.fieldSafety");
  const opts: { v: boolean | null; label: string; tone: "stop" | "ok" | "warn" }[] = [
    { v: true, label: t("affected.yes"), tone: "stop" },
    { v: false, label: t("affected.no"), tone: "ok" },
    { v: null, label: t("affected.check"), tone: "warn" },
  ];
  return (
    <div className="flex flex-wrap gap-1">
      {opts.map((o) => {
        const pressed = value === o.v;
        return (
          <button
            key={String(o.v)}
            type="button"
            disabled={disabled}
            aria-pressed={pressed}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
              !pressed && "border-border bg-background text-foreground hover:border-primary/50",
              pressed && o.tone === "stop" && "border-red-600 bg-red-600 text-white",
              pressed && o.tone === "ok" && "border-emerald-600 bg-emerald-600 text-white",
              pressed && o.tone === "warn" && "border-amber-600 bg-amber-600 text-white",
              disabled && "opacity-50",
            )}
            onClick={() => onChange(o.v)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function FieldSafetyScreen() {
  const t = useTranslations("pages.fieldSafety");
  const list = useFieldSafetyList();
  const [createOpen, setCreateOpen] = useState(false);
  const [matchTarget, setMatchTarget] = useState<FieldSafetyActionDTO | null>(null);
  const [scopeTarget, setScopeTarget] = useState<FieldSafetyActionDTO | null>(null);
  const [devices, setDevices] = useState<DeviceOpt[]>([]);
  const [models, setModels] = useState<ModelOpt[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [scopes, setScopes] = useState<ScopeDraft[]>([]);
  const [scopeDraft, setScopeDraft] = useState<ScopeDraft>(emptyScope);
  const [busy, setBusy] = useState(false);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  const [reference, setReference] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [title, setTitle] = useState("");
  const [requiredAction, setRequiredAction] = useState("");
  const [affectedScope, setAffectedScope] = useState("");
  const [issuedAt, setIssuedAt] = useState(today);
  const [receivedAt, setReceivedAt] = useState(today);
  const [dueAt, setDueAt] = useState("");

  useEffect(() => {
    if (!createOpen && !matchTarget && !scopeTarget) return;
    void api<{ devices: Array<{ id: string; inventoryNumber: string }> }>(
      "/api/devices?state=released",
    )
      .then((res) =>
        setDevices(res.devices.map((d) => ({ id: d.id, inventoryNumber: d.inventoryNumber }))),
      )
      .catch(() => setDevices([]));
  }, [createOpen, matchTarget, scopeTarget]);

  useEffect(() => {
    if (!createOpen && !scopeTarget) return;
    void api<{
      models: Array<{ id: string; displayName: string; basicUdiDi: string | null }>;
    }>("/api/catalog/models")
      .then((res) =>
        setModels(
          res.models.map((m) => ({
            id: m.id,
            displayName: m.displayName,
            basicUdiDi: m.basicUdiDi,
          })),
        ),
      )
      .catch(() => setModels([]));
  }, [createOpen, scopeTarget]);

  if (!list.canView) {
    return (
      <AccessDenied
        title={t("title")}
        description={t("denied")}
        hint={t("denied")}
        testId="field-safety-denied"
      />
    );
  }

  const unmatchedOpen = list.actions.reduce(
    (n, a) => n + (a.closedAt ? 0 : a.unmatchedCount),
    0,
  );

  const addScopeFromDraft = () => {
    if (!scopeDraft.deviceModelId && !scopeDraft.basicUdiDi.trim()) return;
    setScopes((prev) => [...prev, { ...scopeDraft }]);
    setScopeDraft(emptyScope());
  };

  const submitCreate = async () => {
    const pendingScopes = [...scopes];
    if (scopeDraft.deviceModelId || scopeDraft.basicUdiDi.trim()) {
      pendingScopes.push(scopeDraft);
    }
    setBusy(true);
    try {
      await list.create({
        reference: reference.trim(),
        manufacturer: manufacturer.trim(),
        title: title.trim(),
        requiredAction: requiredAction.trim(),
        affectedScope: affectedScope.trim(),
        issuedAt,
        receivedAt,
        dueAt: dueAt || null,
        deviceInstanceIds: selectedIds,
        affectedModels: pendingScopes.map((s) => ({
          deviceModelId: s.deviceModelId,
          basicUdiDi: s.basicUdiDi.trim() || null,
          serialFrom: s.serialFrom.trim() || null,
          serialTo: s.serialTo.trim() || null,
        })),
      });
      setCreateOpen(false);
      setReference("");
      setManufacturer("");
      setTitle("");
      setRequiredAction("");
      setAffectedScope("");
      setSelectedIds([]);
      setScopes([]);
      setScopeDraft(emptyScope());
    } finally {
      setBusy(false);
    }
  };

  const submitAddScopes = async () => {
    if (!scopeTarget) return;
    const rows = [...scopes];
    if (scopeDraft.deviceModelId || scopeDraft.basicUdiDi.trim()) {
      rows.push(scopeDraft);
    }
    if (rows.length === 0) return;
    setBusy(true);
    try {
      await list.addAffectedModels(
        scopeTarget.id,
        rows.map((s) => ({
          deviceModelId: s.deviceModelId,
          basicUdiDi: s.basicUdiDi.trim() || null,
          serialFrom: s.serialFrom.trim() || null,
          serialTo: s.serialTo.trim() || null,
        })),
      );
      setScopeTarget(null);
      setScopes([]);
      setScopeDraft(emptyScope());
    } finally {
      setBusy(false);
    }
  };

  const toggleDevice = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const pickModel = (m: ModelOpt) => {
    setScopeDraft((prev) => ({
      ...prev,
      deviceModelId: m.id,
      modelLabel: m.displayName,
      basicUdiDi: m.basicUdiDi ?? prev.basicUdiDi,
    }));
  };

  const setAffected = (
    actionId: string,
    d: FieldSafetyDeviceActionDTO,
    affected: boolean | null,
  ) => {
    void list.matchDevice(actionId, {
      deviceInstanceId: d.deviceInstanceId,
      affected,
      actionTakenAt: affected === true ? d.actionTakenAt : null,
      actionNote: d.actionNote,
    });
  };

  const completeMeasure = (actionId: string, d: FieldSafetyDeviceActionDTO) => {
    void list.matchDevice(actionId, {
      deviceInstanceId: d.deviceInstanceId,
      affected: true,
      actionTakenAt: today(),
      actionNote: noteDrafts[d.id] ?? d.actionNote,
    });
  };

  const saveNote = (actionId: string, d: FieldSafetyDeviceActionDTO) => {
    const note = noteDrafts[d.id] ?? d.actionNote ?? "";
    void list.matchDevice(actionId, {
      deviceInstanceId: d.deviceInstanceId,
      affected: d.affected,
      actionTakenAt: d.actionTakenAt,
      actionNote: note.trim() || null,
    });
  };

  const scopeEditor = (
    <>
      <div className="space-y-1">
        <Label>{t("form.catalogModel")}</Label>
        <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto">
          {models.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("form.noModels")}</p>
          ) : (
            models.slice(0, 40).map((m) => (
              <Button
                key={m.id}
                type="button"
                size="sm"
                variant={scopeDraft.deviceModelId === m.id ? "default" : "outline"}
                onClick={() => pickModel(m)}
              >
                {m.displayName}
              </Button>
            ))
          )}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <Label>{t("form.udi")}</Label>
          <Input
            value={scopeDraft.basicUdiDi}
            onChange={(e) => setScopeDraft((p) => ({ ...p, basicUdiDi: e.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <Label>{t("form.serialFrom")}</Label>
          <Input
            value={scopeDraft.serialFrom}
            onChange={(e) => setScopeDraft((p) => ({ ...p, serialFrom: e.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <Label>{t("form.serialTo")}</Label>
          <Input
            value={scopeDraft.serialTo}
            onChange={(e) => setScopeDraft((p) => ({ ...p, serialTo: e.target.value }))}
          />
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!scopeDraft.deviceModelId && !scopeDraft.basicUdiDi.trim()}
        onClick={addScopeFromDraft}
      >
        {t("form.addScope")}
      </Button>
      {scopes.length > 0 ? (
        <ul className="space-y-1 text-xs">
          {scopes.map((s, i) => (
            <li key={i} className="flex items-center justify-between gap-2">
              <span>
                {formatScope({
                  modelLabel: s.modelLabel || null,
                  basicUdiDi: s.basicUdiDi || null,
                  serialFrom: s.serialFrom || null,
                  serialTo: s.serialTo || null,
                  lotNumber: null,
                })}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7"
                onClick={() => setScopes((prev) => prev.filter((_, j) => j !== i))}
              >
                {t("actions.remove")}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );

  return (
    <div className="p-work" data-testid="field-safety-page">
      <main className="p-main">
        <ListPageShell
          title={t("title")}
          description={t("description")}
          headerExtra={
            list.canCreate ? (
              <Button
                size="sm"
                onClick={() => {
                  setScopes([]);
                  setScopeDraft(emptyScope());
                  setCreateOpen(true);
                }}
                data-testid="field-safety-create"
              >
                {t("actions.record")}
              </Button>
            ) : undefined
          }
        >
          <div className="mb-4 flex flex-wrap gap-2">
            {VIEWS.map((key) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={list.view === key ? "default" : "outline"}
                className={cn(list.view === key && "pointer-events-none")}
                onClick={() => list.setView(key)}
                data-testid={`field-safety-view-${key}`}
              >
                {t(`views.${key}`)}
              </Button>
            ))}
          </div>

          {unmatchedOpen > 0 && list.view !== "open" ? (
            <div className="mb-4 rounded-lg border border-amber-300/40 bg-amber-50/80 px-3 py-2 text-sm text-amber-950 dark:bg-amber-950/25 dark:text-amber-50">
              <b>{t("banner.unmatchedTitle", { count: unmatchedOpen })}</b> {t("banner.unmatchedBody")}
            </div>
          ) : null}

          {list.loading ? (
            <p className="text-sm text-muted-foreground">{t("loading")}</p>
          ) : list.actions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            <ul className="space-y-4">
              {list.actions.map((a) => {
                const open = !a.closedAt;
                return (
                  <li
                    key={a.id}
                    className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
                    data-testid={`field-safety-${a.id}`}
                  >
                    <div className="space-y-3 p-4 sm:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusChip open={open} />
                            <h2 className="text-[15px] font-semibold leading-snug tracking-tight">
                              {a.title}
                            </h2>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {a.reference} · {a.manufacturer} · {t("meta.issued")}{" "}
                            {formatDate(a.issuedAt)} · {t("meta.received")}{" "}
                            {formatDate(a.receivedAt)}
                            {a.dueAt ? ` · ${t("meta.due")} ${formatDate(a.dueAt)}` : ""}
                            {a.closedAt
                              ? ` · ${t("meta.closed")} ${formatDate(a.closedAt)}`
                              : ""}
                          </p>
                          <p className="text-sm">
                            <b>{t("requiredAction")}</b> {a.requiredAction}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t("scopeLabel")} {a.affectedScope}
                            {a.affectedModels.length > 0
                              ? ` · ${a.affectedModels.map(formatScope).join("; ")}`
                              : ""}
                          </p>
                        </div>
                        {open && list.canCreate ? (
                          <div className="flex flex-wrap gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-xs"
                              onClick={() => {
                                setScopes([]);
                                setScopeDraft(emptyScope());
                                setScopeTarget(a);
                              }}
                            >
                              {t("actions.addModels")}
                            </Button>
                            {a.affectedModels.length > 0 ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs"
                                disabled={busy}
                                onClick={() => {
                                  setBusy(true);
                                  void list.suggestCandidates(a.id).finally(() => setBusy(false));
                                }}
                              >
                                {t("actions.suggest")}
                                {a.suggestedCandidateCount > 0
                                  ? ` (${a.suggestedCandidateCount})`
                                  : ""}
                              </Button>
                            ) : null}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs"
                              onClick={() => setMatchTarget(a)}
                            >
                              {t("actions.addDevices")}
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-8 text-xs"
                              onClick={() => void list.close(a.id)}
                            >
                              {t("actions.close")}
                            </Button>
                          </div>
                        ) : null}
                      </div>

                      {a.deviceActions.length > 0 ? (
                        <div className="overflow-x-auto rounded-lg border border-border">
                          <table className="w-full min-w-[640px] text-left text-sm">
                            <thead className="border-b border-border bg-muted/30 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                              <tr>
                                <th className="px-3 py-2">{t("col.device")}</th>
                                <th className="px-3 py-2">{t("col.affected")}</th>
                                <th className="px-3 py-2">{t("col.done")}</th>
                                <th className="px-3 py-2">{t("col.note")}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {a.deviceActions.map((d) => {
                                const measurePending =
                                  d.affected === true && d.actionTakenAt == null;
                                const noteVal = noteDrafts[d.id] ?? d.actionNote ?? "";
                                return (
                                  <tr key={d.id} className="border-b border-border last:border-0">
                                    <td className="px-3 py-3 align-top">
                                      <b className="font-mono text-xs">
                                        {d.inventoryNumber ?? d.deviceInstanceId}
                                      </b>
                                    </td>
                                    <td className="px-3 py-3 align-top">
                                      {open && list.canCreate ? (
                                        <TernaryAffected
                                          value={d.affected}
                                          disabled={busy}
                                          onChange={(v) => setAffected(a.id, d, v)}
                                        />
                                      ) : (
                                        <AffectedChip affected={d.affected} />
                                      )}
                                    </td>
                                    <td className="px-3 py-3 align-top text-xs">
                                      {d.actionTakenAt ? (
                                        <span className="font-mono">
                                          {formatDate(d.actionTakenAt)}
                                        </span>
                                      ) : open && list.canCreate && measurePending ? (
                                        <button
                                          type="button"
                                          className="font-semibold text-primary hover:underline"
                                          onClick={() => completeMeasure(a.id, d)}
                                        >
                                          {t("actions.measureDone")}
                                        </button>
                                      ) : (
                                        <span className="text-muted-foreground">—</span>
                                      )}
                                    </td>
                                    <td className="px-3 py-3 align-top">
                                      {open && list.canCreate ? (
                                        <Input
                                          className="h-8 max-w-[220px] text-xs"
                                          value={noteVal}
                                          placeholder={t("col.note")}
                                          onChange={(e) =>
                                            setNoteDrafts((prev) => ({
                                              ...prev,
                                              [d.id]: e.target.value,
                                            }))
                                          }
                                          onBlur={() => {
                                            if ((d.actionNote ?? "") !== noteVal) {
                                              saveNote(a.id, d);
                                            }
                                          }}
                                        />
                                      ) : (
                                        <span className="text-xs text-muted-foreground">
                                          {d.actionNote || "—"}
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      ) : open ? (
                        <p className="text-xs text-muted-foreground">{t("noDevices")}</p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ListPageShell>
      </main>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("form.createTitle")}</DialogTitle>
            <DialogDescription>{t("form.createHint")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>{t("form.reference")}</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{t("form.manufacturer")}</Label>
              <Input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>{t("form.titleField")}</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>{t("form.requiredAction")}</Label>
              <Textarea
                value={requiredAction}
                onChange={(e) => setRequiredAction(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>{t("form.scope")}</Label>
              <Textarea
                value={affectedScope}
                onChange={(e) => setAffectedScope(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-1">
              <Label>{t("form.issued")}</Label>
              <Input type="date" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{t("form.received")}</Label>
              <Input
                type="date"
                value={receivedAt}
                onChange={(e) => setReceivedAt(e.target.value)}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>{t("form.due")}</Label>
              <Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </div>
            <div className="space-y-2 border-t pt-3 sm:col-span-2">
              <Label>{t("form.models")}</Label>
              <p className="text-xs text-muted-foreground">{t("form.modelsHint")}</p>
              {scopeEditor}
            </div>
            <div className="sm:col-span-2">
              <Label>{t("form.devices")}</Label>
              <div className="mt-2 flex max-h-40 flex-wrap gap-2 overflow-y-auto">
                {devices.map((d) => (
                  <Button
                    key={d.id}
                    type="button"
                    size="sm"
                    variant={selectedIds.includes(d.id) ? "default" : "outline"}
                    onClick={() => toggleDevice(d.id)}
                  >
                    {d.inventoryNumber}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              {t("actions.cancel")}
            </Button>
            <Button
              type="button"
              disabled={
                busy ||
                !reference.trim() ||
                !manufacturer.trim() ||
                !title.trim() ||
                !requiredAction.trim() ||
                !affectedScope.trim()
              }
              onClick={() => void submitCreate()}
            >
              {t("actions.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!scopeTarget}
        onOpenChange={(o) => {
          if (!o) {
            setScopeTarget(null);
            setScopes([]);
            setScopeDraft(emptyScope());
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("form.addModelsTitle")}</DialogTitle>
            <DialogDescription>{t("form.addModelsHint")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">{scopeEditor}</div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setScopeTarget(null)}>
              {t("actions.cancel")}
            </Button>
            <Button
              type="button"
              disabled={
                busy ||
                (scopes.length === 0 &&
                  !scopeDraft.deviceModelId &&
                  !scopeDraft.basicUdiDi.trim())
              }
              onClick={() => void submitAddScopes()}
            >
              {t("actions.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!matchTarget} onOpenChange={(o) => !o && setMatchTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("form.addDevicesTitle")}</DialogTitle>
            <DialogDescription>{t("form.addDevicesHint")}</DialogDescription>
          </DialogHeader>
          <div className="flex max-h-60 flex-wrap gap-2 overflow-y-auto">
            {devices.map((d) => {
              const already = matchTarget?.deviceActions.some((x) => x.deviceInstanceId === d.id);
              return (
                <Button
                  key={d.id}
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={already || busy}
                  onClick={() => {
                    if (!matchTarget) return;
                    setBusy(true);
                    void list
                      .matchDevice(matchTarget.id, {
                        deviceInstanceId: d.id,
                        affected: null,
                      })
                      .finally(() => setBusy(false));
                  }}
                >
                  {d.inventoryNumber}
                  {already ? " ✓" : ""}
                </Button>
              );
            })}
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setMatchTarget(null)}>
              {t("actions.done")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
