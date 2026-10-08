"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useExternalInspectorDetail } from "@/components/hooks/partner/external-inspectors/useExternalInspectorDetail";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/Loading";
import { staffSkillLevelMessageKey } from "@/lib/console/staffLabels";
import { cn } from "@/lib/utils";

function skillLevelLabel(
  t: ReturnType<typeof useTranslations<"console">>,
  code: string,
  fallback: string,
): string {
  const key = staffSkillLevelMessageKey(code);
  return key ? t(key) : fallback;
}

export function ExternalInspectorDetailScreen({ membershipId }: { membershipId: string }) {
  const t = useTranslations("console");
  const tCommon = useTranslations("common");
  const {
    member,
    refs,
    error,
    loading,
    busy,
    canManage,
    isInvited,
    readOnly,
    employerSelectOptions,
    name,
    setName,
    employerOrganisationId,
    setEmployerOrganisationId,
    commissionedFrom,
    setCommissionedFrom,
    commissionedTo,
    setCommissionedTo,
    liabilityUntil,
    setLiabilityUntil,
    liabilitySumEur,
    setLiabilitySumEur,
    originPostalCode,
    setOriginPostalCode,
    originCity,
    setOriginCity,
    radiusKm,
    setRadiusKm,
    skillCode,
    setSkillCode,
    levelCode,
    setLevelCode,
    skillValidUntil,
    setSkillValidUntil,
    skillEvidence,
    setSkillEvidence,
    qualCode,
    setQualCode,
    qualValidUntil,
    setQualValidUntil,
    qualEvidence,
    setQualEvidence,
    refresh,
    saveProfile,
    addSkill,
    removeSkill,
    addQualification,
    removeQualification,
  } = useExternalInspectorDetail(membershipId);

  const subtitle = member
    ? [member.employerName, member.email].filter(Boolean).join(" · ")
    : t("externalIntro");

  return (
    <div className="p-work" data-testid="console-external-detail">
      <main className="p-main">
        <ListPageShell
          title={member?.name ?? t("externalTitle")}
          description={subtitle}
          contentClassName="max-w-none"
        >
          <p className="mb-4">
            <Link
              href="/partner/external-inspectors"
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              ← {t("backToExternal")}
            </Link>
          </p>
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

          {member && isInvited ? (
            <Alert className="mb-4 border-amber-200 bg-amber-50 text-amber-950">
              <AlertDescription>{t("externalCreateInviteNote")}</AlertDescription>
            </Alert>
          ) : null}

          {member ? (
            <div className="grid gap-5">
              <Section title={t("externalSectionPerson")}>
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  {member.deployable ? (
                    <span className="rounded-md bg-[rgba(47,217,138,0.12)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--green)]">
                      {t("externalDeployable")}
                    </span>
                  ) : (
                    <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-900">
                      {t("externalNotDeployableBadge")}
                    </span>
                  )}
                  {member.notDeployableReason ? (
                    <span className="text-xs text-muted-foreground">{member.notDeployableReason}</span>
                  ) : null}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("staffName")}>
                    <Input
                      value={name}
                      disabled={readOnly || busy}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </Field>
                  <Field label={t("externalEmployer")}>
                    <select
                      className="flex h-9 w-full rounded-md border border-border bg-transparent px-3 text-sm disabled:opacity-60"
                      value={employerOrganisationId}
                      disabled={readOnly || busy}
                      onChange={(e) => setEmployerOrganisationId(e.target.value)}
                    >
                      {employerSelectOptions.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t("staffEmail")} className="sm:col-span-2">
                    <Input value={member.email} disabled />
                  </Field>
                  <Field label={t("externalFrom")}>
                    <Input
                      type="date"
                      value={commissionedFrom}
                      disabled={readOnly || busy}
                      onChange={(e) => setCommissionedFrom(e.target.value)}
                    />
                  </Field>
                  <Field label={t("externalTo")}>
                    <Input
                      type="date"
                      value={commissionedTo}
                      disabled={readOnly || busy}
                      onChange={(e) => setCommissionedTo(e.target.value)}
                    />
                  </Field>
                  <Field label={t("externalLiability")}>
                    <Input
                      type="date"
                      value={liabilityUntil}
                      disabled={readOnly || busy}
                      onChange={(e) => setLiabilityUntil(e.target.value)}
                    />
                  </Field>
                  <Field label={t("externalLiabilitySum")} hint={t("externalLiabilityHint")}>
                    <Input
                      value={liabilitySumEur}
                      disabled={readOnly || busy}
                      onChange={(e) => setLiabilitySumEur(e.target.value)}
                    />
                  </Field>
                </div>
              </Section>

              <Section title={t("externalSectionDeployment")}>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label={t("staffOriginPostal")}>
                    <Input
                      value={originPostalCode}
                      disabled={readOnly || busy}
                      onChange={(e) => setOriginPostalCode(e.target.value)}
                    />
                  </Field>
                  <Field label={t("staffOriginCity")}>
                    <Input
                      value={originCity}
                      disabled={readOnly || busy}
                      onChange={(e) => setOriginCity(e.target.value)}
                    />
                  </Field>
                  <Field label={t("staffRadiusKm")}>
                    <Input
                      type="number"
                      min={0}
                      value={radiusKm}
                      disabled={readOnly || busy}
                      onChange={(e) => setRadiusKm(e.target.value)}
                    />
                  </Field>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">{t("externalDeploymentHint")}</p>
              </Section>

              {!isInvited && canManage ? (
                <div className="flex flex-wrap gap-3">
                  <Button type="button" variant="outline" disabled={busy} onClick={() => void refresh()}>
                    {tCommon("cancel")}
                  </Button>
                  <Button type="button" disabled={busy} onClick={() => void saveProfile()}>
                    {busy ? tCommon("loading") : t("externalSave")}
                  </Button>
                </div>
              ) : null}

              {!isInvited ? (
                <>
                  <Section title={t("externalSectionSkills")}>
                    {member.skills.length === 0 ? (
                      <p className="mb-3 text-sm text-muted-foreground">{t("externalSkillEmpty")}</p>
                    ) : (
                      <table className="mb-3 w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                            <th className="py-2 pr-2 font-medium">{t("staffColSkill")}</th>
                            <th className="py-2 pr-2 font-medium">{t("staffColLevel")}</th>
                            <th className="py-2 pr-2 font-medium">{t("staffValidUntil")}</th>
                            <th className="py-2 font-medium" />
                          </tr>
                        </thead>
                        <tbody>
                          {member.skills.map((s) => (
                            <tr key={s.id} className="border-b border-border/70">
                              <td className="py-2 pr-2">{s.skillLabel}</td>
                              <td className="py-2 pr-2">
                                {skillLevelLabel(t, s.levelCode, s.levelLabel)}
                              </td>
                              <td className="py-2 pr-2">{s.validUntil ?? "—"}</td>
                              <td className="py-2 text-right">
                                {canManage ? (
                                  <button
                                    type="button"
                                    className="text-xs text-primary underline-offset-4 hover:underline"
                                    disabled={busy}
                                    onClick={() => void removeSkill(s.id)}
                                  >
                                    {t("staffRemove")}
                                  </button>
                                ) : null}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {canManage && refs ? (
                      <div className="grid gap-2 sm:grid-cols-5">
                        <select
                          className="flex h-9 rounded-md border border-border bg-transparent px-2 text-sm sm:col-span-2"
                          value={skillCode}
                          onChange={(e) => setSkillCode(e.target.value)}
                        >
                          {refs.skills.map((s) => (
                            <option key={s.code} value={s.code}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                        <select
                          className="flex h-9 rounded-md border border-border bg-transparent px-2 text-sm"
                          value={levelCode}
                          onChange={(e) => setLevelCode(e.target.value)}
                        >
                          {refs.skillLevels.map((l) => (
                            <option key={l.code} value={l.code}>
                              {skillLevelLabel(t, l.code, l.label)}
                            </option>
                          ))}
                        </select>
                        <Input
                          type="date"
                          value={skillValidUntil}
                          onChange={(e) => setSkillValidUntil(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <Input
                            value={skillEvidence}
                            onChange={(e) => setSkillEvidence(e.target.value)}
                            placeholder={t("staffEvidence")}
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            disabled={busy}
                            onClick={() => void addSkill()}
                          >
                            {t("staffAddSkill")}
                          </Button>
                        </div>
                      </div>
                    ) : null}
                    <p className="mt-3 text-xs text-muted-foreground">{t("staffSkillLevelHint")}</p>
                  </Section>

                  <Section title={t("externalSectionQualifications")}>
                    {member.qualifications.length === 0 ? (
                      <p className="mb-3 text-sm text-muted-foreground">{t("staffQualsEmpty")}</p>
                    ) : (
                      <table className="mb-3 w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                            <th className="py-2 pr-2 font-medium">{t("staffColQualification")}</th>
                            <th className="py-2 pr-2 font-medium">{t("staffValidUntil")}</th>
                            <th className="py-2 font-medium" />
                          </tr>
                        </thead>
                        <tbody>
                          {member.qualifications.map((q) => (
                            <tr key={q.id} className="border-b border-border/70">
                              <td className="py-2 pr-2">{q.label}</td>
                              <td className="py-2 pr-2">{q.validUntil ?? "—"}</td>
                              <td className="py-2 text-right">
                                {canManage ? (
                                  <button
                                    type="button"
                                    className="text-xs text-primary underline-offset-4 hover:underline"
                                    disabled={busy}
                                    onClick={() => void removeQualification(q.id)}
                                  >
                                    {t("staffRemove")}
                                  </button>
                                ) : null}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {canManage && refs ? (
                      <div className="grid gap-2 sm:grid-cols-4">
                        <select
                          className="flex h-9 rounded-md border border-border bg-transparent px-2 text-sm sm:col-span-2"
                          value={qualCode}
                          onChange={(e) => setQualCode(e.target.value)}
                        >
                          {refs.qualifications.map((q) => (
                            <option key={q.code} value={q.code}>
                              {q.label}
                            </option>
                          ))}
                        </select>
                        <Input
                          type="date"
                          value={qualValidUntil}
                          onChange={(e) => setQualValidUntil(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <Input
                            value={qualEvidence}
                            onChange={(e) => setQualEvidence(e.target.value)}
                            placeholder={t("staffEvidence")}
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            disabled={busy}
                            onClick={() => void addQualification()}
                          >
                            {t("staffAddQualification")}
                          </Button>
                        </div>
                      </div>
                    ) : null}
                    <p className="mt-3 text-xs text-muted-foreground">{t("staffQualFootnote")}</p>
                  </Section>
                </>
              ) : null}
            </div>
          ) : null}
        </ListPageShell>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4 sm:p-5">
      <h2 className="mb-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
      {hint ? <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
