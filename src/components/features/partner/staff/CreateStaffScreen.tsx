"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCreateStaff } from "@/components/hooks/partner/staff/useCreateStaff";
import { ListPageShell } from "@/components/features/shared/ListPageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/Loading";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { cn } from "@/lib/utils";

export function CreateStaffScreen() {
  const t = useTranslations("console");
  const tCommon = useTranslations("common");
  const {
    form,
    patch,
    fieldErrors,
    busy,
    submit,
    refs,
    refsLoading,
    loadRefs,
    addSkillRow,
    patchSkill,
    removeSkill,
  } = useCreateStaff();
  const { checkPermission, permissionsLoading } = usePermissions();

  useEffect(() => {
    void loadRefs();
  }, [loadRefs]);

  if (!permissionsLoading && !checkPermission("console:staff:invite")) {
    return (
      <div className="p-work" data-testid="console-create-staff-denied">
        <main className="p-main">
          <ListPageShell title={t("staffCreateTitle")} description={tCommon("denied")}>
            <Link href="/partner/staff" className="text-sm text-primary underline-offset-4 hover:underline">
              ← {t("backToStaff")}
            </Link>
          </ListPageShell>
        </main>
      </div>
    );
  }

  return (
    <div className="p-work" data-testid="console-create-staff-page">
      <main className="p-main">
        <ListPageShell
          title={t("staffCreateTitle")}
          description={t("staffCreateIntro")}
          contentClassName="max-w-none"
        >
          <p className="mb-4">
            <Link href="/partner/staff" className="text-sm text-primary underline-offset-4 hover:underline">
              ← {t("backToStaff")}
            </Link>
          </p>
          {refsLoading ? (
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
              <Section title={t("staffSectionDetails")}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field fieldKey="name" label={t("staffName")} error={fieldErrors.name}>
                    <Input
                      value={form.name}
                      onChange={(e) => patch("name", e.target.value)}
                      data-testid="staff-name"
                    />
                  </Field>
                  <Field fieldKey="jobTitle" label={t("staffJobTitle")} error={fieldErrors.jobTitle}>
                    <Input
                      value={form.jobTitle}
                      onChange={(e) => patch("jobTitle", e.target.value)}
                      data-testid="staff-job-title"
                    />
                  </Field>
                  <Field
                    fieldKey="email"
                    label={t("staffEmail")}
                    error={fieldErrors.email}
                    required
                    hint={t("staffEmailHint")}
                  >
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => patch("email", e.target.value)}
                      aria-invalid={Boolean(fieldErrors.email)}
                      data-testid="staff-email"
                    />
                  </Field>
                  <Field fieldKey="appRole" label={t("staffRole")} error={fieldErrors.appRole} required>
                    <select
                      className="flex h-9 w-full rounded-md border border-border bg-transparent px-3 text-sm"
                      value={form.appRole}
                      onChange={(e) =>
                        patch("appRole", e.target.value as "admin" | "inspector" | "order")
                      }
                      data-testid="staff-role"
                    >
                      <option value="admin">{t("staffRoleAdmin")}</option>
                      <option value="inspector">{t("staffRoleInspector")}</option>
                      <option value="order">{t("staffRoleOrder")}</option>
                    </select>
                  </Field>
                  <Field fieldKey="validFrom" label={t("staffMemberSince")} error={fieldErrors.validFrom}>
                    <Input
                      type="date"
                      value={form.validFrom}
                      onChange={(e) => patch("validFrom", e.target.value)}
                    />
                  </Field>
                </div>
              </Section>

              <Section title={t("staffSectionDeployment")}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    fieldKey="dispatchOrigin"
                    label={t("staffDispatchOrigin")}
                    hint={t("staffDispatchOriginHint")}
                  >
                    <select
                      className="flex h-9 w-full rounded-md border border-border bg-transparent px-3 text-sm"
                      value={form.dispatchOrigin}
                      onChange={(e) =>
                        patch(
                          "dispatchOrigin",
                          e.target.value as "home" | "partner_site" | "organisation",
                        )
                      }
                    >
                      <option value="home">{t("staffOriginHome")}</option>
                      <option value="partner_site">{t("staffOriginPartnerSite")}</option>
                      <option value="organisation">{t("staffOriginOrganisation")}</option>
                    </select>
                  </Field>
                  <Field
                    fieldKey="radiusKm"
                    label={t("staffRadiusKm")}
                    error={fieldErrors.radiusKm}
                    hint={t("staffRadiusHint")}
                  >
                    <Input
                      type="number"
                      min={0}
                      value={form.radiusKm}
                      onChange={(e) => patch("radiusKm", e.target.value)}
                    />
                  </Field>
                  <Field fieldKey="originPostalCode" label={t("staffOriginPostal")}>
                    <Input
                      value={form.originPostalCode}
                      onChange={(e) => patch("originPostalCode", e.target.value)}
                    />
                  </Field>
                  <Field fieldKey="originCity" label={t("staffOriginCity")}>
                    <Input
                      value={form.originCity}
                      onChange={(e) => patch("originCity", e.target.value)}
                    />
                  </Field>
                </div>
              </Section>

              <Section title={t("staffSectionSkills")}>
                {form.skills.length === 0 ? (
                  <p className="mb-3 text-sm text-muted-foreground">{t("staffSkillsEmpty")}</p>
                ) : (
                  <div className="mb-3 space-y-3">
                    {form.skills.map((row, index) => (
                      <div
                        key={index}
                        className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-5"
                      >
                        <select
                          className="flex h-9 w-full rounded-md border border-border bg-transparent px-2 text-sm sm:col-span-2"
                          value={row.skillCode}
                          onChange={(e) => patchSkill(index, { skillCode: e.target.value })}
                        >
                          {(refs?.skills ?? []).map((s) => (
                            <option key={s.code} value={s.code}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                        <select
                          className="flex h-9 w-full rounded-md border border-border bg-transparent px-2 text-sm"
                          value={row.levelCode}
                          onChange={(e) => patchSkill(index, { levelCode: e.target.value })}
                        >
                          {(refs?.skillLevels ?? []).map((l) => (
                            <option key={l.code} value={l.code}>
                              {t(`skillLevel_${l.code}` as "skillLevel_eingewiesen")}
                            </option>
                          ))}
                        </select>
                        <Input
                          type="date"
                          value={row.validUntil ?? ""}
                          onChange={(e) =>
                            patchSkill(index, { validUntil: e.target.value || null })
                          }
                          placeholder={t("staffValidUntil")}
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
                <Button type="submit" disabled={busy} data-testid="staff-create-submit">
                  {busy ? tCommon("loading") : t("staffCreateSubmit")}
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link href="/partner/staff">{tCommon("cancel")}</Link>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{t("staffCreateInviteNote")}</p>
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
  fieldKey,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
  className?: string;
  fieldKey?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("grid gap-1.5", className)} data-field={fieldKey}>
      <Label required={required} className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {!error && hint ? <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
