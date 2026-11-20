"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { ServiceRequestDTO, ServiceRequestQuoteDTO } from "@/interfaces";
import { api } from "@/lib/apiClient";
import { displayEuroText } from "@/lib/euro";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { AccessDenied } from "@/components/features/shared/AccessDenied";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/store/toastStore";

type Props = {
  /** Service request id or reference — when omitted, show an input. */
  requestId?: string;
  /** When provided (e.g. request detail), skip fetch. */
  quote?: ServiceRequestQuoteDTO | null;
  onDecided?: () => void;
  /** When embedded on request detail, hide AccessDenied (panel simply omitted). */
  embed?: boolean;
};

/** R10 clinic quote decide — POST /api/requests/:reference/quote/decide. */
export function QuoteDecidePanel({
  requestId: requestIdProp,
  quote: quoteProp,
  onDecided,
  embed,
}: Props) {
  const t = useTranslations("repairs.quote");
  const { checkPermission } = usePermissions();
  const canDecide = checkPermission("requests:approve");
  const [requestId, setRequestId] = useState(requestIdProp ?? "");
  const [quote, setQuote] = useState<ServiceRequestQuoteDTO | null | undefined>(
    quoteProp === undefined ? undefined : quoteProp,
  );
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [decisionNote, setDecisionNote] = useState("");
  const [saving, setSaving] = useState<"approved" | "rejected" | null>(null);

  const loadQuote = useCallback(async (id: string) => {
    setLoadingQuote(true);
    try {
      const req = await api<ServiceRequestDTO>(
        `/api/service-requests/${encodeURIComponent(id)}`,
      );
      setQuote(req.quote);
    } catch {
      setQuote(null);
    } finally {
      setLoadingQuote(false);
    }
  }, []);

  useEffect(() => {
    if (quoteProp !== undefined) {
      setQuote(quoteProp);
      return;
    }
    const id = (requestIdProp ?? "").trim();
    if (!id) {
      setQuote(undefined);
      return;
    }
    void loadQuote(id);
  }, [quoteProp, requestIdProp, loadQuote]);

  if (!canDecide) {
    return embed ? null : <AccessDenied title={t("title")} testId="quote-decide-denied" />;
  }

  async function decide(decision: "approved" | "rejected") {
    const id = (requestIdProp ?? requestId).trim();
    if (!id) return;
    if (decision === "rejected" && !decisionNote.trim()) {
      toast.error(t("rejectNoteRequired"));
      return;
    }
    setSaving(decision);
    try {
      await api(`/api/requests/${encodeURIComponent(id)}/quote/decide`, {
        method: "POST",
        body: JSON.stringify({
          decision,
          decisionNote: decisionNote.trim() || null,
        }),
      });
      toast.success(decision === "approved" ? t("approved") : t("rejected"));
      setDecisionNote("");
      if (quoteProp === undefined) {
        await loadQuote(id);
      }
      onDecided?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error"));
    } finally {
      setSaving(null);
    }
  }

  const resolvedId = (requestIdProp ?? requestId).trim();
  const hasQuoteValue = Boolean(
    quote && (quote.amountText.trim() || quote.scopeText.trim()),
  );
  const canAct = hasQuoteValue && quote?.decision === "open";

  return (
    <div className="space-y-4" data-testid="quote-decide-panel">
      <header>
        <h2 className="text-base font-semibold tracking-tight">{t("title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      {!requestIdProp ? (
        <div className="space-y-1.5">
          <Label htmlFor="quote-request-id">{t("requestId")}</Label>
          <Input
            id="quote-request-id"
            value={requestId}
            onChange={(e) => setRequestId(e.target.value)}
            onBlur={() => {
              const id = requestId.trim();
              if (id) void loadQuote(id);
            }}
            required
            data-testid="quote-request-id"
          />
        </div>
      ) : null}

      {loadingQuote ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : !hasQuoteValue ? (
        <p className="text-sm text-muted-foreground" data-testid="quote-empty">
          {t("empty")}
        </p>
      ) : (
        <>
          <dl className="space-y-2 rounded-md border border-border bg-muted/30 p-3 text-sm">
            <div className="grid gap-1 sm:grid-cols-[8rem_1fr]">
              <dt className="text-muted-foreground">{t("amount")}</dt>
              <dd className="font-medium text-foreground" data-testid="quote-amount">
                {displayEuroText(quote!.amountText)}
              </dd>
            </div>
            <div className="grid gap-1 sm:grid-cols-[8rem_1fr]">
              <dt className="text-muted-foreground">{t("scope")}</dt>
              <dd className="text-foreground" data-testid="quote-scope">
                {quote!.scopeText}
              </dd>
            </div>
            <div className="grid gap-1 sm:grid-cols-[8rem_1fr]">
              <dt className="text-muted-foreground">{t("status")}</dt>
              <dd data-testid="quote-status">
                {t(`status_${quote!.decision}`)}
              </dd>
            </div>
            {quote!.decision !== "open" && quote!.decidedBy ? (
              <div className="grid gap-1 sm:grid-cols-[8rem_1fr]">
                <dt className="text-muted-foreground">{t("decidedBy")}</dt>
                <dd>{quote!.decidedBy}</dd>
              </div>
            ) : null}
            {quote!.decisionNote ? (
              <div className="grid gap-1 sm:grid-cols-[8rem_1fr]">
                <dt className="text-muted-foreground">{t("decisionNote")}</dt>
                <dd>{quote!.decisionNote}</dd>
              </div>
            ) : null}
          </dl>

          {canAct ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="quote-note">{t("decisionNote")}</Label>
                <Textarea
                  id="quote-note"
                  value={decisionNote}
                  onChange={(e) => setDecisionNote(e.target.value)}
                  rows={3}
                  data-testid="quote-decision-note"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={Boolean(saving) || !resolvedId}
                  onClick={() => void decide("approved")}
                  data-testid="quote-approve"
                >
                  {saving === "approved" ? t("saving") : t("approve")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={Boolean(saving) || !resolvedId}
                  onClick={() => void decide("rejected")}
                  data-testid="quote-reject"
                >
                  {saving === "rejected" ? t("saving") : t("reject")}
                </Button>
              </div>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
