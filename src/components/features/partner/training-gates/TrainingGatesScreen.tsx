"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/store/toastStore";

type GateRow = {
  id: string;
  manufacturer: string;
  gate: "hint" | "block";
  setBy: string | null;
};

/** E79 — list/set manufacturer training gates via GET/PUT /api/partner/training-gates. */
export function TrainingGatesScreen() {
  const t = useTranslations("repairs.trainingGates");
  const [rows, setRows] = useState<GateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [manufacturer, setManufacturer] = useState("");
  const [gate, setGate] = useState<"hint" | "block">("hint");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api<{ gates: GateRow[] }>("/api/partner/training-gates");
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
    if (!manufacturer.trim()) return;
    setSaving(true);
    try {
      await api("/api/partner/training-gates", {
        method: "PUT",
        body: JSON.stringify({ manufacturer: manufacturer.trim(), gate }),
      });
      toast.success(t("saved"));
      setManufacturer("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-work space-y-6" data-testid="training-gates-page">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <form className="mx-auto max-w-xl space-y-3" onSubmit={onSubmit}>
        <div className="space-y-1.5">
          <Label htmlFor="tg-mfr">{t("manufacturer")}</Label>
          <Input
            id="tg-mfr"
            value={manufacturer}
            onChange={(e) => setManufacturer(e.target.value)}
            required
            data-testid="training-gate-manufacturer"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tg-gate">{t("gate")}</Label>
          <select
            id="tg-gate"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={gate}
            onChange={(e) => setGate(e.target.value as "hint" | "block")}
            data-testid="training-gate-value"
          >
            <option value="hint">{t("hint")}</option>
            <option value="block">{t("block")}</option>
          </select>
        </div>
        <Button type="submit" disabled={saving} data-testid="training-gate-submit">
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
                <th className="py-2 pr-3">{t("colManufacturer")}</th>
                <th className="py-2 pr-3">{t("colGate")}</th>
                <th className="py-2">{t("colSetBy")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/60">
                  <td className="py-2.5 pr-3">{r.manufacturer}</td>
                  <td className="py-2.5 pr-3">{r.gate === "block" ? t("block") : t("hint")}</td>
                  <td className="py-2.5">{r.setBy ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
