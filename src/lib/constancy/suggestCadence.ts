/** Map RefConstancyObject.defaultCadence text → suggested interval (employer may override). */
export function suggestFromDefaultCadence(defaultCadence: string | null | undefined): {
  intervalValue: number;
  intervalUnit: "months" | "years" | "working_days";
  hint: string | null;
} {
  const raw = (defaultCadence ?? "").toLowerCase().trim();
  if (!raw) {
    return { intervalValue: 12, intervalUnit: "months", hint: null };
  }
  if (raw.includes("arbeitst") || raw.includes("taeglich") || raw.includes("täglich") || raw === "daily") {
    return {
      intervalValue: 1,
      intervalUnit: "working_days",
      hint: `QS-RL names “${defaultCadence}” — working days (Mon–Fri). Confirm or choose another interval.`,
    };
  }
  if (raw.includes("monat")) {
    return {
      intervalValue: 1,
      intervalUnit: "months",
      hint: `QS-RL names “${defaultCadence}” — suggestion only.`,
    };
  }
  if (raw.includes("quart") || raw.includes("viertel")) {
    return {
      intervalValue: 3,
      intervalUnit: "months",
      hint: `QS-RL names “${defaultCadence}” — suggestion only.`,
    };
  }
  if (raw.includes("halb")) {
    return {
      intervalValue: 6,
      intervalUnit: "months",
      hint: `QS-RL names “${defaultCadence}” — suggestion only.`,
    };
  }
  if (raw.includes("jaehr") || raw.includes("jähr") || raw.includes("jahr")) {
    return {
      intervalValue: 1,
      intervalUnit: "years",
      hint: `QS-RL names “${defaultCadence}” — suggestion only.`,
    };
  }
  return {
    intervalValue: 12,
    intervalUnit: "months",
    hint: `QS-RL names “${defaultCadence}” — parse the interval yourself; suggestion only.`,
  };
}
