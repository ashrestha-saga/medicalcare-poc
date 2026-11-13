"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/http/apiClient";
import { toast } from "@/store/toastStore";

type Line = { description: string; partNo?: string | null; qty?: number };

type Props = {
  serviceRequestId: string;
  disabled?: boolean;
  /** Optional lines from K-REP parts step; omitted → server uses MaintenanceEvent parts. */
  lines?: Line[];
};

function parseLinesFromNote(note: string | null | undefined): Line[] {
  if (!note?.trim()) return [];
  return note
    .split(/\n|;/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((description) => ({ description, qty: 1 }));
}

/** E80 — one-tap handoff of K-REP parts to disposition Bestellvorschläge. */
export function PartsProposalHandoffCard({
  serviceRequestId,
  disabled,
  lines,
}: Props) {
  const t = useTranslations("pruefpartner");
  const [busy, setBusy] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  const hasLines = Boolean(lines?.some((l) => l.description.trim()));

  async function handoff() {
    setBusy(true);
    try {
      const body =
        hasLines && lines
          ? { lines }
          : {};
      const res = await api<{ proposal: { id: string } }>(
        `/api/partner/requests/${encodeURIComponent(serviceRequestId)}/parts-proposal`,
        { method: "POST", body: JSON.stringify(body) },
      );
      setSavedId(res.proposal.id);
      toast.success(t("partsProposalDone"));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("partsProposalFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (savedId) {
    return (
      <div className="pp-note" data-t="ok" data-testid="inspect-parts-proposal-done">
        <b>{t("partsProposalDone")}</b>{" "}
        <span className="mono">{savedId}</span> · {t("partsProposalDoneHint")}
      </div>
    );
  }

  return (
    <section className="pp-card" data-testid="inspect-parts-proposal">
      <h4>{t("partsProposalTitle")}</h4>
      <div className="pp-card__body">
        <p className="pp-hint">{t("partsProposalHint")}</p>
        <Button
          type="button"
          className="pp-btn pp-btn--primary"
          disabled={disabled || busy}
          data-testid="inspect-parts-proposal-submit"
          onClick={() => void handoff()}
        >
          {t("partsProposalSubmit")}
        </Button>
      </div>
    </section>
  );
}

export { parseLinesFromNote };
