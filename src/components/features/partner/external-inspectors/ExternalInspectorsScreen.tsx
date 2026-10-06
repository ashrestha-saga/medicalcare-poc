"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ConsoleExternalListDTO, ConsoleStaffMemberDTO } from "@/interfaces/console";
import { api, ApiError } from "@/lib/http/apiClient";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/Loading";
import { staffSkillLevelMessageKey } from "@/lib/console/staffLabels";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { cn } from "@/lib/utils";

function SoftChip({ children, tone = "green" }: { children: React.ReactNode; tone?: "green" | "accent" }) {
  return (
    <span
      className={cn(
        "inline-block rounded-md border-transparent px-2 py-0.5 text-[10px]",
        tone === "green"
          ? "bg-[rgba(47,217,138,0.12)] text-[var(--green)]"
          : "bg-[rgba(30,127,224,0.12)] text-[var(--accent)]",
      )}
    >
      {children}
    </span>
  );
}

export function ExternalInspectorsScreen() {
  const t = useTranslations("console");
  const { checkPermission } = usePermissions();
  const canManage = checkPermission("console:external:manage");
  const [data, setData] = useState<ConsoleExternalListDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await api<ConsoleExternalListDTO>("/api/partner/external-inspectors"));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("externalLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load list on mount
    void refresh();
  }, [refresh]);

  const groups = useMemo(() => {
    const members = data?.members ?? [];
    const map = new Map<string, { key: string; title: string; members: ConsoleStaffMemberDTO[] }>();
    for (const m of members) {
      const key = m.employerOrganisationId ?? "unknown";
      const title = m.employerName ?? t("externalUnknownEmployer");
      const g = map.get(key) ?? { key, title, members: [] };
      g.members.push(m);
      map.set(key, g);
    }
    return [...map.values()].sort((a, b) => a.title.localeCompare(b.title));
  }, [data, t]);

  return (
    <div className="p-work" data-testid="console-external">
      <main className="p-main">
        <ListPageShell
          title={t("externalTitle")}
          description={t("externalIntro")}
          headerExtra={
            canManage && data?.canManage ? (
              <Button asChild>
                <Link href="/partner/external-inspectors/new">{t("externalCreateCta")}</Link>
              </Button>
            ) : null
          }
        >
          {loading ? (
            <div className="p-wait">
              <Spinner />
            </div>
          ) : null}
          {error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {data && data.notDeployable.length > 0 ? (
            <Alert className="mb-4 border-amber-200 bg-amber-50 text-amber-950">
              <AlertDescription>
                <p className="mb-1 font-medium">{t("externalNotDeployableTitle")}</p>
                <ul className="mb-2 list-inside list-disc text-sm">
                  {data.notDeployable.map((item) => (
                    <li key={item.membershipId}>
                      {item.personName} — {item.reason}
                    </li>
                  ))}
                </ul>
                <p className="text-xs">{t("externalNotDeployableNote")}</p>
              </AlertDescription>
            </Alert>
          ) : null}

          {!loading && groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("externalEmpty")}</p>
          ) : null}

          <div className="space-y-8">
            {groups.map((g) => (
              <section key={g.key}>
                <h2 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {g.title}
                </h2>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full min-w-[56rem] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <th className="px-3 py-2 font-semibold">{t("externalColName")}</th>
                        <th className="px-3 py-2 font-semibold">{t("externalColQualification")}</th>
                        <th className="px-3 py-2 font-semibold">{t("externalColSkills")}</th>
                        <th className="px-3 py-2 font-semibold">{t("externalColCommission")}</th>
                        <th className="px-3 py-2 font-semibold">{t("externalColLiability")}</th>
                        <th className="px-3 py-2 font-semibold">{t("externalColDeployment")}</th>
                        <th className="px-3 py-2 font-semibold" />
                      </tr>
                    </thead>
                    <tbody>
                      {g.members.map((m) => (
                        <tr key={m.membershipId} className="border-b border-border/70">
                          <td className="px-3 py-2.5">
                            <div className="font-medium">{m.name}</div>
                            <div className="font-mono text-xs text-muted-foreground">{m.email}</div>
                            {m.status === "invited" ? (
                              <span className="mt-1 inline-block rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] uppercase text-amber-900">
                                {t("externalStatusInvited")}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2.5">
                            {m.qualifications.length === 0 ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {m.qualifications.map((q) => (
                                  <SoftChip key={q.id}>{q.label}</SoftChip>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            {m.skills.length === 0 ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {m.skills.map((s) => {
                                  const levelKey = staffSkillLevelMessageKey(s.levelCode);
                                  return (
                                    <SoftChip key={s.id} tone="accent">
                                      {s.skillLabel}
                                      {levelKey ? ` · ${t(levelKey)}` : ""}
                                    </SoftChip>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className={cn(
                                "text-xs",
                                m.deployable === false && m.status === "active"
                                  ? "text-destructive"
                                  : "text-[var(--green)]",
                              )}
                            >
                              {m.commissionedTo ?? "—"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-xs">
                            {m.liabilitySumEur != null
                              ? `${(m.liabilitySumEur / 1_000_000).toFixed(0)} Mio. EUR`
                              : "—"}
                            {m.liabilityUntil ? (
                              <div className="text-muted-foreground">
                                {t("externalLiabilityUntil", { date: m.liabilityUntil })}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-3 py-2.5 text-xs">
                            {[m.originCity, m.radiusKm != null ? `${m.radiusKm} km` : null]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <Link
                              href={`/partner/external-inspectors/${encodeURIComponent(m.membershipId)}`}
                              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                            >
                              {t("externalColOpen")}
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>

          <p className="mt-6 text-xs leading-relaxed text-muted-foreground">{t("externalWorkflowNote")}</p>
        </ListPageShell>
      </main>
    </div>
  );
}
