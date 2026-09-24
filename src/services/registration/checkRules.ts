import {
  fieldMeta,
  hydrateAnswerMeta,
  isAnswered,
} from "./answerMeta";
import { ELECTRONIC_MESSGROESSE } from "./messgroessen";
import type { CheckRuleQuittance, RegistrationCharacteristics } from "./types";

/** FA-220 — Widerspruch blocks; Hinweis must be acknowledged. */
export type CheckRuleLevel = "widerspruch" | "hinweis";

export interface CheckRuleHit {
  id: string;
  level: CheckRuleLevel;
  fieldIds: string[];
  message: string;
}

export interface CheckRulesContext {
  /** Purchase year from Erstanlage step 1 (H-medgv-jahr). */
  purchaseYear?: number | string | null;
}

export type { CheckRuleQuittance };

/** Map Anlage-2 item numbers to electronic measuring functions (legacy digit-only drafts). */
function electronicFromAnlage2(ziffer: string | undefined): boolean {
  if (!ziffer) return false;
  if (ziffer === "1.1" || ziffer.startsWith("1.2")) return true;
  if (ziffer.startsWith("1.5") || ziffer === "1.6" || ziffer === "1.7") return true;
  return false;
}

function answeredYes(m: RegistrationCharacteristics, field: string): boolean {
  const meta = fieldMeta(m, field);
  if (!isAnswered(meta)) return false;
  return Boolean((m as unknown as Record<string, unknown>)[field]);
}

function answeredNo(m: RegistrationCharacteristics, field: string): boolean {
  const meta = fieldMeta(m, field);
  if (!isAnswered(meta)) return false;
  return !(m as unknown as Record<string, unknown>)[field];
}

function answeredValue(
  m: RegistrationCharacteristics,
  field: string,
): unknown | undefined {
  const meta = fieldMeta(m, field);
  if (!isAnswered(meta)) return undefined;
  return (m as unknown as Record<string, unknown>)[field];
}

