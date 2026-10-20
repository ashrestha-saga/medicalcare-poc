import type { PermissionSlug } from "@/interfaces/permissions";

/**
 * Compact toggles for role `user` on invite/edit (in addition to the full matrix).
 * Maps to existing permission slugs — no new taxonomy.
 */
export const CAPTURER_EXTRA_CAPABILITIES: readonly {
  slug: PermissionSlug;
  label: string;
  description: string;
}[] = [
  {
    slug: "reprocessing:view",
    label: "Reprocessing",
    description: "Daily checks and batches on equipment in assigned areas",
  },
  {
    slug: "reprocessing:release",
    label: "Reprocessing release",
    description: "Sign off batches (also requires Sachkunde qualification)",
  },
  {
    slug: "devicebook:view",
    label: "Device book",
    description: "Read medical device book entries for devices in scope",
  },
  {
    slug: "incidents:view",
    label: "Incidents",
    description: "View incidents linked to devices in scope",
  },
] as const;
