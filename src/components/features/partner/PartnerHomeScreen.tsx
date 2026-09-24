"use client";

import { usePartnerHome } from "@/components/hooks/partner/usePartnerHome";
import { Spinner } from "@/components/ui/Loading";
import { Alert, AlertDescription } from "@/components/ui/alert";

const SCOPE_LABELS: Record<string, string> = {
  inventory: "Inventory",
  "due-dates": "Due dates",
  inspection: "Inspection",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Administration",
  inspector: "Inspection partner",
  order: "Scheduling",
};

const JOB_TITLE_LABELS: Record<string, string> = {
  Betriebsleitung: "Operations management",
  Medizintechnik: "Medical engineering",
  Sachverständiger: "Expert assessor",
  Disposition: "Scheduling",
};

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

function contractPeriod(validFrom: string, validTo: string | null): string {
  const from = formatDate(validFrom);
  if (!validTo) return `${from} — no expiry`;
  return `${from} — ${formatDate(validTo)}`;
}

export function PartnerHomeScreen() {
  const { data, error, loading } = usePartnerHome();

  return (
    <div className="p-work" data-testid="partner-home-page">
      <main className="p-main">
        <div className="p-mgmt" data-testid="partner-home-screen">
          <section className="p-devhead p-mgmt__head">
            <h2>Partner portal</h2>
            <p className="p-mgmt__sub">
              Your organisation, who has access for your company, and which clinics you are
              contracted to serve.
            </p>
          </section>

          {loading ? (
            <div className="p-wait p-mgmt__loading">
              <Spinner />
            </div>
          ) : null}

          {error ? (
            <div className="p-mgmt__alert">
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          ) : null}

          {!loading && data ? (
            <>
              <section className="p-mgmt__panel" style={{ margin: "8px 18px 0" }}>
                <p className="p-sec-title">Organisation</p>
                <dl className="p-ext-dl p-mgmt__meta">
                  <div className="p-ext-row">
                    <dt>Name</dt>
                    <dd>{data.organisationName}</dd>
                  </div>
                  <div className="p-ext-row">
                    <dt>Code</dt>
                    <dd>{data.organisationCode}</dd>
                  </div>
                  {data.contact ? (
                    <div className="p-ext-row">
                      <dt>Contact</dt>
                      <dd>{data.contact}</dd>
                    </div>
                  ) : null}
                  <div className="p-ext-row">
                    <dt>Your role</dt>
                    <dd>{ROLE_LABELS[data.myAppRole] ?? data.myAppRole}</dd>
                  </div>
                </dl>
              </section>

              <div className="p-mgmt__grid">
                <section className="p-mgmt__panel">
                  <p className="p-sec-title">People with access</p>
                  {data.people.length === 0 ? (
                    <p className="p-mgmt__empty">No active partner people are assigned.</p>
                  ) : (
                    <ul className="p-mgmt__people" data-testid="partner-people">
                      {data.people.map((person) => {
                        const title = person.jobTitle
                          ? (JOB_TITLE_LABELS[person.jobTitle] ?? person.jobTitle)
                          : null;
                        return (
                          <li key={person.id} className="p-mgmt__person">
                            <div>
                              <b>{person.name}</b>
                              {title ? <span>{title}</span> : null}
                            </div>
                            <em className="p-mgmt__role">{ROLE_LABELS[person.appRole] ?? person.appRole}</em>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <p className="p-mgmt__hint">
                    From your organisation&apos;s assignment. Clinics see the same list on their
                    Management page.
                  </p>
                </section>

                <section className="p-mgmt__panel">
                  <p className="p-sec-title">Contracted clinics</p>
                  {data.clinics.length === 0 ? (
                    <p className="p-mgmt__empty" data-testid="partner-clinics-empty">
                      No active service contracts for this organisation.
                    </p>
                  ) : (
                    <ul className="p-mgmt__people" data-testid="partner-clinics">
                      {data.clinics.map((clinic) => (
                        <li key={clinic.contractId} className="p-mgmt__person" style={{ flexDirection: "column", alignItems: "stretch" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                            <div>
                              <b>{clinic.tenantName}</b>
                              <span>{contractPeriod(clinic.validFrom, clinic.validTo)}</span>
                            </div>
                          </div>
                          {clinic.scope.length > 0 ? (
                            <ul className="p-mgmt__scope" style={{ marginTop: 10 }}>
                              {clinic.scope.map((s) => (
                                <li key={s}>{SCOPE_LABELS[s] ?? s}</li>
                              ))}
                            </ul>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="p-mgmt__hint">
                    Clinics open their data to you only while a contract is active. Opening clinic
                    inventory from this portal is not part of this POC yet.
                  </p>
                </section>
              </div>
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}
