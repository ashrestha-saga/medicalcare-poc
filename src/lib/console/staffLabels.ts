/** Skill level codes from RefSkillLevel — labels via console.skillLevel_* i18n keys. */
export const STAFF_SKILL_LEVEL_CODES = ["eingewiesen", "geuebt", "hersteller"] as const;

export type StaffSkillLevelCode = (typeof STAFF_SKILL_LEVEL_CODES)[number];

export function isStaffSkillLevelCode(code: string): code is StaffSkillLevelCode {
  return (STAFF_SKILL_LEVEL_CODES as readonly string[]).includes(code);
}

export function staffSkillLevelMessageKey(code: string): `skillLevel_${StaffSkillLevelCode}` | null {
  if (!isStaffSkillLevelCode(code)) return null;
  return `skillLevel_${code}`;
}

export const STAFF_DISPATCH_ORIGINS = ["home", "partner_site", "organisation"] as const;

export type StaffDispatchOrigin = (typeof STAFF_DISPATCH_ORIGINS)[number];

export function isStaffDispatchOrigin(v: string): v is StaffDispatchOrigin {
  return (STAFF_DISPATCH_ORIGINS as readonly string[]).includes(v);
}

export function staffDispatchOriginMessageKey(
  origin: string,
): "staffOriginHome" | "staffOriginPartnerSite" | "staffOriginOrganisation" | null {
  if (origin === "home") return "staffOriginHome";
  if (origin === "partner_site") return "staffOriginPartnerSite";
  if (origin === "organisation") return "staffOriginOrganisation";
  return null;
}
