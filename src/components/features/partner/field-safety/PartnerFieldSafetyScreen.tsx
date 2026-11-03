"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { AccessDenied } from "@/components/features/shared/AccessDenied";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import {
  AdminListCard,
  ResponsiveTableSwitch,
} from "@/components/features/shared/ResponsiveTableSwitch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/http/apiClient";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { toast } from "@/store/toastStore";
import { cn } from "@/lib/utils";

type PreviewTenant = {
  tenantId: string;
  tenantName: string;
  tenantCode: string | null;
  deviceCount: number;
  modelId: string | null;
  matchedModelLabel: string;
};

type NoticeRow = {
  id: string;
  rolloutKey: string;
  reference: string;
  title: string;
  manufacturer: string;
  modelLabel: string | null;
  affectedScope: string;
  dueAt: string | null;
  recordedAt: string | null;
  sourceOrganisationId: string | null;
  status: "closed" | "measure" | "reconciliation";
  tenantId: string;
  tenantName: string;
  tenantCode: string | null;
  closedAt: string | null;
};

type FormState = {
  reference: string;
  manufacturer: string;
  modelLabel: string;
  dueAt: string;
  title: string;
  requiredAction: string;
  affectedScope: string;
};

const emptyForm = (): FormState => ({
  reference: "",
  manufacturer: "",
  modelLabel: "",
  dueAt: "",
  title: "",
  requiredAction: "",
  affectedScope: "",
});

function statusLabel(
  t: ReturnType<typeof useTranslations<"console">>,
  status: NoticeRow["status"],
): string {
  if (status === "closed") return t("fieldSafetyStatusClosed");
  if (status === "measure") return t("fieldSafetyStatusMeasure");
  return t("fieldSafetyStatusRecon");
}

