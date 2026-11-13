"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/apiClient";
import { toast } from "@/store/toastStore";

const STEPS = ["shipped", "at_workshop", "returned", "arrived"] as const;
type Step = (typeof STEPS)[number];

type Props = {
  reference: string;
};

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

/** R18 partner send-in — PUT /api/partner/requests/:id/send-in. */
export function SendInTimeline({ reference }: Props) {
  const t = useTranslations("repairs.sendIn");
  const [step, setStep] = useState<Step>("shipped");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [trackingRef, setTrackingRef] = useState("");
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const id = reference.trim();
    if (!id) return;
    setSaving(true);
    try {
      await api(`/api/partner/requests/${encodeURIComponent(id)}/send-in`, {
        method: "PUT",
        body: JSON.stringify({
          step,
          date,
          trackingRef: step === "shipped" ? trackingRef.trim() || null : null,
        }),
      });
      toast.success(t("success"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-work" data-testid="send-in-timeline">
      <main className="p-main">
        <ListPageShell
          variant="compose"
          title={t("title")}
          description={t("subtitle")}
          contentClassName="max-w-none"
          headerExtra={
            <Button asChild variant="outline" size="sm" className="h-8">
              <Link href={`/partner/orders/${encodeURIComponent(reference)}`}>
                {reference}
              </Link>
            </Button>
          }
        >
          <p className="mb-4 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {t("reference")}: {reference}
          </p>

          <form className="grid w-full gap-4" onSubmit={onSubmit}>
            <section className="rounded-lg border border-border bg-card p-4 sm:p-5">
              <div className="grid gap-4">
                <Field label={t("step")} htmlFor="send-in-step" required>
                  <select
                    id="send-in-step"
                    className={selectClass}
                    value={step}
                    onChange={(e) => setStep(e.target.value as Step)}
                    data-testid="send-in-step"
                  >
                    {STEPS.map((s) => (
                      <option key={s} value={s}>
                        {t(s)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("date")} htmlFor="send-in-date" required>
                  <Input
                    id="send-in-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </Field>
                {step === "shipped" ? (
                  <Field label={t("trackingRef")} htmlFor="send-in-tracking">
                    <Input
                      id="send-in-tracking"
                      value={trackingRef}
                      onChange={(e) => setTrackingRef(e.target.value)}
                      data-testid="send-in-tracking"
                    />
                  </Field>
                ) : null}
              </div>
            </section>

            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <Button type="submit" disabled={saving} data-testid="send-in-submit">
                {saving ? t("saving") : t("submit")}
              </Button>
              <Button asChild type="button" variant="outline">
                <Link href={`/partner/orders/${encodeURIComponent(reference)}`}>
                  {reference}
                </Link>
              </Button>
            </div>
          </form>
        </ListPageShell>
      </main>
    </div>
  );
}
