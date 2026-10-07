import {
  INSPECTION_TYPES,
  type InspectionTypeCode,
} from "@/constants/inspectionTypes";

/** Classification flags used to decide which inspection types apply. */
export type ClassificationServiceFlags = {
  annex1?: boolean | null;
  annex2?: boolean | null;
  softwareClass?: string | null;
  radiation?: boolean | null;
} | null | undefined;

/** Always offered on a service request, regardless of model classification. */
export const ALWAYS_AVAILABLE_SERVICE_TYPES = [
  "REPAIR",
  "SOFTWARE",
  "RADIATION",
  "OTHER",
] as const satisfies readonly InspectionTypeCode[];

const ALWAYS = new Set<string>(ALWAYS_AVAILABLE_SERVICE_TYPES);

/**
 * Service types for the scan-flow dropdown:
 * - STK / MTK when catalog classification asserts annex1 / annex2
 * - REPAIR, SOFTWARE, RADIATION, OTHER always
 * - DGUV only if we later add a dedicated flag (not today)
 */
export function serviceTypesForClassification(flags: ClassificationServiceFlags) {
  return INSPECTION_TYPES.filter((t) => {
    if (ALWAYS.has(t.code)) return true;
    if (!flags || !t.proposalKey) return false;
    if (t.proposalKey === "annex1") return flags.annex1 === true;
    if (t.proposalKey === "annex2") return flags.annex2 === true;
    if (t.proposalKey === "softwareClass") return Boolean(flags.softwareClass);
    if (t.proposalKey === "radiation") return flags.radiation === true;
    return false;
  });
}

/** Resolve flags from inventory device or catalog/BEUDAMED model. */
export function classificationFlagsFromResolution(resolution: {
  device?: { classification?: ClassificationServiceFlags } | null;
  model?: { classification?: ClassificationServiceFlags } | null;
} | null): ClassificationServiceFlags {
  return resolution?.device?.classification ?? resolution?.model?.classification ?? null;
}
