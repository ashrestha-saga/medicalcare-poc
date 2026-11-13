/** Canonical repair serviceType values (E70). Scan dropdown may still emit `REPAIR`. */
export const REPAIR_SERVICE_TYPE = "repair" as const;
export const POST_REPAIR_CHECK_SERVICE_TYPE = "post_repair_check" as const;

export const REPAIR_SERVICE_TYPES = [
  REPAIR_SERVICE_TYPE,
  POST_REPAIR_CHECK_SERVICE_TYPE,
] as const;

export type RepairServiceType = (typeof REPAIR_SERVICE_TYPES)[number];

/** Alias normalisation for reads / counters. */
export function canonicalServiceType(raw: string): string {
  if (raw === "REPAIR" || raw === "instandsetzung") return REPAIR_SERVICE_TYPE;
  if (raw === "pruefung_nach_instandsetzung") return POST_REPAIR_CHECK_SERVICE_TYPE;
  return raw;
}

export type PostRepairCheckKind = "stk" | "mtk" | "requalification" | "acceptance_constancy";

export const POST_REPAIR_CHECK_LABELS: Record<
  PostRepairCheckKind,
  { de: string; en: string }
> = {
  stk: {
    de: "Prüfung nach Instandsetzung (§ 7 Abs. 2, STK)",
    en: "Post-repair check (§ 7 (2), STK)",
  },
  mtk: {
    de: "Messtechnische Kontrolle nach Instandsetzung",
    en: "Metrological check after repair",
  },
  requalification: {
    de: "Erneute Leistungsbeurteilung nach Instandsetzung",
    en: "Renewed performance qualification after repair",
  },
  acceptance_constancy: {
    de: "Abnahme-/Konstanzprüfung nach Instandsetzung",
    en: "Acceptance/constancy check after repair",
  },
};

/** E78 class map inputs derived from open DeviceModelClassification + reprocessing profile. */
export type PostRepairClassHints = {
  radiation?: boolean | null;
  annex2?: boolean | null;
  /** deviceFamilyCode or product kind hint */
  deviceFamilyCode?: string | null;
  productKindCode?: string | null;
  hasReprocessingProfile?: boolean;
};

export function postRepairCheckByClass(hints: PostRepairClassHints): PostRepairCheckKind {
  if (hints.radiation) return "acceptance_constancy";
  if (hints.hasReprocessingProfile) return "requalification";
  const family = (hints.deviceFamilyCode ?? hints.productKindCode ?? "").toLowerCase();
  if (family.includes("aufbereit") || family.includes("reproc") || family === "sterilisator") {
    return "requalification";
  }
  if (family.includes("roentgen") || family.includes("radiation") || family.includes("xray")) {
    return "acceptance_constancy";
  }
  if (hints.annex2 || family.includes("mess") || family.includes("mtk")) return "mtk";
  return "stk";
}

export const K_REP_CATALOGUE_CODE = "K-REP";

/** RefInspectionType.code for the general K-REP catalogue. */
export const REPAIR_INSPECTION_TYPE_CODE = "REPAIR";

/** Map E78 post-repair checkType → RefInspectionType.code. */
export function inspectionTypeCodeForCheckType(
  checkType: PostRepairCheckKind | string | null | undefined,
): string {
  switch (checkType) {
    case "mtk":
      return "MTK";
    case "requalification":
      return "VALIDATION";
    case "acceptance_constancy":
      return "CONSTANCY";
    case "stk":
    default:
      return "STK";
  }
}

/**
 * Inspection type used when starting/previewing a protocol for a service request.
 * Duty wins when present; repair SRs without a duty map to REPAIR (K-REP), not STK.
 * Post-repair SRs use checkType (E78) when no duty type is set.
 */
export function inspectionTypeCodeForServiceRequest(input: {
  serviceType: string;
  dutyInspectionTypeCode?: string | null;
  checkType?: PostRepairCheckKind | string | null;
}): string {
  if (input.dutyInspectionTypeCode) return input.dutyInspectionTypeCode;
  const st = canonicalServiceType(input.serviceType);
  if (st === REPAIR_SERVICE_TYPE) return REPAIR_INSPECTION_TYPE_CODE;
  if (st === POST_REPAIR_CHECK_SERVICE_TYPE) {
    return inspectionTypeCodeForCheckType(input.checkType);
  }
  return "STK";
}
