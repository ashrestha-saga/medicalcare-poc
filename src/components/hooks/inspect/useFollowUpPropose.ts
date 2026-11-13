"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { api, ApiError } from "@/lib/http/apiClient";

/** Client logic for proposing a Nachbesuch from a failed protocol step. */
export function useFollowUpPropose(reference: string) {
  const t = useTranslations("pruefpartner");
  const [open, setOpen] = useState(false);
  const [needs, setNeeds] = useState("");
  const [duration, setDuration] = useState("60");
  const [urgency, setUrgency] = useState<"high" | "normal">("normal");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedRef, setSavedRef] = useState<string | null>(null);

  async function propose() {
    const text = needs.trim();
    if (!text) {
      setErr(t("followUpNeedsRequired"));
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await api<{ reference: string }>(
        `/api/partner/disposition/${encodeURIComponent(reference)}/follow-up`,
        {
          method: "POST",
          body: JSON.stringify({
            followUpNeeds: `${text}\n(${t("followUpDuration")}: ${duration} min)`,
            followUpUrgency: urgency,
            reason: "instandsetzung",
          }),
        },
      );
      setSavedRef(res.reference);
      setOpen(false);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : t("followUpFailed"));
    } finally {
      setBusy(false);
    }
  }

  return {
    open,
    setOpen,
    needs,
    setNeeds,
    duration,
    setDuration,
    urgency,
    setUrgency,
    busy,
    err,
    savedRef,
    propose,
  };
}
