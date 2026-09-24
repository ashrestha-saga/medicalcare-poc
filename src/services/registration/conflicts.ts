import {
  openCheckMessages,
  type CheckRulesContext,
} from "./checkRules";
import type { RegistrationCharacteristics } from "./types";

/**
 * FA-300 / FA-220 — open Widersprüche and unacknowledged Hinweise block advancing.
 * Delegates to `evaluateCheckRules` (FA-301–306 + W-* + H-*).
 */
export function characteristicConflicts(
  m: RegistrationCharacteristics,
  ctx: CheckRulesContext = {},
): string[] {
  return openCheckMessages(m, ctx);
}
