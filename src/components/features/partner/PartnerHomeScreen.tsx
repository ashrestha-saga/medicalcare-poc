"use client";

import { useTranslations } from "next-intl";
import { usePartnerHome } from "@/components/hooks/partner/usePartnerHome";
import { Spinner } from "@/components/ui/Loading";
import { Alert, AlertDescription } from "@/components/ui/alert";

const CAPACITY_KEYS: Record<string, "capServiceProvider" | "capInspectionPartner" | "capPlatformOperator" | "capInstitution"> = {
  service_provider: "capServiceProvider",
  inspection_partner: "capInspectionPartner",
  platform_operator: "capPlatformOperator",
  institution: "capInstitution",
};

const APP_ROLE_KEYS: Record<string, "roleAdmin" | "roleInspector" | "roleOrder"> = {
  admin: "roleAdmin",
  inspector: "roleInspector",
  order: "roleOrder",
};

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

export function PartnerHomeScreen() {
  const t = useTranslations("console");
  const { data, error, loading } = usePartnerHome();

  return (
    <div className="p-work" data-testid="partner-home-page">
      <main className="p-main">
        <div className="p-mgmt" data-testid="partner-home-screen">
          <section className="p-devhead p-mgmt__head">
            <h2>{t("orgTitle")}</h2>
            <p className="p-mgmt__sub">{t("orgIntro")}</p>
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
                <p className="p-sec-title">{t("orgCard")}</p>
                <dl className="p-ext-dl p-mgmt__meta">
                  <div className="p-ext-row">
                    <dt>{t("orgName")}</dt>
                    <dd>{data.organisationName}</dd>
                  </div>
                  <div className="p-ext-row">
                    <dt>{t("orgCode")}</dt>
                    <dd>{data.organisationCode}</dd>
                  </div>
                  {data.contact ? (
                    <div className="p-ext-row">
                      <dt>{t("orgContact")}</dt>
                      <dd>{data.contact}</dd>
                    </div>
                  ) : null}
                  <div className="p-ext-row">
                    <dt>{t("orgYourRole")}</dt>
                    <dd>{t(APP_ROLE_KEYS[data.myAppRole] ?? "roleInspector")}</dd>
                  </div>
                  {data.roles.length > 0 ? (
                    <div className="p-ext-row">
                      <dt>{t("orgCapacities")}</dt>
                      <dd>
                        {data.roles
                          .map((r) => t(CAPACITY_KEYS[r] ?? "capInstitution"))
                          .join(", ")}
                      </dd>
                    </div>
                  ) : null}
                  <div className="p-ext-row">
                    <dt>{t("orgLiveClinics")}</dt>
                    <dd>{data.clinics.length}</dd>
                  </div>
                </dl>
                {data.roles.includes("service_provider") && data.roles.includes("inspection_partner") ? (
                  <p className="p-mgmt__hint" style={{ marginTop: 12 }}>
                    {t("orgDualRoleNote")}
                  </p>
                ) : null}
              </section>

              <div className="p-mgmt__grid">
                <section className="p-mgmt__panel">
                  <p className="p-sec-title">{t("orgPeople")}</p>
                  {data.people.length === 0 ? (
                    <p className="p-mgmt__empty">{t("orgPeopleEmpty")}</p>
                  ) : (
                    <ul className="p-mgmt__people" data-testid="partner-people">
                      {data.people.map((person) => (
                        <li key={person.id} className="p-mgmt__person">
                          <div>
                            <b>{person.name}</b>
                            {person.jobTitle ? <span>{person.jobTitle}</span> : null}
                          </div>
                          <em className="p-mgmt__role">
                            {t(APP_ROLE_KEYS[person.appRole] ?? "roleInspector")}
                          </em>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="p-mgmt__panel">
                  <p className="p-sec-title">{t("orgClinics")}</p>
                  {data.clinics.length === 0 ? (
                    <p className="p-mgmt__empty" data-testid="partner-clinics-empty">
                      {t("orgClinicsEmpty")}
                    </p>
                  ) : (
                    <ul className="p-mgmt__people" data-testid="partner-clinics">
                      {data.clinics.map((clinic) => (
                        <li
                          key={clinic.contractId}
                          className="p-mgmt__person"
                          style={{ flexDirection: "column", alignItems: "stretch" }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                            <div>
                              <b>{clinic.tenantName}</b>
                              <span>
                                {formatDate(clinic.validFrom)}
                                {" — "}
                                {clinic.validTo ? formatDate(clinic.validTo) : t("openEnded")}
                              </span>
                            </div>
                          </div>
                          {clinic.scope.length > 0 ? (
                            <ul className="p-mgmt__scope" style={{ marginTop: 10 }}>
                              {clinic.scope.map((s) => (
                                <li key={s}>{s}</li>
                              ))}
                            </ul>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>

              <section className="p-mgmt__panel" style={{ margin: "12px 18px 0" }}>
                <p className="p-sec-title">{t("orgSperreTitle")}</p>
                <p className="p-mgmt__hint">{t("orgSperreBody")}</p>
              </section>
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}
