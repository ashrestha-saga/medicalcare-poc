"use client";

import {
  channelLabel,
  serviceRequestStateLabel,
  useSuccessState,
} from "@/components/hooks/service-request/useSuccessState";
import { InventarizeForm } from "./InventarizeForm";

export function SuccessState() {
  const {
    success,
    detail,
    records,
    dispatchSummary,
    online,
    isQueued,
    isService,
    title,
    checkTone,
    reset,
    showInventarize,
    inventarizeOffer,
    finishInventarize,
  } = useSuccessState();

  if (!success) return null;

  if (showInventarize && inventarizeOffer) {
    const deviceTitle =
      inventarizeOffer.tradeName?.trim() ||
      inventarizeOffer.modelName?.trim() ||
      "Gerät";
    return (
      <InventarizeForm
        offer={inventarizeOffer}
        deviceTitle={deviceTitle}
        onDone={finishInventarize}
      />
    );
  }

  return (
    <div className="p-done" data-testid={isQueued ? "queued-state" : "success-state"}>
      <div className="p-check" data-tone={checkTone}>
        {isQueued ? "…" : checkTone === "warn" ? "!" : checkTone === "mixed" ? "±" : "✓"}
      </div>
      <h2>{title}</h2>
      {isQueued ? (
        <p className="p-done-sub">
          {online
            ? "Wird gesendet, sobald möglich…"
            : "Wird automatisch gesendet, wenn die Verbindung wieder da ist."}
        </p>
      ) : (
        <p className="ref" data-testid="success-reference">
          {success.reference}
        </p>
      )}

      {detail && isService && !isQueued && (
        <>
          <section className="p-dispatch" data-testid="dispatch-results">
            <p className="p-sec-title">Versandkanäle</p>
            {records.length === 0 ? (
              <p className="p-done-sub">Keine Dispatch-Ziele konfiguriert.</p>
            ) : (
              <ul className="p-dispatch-list">
                {records.map((d) => (
                  <li key={`${d.target}-${d.timestamp}`} data-ok={d.success ? "1" : "0"} data-testid="dispatch-row">
                    <div className="p-dispatch-row">
                      <span className="p-dispatch-mark" aria-hidden>
                        {d.success ? "✓" : "✗"}
                      </span>
                      <div className="p-dispatch-main">
                        <strong>{channelLabel(d.target)}</strong>
                        <span className="p-dispatch-target">{d.target}</span>
                        {(d.detail || d.error) && (
                          <span className="p-dispatch-detail">{d.detail ?? d.error}</span>
                        )}
                        {d.httpStatus != null && (
                          <span className="p-dispatch-meta">
                            HTTP {d.httpStatus} · Versuch {d.attemptCount}
                          </span>
                        )}
                        {d.httpStatus == null && d.attemptCount > 1 && (
                          <span className="p-dispatch-meta">Versuch {d.attemptCount}</span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {dispatchSummary && (
              <p className="p-dispatch-summary" data-testid="dispatch-summary">
                {dispatchSummary.ok}/{dispatchSummary.total} Kanäle erfolgreich
                {dispatchSummary.fail > 0 ? ` · ${dispatchSummary.fail} fehlgeschlagen` : ""}
              </p>
            )}
          </section>

          <ol className="p-status-timeline" data-testid="status-timeline">
            {detail.statusEvents.map((e, i) => (
              <li key={`${e.state}-${e.changedAt}-${i}`}>
                <span className="t-mono">{serviceRequestStateLabel(e.state)}</span>
                {" · "}
                {e.source}
                {e.note ? ` — ${e.note}` : ""}
              </li>
            ))}
          </ol>
        </>
      )}

      <button type="button" className="p-cta" onClick={reset} data-testid="scan-next">
        Weiter scannen
      </button>
    </div>
  );
}
