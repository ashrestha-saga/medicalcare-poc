"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { api, ApiError } from "@/lib/http/apiClient";

type SecondReason = "notfall" | "teile" | "kunde" | "sonstiges";

/** Site-card visit lifecycle: start, end, resume, second visit (E34). */
export function useSiteVisitStart(input: {
  siteId: string | null;
  visitId: string | null;
  references: string[];
  onChanged?: () => void;
}) {
  const t = useTranslations("pruefpartner");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setErr(null);
    try {
      await action();
      input.onChanged?.();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : t("visitStartFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function startVisit() {
    await run(async () => {
      await api<{ visitId: string; startedAt: string }>("/api/partner/inspect/visits/start", {
        method: "POST",
        body: JSON.stringify({
          siteId: input.siteId,
          references: input.references,
        }),
      });
    });
  }

  async function endVisit() {
    if (!input.visitId) {
      setErr(t("visitEndMissing"));
      return;
    }
    await run(async () => {
      await api(`/api/partner/inspect/visits/${encodeURIComponent(input.visitId!)}/end`, {
        method: "POST",
        body: "{}",
      });
    });
  }

  async function resumeVisit() {
    if (!input.visitId) {
      setErr(t("visitEndMissing"));
      return;
    }
    await run(async () => {
      await api(`/api/partner/inspect/visits/${encodeURIComponent(input.visitId!)}/resume`, {
        method: "POST",
        body: "{}",
      });
    });
  }

  async function startSecondVisit(reason: SecondReason, note: string) {
    if (!input.visitId) {
      setErr(t("visitEndMissing"));
      return;
    }
    await run(async () => {
      await api(`/api/partner/inspect/visits/${encodeURIComponent(input.visitId!)}/second`, {
        method: "POST",
        body: JSON.stringify({
          reason,
          note: note.trim() || null,
          references: input.references,
        }),
      });
    });
  }

  return { busy, err, startVisit, endVisit, resumeVisit, startSecondVisit };
}
