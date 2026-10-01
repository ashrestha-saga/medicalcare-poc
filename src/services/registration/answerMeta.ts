import type { ProductKindDTO } from "./productKindTypes";
import type { RegistrationCharacteristics } from "./types";
import {
  messgroesseByKey,
  messgroesseFromZiffer,
  messgroesseNeedsVariante,
  zifferAus,
} from "./messgroessen";

/** Local visibility check — avoids circular import with productKindLogic. */
function blockVisible(kind: ProductKindDTO | null, key: string, weitere: boolean): boolean {
  if (!kind) return false;
  if (kind.blocks.includes(key)) return false;
  if (kind.shows.includes(key)) return true;
  return weitere;
}

/**
 * Mockup v18: AED layperson/public-space question only for aktiv-therapie and sonstiges.
 */
export function showsAedExemptionQuestion(produktart: string | undefined | null): boolean {
  return produktart === "aktiv-therapie" || produktart === "sonstiges";
}

/** FA-208 — only confirmed / chosen count as answered; deferred is explicit gap (ERF-01). */
export type AnswerState =
  | "offen"
  | "vorschlag"
  | "vorschlag_bestaetigt"
  | "selbst_gewaehlt"
  | "deferred";

export interface FieldAnswerMeta {
  state: AnswerState;
  suggestedValue?: unknown;
  confirmedBy?: string | null;
  confirmedAt?: string | null;
  /** True when the user changed a suggestion rather than confirming it. */
  changedFromSuggestion?: boolean;
}

export type DecisionOrigin = "bestaetigt" | "geaendert" | "selbst_gewaehlt";

export interface DecisionProtocolEntry {
  field: string;
  label: string;
  answer: string;
  origin: DecisionOrigin;
  person: string | null;
  at: string | null;
}

export interface AnswerCounts {
  confirmed: number;
  changed: number;
  selfChosen: number;
}

/** Fields that participate in the suggestion / confirm lifecycle. */
export const TRACKED_FIELDS = [
  "aktiv",
  "anlage1",
  "altgeraet",
  "aedAusnahme",
  "energie",
  "strahlung",
  "strahlenArt",
  "zulassung",
  "software",
  "swKlasse",
  "aufbereitung",
  "aufbKlasse",
  "aufbExtern",
  "vernetzt",
  "implantat",
  "einmalprodukt",
  "istAufbGeraet",
  "eigenTyp",
  "wartungIntervall",
  "wartungQuelle",
  "wartungBegruendung",
  "messgroesse",
  "messvariante",
  "anlage2Choice",
  "anlage2Verfahren",
] as const;

export type TrackedField = (typeof TRACKED_FIELDS)[number];

const FIELD_LABELS: Record<TrackedField, string> = {
  aktiv: "Active, non-implantable product",
  anlage1: "Anlage 1 MPBetreibV",
  altgeraet: "Legacy device MedGV Gruppe 1",
  aedAusnahme: "AED exemption",
  energie: "Energy application",
  strahlung: "Application of ionising radiation",
  strahlenArt: "Type of radiation application",
  zulassung: "Regulatory authorisation",
  software: "Software as medical device / IVD",
  swKlasse: "Software class",
  aufbereitung: "Reusable and requires reprocessing",
  aufbKlasse: "Reprocessing class",
  aufbExtern: "Reprocessing outsourced",
  vernetzt: "Networked",
  implantat: "Implant per Anlage 3",
  einmalprodukt: "Reprocessing of single-use devices (§ 9)",
  istAufbGeraet: "Product is a reprocessing device",
  eigenTyp: "Type of reprocessing device",
  wartungIntervall: "Maintenance interval (months)",
  wartungQuelle: "Origin of the maintenance interval",
  wartungBegruendung: "Justification of the set interval",
  messgroesse: "Measured quantity (Anlage 2)",
  messvariante: "Measured quantity — variant",
  anlage2Choice: "Measuring function per Anlage 2",
  anlage2Verfahren: "Anlage 2 procedure (1.5.3)",
};

/** Sentinel: explicit “no measuring function” (FA-211). */
export const ANLAGE2_NONE = "__none__";

export function emptyCharacteristics(): RegistrationCharacteristics {
  return {
    produktart: "",
    weitere: false,
  };
}

export function isAnswered(meta: FieldAnswerMeta | undefined): boolean {
  return meta?.state === "vorschlag_bestaetigt" || meta?.state === "selbst_gewaehlt";
}

