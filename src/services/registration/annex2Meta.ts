import annex2Pack from "../../../data/mtk-anlage2-regeln.json";

export type Annex2JsonRule = {
  id: string;
  ziffer: string;
  ebene: string;
  bezeichnung: string;
  variante?: string;
  einschraenkung?: string;
  fristJahre?: number | null;
  hinweis?: string;
  verfahren?: string;
  wahlweiseNach?: string[];
  matchTerms?: string[];
  matchExclude?: string[];
  quelle?: string;
};

const byId = new Map<string, Annex2JsonRule>();
const byItemNo = new Map<string, Annex2JsonRule[]>();

for (const r of annex2Pack.regeln as Annex2JsonRule[]) {
  byId.set(r.id, r);
  byId.set(`annex2-${r.id}`, r);
  const list = byItemNo.get(r.ziffer) ?? [];
  list.push(r);
  byItemNo.set(r.ziffer, list);
}

export function annex2MetaById(id: string): Annex2JsonRule | null {
  return byId.get(id) ?? null;
}

export function annex2MetaByItemNo(itemNo: string): Annex2JsonRule | null {
  const list = byItemNo.get(itemNo);
  return list?.[0] ?? null;
}

/** Accept Prisma Json arrays or legacy stringified JSON. */
export function parseJsonStringArray(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    try {
      const v = JSON.parse(raw) as unknown;
      return Array.isArray(v) ? v.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Mock accessory templates (probes etc.) — same as backoffice v14. */
export const ZUBEHOER_TEMPLATES: { t: string; klasse: string }[] = [
  { t: "Convex probe", klasse: "unkritisch" },
  { t: "Linear probe", klasse: "unkritisch" },
  { t: "Transvaginal probe", klasse: "semikritisch-b" },
  { t: "TEE probe", klasse: "semikritisch-b" },
  { t: "Needle guide", klasse: "kritisch-a" },
];
