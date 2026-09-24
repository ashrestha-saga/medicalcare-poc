import type {
  AnswerCounts,
  DecisionProtocolEntry,
  FieldAnswerMeta,
} from "./answerMeta";

/** FA-224 — acknowledged Hinweis (wording stored, not only id). */
export interface CheckRuleQuittance {
  message: string;
  by: string;
  at: string;
  fieldIds: string[];
}

/** Characteristics blob collected by the Erstanlage wizard (step 2). */
export interface RegistrationCharacteristics {
  produktart: string;
  weitere?: boolean;
  aktiv?: boolean;
  anlage1?: boolean;
  anlage2Ziffer?: string;
  anlage2ItemId?: string;
  /** For Anlage 2 Nr. 1.5.3 — operator chooses procedure after 1.5.1 or 1.5.2. */
  anlage2Verfahren?: string;
  /** Optional Messgröße key (v17); W-mess-passiv also maps from anlage2Ziffer. */
  messgroesse?: string;
  messvariante?: string;
  strahlung?: boolean;
  strahlenArt?: string;
  zulassung?: string;
  konstanz?: { k: string; intervall: string }[];
  software?: boolean;
  swKlasse?: string;
  aufbereitung?: boolean;
  aufbKlasse?: string;
  aufbGeraete?: string[];
  aufbExtern?: boolean;
  einmalprodukt?: boolean;
  zubehoer?: { t: string; klasse: string }[];
  wartungIntervall?: number;
  wartungQuelle?: "hersteller" | "eigen";
  wartungExtern?: boolean;
  energie?: boolean;
  aedAusnahme?: boolean;
  altgeraet?: boolean;
  vernetzt?: boolean;
  implantat?: boolean;
  istAufbGeraet?: boolean;
  eigenTyp?: string;
  /**
   * FA-208 per-field provenance. Keys are tracked field names
   * (`aktiv`, `wartungIntervall`, `anlage2Choice`, …).
   */
  answerMeta?: Record<string, FieldAnswerMeta>;
  /** FA-224 — acknowledged Hinweise (wording + actor + time). */
  ruleQuittances?: Record<string, CheckRuleQuittance>;
  /** Frozen on release (FA-217 / FA-218). */
  decisionProtocol?: DecisionProtocolEntry[];
  answerCounts?: AnswerCounts;
}

export type DutyConfidence = "verified" | "derived" | "n/a";

export interface DerivedDuty {
  id: string;
  art: string;
  titel: string;
  grund: string;
  einschlaegig: boolean;
  frist: number | null;
  einheit: string | null;
  bezug: string;
  intervall?: string;
  nachweis: string;
  zustaendig: string;
  vertrauen: DutyConfidence;
  hinweis: string;
  inspectionTypeCode: string;
  deadlineAnchor: string;
  constancyObjectCode?: string;
  routine?: string[];
  freigabe?: string;
}

export interface PrerequisiteItem {
  k: string;
  t: string;
  g: string;
  n: string;
  pflicht: boolean;
  /** Auto-satisfied from site data (e.g. § 6 MPSB). */
  erfuellt?: boolean;
}
