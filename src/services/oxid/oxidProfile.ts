import type { SessionUser } from "@/interfaces/session";
import type { OxidMeProfile } from "@/interfaces/external";
import { DATA_TENANT_ID, OXID_SESSION_ROLE } from "@/constants/tenant";

function formatStreetLine(a?: {
  street?: string;
  street_no?: string;
  zip?: string;
  city?: string;
} | null): string | null {
  if (!a) return null;
  const street = [a.street, a.street_no].filter(Boolean).join(" ").trim();
  const city = [a.zip, a.city].filter(Boolean).join(" ").trim();
  const parts = [street, city].map((p) => p?.trim()).filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

export function profileUserId(profile: OxidMeProfile): string {
  return profile.oxid || profile.sub || "";
}

/** OXID shop company — account-bar / connection label. */
export function profileCompany(profile: OxidMeProfile): string | null {
  const raw = profile.company?.trim() || profile.billing?.company?.trim() || "";
  return raw || null;
}

/** @deprecated OXID is no longer used for DeviceCare login — kept for unit tests. */
export function mapMeToSessionUser(profile: OxidMeProfile): SessionUser {
  const id = profileUserId(profile);
  const name =
    [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim() ||
    profile.email ||
    id;
  const delivery =
    formatStreetLine(profile.billing) ||
    formatStreetLine(profile) ||
    formatStreetLine(profile.addresses?.[0]) ||
    null;
  return {
    id,
    name,
    role: OXID_SESSION_ROLE,
    tenantId: DATA_TENANT_ID,
    companyName: profileCompany(profile),
    customerNumber: profile.custnr?.trim() || null,
    deliveryLine: delivery,
  };
}