/** ERF-01 — explicit deferral; device may stay draft with a DeviceClarification row. */
export function isDeferred(meta: FieldAnswerMeta | undefined): boolean {
  return meta?.state === "deferred";
}

export function deferField(
  m: RegistrationCharacteristics,
  field: string,
  actor: string,
): RegistrationCharacteristics {
  return withMeta(m, field, stamp({ state: "deferred" }, actor));
}

export function fieldMeta(
  m: RegistrationCharacteristics,
  field: string,
): FieldAnswerMeta | undefined {
  return m.answerMeta?.[field];
}

function stamp(
  meta: FieldAnswerMeta,
  actor: string,
  now = new Date().toISOString(),
): FieldAnswerMeta {
  return { ...meta, confirmedBy: actor, confirmedAt: now };
}

function withMeta(
  m: RegistrationCharacteristics,
  field: string,
  meta: FieldAnswerMeta,
): RegistrationCharacteristics {
  return {
    ...m,
    answerMeta: { ...(m.answerMeta ?? {}), [field]: meta },
  };
}

function clearMetaField(
  m: RegistrationCharacteristics,
  field: string,
): RegistrationCharacteristics {
  const next = { ...(m.answerMeta ?? {}) };
  delete next[field];
  return { ...m, answerMeta: next };
}

/**
 * Legacy blobs without answerMeta: defined values count as self-chosen
 * so older drafts/tests still derive. Unset fields stay offen.
 */
export function hydrateAnswerMeta(m: RegistrationCharacteristics): RegistrationCharacteristics {
  let next = m;
  const meta: Record<string, FieldAnswerMeta> = { ...(m.answerMeta ?? {}) };

  const markIfSet = (field: string, value: unknown) => {
    if (meta[field]) return;
    if (value === undefined || value === null || value === "") return;
    meta[field] = { state: "selbst_gewaehlt" };
  };

  for (const key of TRACKED_FIELDS) {
    if (key === "anlage2Choice" || key === "messgroesse" || key === "messvariante") continue;
    markIfSet(key, (next as unknown as Record<string, unknown>)[key]);
  }

  if (!meta.messgroesse) {
    if (next.messgroesse) {
      meta.messgroesse = { state: "selbst_gewaehlt" };
      if (next.messvariante) meta.messvariante = { state: "selbst_gewaehlt" };
    } else if (next.anlage2ItemId || next.anlage2Ziffer) {
      const mapped = next.anlage2Ziffer ? messgroesseFromZiffer(next.anlage2Ziffer) : null;
      if (mapped) {
        next = {
          ...next,
          messgroesse: mapped.messgroesse,
          messvariante: mapped.messvariante,
        };
        meta.messgroesse = { state: "selbst_gewaehlt" };
        if (mapped.messvariante) meta.messvariante = { state: "selbst_gewaehlt" };
      }
      meta.anlage2Choice = { state: "selbst_gewaehlt" };
    }
  }

  if (!meta.anlage2Choice) {
    if (next.anlage2ItemId || next.anlage2Ziffer || next.messgroesse) {
      meta.anlage2Choice = { state: "selbst_gewaehlt" };
    }
  }

  return { ...next, answerMeta: meta };
}

export function suggestedZulassung(strahlenArt: string | undefined): string {
  return strahlenArt === "roentgen" ? "anzeige" : "genehmigung";
}

function setSuggestion(
  m: RegistrationCharacteristics,
  field: TrackedField,
  value: unknown,
): RegistrationCharacteristics {
  const next: RegistrationCharacteristics = { ...m };
  applyValue(next, field, value);
  return withMeta(next, field, {
    state: "vorschlag",
    suggestedValue: value,
  });
}

/**
 * Apply product-kind presets as suggestions (FA-210), not final answers.
 * Also suggests IFU maintenance 12 months (FA-212) and authorization from radiation type (FA-213).
 */
export function applyProductKindAsSuggestions(kind: ProductKindDTO): RegistrationCharacteristics {
  let m = emptyCharacteristics();
  m.produktart = kind.code;
  m.weitere = false;

  const presets = kind.presets ?? {};

  const boolKeys: TrackedField[] = [
    "aktiv",
    "anlage1",
    "strahlung",
    "vernetzt",
    "aufbereitung",
    "software",
    "implantat",
    "istAufbGeraet",
  ];
  for (const key of boolKeys) {
    if (presets[key] === true || presets[key] === false) {
      m = setSuggestion(m, key, Boolean(presets[key]));
    }
  }

  if (typeof presets.strahlenArt === "string" && presets.strahlenArt) {
    m = setSuggestion(m, "strahlenArt", presets.strahlenArt);
    m = setSuggestion(m, "zulassung", suggestedZulassung(presets.strahlenArt));
  } else if (presets.strahlung === true) {
    m = setSuggestion(m, "zulassung", suggestedZulassung(undefined));
  }

  if (blockVisible(kind, "wartung", false)) {
    m = setSuggestion(m, "wartungIntervall", 12);
    m = setSuggestion(m, "wartungQuelle", "hersteller");
  }

  return m;
}

