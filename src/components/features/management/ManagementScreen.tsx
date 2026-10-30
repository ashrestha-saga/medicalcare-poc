"use client";

import { useTranslations } from "next-intl";
import type { ManagementContractDTO } from "@/interfaces";
import { useManagementOverview } from "@/components/hooks/management/useManagementOverview";
import { Spinner } from "@/components/ui/Loading";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListPageShell } from "@/components/features/shared/ListPageShell";

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

export function ManagementScreen() {
  const t = useTranslations("pages.management");
  const { data, error, loading } = useManagementOverview();

  const scopeLabel = (token: string): string => {
    const map: Record<string, string> = {
      inventory: t("scopeInventory"),
      "due-dates": t("scopeDueDates"),
      inspection: t("scopeInspection"),
      bestand: t("scopeInventory"),
      fristen: t("scopeDueDates"),
      pruefung: t("scopeInspection"),
      aufbereitung: t("scopeReprocessing"),
    };
    return map[token] ?? token;
  };

  const roleLabel = (role: string): string => {
    const map: Record<string, string> = {
      admin: t("roleAdmin"),
      inspector: t("roleInspector"),
      partner: t("rolePartner"),
      order: t("roleOrder"),
    };
    return map[role] ?? role;
  };

  const jobTitleLabel = (title: string | null): string | null => {
    if (!title) return null;
    const map: Record<string, string> = {
      Betriebsleitung: t("jobOps"),
      Medizintechnik: t("jobMedTech"),
      Sachverständiger: t("jobExpert"),
      Disposition: t("jobScheduling"),
    };
    return map[title] ?? title;
  };

  const contractPeriod = (c: ManagementContractDTO): string => {
    const from = formatDate(c.validFrom);
    if (!c.validTo) return t("noExpiry", { from });
    return t("period", { from, to: formatDate(c.validTo) });
  };

  return (
    <div className="p-work" data-testid="management-page">
      <main className="p-main">
        <ListPageShell title={t("title")} description={t("description")} testId="management-screen">
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : null}

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {!loading && !error && data && data.contracts.length === 0 ? (
            <Card className="border-border/80">
              <CardHeader>
                <CardTitle className="text-base">{t("managingOrg")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{t("noContract")}</p>
              </CardContent>
            </Card>
          ) : null}

          {!loading &&
            data?.contracts.map((contract) => (
              <div
                key={contract.id}
                className="grid gap-4 lg:grid-cols-[1.15fr_1fr]"
                data-testid="management-contract"
              >
                <Card className="border-border/80">
                  <CardHeader>
                    <CardTitle className="text-base">{t("managingOrg")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <dl className="p-ext-dl p-mgmt__meta">
                      <div className="p-ext-row">
                        <dt>{t("organisation")}</dt>
                        <dd>{contract.organisationName}</dd>
                      </div>
                      {contract.contact ? (
                        <div className="p-ext-row">
                          <dt>{t("contact")}</dt>
                          <dd>{contract.contact}</dd>
                        </div>
                      ) : null}
                      <div className="p-ext-row">
                        <dt>{t("contract")}</dt>
                        <dd>{contractPeriod(contract)}</dd>
                      </div>
                      <div className="p-ext-row">
                        <dt>{t("operatingModel")}</dt>
                        <dd>{t("operatedByService")}</dd>
                      </div>
                    </dl>

                    <div>
                      <p className="p-mgmt__scope-label !mt-0">{t("scopeLabel")}</p>
                      <ul className="p-mgmt__scope" data-testid="management-scope">
                        {contract.scope.map((s) => (
                          <li key={s}>{scopeLabel(s)}</li>
                        ))}
                      </ul>
                    </div>

                    <p className="text-sm text-muted-foreground">{t("staffExcluded")}</p>

                    <aside
                      className="rounded-md border border-border border-l-4 border-l-primary bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
                      data-testid="management-operating-callout"
                    >
                      <p>{t("operatingCallout")}</p>
                    </aside>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled
                      title={t("objectionDisabled")}
                    >
                      {t("raiseObjection")}
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-border/80">
                  <CardHeader>
                    <CardTitle className="text-base">{t("peopleAccess")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {contract.people.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t("noPeople")}</p>
                    ) : (
                      <ul className="p-mgmt__people" data-testid="management-people">
                        {contract.people.map((person) => {
                          const title = jobTitleLabel(person.jobTitle);
                          return (
                            <li key={person.id} className="p-mgmt__person">
                              <div>
                                <b>{person.name}</b>
                                {title ? <span>{title}</span> : null}
                              </div>
                              <em className="p-mgmt__role">{roleLabel(person.appRole)}</em>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </div>
            ))}

          {!loading && data && data.contracts.length > 0 ? (
            <Card className="mt-4 border-border/80" data-testid="management-latest-access">
              <CardHeader>
                <CardTitle className="text-base">{t("latestAccess")}</CardTitle>
              </CardHeader>
              <CardContent>
                {data.latestAccess.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("latestAccessEmpty")}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <th className="py-2 pr-3 font-medium">{t("accessWhen")}</th>
                          <th className="py-2 pr-3 font-medium">{t("accessWho")}</th>
                          <th className="py-2 font-medium">{t("accessWhat")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.latestAccess.map((row) => (
                          <tr key={row.id} className="border-b border-border/60 align-top">
                            <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                              {new Date(row.occurredAt).toLocaleString()}
                            </td>
                            <td className="py-2 pr-3">
                              <div className="font-medium">{row.actorName}</div>
                              <div className="text-xs text-muted-foreground">
                                {[row.organisationName, row.actorRole].filter(Boolean).join(" · ")}
                              </div>
                            </td>
                            <td className="py-2">
                              <div>{row.summary}</div>
                              <div className="text-xs text-muted-foreground">
                                {row.resource}
                                {row.resourceId ? ` · ${row.resourceId}` : ""}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}
        </ListPageShell>
      </main>
    </div>
  );
}
