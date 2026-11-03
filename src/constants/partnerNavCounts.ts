import type { MenuModuleId } from "@/interfaces/permissions";

/** Raw payload from GET /api/partner/nav-counts (menu id → count). */
export type PartnerNavCountsRaw = Partial<Record<MenuModuleId, number>>;

export type PartnerNavCountEntry = {
  count: number;
  warn: boolean;
};

export type PartnerNavCountsResponse = Partial<Record<MenuModuleId, PartnerNavCountEntry>>;

/** Modules that show a warn-styled badge when count > 0. */
const WARN_WHEN_POSITIVE = new Set<MenuModuleId>(["console-today", "console-due-dates"]);

export function normalizePartnerNavCounts(raw: PartnerNavCountsRaw): PartnerNavCountsResponse {
  const out: PartnerNavCountsResponse = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) continue;
    const id = key as MenuModuleId;
    out[id] = {
      count: value,
      warn: WARN_WHEN_POSITIVE.has(id),
    };
  }
  return out;
}