/** Confirm a suggestion without changing the value (FA-210 / FA-216). */
export function confirmSuggestion(
  m: RegistrationCharacteristics,
  field: string,
  actor: string,
): RegistrationCharacteristics {
  const meta = fieldMeta(m, field);
  if (!meta || meta.state !== "vorschlag") return m;
  return withMeta(
    m,
    field,
    stamp({ ...meta, state: "vorschlag_bestaetigt", changedFromSuggestion: false }, actor),
  );
}

/** Confirm every current suggestion; open fields stay open (FA-216). */
export function confirmAllSuggestions(
  m: RegistrationCharacteristics,
  actor: string,
): RegistrationCharacteristics {
  let next = m;
  for (const [field, meta] of Object.entries(m.answerMeta ?? {})) {
    if (meta.state === "vorschlag") {
      next = confirmSuggestion(next, field, actor);
    }
  }
  return next;
}

/**
 * Record a user answer. Matching a suggestion → bestätigt; differing → geändert;
 * no prior suggestion → selbst gewählt.
 */
export function answerField(
  m: RegistrationCharacteristics,
  field: string,
  value: unknown,
  actor: string,
): RegistrationCharacteristics {
  const prev = fieldMeta(m, field);
  const suggested = prev?.suggestedValue;
  const hadSuggestion =
    prev?.state === "vorschlag" ||
    prev?.state === "vorschlag_bestaetigt" ||
    prev?.suggestedValue !== undefined;

  let state: AnswerState;
  let changedFromSuggestion = false;
  if (hadSuggestion && Object.is(suggested, value)) {
    state = "vorschlag_bestaetigt";
    changedFromSuggestion = false;
  } else if (hadSuggestion) {
    state = "selbst_gewaehlt";
    changedFromSuggestion = true;
  } else {
    state = "selbst_gewaehlt";
  }

  let next: RegistrationCharacteristics = { ...m };
  applyValue(next, field, value);
  if (field === "eigenTyp" && value) {
    next.istAufbGeraet = true;
  }
  next = withMeta(
    next,
    field,
    stamp(
      {
        state,
        suggestedValue: prev?.suggestedValue,
        changedFromSuggestion,
      },
      actor,
    ),
  );
  if (field === "eigenTyp" && value) {
    next = withMeta(
      next,
      "istAufbGeraet",
      stamp({ state, suggestedValue: true, changedFromSuggestion }, actor),
    );
  }
  next = clearDependents(next, field, value, actor);
  // FA-223 — changing an answer drops dependent Hinweis quittances.
  return dropQuittancesForFields(
    next,
    [field, field === "eigenTyp" ? "istAufbGeraet" : ""].filter(Boolean),
  );
}