function parseYear(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * FA-220–224 Prüfregeln (v17 `pruefregeln`) plus FA-301–306 hard contradictions.
 * Rules fire only on answered fields (FA-221).
 */
export function evaluateCheckRules(
  raw: RegistrationCharacteristics,
  ctx: CheckRulesContext = {},
): CheckRuleHit[] {
  const m = hydrateAnswerMeta(raw);
  const art = m.produktart;
  const hits: CheckRuleHit[] = [];
  const add = (id: string, level: CheckRuleLevel, fieldIds: string[], message: string) => {
    hits.push({ id, level, fieldIds, message });
  };

  // —— FA-301–306 (konflikte) ——
  if (
    answeredYes(m, "implantat") &&
    (answeredYes(m, "strahlung") ||
      answeredYes(m, "aufbereitung") ||
      answeredYes(m, "software") ||
      answeredYes(m, "istAufbGeraet"))
  ) {
    add(
      "FA-301",
      "widerspruch",
      ["implantat", "strahlung", "aufbereitung", "software", "istAufbGeraet"],
      "An implant under Anlage 3 is neither a radiation application, nor a reprocessing device, nor standalone software.",
    );
  }
  if (answeredYes(m, "einmalprodukt") && answeredYes(m, "aufbereitung")) {
    add(
      "FA-302",
      "widerspruch",
      ["einmalprodukt", "aufbereitung"],
      "Single-use and reusable products are mutually exclusive. § 9 applies to single-use devices, § 8 to reusable ones.",
    );
  }
  if (answeredYes(m, "software") && answeredYes(m, "anlage1")) {
    add(
      "FA-303",
      "widerspruch",
      ["software", "anlage1"],
      "Standalone software is not subject to a safety inspection under § 12 — that concerns electrical safety of the device.",
    );
  }
  if (answeredYes(m, "aedAusnahme") && answeredNo(m, "anlage1")) {
    add(
      "FA-304",
      "widerspruch",
      ["aedAusnahme", "anlage1"],
      "The AED exemption presupposes that the product would fall under Anlage 1 in the first place.",
    );
  }
  if ((m.zubehoer?.length ?? 0) > 0 && answeredNo(m, "aufbereitung")) {
    add(
      "FA-305",
      "widerspruch",
      ["zubehoer", "aufbereitung"],
      "Accessories with a different classification only make sense if the product is reprocessed.",
    );
  }

  if (answeredYes(m, "istAufbGeraet") && answeredYes(m, "aufbereitung")) {
    add(
      "FA-306",
      "widerspruch",
      ["istAufbGeraet", "aufbereitung"],
      "The product cannot be both the reprocessing device and the product being reprocessed.",
    );
  }

  // —— v17 Widersprüche (W-*) ——
  if (answeredYes(m, "implantat") && answeredYes(m, "aktiv")) {
    add(
      "W-impl-aktiv",
      "widerspruch",
      ["implantat", "aktiv"],
      "“Active, non-implantable” and “implant” are mutually exclusive. Active implants fall under Anlage 3, not under STK.",
    );
  }
  if (answeredYes(m, "vernetzt") && answeredNo(m, "aktiv")) {
    add(
      "W-netz-passiv",
      "widerspruch",
      ["vernetzt", "aktiv"],
      "A non-active product has no energy source and therefore no network connection.",
    );
  }

  const messgroesse = m.messgroesse;
  const electronic =
    (messgroesse && ELECTRONIC_MESSGROESSE[messgroesse]) ||
    (!messgroesse && electronicFromAnlage2(m.anlage2Ziffer));
  if (electronic && answeredNo(m, "aktiv")) {
    add(
      "W-mess-passiv",
      "widerspruch",
      ["messgroesse", "aktiv"],
      "This measured quantity is only captured by active devices. Mechanically it exists only for blood pressure (aneroid) and intraocular pressure.",
    );
  }

  const strahlenArt = answeredValue(m, "strahlenArt") as string | undefined;
  const zulassung = answeredValue(m, "zulassung") as string | undefined;
  if (
    answeredYes(m, "strahlung") &&
    (strahlenArt === "nuklear" || strahlenArt === "therapie") &&
    zulassung === "anzeige"
  ) {
    add(
      "W-zul",
      "widerspruch",
      ["zulassung", "strahlenArt"],
      "Radiotherapy and nuclear medicine require a licence under § 12 StrlSchG. A notification is not sufficient.",
    );
  }

  const aufbKlasse = answeredValue(m, "aufbKlasse") as string | undefined;
  if (
    answeredYes(m, "aufbereitung") &&
    typeof aufbKlasse === "string" &&
    /^kritisch/.test(aufbKlasse) &&
    answeredYes(m, "vernetzt") &&
    art === "instrument"
  ) {
    add(
      "W-instr-netz",
      "widerspruch",
      ["vernetzt"],
      "A surgical instrument is not networked.",
    );
  }

  // —— v17 Hinweise (H-*) ——
  const jahr = parseYear(ctx.purchaseYear);
  if (answeredYes(m, "altgeraet") && jahr != null && jahr > 1998) {
    add(
      "H-medgv-jahr",
      "hinweis",
      ["altgeraet"],
      `Legacy device under MedGV, but purchase year ${jahr}. MedGV applied to devices placed on the market before June 1998. Possible for a second-hand purchase — otherwise the answer is incorrect.`,
    );
  }
  if (answeredYes(m, "anlage1") && art === "messgeraet") {
    add(
      "H-anl1-mess",
      "hinweis",
      ["anlage1"],
      "Measuring devices under Anlage 2 are usually not listed in Anlage 1. Affirm only if the manufacturer's intended purpose expressly supports it.",
    );
  }
  if (answeredYes(m, "software") && art !== "software" && art !== "sonstiges") {
    add(
      "H-sw-eingebettet",
      "hinweis",
      ["software"],
      "This means standalone software as a medical device. Embedded software of a device does not count — otherwise duties under § 17 arise that do not apply.",
    );
  }
  if (answeredNo(m, "aufbereitung") && art === "sonografie") {
    add(
      "H-sono-aufb",
      "hinweis",
      ["aufbereitung"],
      "Ultrasound probes with mucosal contact — transvaginal, transrectal, transoesophageal — require semi-critical reprocessing. Answer “No” only if exclusively skin probes are used.",
    );
  }
  if (answeredYes(m, "aufbereitung") && aufbKlasse === "unkritisch" && art === "instrument") {
    add(
      "H-instr-unkr",
      "hinweis",
      ["aufbKlasse"],
      "Surgical instruments are usually classified as critical. “Non-critical” applies only to exclusive contact with intact skin.",
    );
  }
  if (
    answeredYes(m, "strahlung") &&
    art === "bildgebung" &&
    !(m.konstanz || []).length
  ) {
    add(
      "H-kz-leer",
      "hinweis",
      ["strahlung"],
      "X-ray without a constancy test: every X-ray installation has at least one test object under § 116 StrlSchV.",
    );
  }
  const wartungQuelle = answeredValue(m, "wartungQuelle") as string | undefined;
  const wartungIntervall = answeredValue(m, "wartungIntervall") as number | undefined;
  if (wartungQuelle === "eigen" && typeof wartungIntervall === "number" && wartungIntervall > 24) {
    add(
      "H-wart-lang",
      "hinweis",
      ["wartungIntervall", "wartungQuelle"],
      "An operator-defined maintenance interval of more than 24 months is unusually long.",
    );
  }
  if (answeredYes(m, "energie") && art === "messgeraet") {
    add(
      "H-energie-mess",
      "hinweis",
      ["energie"],
      "A measuring device does not usually deliver energy to the patient.",
    );
  }

  return hits;
}

export function isRuleAcknowledged(m: RegistrationCharacteristics, ruleId: string): boolean {
  return Boolean(m.ruleQuittances?.[ruleId]);
}

/** Open Widersprüche plus unacknowledged Hinweise (v17 `offenePruefungen`). */
export function openCheckRules(
  m: RegistrationCharacteristics,
  ctx: CheckRulesContext = {},
): CheckRuleHit[] {
  return evaluateCheckRules(m, ctx).filter(
    (r) => r.level === "widerspruch" || !isRuleAcknowledged(m, r.id),
  );
}

export function openCheckMessages(
  m: RegistrationCharacteristics,
  ctx: CheckRulesContext = {},
): string[] {
  return openCheckRules(m, ctx).map((r) => r.message);
}

/** Acknowledge a Hinweis — stores wording (FA-224). */
export function acknowledgeCheckRule(
  m: RegistrationCharacteristics,
  hit: CheckRuleHit,
  actor: string,
  at = new Date().toISOString(),
): RegistrationCharacteristics {
  if (hit.level !== "hinweis") return m;
  return {
    ...m,
    ruleQuittances: {
      ...(m.ruleQuittances ?? {}),
      [hit.id]: {
        message: hit.message,
        by: actor,
        at,
        fieldIds: hit.fieldIds,
      },
    },
  };
}

/** FA-223 — changing an answer invalidates quittances that depended on it. */
export function invalidateQuittancesForFields(
  m: RegistrationCharacteristics,
  fields: string[],
): RegistrationCharacteristics {
  const q = m.ruleQuittances;
  if (!q || !fields.length) return m;
  const fieldSet = new Set(fields);
  let changed = false;
  const next: Record<string, CheckRuleQuittance> = {};
  for (const [id, entry] of Object.entries(q)) {
    if (entry.fieldIds.some((f) => fieldSet.has(f))) {
      changed = true;
      continue;
    }
    next[id] = entry;
  }
  if (!changed) return m;
  return { ...m, ruleQuittances: next };
}

export function rulesForField(hits: CheckRuleHit[], field: string): CheckRuleHit[] {
  return hits.filter((h) => h.fieldIds.includes(field));
}