/** Partner console — manufacturer notice record + rollout (v14-A mockup). */
export function PartnerFieldSafetyScreen() {
  const t = useTranslations("console");
  const tCommon = useTranslations("common");
  const { checkPermission } = usePermissions();
  const canRollout = checkPermission("fieldsafety:rollout");
  const canView =
    canRollout || checkPermission("console:customers:view");

  const [form, setForm] = useState<FormState>(emptyForm);
  const [preview, setPreview] = useState<PreviewTenant[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewed, setPreviewed] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [rolloutBusy, setRolloutBusy] = useState(false);
  const [rows, setRows] = useState<NoticeRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const patch = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (key === "modelLabel" || key === "manufacturer") {
      setPreviewed(false);
      setPreview([]);
      setSelected(new Set());
    }
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ rows: NoticeRow[] }>("/api/partner/field-safety/rollout");
      setRows(data.rows ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("fieldSafetyLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (canView) void refresh();
  }, [canView, refresh]);

  const checkTenants = async () => {
    if (!form.modelLabel.trim()) {
      toast.error(t("fieldSafetyModelRequired"));
      return;
    }
    setPreviewBusy(true);
    try {
      const q = new URLSearchParams({ modelLabel: form.modelLabel.trim() });
      if (form.manufacturer.trim()) q.set("manufacturer", form.manufacturer.trim());
      const data = await api<{ tenants: PreviewTenant[] }>(
        `/api/partner/field-safety/preview?${q.toString()}`,
      );
      setPreview(data.tenants);
      setSelected(new Set(data.tenants.map((x) => x.tenantId)));
      setPreviewed(true);
      if (data.tenants.length === 0) toast.info(t("fieldSafetyPreviewEmpty"));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("fieldSafetyPreviewFailed"));
    } finally {
      setPreviewBusy(false);
    }
  };

  const toggleTenant = (tenantId: string, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(tenantId);
      else next.delete(tenantId);
      return next;
    });
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canRollout) return;
    if (selected.size === 0) {
      toast.error(t("fieldSafetySelectTenants"));
      return;
    }
    setRolloutBusy(true);
    try {
      const res = await api<{ created: number }>("/api/partner/field-safety/rollout", {
        method: "POST",
        body: JSON.stringify({
          reference: form.reference.trim(),
          title: form.title.trim(),
          manufacturer: form.manufacturer.trim(),
          requiredAction: form.requiredAction.trim(),
          affectedScope: form.affectedScope.trim() || undefined,
          modelLabel: form.modelLabel.trim() || undefined,
          dueAt: form.dueAt.trim() || null,
          tenantIds: [...selected],
        }),
      });
      toast.success(t("fieldSafetyCreated", { count: res.created }));
      setForm(emptyForm());
      setPreview([]);
      setSelected(new Set());
      setPreviewed(false);
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("fieldSafetyCreateFailed"));
    } finally {
      setRolloutBusy(false);
    }
  };

  const selectedCount = selected.size;

  const table = useMemo(
    () => (
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">{t("fieldSafetyColRef")}</th>
              <th className="px-3 py-2">{t("fieldSafetyColMfrModel")}</th>
              <th className="px-3 py-2">{t("fieldSafetyColDue")}</th>
              <th className="px-3 py-2">{t("fieldSafetyColTenant")}</th>
              <th className="px-3 py-2">{t("fieldSafetyColCreated")}</th>
              <th className="px-3 py-2">{t("fieldSafetyColStatus")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border last:border-0" data-testid="partner-fsca-row">
                <td className="px-3 py-2.5 align-top">
                  <div className="font-medium">{row.reference}</div>
                  <div className="text-xs text-muted-foreground">{row.title}</div>
                </td>
                <td className="px-3 py-2.5 align-top text-muted-foreground">
                  {[row.manufacturer, row.modelLabel].filter(Boolean).join(" · ") || "—"}
                </td>
                <td className="px-3 py-2.5 align-top tabular-nums">{row.dueAt ?? "—"}</td>
                <td className="px-3 py-2.5 align-top">
                  <div>{row.tenantName}</div>
                  {row.tenantCode ? (
                    <div className="text-xs text-muted-foreground">{row.tenantCode}</div>
                  ) : null}
                </td>
                <td className="px-3 py-2.5 align-top tabular-nums">{row.recordedAt ?? "—"}</td>
                <td className="px-3 py-2.5 align-top">
                  <Badge variant={row.status === "closed" ? "outline" : "secondary"}>
                    {statusLabel(t, row.status)}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
    [rows, t],
  );

  const cards = (
    <div className="space-y-3">
      {rows.map((row) => (
        <AdminListCard
          key={row.id}
          title={row.reference}
          subtitle={row.title}
          testId="partner-fsca-card"
        >
          <p className="text-xs text-muted-foreground">
            {[row.manufacturer, row.modelLabel].filter(Boolean).join(" · ")}
          </p>
          <p className="text-xs text-muted-foreground">
            {row.tenantName}
            {row.tenantCode ? ` · ${row.tenantCode}` : ""}
          </p>
          <div className="mt-2">
            <Badge variant={row.status === "closed" ? "outline" : "secondary"}>
              {statusLabel(t, row.status)}
            </Badge>
          </div>
        </AdminListCard>
      ))}
    </div>
  );

  if (!canView) {
    return (
      <AccessDenied
        title={t("fieldSafetyTitle")}
        description={t("fieldSafetyDenied")}
        hint={tCommon("contactAdmin")}
        testId="partner-field-safety-denied"
      />
    );
  }

  return (
    <div className="p-work" data-testid="console-field-safety">
      <main className="p-main">
        <ListPageShell title={t("fieldSafetyTitle")} description={t("fieldSafetyIntro")}>
          <Alert className="mb-5 border-l-[3px] border-l-primary">
            <AlertDescription className="text-sm leading-relaxed">
              {t("fieldSafetyLogic")}
            </AlertDescription>
          </Alert>

          {canRollout ? (
            <section className="mb-8 rounded-md border border-border p-4 sm:p-5">
              <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {t("fieldSafetyRecordHeading")}
              </h2>
              <form className="mt-4 space-y-4" onSubmit={(e) => void onSubmit(e)}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="fsn-ref">{t("fieldSafetyRef")}</Label>
                    <Input
                      id="fsn-ref"
                      value={form.reference}
                      onChange={(e) => patch("reference", e.target.value)}
                      placeholder={t("fieldSafetyRefPh")}
                      required
                      data-testid="fsn-reference"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="fsn-mfr">{t("fieldSafetyManufacturer")}</Label>
                    <Input
                      id="fsn-mfr"
                      value={form.manufacturer}
                      onChange={(e) => patch("manufacturer", e.target.value)}
                      required
                      data-testid="fsn-manufacturer"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="fsn-model">{t("fieldSafetyModel")}</Label>
                    <Input
                      id="fsn-model"
                      value={form.modelLabel}
                      onChange={(e) => patch("modelLabel", e.target.value)}
                      placeholder={t("fieldSafetyModelPh")}
                      required
                      data-testid="fsn-model"
                    />
                    <p className="text-[11px] text-muted-foreground">{t("fieldSafetyModelHint")}</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="fsn-due">{t("fieldSafetyDue")}</Label>
                    <Input
                      id="fsn-due"
                      type="date"
                      value={form.dueAt}
                      onChange={(e) => patch("dueAt", e.target.value)}
                      data-testid="fsn-due"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fsn-title">{t("fieldSafetyNoticeTitle")}</Label>
                  <Input
                    id="fsn-title"
                    value={form.title}
                    onChange={(e) => patch("title", e.target.value)}
                    required
                    data-testid="fsn-title"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fsn-action">{t("fieldSafetyAction")}</Label>
                  <Textarea
                    id="fsn-action"
                    value={form.requiredAction}
                    onChange={(e) => patch("requiredAction", e.target.value)}
                    placeholder={t("fieldSafetyActionPh")}
                    required
                    rows={2}
                    data-testid="fsn-action"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fsn-scope">{t("fieldSafetyScope")}</Label>
                  <Textarea
                    id="fsn-scope"
                    value={form.affectedScope}
                    onChange={(e) => patch("affectedScope", e.target.value)}
                    placeholder={t("fieldSafetyScopePh")}
                    rows={2}
                    data-testid="fsn-scope"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={previewBusy}
                    onClick={() => void checkTenants()}
                    data-testid="fsn-preview"
                  >
                    {previewBusy ? "…" : t("fieldSafetyCheckTenants")}
                  </Button>
                  <Button
                    type="submit"
                    disabled={rolloutBusy || selectedCount === 0}
                    data-testid="fsn-create"
                  >
                    {rolloutBusy
                      ? "…"
                      : t("fieldSafetyCreateIn", { count: selectedCount })}
                  </Button>
                </div>
              </form>
            </section>
          ) : null}

          <section className="mb-8">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {t("fieldSafetyPreviewHeading")}
            </h2>
            {!previewed ? (
              <p className="text-sm text-muted-foreground">{t("fieldSafetyPreviewHint")}</p>
            ) : preview.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("fieldSafetyPreviewEmpty")}</p>
            ) : (
              <ul className="space-y-2 rounded-md border border-border p-3">
                {preview.map((tenant) => {
                  const on = selected.has(tenant.tenantId);
                  return (
                    <li
                      key={tenant.tenantId}
                      className={cn(
                        "flex items-start gap-3 rounded-md px-2 py-1.5",
                        on ? "bg-muted/50" : "opacity-70",
                      )}
                    >
                      <Checkbox
                        checked={on}
                        onCheckedChange={(v) => toggleTenant(tenant.tenantId, v === true)}
                        disabled={!canRollout}
                        aria-label={tenant.tenantName}
                      />
                      <div className="min-w-0 flex-1 text-sm">
                        <div className="font-medium">
                          {tenant.tenantName}
                          {tenant.tenantCode ? (
                            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                              {tenant.tenantCode}
                            </span>
                          ) : null}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t("fieldSafetyPreviewDevices", {
                            count: tenant.deviceCount,
                            model: tenant.matchedModelLabel,
                          })}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {t("fieldSafetyHistoryHeading")}
            </h2>
            {error ? (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            {loading ? <p className="text-sm text-muted-foreground">…</p> : null}
            {!loading && rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("fieldSafetyEmpty")}</p>
            ) : null}
            {!loading && rows.length > 0 ? (
              <ResponsiveTableSwitch table={table} cards={cards} />
            ) : null}
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              {t("fieldSafetyFooterNote")}
            </p>
          </section>
        </ListPageShell>
      </main>
    </div>
  );
}
