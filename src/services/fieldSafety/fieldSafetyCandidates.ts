/**
 * Pure helpers for FSCA candidate matching (unit-testable without Prisma).
 * Suggestion only — never asserts affected=true.
 */

export type AffectedModelScope = {
  deviceModelId: string | null;
  basicUdiDi: string | null;
  serialFrom: string | null;
  serialTo: string | null;
};

export type CandidateDevice = {
  id: string;
  modelId: string | null;
  serialNumber: string | null;
  modelBasicUdiDi: string | null;
};

/** Lexicographic serial range check (letter serials as in manufacturer letters). */
export function serialInRange(
  serial: string | null | undefined,
  from: string | null | undefined,
  to: string | null | undefined,
): boolean {
  if (!from && !to) return true;
  if (!serial) return false;
  const s = serial.trim();
  if (from && s < from.trim()) return false;
  if (to && s > to.trim()) return false;
  return true;
}

export function deviceMatchesScope(device: CandidateDevice, scope: AffectedModelScope): boolean {
  const modelOk =
    (scope.deviceModelId != null && device.modelId === scope.deviceModelId) ||
    (scope.basicUdiDi != null &&
      scope.basicUdiDi.trim() !== "" &&
      device.modelBasicUdiDi === scope.basicUdiDi.trim());

  if (!scope.deviceModelId && !scope.basicUdiDi?.trim()) {
    // Serial-only row: match by serial range against any device.
    return serialInRange(device.serialNumber, scope.serialFrom, scope.serialTo);
  }
  if (!modelOk) return false;
  return serialInRange(device.serialNumber, scope.serialFrom, scope.serialTo);
}

export function filterCandidateDevices(
  devices: CandidateDevice[],
  scopes: AffectedModelScope[],
): CandidateDevice[] {
  if (scopes.length === 0) return [];
  const seen = new Set<string>();
  const out: CandidateDevice[] = [];
  for (const d of devices) {
    if (seen.has(d.id)) continue;
    if (scopes.some((s) => deviceMatchesScope(d, s))) {
      seen.add(d.id);
      out.push(d);
    }
  }
  return out;
}
