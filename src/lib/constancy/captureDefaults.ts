/**
 * QS-RL / mockup-aligned capture defaults per Prüfgegenstand (E87).
 * Used when determining takt and when correcting seeded cadences.
 */

export type ConstancyCaptureMode = "device_protocol" | "manual_measurement" | "visual";

export type ConstancyRefValue = {
  name: string;
  value: number;
  unit: string;
  tolerancePct?: number | null;
  toleranceAbs?: number | null;
  source?: string | null;
  asOf?: string | null;
};

export type ConstancyCaptureDefaults = {
  captureMode: ConstancyCaptureMode;
  protocolSource: string | null;
  referenceValues: ConstancyRefValue[] | null;
  visualCheckpoints: string[] | null;
};

const QS = "QS-RL Röntgendiagnostik / DIN 6868-Reihe";

const DEFAULTS: Record<string, ConstancyCaptureDefaults> = {
  aufnahme: {
    captureMode: "device_protocol",
    protocolSource: "Herstellersoftware Radiotec QC-Suite",
    referenceValues: null,
    visualCheckpoints: null,
  },
  durchl: {
    captureMode: "device_protocol",
    protocolSource: "Herstellersoftware",
    referenceValues: null,
    visualCheckpoints: null,
  },
  monitor: {
    // Mockup haupt: arbeitstäglich Sichtprüfung (C). Monthly Leuchtdichte (B) is a second object there.
    captureMode: "visual",
    protocolSource: null,
    referenceValues: null,
    visualCheckpoints: [
      "Testbild TG18-QC: alle Graustufenfelder unterscheidbar",
      "Keine Artefakte, Pixelfehler oder Nachleuchten",
      "Umgebungsbeleuchtung wie festgelegt (abgedunkelt)",
    ],
  },
  digital: {
    captureMode: "visual",
    protocolSource: null,
    referenceValues: null,
    visualCheckpoints: [
      "Prüfkörperaufnahme ohne Artefakte",
      "Dosisindikator im Referenzbereich",
      "Bildbezeichnung und Seitenkennung korrekt",
    ],
  },
  dosis: {
    captureMode: "manual_measurement",
    protocolSource: null,
    referenceValues: [
      {
        name: "DFP Anzeige/Referenz",
        value: 100,
        unit: "%",
        tolerancePct: 25,
        source: QS,
        asOf: "2026-11",
      },
    ],
    visualCheckpoints: null,
  },
};

/** Optional second capture for monitor luminance (mockup Weg B) when a duty is labelled for it. */
export const MONITOR_LUMINANCE_DEFAULTS: ConstancyCaptureDefaults = {
  captureMode: "manual_measurement",
  protocolSource: null,
  referenceValues: [
    {
      name: "Lmax",
      value: 450,
      unit: "cd/m²",
      tolerancePct: 10,
      source: QS,
      asOf: "2026-11",
    },
    {
      name: "Lmin",
      value: 1.2,
      unit: "cd/m²",
      tolerancePct: 20,
      source: QS,
      asOf: "2026-11",
    },
  ],
  visualCheckpoints: null,
};

export function captureDefaultsForObject(
  constancyObjectCode: string | null | undefined,
): ConstancyCaptureDefaults {
  const code = (constancyObjectCode ?? "").trim().toLowerCase();
  return (
    DEFAULTS[code] ?? {
      captureMode: "device_protocol",
      protocolSource: null,
      referenceValues: null,
      visualCheckpoints: null,
    }
  );
}

/** Resolve checkpoints: cadence JSON optional override, else object defaults. */
export function visualCheckpointsFor(
  constancyObjectCode: string | null | undefined,
  referenceValuesJson: unknown,
): string[] {
  if (Array.isArray(referenceValuesJson)) {
    const fromJson = referenceValuesJson
      .map((row) => {
        const r = row as { point?: string; checkpoint?: string };
        return (r.point ?? r.checkpoint ?? "").trim();
      })
      .filter(Boolean);
    if (fromJson.length) return fromJson;
  }
  if (
    referenceValuesJson &&
    typeof referenceValuesJson === "object" &&
    Array.isArray((referenceValuesJson as { visualCheckpoints?: unknown }).visualCheckpoints)
  ) {
    return ((referenceValuesJson as { visualCheckpoints: unknown[] }).visualCheckpoints)
      .map((x) => String(x).trim())
      .filter(Boolean);
  }
  return captureDefaultsForObject(constancyObjectCode).visualCheckpoints ?? [];
}

export function referenceRowsFromJson(json: unknown): ConstancyRefValue[] {
  if (!Array.isArray(json)) return [];
  const out: ConstancyRefValue[] = [];
  for (const row of json) {
    const r = row as Partial<ConstancyRefValue>;
    if (!r?.name || typeof r.value !== "number" || !r.unit) continue;
    out.push({
      name: r.name,
      value: r.value,
      unit: r.unit,
      tolerancePct: r.tolerancePct ?? null,
      toleranceAbs: r.toleranceAbs ?? null,
      source: r.source ?? null,
      asOf: r.asOf ?? null,
    });
  }
  return out;
}
