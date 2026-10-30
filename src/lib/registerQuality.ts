/**
 * Heuristics to hide obvious demo / test / keyboard-mash records from the
 * device book and incident registers. Purely presentational: nothing is deleted.
 */

const TEST_LABEL_RE = /^test\s*\d/i;
const TEST_CODE_RE = /^D\d+[a-z]{2,}$/i;

/** "Test 1", "test2", "D123abc" style placeholder labels. */
export function looksLikeTestLabel(text: string | null | undefined): boolean {
  const v = text?.trim();
  if (!v) return false;
  return TEST_LABEL_RE.test(v) || TEST_CODE_RE.test(v);
}

/**
 * Short single "word" that looks like random typing: mostly letters and either
 * a very low vowel ratio or a long run of the same character.
 */
export function looksLikeKeyboardMash(text: string | null | undefined): boolean {
  const v = text?.trim();
  if (!v || v.length >= 12 || /\s/.test(v)) return false;

  const letters = v.match(/\p{L}/gu) ?? [];
  if (letters.length < 3 || letters.length / v.length < 0.7) return false;

  if (/(.)\1{2,}/iu.test(v)) return true;

  const vowels = letters.filter((c) => /[aeiouyäöü]/i.test(c)).length;
  return vowels / letters.length < 0.2;
}

function isJunk(text: string | null | undefined): boolean {
  return looksLikeTestLabel(text) || looksLikeKeyboardMash(text);
}

export type RegisterDeviceFields = {
  inventoryNumber?: string | null;
  name?: string | null;
  modelName?: string | null;
  manufacturer?: string | null;
  serialNumber?: string | null;
  room?: string | null;
};

/** True when the device looks like demo junk (identifiers are mash/test labels). */
export function shouldHideFromRegisterDevice(fields: RegisterDeviceFields): boolean {
  // Manufacturer / model often hold short legal forms (e.g. GmbH) — test labels only there.
  const identifiers = [fields.inventoryNumber, fields.name, fields.serialNumber, fields.room];
  if (identifiers.some(isJunk)) return true;
  return [fields.modelName, fields.manufacturer].some(looksLikeTestLabel);
}

export type RegisterIncidentFields = {
  description?: string | null;
  harmDescription?: string | null;
};

/** True when the incident description (or harm description) looks like demo junk. */
export function shouldHideFromRegisterIncident(fields: RegisterIncidentFields): boolean {
  return isJunk(fields.description) || isJunk(fields.harmDescription);
}