/** Local copy to avoid circular import with checkRules. */
function dropQuittancesForFields(
  m: RegistrationCharacteristics,
  fields: string[],
): RegistrationCharacteristics {
  const q = m.ruleQuittances;
  if (!q || !fields.length) return m;
  const fieldSet = new Set(fields);
  let changed = false;
  const next: NonNullable<RegistrationCharacteristics["ruleQuittances"]> = {};
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

/** Anlage 2 measuring function — explicit none or item id (FA-211). Legacy path. */
export function answerAnlage2Choice(
  m: RegistrationCharacteristics,
  choice: typeof ANLAGE2_NONE | string,
  itemNo: string | undefined,
  actor: string,
  requiresVerfahren: boolean,
): RegistrationCharacteristics {
  let next = answerField(m, "anlage2Choice", choice, actor);
  if (choice === ANLAGE2_NONE || choice === "") {
    next = {
      ...next,
      anlage2ItemId: undefined,
      anlage2Ziffer: undefined,
      anlage2Verfahren: undefined,
      messgroesse: "keine",
      messvariante: undefined,
    };
    next = clearMetaField(next, "anlage2Verfahren");
    next = withMeta(next, "messgroesse", stamp({ state: "selbst_gewaehlt" }, actor));
    next = clearMetaField(next, "messvariante");
  } else {
    next = {
      ...next,
      anlage2ItemId: choice,
      anlage2Ziffer: itemNo,
      anlage2Verfahren: undefined,
    };
    const mapped = itemNo ? messgroesseFromZiffer(itemNo) : null;
    if (mapped) {
      next = { ...next, messgroesse: mapped.messgroesse, messvariante: mapped.messvariante };
      next = withMeta(next, "messgroesse", stamp({ state: "selbst_gewaehlt" }, actor));
      if (mapped.messvariante) {
        next = withMeta(next, "messvariante", stamp({ state: "selbst_gewaehlt" }, actor));
      }
    }
    if (requiresVerfahren) {
      next = withMeta(next, "anlage2Verfahren", { state: "offen" });
    } else {
      next = clearMetaField(next, "anlage2Verfahren");
    }
  }
  return next;
}

/**
 * FA-203 — pick Messgröße; digit and interval are derived (v17 mtkBlock).
 * Pass annex2Leaves to resolve item id when available.
 */
export function answerMessgroesse(
  m: RegistrationCharacteristics,
  key: string,
  actor: string,
  annex2Leaves?: { id: string; itemNo: string; wahlweiseNach?: string[] | null }[],
): RegistrationCharacteristics {
  let next = answerField(m, "messgroesse", key, actor);
  next = {
    ...next,
    messvariante: undefined,
    anlage2Verfahren: undefined,
  };
  next = clearMetaField(next, "messvariante");
  next = clearMetaField(next, "anlage2Verfahren");

  const g = messgroesseByKey(key);
  if (!g || key === "keine") {
    next = {
      ...next,
      anlage2ItemId: undefined,
      anlage2Ziffer: undefined,
    };
    next = withMeta(next, "anlage2Choice", stamp({ state: "selbst_gewaehlt", suggestedValue: ANLAGE2_NONE }, actor));
    return next;
  }

  if (messgroesseNeedsVariante(key)) {
    next = {
      ...next,
      anlage2ItemId: undefined,
      anlage2Ziffer: undefined,
    };
    next = withMeta(next, "messvariante", { state: "offen" });
    return next;
  }

  return applyDerivedZiffer(next, zifferAus({ messgroesse: key }), actor, annex2Leaves);
}

export function answerMessvariante(
  m: RegistrationCharacteristics,
  variante: string,
  actor: string,
  annex2Leaves?: { id: string; itemNo: string; wahlweiseNach?: string[] | null }[],
): RegistrationCharacteristics {
  let next = answerField(m, "messvariante", variante, actor);
  const z = zifferAus({ messgroesse: next.messgroesse, messvariante: variante });
  return applyDerivedZiffer(next, z, actor, annex2Leaves);
}

function applyDerivedZiffer(
  m: RegistrationCharacteristics,
  ziffer: string,
  actor: string,
  annex2Leaves?: { id: string; itemNo: string; wahlweiseNach?: string[] | null }[],
): RegistrationCharacteristics {
  const leaf = ziffer
    ? annex2Leaves?.find((a) => a.itemNo === ziffer)
    : undefined;
  let next: RegistrationCharacteristics = {
    ...m,
    anlage2Ziffer: ziffer || undefined,
    anlage2ItemId: leaf?.id,
    anlage2Verfahren: undefined,
  };
  next = withMeta(
    next,
    "anlage2Choice",
    stamp(
      {
        state: "selbst_gewaehlt",
        suggestedValue: leaf?.id ?? (ziffer ? ziffer : ANLAGE2_NONE),
      },
      actor,
    ),
  );
  next = clearMetaField(next, "anlage2Verfahren");
  if (leaf?.wahlweiseNach?.length) {
    next = withMeta(next, "anlage2Verfahren", { state: "offen" });
  }
  return next;
}

function applyValue(m: RegistrationCharacteristics, field: string, value: unknown): void {
  if (field === "anlage2Choice") {
    if (value === ANLAGE2_NONE || value === "") {
      m.anlage2ItemId = undefined;
      m.anlage2Ziffer = undefined;
      m.anlage2Verfahren = undefined;
    }
    // concrete item id is applied by the caller alongside labels
    return;
  }
  if (field === "wartungIntervall") {
    m.wartungIntervall = value as number;
    return;
  }
  if (field === "wartungQuelle") {
    m.wartungQuelle = value as "hersteller" | "eigen";
    return;
  }
  if (field === "wartungBegruendung") {
    m.wartungBegruendung = typeof value === "string" ? value : String(value ?? "");
    return;
  }
  (m as unknown as Record<string, unknown>)[field] = value;
}

/** FA-214 — denying a parent clears dependent answers. */
export function clearDependents(
  m: RegistrationCharacteristics,
  field: string,
  value: unknown,
  _actor: string,
): RegistrationCharacteristics {
  if (field === "aktiv" && value === false) {
    return clearFields(m, ["anlage1", "altgeraet", "aedAusnahme", "energie"]);
  }
  if (field === "anlage1" && value === false) {
    return clearFields(m, ["aedAusnahme"]);
  }
  if (field === "strahlung" && value === false) {
    return clearFields(m, ["strahlenArt", "zulassung", "konstanz"]);
  }
  if (field === "software" && value === false) {
    return clearFields(m, ["swKlasse"]);
  }
  if (field === "aufbereitung" && value === false) {
    return clearFields(m, ["aufbKlasse", "aufbExtern", "aufbGeraete", "zubehoer"]);
  }
  if (field === "wartungQuelle" && value !== "eigen") {
    return clearFields(m, ["wartungBegruendung"]);
  }
  return m;
}

function clearFields(
  m: RegistrationCharacteristics,
  fields: string[],
): RegistrationCharacteristics {
  let next: RegistrationCharacteristics = { ...m };
  for (const f of fields) {
    if (f === "konstanz") {
      next.konstanz = undefined;
    } else if (f === "aufbGeraete") {
      next.aufbGeraete = undefined;
    } else if (f === "zubehoer") {
      next.zubehoer = undefined;
    } else {
      (next as unknown as Record<string, unknown>)[f] = undefined;
    }
    next = clearMetaField(next, f);
  }
  return next;
}

export interface UnansweredField {
  field: string;
  label: string;
}

function needsAnswer(m: RegistrationCharacteristics, field: string): boolean {
  if (field === "wartungBegruendung") {
    if (!isAnswered(fieldMeta(m, field))) return true;
    return !String(m.wartungBegruendung ?? "").trim();
  }
  return !isAnswered(fieldMeta(m, field));
}

/**
 * Visible duty-triggering fields that are still open or only suggested (FA-215).
 */
export function unansweredVisibleFields(
  m: RegistrationCharacteristics,
  kind: ProductKindDTO | null,
): UnansweredField[] {
  const hydrated = hydrateAnswerMeta(m);
  const weitere = Boolean(hydrated.weitere);
  const show = (key: string) => blockVisible(kind, key, weitere);
  const out: UnansweredField[] = [];
  const add = (field: TrackedField) => {
    if (needsAnswer(hydrated, field)) {
      out.push({ field, label: FIELD_LABELS[field] });
    }
  };

  if (show("wartung")) {
    add("wartungIntervall");
    add("wartungQuelle");
    if (
      hydrated.wartungQuelle === "eigen" &&
      isAnswered(fieldMeta(hydrated, "wartungQuelle"))
    ) {
      add("wartungBegruendung");
    }
  }

  if (show("stk")) {
    add("aktiv");
    if (hydrated.aktiv === true && isAnswered(fieldMeta(hydrated, "aktiv"))) {
      add("anlage1");
      add("altgeraet");
      if (
        showsAedExemptionQuestion(hydrated.produktart) &&
        hydrated.anlage1 === true &&
        isAnswered(fieldMeta(hydrated, "anlage1"))
      ) {
        add("aedAusnahme");
      }
    }
  }

  if (show("mtk")) {
    add("messgroesse");
    if (messgroesseNeedsVariante(hydrated.messgroesse)) {
      add("messvariante");
    }
    if (fieldMeta(hydrated, "anlage2Verfahren") && needsAnswer(hydrated, "anlage2Verfahren")) {
      add("anlage2Verfahren");
    }
  }

  if (show("strahlung")) {
    add("strahlung");
    if (hydrated.strahlung === true && isAnswered(fieldMeta(hydrated, "strahlung"))) {
      add("strahlenArt");
      add("zulassung");
    }
  }

  if (show("software")) {
    add("software");
    if (hydrated.software === true && isAnswered(fieldMeta(hydrated, "software"))) {
      add("swKlasse");
    }
  }

  if (show("aufbereitung")) {
    add("aufbereitung");
    if (hydrated.aufbereitung === true && isAnswered(fieldMeta(hydrated, "aufbereitung"))) {
      add("aufbKlasse");
      add("aufbExtern");
    }
  }

  if (show("eigenAufb")) {
    add("eigenTyp");
  }

  if (show("vernetzt")) add("vernetzt");
  if (show("implantat")) add("implantat");
  if (show("einmal")) add("einmalprodukt");

  return out;
}

export function formatUnansweredMessage(fields: UnansweredField[]): string {
  if (!fields.length) return "";
  return `Cannot derive duties. Open or unconfirmed: ${fields.map((f) => f.label).join(" · ")}`;
}

function formatAnswerValue(field: string, m: RegistrationCharacteristics): string {
  if (field === "messgroesse") {
    return messgroesseByKey(m.messgroesse || "")?.t ?? m.messgroesse ?? "—";
  }
  if (field === "messvariante") {
    const g = messgroesseByKey(m.messgroesse || "");
    const v = g?.varianten?.find((x) => x.k === m.messvariante);
    return v?.t ?? m.messvariante ?? "—";
  }
  if (field === "anlage2Choice") {
    if (m.messgroesse === "keine" || (!m.anlage2ItemId && !m.anlage2Ziffer && m.messgroesse)) {
      if (m.messgroesse === "keine") return "no measuring function";
    }
    if (!m.anlage2ItemId && !m.anlage2Ziffer) return "no measuring function";
    return m.anlage2Ziffer ?? m.anlage2ItemId ?? "—";
  }
  const v = (m as unknown as Record<string, unknown>)[field];
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (v == null || v === "") return "—";
  if (field === "wartungQuelle") {
    return v === "hersteller" ? "from instructions for use" : "set by the operator";
  }
  if (field === "zulassung") {
    return v === "anzeige" ? "Notification § 19 StrlSchG" : "Licence § 12 StrlSchG";
  }
  return String(v);
}

function originOf(meta: FieldAnswerMeta): DecisionOrigin {
  if (meta.state === "vorschlag_bestaetigt" && !meta.changedFromSuggestion) return "bestaetigt";
  if (meta.changedFromSuggestion) return "geaendert";
  return "selbst_gewaehlt";
}

/** FA-217 decision protocol from answered fields. */
export function buildDecisionProtocol(m: RegistrationCharacteristics): DecisionProtocolEntry[] {
  const hydrated = hydrateAnswerMeta(m);
  const entries: DecisionProtocolEntry[] = [];
  for (const field of TRACKED_FIELDS) {
    const meta = fieldMeta(hydrated, field);
    if (!isAnswered(meta) || !meta) continue;
    entries.push({
      field,
      label: FIELD_LABELS[field],
      answer: formatAnswerValue(field, hydrated),
      origin: originOf(meta),
      person: meta.confirmedBy ?? null,
      at: meta.confirmedAt ?? null,
    });
  }
  return entries;
}

export function countAnswerOrigins(protocol: DecisionProtocolEntry[]): AnswerCounts {
  const counts: AnswerCounts = { confirmed: 0, changed: 0, selfChosen: 0 };
  for (const e of protocol) {
    if (e.origin === "bestaetigt") counts.confirmed += 1;
    else if (e.origin === "geaendert") counts.changed += 1;
    else counts.selfChosen += 1;
  }
  return counts;
}

/** Set or replace a field as an unconfirmed suggestion (FA-213). */
export function suggestFieldValue(
  m: RegistrationCharacteristics,
  field: TrackedField,
  value: unknown,
): RegistrationCharacteristics {
  return setSuggestion(m, field, value);
}

export function suggestionCount(m: RegistrationCharacteristics): number {
  return Object.values(m.answerMeta ?? {}).filter((x) => x.state === "vorschlag").length;
}

/** Counts for the characteristics summary card (mockup). */
export function answerProgressCounts(
  m: RegistrationCharacteristics,
  kind: ProductKindDTO | null,
): { confirmed: number; proposals: number; unanswered: number } {
  const hydrated = hydrateAnswerMeta(m);
  const confirmed = Object.values(hydrated.answerMeta ?? {}).filter(isAnswered).length;
  const proposals = suggestionCount(hydrated);
  const unanswered = unansweredVisibleFields(hydrated, kind).filter(
    (f) => fieldMeta(hydrated, f.field)?.state !== "vorschlag",
  ).length;
  return { confirmed, proposals, unanswered };
}

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field as TrackedField] ?? field;
}
