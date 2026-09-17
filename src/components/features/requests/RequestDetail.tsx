"use client";

import type { RequestDetailProps } from "@/interfaces";
import { Spinner } from "@/components/ui/Loading";
import { formatWhen, stateTone, useRequestTransition } from "@/components/hooks/requests";

export function RequestDetail({ request, canWork, onBack, onUpdated }: RequestDetailProps) {
  const {
    busy,
    completing,
    workNote,
    setWorkNote,
    startable,
    completable,
    start,
    complete,
    openComplete,
    cancelComplete,
  } = useRequestTransition(request, onUpdated);

  return (
    <div className="p-requests__detail" data-testid="request-detail">
      <section className="p-devhead p-requests__head">
        <button type="button" className="p-close" onClick={onBack} aria-label="Back to list">
          ×
        </button>
        <h2>{request.reference}</h2>
        <div className="codes">
          <span>{request.serviceType}</span>
          <span data-tone={stateTone(request.state)}>{request.state}</span>
        </div>
      </section>

      <div className="p-requests__body">
        <dl className="p-ext-dl p-requests__meta">
          <div className="p-ext-row">
            <dt>Raised by</dt>
            <dd>{request.raisedBy ?? "—"}</dd>
          </div>
          <div className="p-ext-row">
            <dt>Created</dt>
            <dd>{formatWhen(request.createdAt)}</dd>
          </div>
          <div className="p-ext-row">
            <dt>Location</dt>
            <dd>{request.locationText}</dd>
          </div>
          {request.priority && (
            <div className="p-ext-row">
              <dt>Priority</dt>
              <dd>{request.priority}</dd>
            </div>
          )}
          {request.note && (
            <div className="p-ext-row">
              <dt>Request note</dt>
              <dd>{request.note}</dd>
            </div>
          )}
          <div className="p-ext-row">
            <dt>Subject</dt>
            <dd>
              {request.subjectType} · {request.subjectId}
            </dd>
          </div>
        </dl>

        <p className="p-sec-title">History</p>
        <ul className="p-requests__timeline" data-testid="request-timeline">
          {request.statusEvents.map((e, i) => (
            <li key={`${e.changedAt}-${e.state}-${i}`}>
              <span className="p-requests__tl-state" data-tone={stateTone(e.state)}>
                {e.state}
              </span>
              <span className="p-requests__tl-meta">
                {formatWhen(e.changedAt)}
                {e.actor ? ` · ${e.actor}` : ""}
                {e.source ? ` · ${e.source}` : ""}
              </span>
              {e.note && <p className="p-requests__tl-note">{e.note}</p>}
            </li>
          ))}
        </ul>

        {canWork && startable && !completing && (
          <div className="p-requests__actions">
            <button
              type="button"
              className="p-cta"
              disabled={busy}
              onClick={() => void start()}
              data-testid="start-work"
            >
              {busy ? <Spinner /> : "Start work"}
            </button>
          </div>
        )}

        {canWork && completable && !completing && (
          <div className="p-requests__actions">
            <button
              type="button"
              className="p-cta"
              disabled={busy}
              onClick={openComplete}
              data-testid="open-complete"
            >
              Complete maintenance
            </button>
          </div>
        )}

        {canWork && completing && (
          <div className="p-requests__complete" data-testid="complete-form">
            <p className="p-sec-title">Work note</p>
            <div className="p-field">
              <label htmlFor="work-note">
                What was done <span className="p-req" aria-hidden="true">*</span>
              </label>
              <textarea
                id="work-note"
                className="field"
                rows={4}
                value={workNote}
                onChange={(e) => setWorkNote(e.target.value)}
                placeholder="Inspection result, parts used, findings…"
                data-testid="work-note"
              />
            </div>
            <div className="p-requests__actions">
              <button
                type="button"
                className="p-cta"
                disabled={busy}
                onClick={() => void complete()}
                data-testid="submit-complete"
              >
                {busy ? <Spinner /> : "Mark completed"}
              </button>
              <button type="button" className="p-cta ghost" disabled={busy} onClick={cancelComplete}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
