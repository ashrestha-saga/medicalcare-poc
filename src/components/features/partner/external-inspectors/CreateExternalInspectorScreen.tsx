"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCreateExternalInspector } from "@/components/hooks/partner/external-inspectors/useCreateExternalInspector";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/Loading";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { staffSkillLevelMessageKey } from "@/lib/console/staffLabels";
import { cn } from "@/lib/utils";

export function CreateExternalInspectorScreen() {
  const t = useTranslations("console");
  const tCommon = useTranslations("common");
  const {
    form,
    patch,
    fieldErrors,
    busy,
    submit,
    meta,
    metaLoading,
    loadMeta,
    addSkillRow,
    patchSkill,
    removeSkill,
  } = useCreateExternalInspector();
  const { checkPermission, permissionsLoading } = usePermissions();

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  if (!permissionsLoading && !checkPermission("console:external:manage")) {
    return (
      <div className="p-work">
        <main className="p-main">
          <ListPageShell title={t("externalCreateTitle")} description={tCommon("denied")}>
            <Link
              href="/partner/external-inspectors"
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              ← {t("backToExternal")}
            </Link>
          </ListPageShell>
        </main>
      </div>
    );
  }

  return (
    <div className="p-work" data-testid="console-create-external-page">
      <main className="p-main">
        <ListPageShell
          title={t("externalCreateTitle")}
          description={t("externalCreateIntro")}
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
          {metaLoading ? (
            <div className="p-wait">
              <Spinner />
            </div>
          ) : (
            <form
              noValidate
              className="grid w-full gap-5"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <Section title={t("externalSectionPerson")}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("staffName")} error={fieldErrors.name}>
                    <Input value={form.name} onChange={(e) => patch("name", e.target.value)} />
                  </Field>
                  <Field
                    label={t("externalEmployer")}
                    error={fieldErrors.employerOrganisationId}
                    required
                  >
                    <select
                      className="flex h-9 w-full rounded-md border border-border bg-transparent px-3 text-sm"
                      value={form.employerOrganisationId}
                      onChange={(e) => patch("employerOrganisationId", e.target.value)}
                    >
                      {(meta?.employerOptions ?? []).map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    label={t("staffEmail")}
                    error={fieldErrors.email}
                    required
                    hint={t("externalEmailHint")}
                    className="sm:col-span-2"
                  >
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => patch("email", e.target.value)}
                    />
                  </Field>
                  <Field label={t("externalFrom")} error={fieldErrors.commissionedFrom} required>
                    <Input
                      type="date"
                      value={form.commissionedFrom}
                      onChange={(e) => patch("commissionedFrom", e.target.value)}
                    />
                  </Field>
                  <Field label={t("externalTo")} error={fieldErrors.commissionedTo} required>
                    <Input
                      type="date"
                      value={form.commissionedTo}
                      onChange={(e) => patch("commissionedTo", e.target.value)}
                    />
                  </Field>
                  <Field label={t("externalLiability")} error={fieldErrors.liabilityUntil} required>
                    <Input
                      type="date"
                      value={form.liabilityUntil}
                      onChange={(e) => patch("liabilityUntil", e.target.value)}
                    />
                  </Field>
                  <Field
                    label={t("externalLiabilitySum")}
                    error={fieldErrors.liabilitySumEur}
                    hint={t("externalLiabilityHint")}
                  >
                    <Input
                      value={form.liabilitySumEur}
                      placeholder="5000000"
                      onChange={(e) => patch("liabilitySumEur", e.target.value)}
                    />
                  </Field>
                </div>
              </Section>

              <Section title={t("externalSectionDeployment")}>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label={t("staffOriginPostal")}>
                    <Input
                      value={form.originPostalCode}
                      onChange={(e) => patch("originPostalCode", e.target.value)}
                    />
                  </Field>
                  <Field label={t("staffOriginCity")}>
                    <Input
                      value={form.originCity}
                      onChange={(e) => patch("originCity", e.target.value)}
                    />
                  </Field>
                  <Field label={t("staffRadiusKm")} error={fieldErrors.radiusKm}>
                    <Input
                      type="number"
                      min={0}
                      value={form.radiusKm}
                      onChange={(e) => patch("radiusKm", e.target.value)}
                    />
                  </Field>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">{t("externalDeploymentHint")}</p>
              </Section>

              <Section title={t("externalSectionSkills")}>
                {form.skills.length === 0 ? (
                  <p className="mb-3 text-sm text-muted-foreground">{t("externalSkillEmpty")}</p>
                ) : (
                  <div className="mb-3 space-y-3">
                    {form.skills.map((row, index) => (
                      <div
                        key={index}
                        className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-5"
                      >
                        <select
                          className="flex h-9 rounded-md border border-border bg-transparent px-2 text-sm sm:col-span-2"
                          value={row.skillCode}
                          onChange={(e) => patchSkill(index, { skillCode: e.target.value })}
                        >
                          {(meta?.refs.skills ?? []).map((s) => (
                            <option key={s.code} value={s.code}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                        <select
                          className="flex h-9 rounded-md border border-border bg-transparent px-2 text-sm"
                          value={row.levelCode}
                          onChange={(e) => patchSkill(index, { levelCode: e.target.value })}
                        >
                          {(meta?.refs.skillLevels ?? []).map((l) => {
                            const levelKey = staffSkillLevelMessageKey(l.code);
                            return (
                              <option key={l.code} value={l.code}>
                                {levelKey ? t(levelKey) : l.label}
                              </option>
                            );
                          })}
                        </select>
                        <Input
                          type="date"
                          value={row.validUntil ?? ""}
                          onChange={(e) =>
                            patchSkill(index, { validUntil: e.target.value || null })
                          }
                        />
                        <div className="flex gap-2">
                          <Input
                            value={row.evidenceRef ?? ""}
                            onChange={(e) =>
                              patchSkill(index, { evidenceRef: e.target.value || null })
                            }
                            placeholder={t("staffEvidence")}
                            className="flex-1"
                          />
                          <Button type="button" variant="outline" onClick={() => removeSkill(index)}>
                            {t("staffRemove")}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <Button type="button" variant="outline" onClick={addSkillRow}>
                  {t("staffAddSkill")}
                </Button>
                <p className="mt-3 text-xs text-muted-foreground">{t("staffSkillLevelHint")}</p>
              </Section>

              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="outline" asChild>
                  <Link href="/partner/external-inspectors">{tCommon("cancel")}</Link>
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? tCommon("loading") : t("externalCreateSubmit")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{t("externalCreateInviteNote")}</p>
            </form>
          )}
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
  error,
  required,
  hint,
  className,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label
        required={required}
        className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
      >
        {label}
      </Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {!error && hint ? <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
