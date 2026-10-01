import type { InspectionTypeCode } from "@/constants/inspectionTypes";
import { INSPECTION_TYPE_CODES } from "@/constants/inspectionTypes";

const RADIATION_DUTIES = new Set(["CONSTANCY", "ACCEPT", "EXPERT", "MEDBOARD", "RADIOACTIVE"]);
const SOFTWARE_DUTIES = new Set(["ITSEC", "INSTALL", "NETWORK"]);

/** Map a frozen duty's inspection type onto the service-request catalog (FA-404). */
export function serviceTypeForDuty(inspectionTypeCode: string): InspectionTypeCode {
  const code = inspectionTypeCode.trim().toUpperCase();
  if ((INSPECTION_TYPE_CODES as readonly string[]).includes(code)) {
    return code as InspectionTypeCode;
  }
  if (RADIATION_DUTIES.has(code)) return "RADIATION";
  if (SOFTWARE_DUTIES.has(code)) return "SOFTWARE";
  return "OTHER";
}

export function deadlineAnchorLabel(anchor: string): string {
  switch (anchor) {
    case "exact_day":
      return "to the day";
    case "month_end":
      return "End of month";
    case "year_end":
      return "year-end";
    case "interval":
      return "recurring";
    case "event":
      return "event";
    case "process":
      return "process";
    case "permanent":
      return "ongoing";
    default:
      return anchor;
  }
}

export function confidenceLabel(confidence: string): string {
  if (confidence === "verified") return "evidenced";
  // Legacy `guess` reads as derived (SWOT: deprecation without silent drift).
  if (confidence === "guess" || confidence === "derived") return "derived";
  return confidence;
}
