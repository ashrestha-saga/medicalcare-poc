"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AccessDenied } from "@/components/features/shared/AccessDenied";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/apiClient";
import { useQueryParam } from "@/lib/navigation/searchParams";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { toast } from "@/store/toastStore";

type PendingRow = {
  id: string;
  reference: string;
  serviceType: string;
  state: string;
  externalOrgName: string | null;
  externalCommissionedAt: string | null;
  inventoryNumber: string | null;
  tradeName: string | null;
  dutyKey: string | null;
  dueAt: string | null;
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

/** R40 — clinic SV Bescheinigung intake for Fremdleistung orders. */
export function SvCertificateScreen() {
  const t = useTranslations("pages.svCertificate");
  const { checkPermission, permissionsLoading } = usePermissions();
  const canCreate = checkPermission("requests:approve");
  const referenceParam = useQueryParam("reference");

  const [pending, setPending] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reference, setReference] = useState(() => referenceParam ?? "");
  const [externalOrgName, setExternalOrgName] = useState("");
  const [certificateRef, setCertificateRef] = useState("");
  const [certificateDate, setCertificateDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [result, setResult] = useState<"passed" | "objected">("passed");
  const [defectsText, setDefectsText] = useState("");
  const [fileName, setFileName] = useState("");
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastRetention, setLastRetention] = useState<string | null>(null);

  const loadPending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ requests: PendingRow[] }>("/api/requests/external-pending");
      setPending(res.requests);
      if (!referenceParam && res.requests[0] && !reference) {
        setReference(res.requests[0].reference);
        setExternalOrgName(res.requests[0].externalOrgName ?? "");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errorLoad"));
    } finally {
      setLoading(false);
    }
  }, [reference, referenceParam, t]);

  useEffect(() => {
    if (!canCreate || permissionsLoading) return;
    void loadPending();
  }, [canCreate, permissionsLoading, loadPending]);

  useEffect(() => {
    if (!referenceParam) return;
    setReference(referenceParam);
    const row = pending.find((p) => p.reference === referenceParam);
    if (row?.externalOrgName) setExternalOrgName(row.externalOrgName);
  }, [referenceParam, pending]);

  if (permissionsLoading) {
    return (
      <div className="p-work" data-testid="sv-certificate-loading">
        <main className="p-main">
          <ListPageShell variant="compose" title={t("title")}>
            <p className="text-sm text-muted-foreground">…</p>
          </ListPageShell>
        </main>
      </div>
    );
  }

  if (!canCreate) {
    return <AccessDenied title={t("title")} testId="sv-certificate-denied" />;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reference.trim()) {
      toast.error(t("referenceRequired"));
      return;
    }
    if (!dataUrl) {
      toast.error(t("attachmentRequired"));
      return;
    }
    if (result === "objected" && !defectsText.trim()) {
      toast.error(t("defectsRequired"));
      return;
    }
    setSaving(true);
    setLastRetention(null);
    try {
      const res = await api<{
        result: { retentionUntil: string; office: string; externalResult: string };
      }>(`/api/requests/${encodeURIComponent(reference.trim())}/external-certificate`, {
        method: "POST",
        body: JSON.stringify({
          externalCertificateRef: certificateRef.trim(),
          externalCertificateDate: certificateDate,
          dataUrl,
          externalResult: result,
          externalDefectsText: result === "objected" ? defectsText.trim() : null,
          externalOrgName: externalOrgName.trim() || null,
        }),
      });
      toast.success(t("success"));
      setLastRetention(res.result.retentionUntil);
      setCertificateRef("");
      setDefectsText("");
      setFileName("");
      setDataUrl(null);
      await loadPending();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-work" data-testid="sv-certificate-page">
      <main className="p-main">
        <ListPageShell
          variant="compose"
          title={t("title")}
          description={t("description")}
          headerExtra={
            <Button type="button" size="sm" variant="outline" asChild>
              <Link href="/requests">{t("backToRequests")}</Link>
            </Button>
          }
        >
          {lastRetention ? (
            <p className="mb-4 text-sm text-muted-foreground" data-testid="sv-certificate-retention">
              {t("retentionNote", { date: lastRetention })}
            </p>
          ) : null}

          <form className="mx-auto flex max-w-xl flex-col gap-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="sv-ref">{t("reference")}</Label>
              <select
                id="sv-ref"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={reference}
                onChange={(e) => {
                  const next = e.target.value;
                  setReference(next);
                  const row = pending.find((p) => p.reference === next);
                  if (row?.externalOrgName) setExternalOrgName(row.externalOrgName);
                }}
                data-testid="sv-certificate-reference"
                required
              >
                <option value="">{loading ? t("loading") : t("referencePlaceholder")}</option>
                {pending.map((p) => (
                  <option key={p.id} value={p.reference}>
                    {p.reference}
                    {p.inventoryNumber ? ` · ${p.inventoryNumber}` : ""}
                    {p.externalOrgName ? ` · ${p.externalOrgName}` : ""}
                  </option>
                ))}
              </select>
              {!loading && pending.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("emptyPending")}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="sv-office">{t("office")}</Label>
              <Input
                id="sv-office"
                value={externalOrgName}
                onChange={(e) => setExternalOrgName(e.target.value)}
                data-testid="sv-certificate-office"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sv-nr">{t("certificateRef")}</Label>
                <Input
                  id="sv-nr"
                  value={certificateRef}
                  onChange={(e) => setCertificateRef(e.target.value)}
                  required
                  data-testid="sv-certificate-nr"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sv-date">{t("certificateDate")}</Label>
                <Input
                  id="sv-date"
                  type="date"
                  value={certificateDate}
                  onChange={(e) => setCertificateDate(e.target.value)}
                  required
                  data-testid="sv-certificate-date"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sv-result">{t("result")}</Label>
              <select
                id="sv-result"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={result}
                onChange={(e) => setResult(e.target.value as "passed" | "objected")}
                data-testid="sv-certificate-result"
              >
                <option value="passed">{t("resultPassed")}</option>
                <option value="objected">{t("resultObjected")}</option>
              </select>
            </div>

            {result === "objected" ? (
              <div className="space-y-2">
                <Label htmlFor="sv-defects">{t("defects")}</Label>
                <textarea
                  id="sv-defects"
                  className="min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={defectsText}
                  onChange={(e) => setDefectsText(e.target.value)}
                  required
                  data-testid="sv-certificate-defects"
                />
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="sv-file">{t("attachment")}</Label>
              <Input
                id="sv-file"
                type="file"
                accept="application/pdf,image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) {
                    setFileName("");
                    setDataUrl(null);
                    return;
                  }
                  setFileName(file.name);
                  setDataUrl(await fileToDataUrl(file));
                }}
                data-testid="sv-certificate-file"
              />
              {fileName ? (
                <p className="text-xs text-muted-foreground">{fileName}</p>
              ) : null}
            </div>

            <Button type="submit" disabled={saving} data-testid="sv-certificate-save">
              {saving ? t("saving") : t("save")}
            </Button>
          </form>
        </ListPageShell>
      </main>
    </div>
  );
}
