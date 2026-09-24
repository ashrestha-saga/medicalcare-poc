import type { ProductKindDTO } from "./productKindTypes";
import type { RegistrationCharacteristics } from "./types";
import { applyProductKindAsSuggestions } from "./answerMeta";

export type { ProductKindDTO } from "./productKindTypes";

/**
 * Apply product-kind presets as suggestions (FA-200 / FA-210).
 * Prefill is not an answer until the user confirms or changes it.
 */
export function applyProductKindPresets(
  kind: ProductKindDTO,
  _current?: RegistrationCharacteristics,
): RegistrationCharacteristics {
  return applyProductKindAsSuggestions(kind);
}

export function blockVisible(kind: ProductKindDTO | null, key: string, weitere: boolean): boolean {
  if (!kind) return false;
  if (kind.blocks.includes(key)) return false;
  if (kind.shows.includes(key)) return true;
  return weitere;
}
