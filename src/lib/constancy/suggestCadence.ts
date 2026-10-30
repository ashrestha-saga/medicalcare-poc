export type ConstancyIntervalUnit = "months" | "years" | "working_days";

/** Map RefConstancyObject.defaultCadence text → suggested interval. */
export function suggestFromDefaultCadence(defaultCadence: string | null | undefined): {
  intervalValue: number;
  intervalUnit: ConstancyIntervalUnit;
  hint: string | null;
  parsed: boolean;
} {
  const raw = (defaultCadence ?? "").toLowerCase().trim();
  if (!raw) {
    return { intervalValue: 12, intervalUnit: "months", hint: null, parsed: false };
  }
  if (raw.includes("arbeitst") || raw.includes("taeglich") || raw.includes("täglich") || raw === "daily") {
    return {
      intervalValue: 1,
      intervalUnit: "working_days",
      hint: `QS-RL names “${defaultCadence}” — working days (Mon–Fri). Keep that unit or change the cited basis.`,
      parsed: true,
    };
  }
  if (raw.includes("monat")) {
    return {
      intervalValue: 1,
      intervalUnit: "months",
      hint: `QS-RL names “${defaultCadence}” — use months for this basis.`,
      parsed: true,
    };
  }
  if (raw.includes("quart") || raw.includes("viertel")) {
    return {
      intervalValue: 3,
      intervalUnit: "months",
      hint: `QS-RL names “${defaultCadence}” — use months for this basis.`,
      parsed: true,
    };
  }
  if (raw.includes("halb")) {
    return {
      intervalValue: 6,
      intervalUnit: "months",
      hint: `QS-RL names “${defaultCadence}” — use months for this basis.`,
      parsed: true,
    };
  }
  if (raw.includes("jaehr") || raw.includes("jähr") || raw.includes("jahr")) {
    return {
      intervalValue: 1,
      intervalUnit: "years",
      hint: `QS-RL names “${defaultCadence}” — use years for this basis.`,
      parsed: true,
    };
  }
  return {
    intervalValue: 12,
    intervalUnit: "months",
    hint: `QS-RL names “${defaultCadence}” — parse the interval yourself.`,
    parsed: false,
  };
}

/**
 * Blocks e.g. “1 working day” against a monthly QS-RL guideline.
 * Unknown / unparseable guidelines are not blocked.
 */
export function guidelineCadenceMismatch(
  defaultCadence: string | null | undefined,
  intervalUnit: ConstancyIntervalUnit,
): { mismatch: boolean; suggestedUnit: ConstancyIntervalUnit | null; guideline: string | null } {
  const suggested = suggestFromDefaultCadence(defaultCadence);
  if (!suggested.parsed || !defaultCadence?.trim()) {
    return { mismatch: false, suggestedUnit: null, guideline: null };
  }
  return {
    mismatch: intervalUnit !== suggested.intervalUnit,
    suggestedUnit: suggested.intervalUnit,
    guideline: defaultCadence.trim(),
  };
}
