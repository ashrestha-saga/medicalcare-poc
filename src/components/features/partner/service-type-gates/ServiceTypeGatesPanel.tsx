"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/store/toastStore";

type OverridableBy = "none" | "service_lead" | "management";

type GateRow = {
  id: string;
  serviceType: string;
  qualificationCode: string;
  gate: "hint" | "block";
  overridableBy: OverridableBy;
  locked: boolean;
  setBy: string;
};

const EDITABLE_TYPES = ["konstanz", "dguv"] as const;

type Props = {
  /** Standalone page vs section under Staff (E89 mockup). */
  variant?: "page" | "embedded";
};

/** E89/A45 — list/set service-type qualification gates (konstanz/dguv overridableBy). */
export function ServiceTypeGatesPanel({ variant = "page" }: Props) {
  const t = useTranslations("partner.serviceTypeGates");
  const [rows, setRows] = useState<GateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [serviceType, setServiceType] = useState<(typeof EDITABLE_TYPES)[number]>("konstanz");
  const [overridableBy, setOverridableBy] = useState<OverridableBy>("service_lead");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ gates: GateRow[] }>("/api/partner/service-type-gates");
      setRows(res.gates);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api("/api/partner/service-type-gates", {
        method: "PUT",
        body: JSON.stringify({ serviceType, overridableBy }),
      });
      toast.success(t("saved"));
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error"));
    } finally {
      setSaving(false);
    }
  }

  function labelServiceType(key: string) {
    if (key === "sv") return t("typeSv");
    if (key === "konstanz") return t("typeKonstanz");
    if (key === "dguv") return t("typeDguv");
    return key;
  }

  function labelOverridableBy(value: OverridableBy) {
    if (value === "none") return t("overridableNone");
    if (value === "service_lead") return t("overridableServiceLead");
    return t("overridableManagement");
  }

  const embedded = variant === "embedded";
  const title = embedded ? t("embeddedTitle") : t("title");
  const subtitle = embedded ? t("embeddedSubtitle") : t("subtitle");

  return (
    <section
      className={embedded ? "mt-8 space-y-4 border-t border-border pt-6" : "space-y-6"}
      data-testid={embedded ? "service-type-gates-staff" : "service-type-gates-page"}
    >
      <header>
        <h2 className={embedded ? "text-base font-semibold tracking-tight" : "text-xl font-semibold tracking-tight"}>
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </header>

      <form
        className={embedded ? "grid max-w-2xl gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" : "mx-auto max-w-xl space-y-3"}
        onSubmit={onSubmit}
      >
        <div className="space-y-1.5">
          <Label htmlFor={embedded ? "stg-type-staff" : "stg-type"}>{t("serviceType")}</Label>
          <select
            id={embedded ? "stg-type-staff" : "stg-type"}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value as (typeof EDITABLE_TYPES)[number])}
            data-testid="service-type-gate-type"
          >
            {EDITABLE_TYPES.map((key) => (
              <option key={key} value={key}>
                {labelServiceType(key)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={embedded ? "stg-overridable-staff" : "stg-overridable"}>{t("overridableBy")}</Label>
          <select
            id={embedded ? "stg-overridable-staff" : "stg-overridable"}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={overridableBy}
            onChange={(e) => setOverridableBy(e.target.value as OverridableBy)}
            data-testid="service-type-gate-overridable"
          >
            <option value="none">{t("overridableNone")}</option>
            <option value="service_lead">{t("overridableServiceLead")}</option>
            <option value="management">{t("overridableManagement")}</option>
          </select>
        </div>
        <Button type="submit" disabled={saving} data-testid="service-type-gate-submit">
          {saving ? t("saving") : t("submit")}
        </Button>
      </form>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-3">{t("colServiceType")}</th>
                <th className="py-2 pr-3">{t("colQualification")}</th>
                <th className="py-2 pr-3">{t("colGate")}</th>
                <th className="py-2 pr-3">{t("colOverridableBy")}</th>
                <th className="py-2">{t("colLocked")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/60">
                  <td className="py-2.5 pr-3">{labelServiceType(r.serviceType)}</td>
                  <td className="py-2.5 pr-3 font-mono text-xs">{r.qualificationCode}</td>
                  <td className="py-2.5 pr-3">{r.gate === "block" ? t("block") : t("hint")}</td>
                  <td className="py-2.5 pr-3">{labelOverridableBy(r.overridableBy)}</td>
                  <td className="py-2.5">
                    {r.locked || r.serviceType === "sv" ? t("lockedYes") : t("lockedNo")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {embedded ? <p className="text-xs text-muted-foreground">{t("embeddedNote")}</p> : null}
    </section>
  );
}
