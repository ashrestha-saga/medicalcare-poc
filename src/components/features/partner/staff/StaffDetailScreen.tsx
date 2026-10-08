"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useStaffDetail } from "@/components/hooks/partner/staff/useStaffDetail";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

export function StaffDetailScreen({ membershipId }: { membershipId: string }) {
  const t = useTranslations("console");
  const tCommon = useTranslations("common");
  const {
    member,
    clinics,
    refs,
    selected,
    error,
    loading,
    busy,
    canEdit,
    canAssign,
    isInvited,
    isAdmin,
    name,
    setName,
    jobTitle,
    setJobTitle,
    appRole,
    setAppRole,
    validFrom,
    setValidFrom,
    dispatchOrigin,
    setDispatchOrigin,
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
    saveAssignments,
    addSkill,
    removeSkill,
    addQualification,
    removeQualification,
    toggle,
  } = useStaffDetail(membershipId);

  const subtitle = member
    ? [
        member.jobTitle,
        member.status === "invited"
          ? t("staffStatusInvited")
          : member.appRole === "admin"
            ? t("staffRoleAdmin")
            : member.appRole === "order"
              ? t("staffRoleOrder")
              : t("staffRoleInspector"),
      ]
        .filter(Boolean)
        .join(" · ")
    : t("staffAssignIntro");

  return (
    <div className="p-work" data-testid="console-staff-detail">
      <main className="p-main">
        <ListPageShell
          title={member?.name ?? t("staffTitle")}
          description={subtitle}
          contentClassName="max-w-none"
        >
          <p className="mb-4">
            <Link href="/partner/staff" className="text-sm text-primary underline-offset-4 hover:underline">
              ← {t("backToStaff")}
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
              <AlertDescription>{t("staffInvitedDetailNote")}</AlertDescription>
            </Alert>
          ) : null}

          {member ? (
            <div className="grid gap-5">
              <Section title={t("staffSectionDetails")}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("staffName")}>
                    <Input
                      value={name}
                      disabled={isInvited || !canEdit || busy}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </Field>
                  <Field label={t("staffJobTitle")}>
                    <Input
                      value={jobTitle}
                      disabled={isInvited || !canEdit || busy}
                      onChange={(e) => setJobTitle(e.target.value)}
                    />
                  </Field>
                  <Field label={t("staffEmail")}>
                    <Input value={member.email} disabled />
                  </Field>
                  <Field label={t("staffRole")}>
                    <select
                      className="flex h-9 w-full rounded-md border border-border bg-transparent px-3 text-sm disabled:opacity-60"
                      value={appRole}
                      disabled={isInvited || !canEdit || busy}
                      onChange={(e) =>
                        setAppRole(e.target.value as "admin" | "inspector" | "order")
                      }
                    >
                      <option value="admin">{t("staffRoleAdmin")}</option>
                      <option value="inspector">{t("staffRoleInspector")}</option>
                      <option value="order">{t("staffRoleOrder")}</option>
                    </select>
                  </Field>
                  <Field label={t("staffMemberSince")}>
                    <Input
                      type="date"
                      value={validFrom}
                      disabled={isInvited || !canEdit || busy}
                      onChange={(e) => setValidFrom(e.target.value)}
                    />
                  </Field>
                </div>
              </Section>

              <Section title={t("staffSectionDeployment")}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("staffDispatchOrigin")}>
                    <select
                      className="flex h-9 w-full rounded-md border border-border bg-transparent px-3 text-sm disabled:opacity-60"
                      value={dispatchOrigin}
                      disabled={isInvited || !canEdit || busy}
                      onChange={(e) =>
                        setDispatchOrigin(
                          e.target.value as "home" | "partner_site" | "organisation",
                        )
                      }
                    >
                      <option value="home">{t("staffOriginHome")}</option>
                      <option value="partner_site">{t("staffOriginPartnerSite")}</option>
                      <option value="organisation">{t("staffOriginOrganisation")}</option>
                    </select>
                    <p className="text-xs text-muted-foreground">{t("staffDispatchOriginHint")}</p>
                  </Field>
                  <Field label={t("staffRadiusKm")}>
                    <Input
                      type="number"
                      value={radiusKm}
                      disabled={isInvited || !canEdit || busy}
                      onChange={(e) => setRadiusKm(e.target.value)}
                    />
                  </Field>
                  <Field label={t("staffOriginPostal")}>
                    <Input
                      value={originPostalCode}
                      disabled={isInvited || !canEdit || busy}
                      onChange={(e) => setOriginPostalCode(e.target.value)}
                    />
                  </Field>
                  <Field label={t("staffOriginCity")}>
                    <Input
                      value={originCity}
                      disabled={isInvited || !canEdit || busy}
                      onChange={(e) => setOriginCity(e.target.value)}
                    />
                  </Field>
                </div>
              </Section>

              {!isInvited && canEdit ? (
                <div className="flex flex-wrap gap-3">
                  <Button type="button" disabled={busy} onClick={() => void saveProfile()}>
                    {busy ? tCommon("loading") : tCommon("save")}
                  </Button>
                  <Button type="button" variant="outline" disabled={busy} onClick={() => void refresh()}>
                    {tCommon("cancel")}
                  </Button>
                </div>
              ) : null}

              {!isInvited ? (
                <>
                  <Section title={t("staffSectionSkills")}>
                    {member.skills.length === 0 ? (
                      <p className="mb-3 text-sm text-muted-foreground">{t("staffSkillsEmpty")}</p>
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
                                {canEdit ? (
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
                    {canEdit && refs ? (
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
                          <Button type="button" variant="outline" disabled={busy} onClick={() => void addSkill()}>
                            {t("staffAddSkill")}
                          </Button>
                        </div>
                      </div>
                    ) : null}
                    <p className="mt-3 text-xs text-muted-foreground">{t("staffSkillLevelHint")}</p>
                  </Section>

                  <Section title={t("staffSectionQualifications")}>
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
                                {canEdit ? (
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
                    {canEdit && refs ? (
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

                  <Section title={t("staffSectionTenants")}>
                    {isAdmin ? (
                      <p className="text-sm text-muted-foreground">{t("staffAssignAdminNote")}</p>
                    ) : (
                      <>
                        <ul className="mb-4 space-y-2">
                          {clinics.map((c) => (
                            <li key={c.tenantId} className="flex items-center gap-2">
                              <Checkbox
                                checked={selected.includes(c.tenantId)}
                                disabled={!canAssign || busy || !c.live}
                                onCheckedChange={() => toggle(c.tenantId)}
                              />
                              <span className={cn(!c.live && "text-muted-foreground")}>
                                {c.tenantName}
                                {c.city || c.tenantCode
                                  ? ` · ${[c.city, c.tenantCode].filter(Boolean).join(" · ")}`
                                  : ""}
                                {!c.live ? ` (${t("staffContractEnded")})` : ""}
                              </span>
                            </li>
                          ))}
                        </ul>
                        <p className="mb-3 text-xs text-muted-foreground">{t("staffEndedContractsNote")}</p>
                        {canAssign ? (
                          <Button type="button" disabled={busy} onClick={() => void saveAssignments()}>
                            {t("staffAssignSave")}
                          </Button>
                        ) : null}
                      </>
                    )}
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
