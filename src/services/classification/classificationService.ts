import type { ClassificationMatchType, ClassificationProposalDTO, ClassificationRuleDTO, DeviceModelDTO } from "@/interfaces";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { toClassificationRuleDTO } from "@/services/shared/mappers";

/**
 * FA-400..404 — classification is a *suggestion*, never a determination.
 * `decide` is pure (Section 21): given a model and the candidate rules it
 * returns at most one proposal, chosen deterministically.
 */

export interface ClassificationInput {
  model: DeviceModelDTO;
  rules: ClassificationRuleDTO[];
  now?: Date;
}

export interface ClassificationResult {
  proposal: ClassificationProposalDTO | null;
  matchedRuleId?: string;
}

/** Section 21 — priority order. Lower index wins. */
const MATCH_PRIORITY: ClassificationMatchType[] = ["basicUdiDi", "emdn", "gmdn", "manufacturerModel"];
const CONFIDENCE_PRIORITY = { verified: 0, derived: 1, guess: 2 } as const;

export function manufacturerModelKey(manufacturer: string | null, modelName: string | null): string | null {
  if (!manufacturer || !modelName) return null;
  return `${manufacturer.trim().toLowerCase()}|${modelName.trim().toLowerCase()}`;
}

function ruleMatches(rule: ClassificationRuleDTO, model: DeviceModelDTO): boolean {
  const value = rule.matchValue.trim().toLowerCase();
  switch (rule.matchType) {
    case "basicUdiDi":
      return !!model.basicUdiDi && model.basicUdiDi.toLowerCase() === value;
    case "emdn":
      return !!model.emdnCode && model.emdnCode.toLowerCase() === value;
    case "gmdn":
      return !!model.gmdnCode && model.gmdnCode.toLowerCase() === value;
    case "manufacturerModel":
      return manufacturerModelKey(model.manufacturer, model.modelName) === value;
    default:
      return false;
  }
}

function isValidNow(rule: ClassificationRuleDTO, now: Date): boolean {
  if (rule.validFrom && new Date(rule.validFrom) > now) return false;
  if (rule.validTo && new Date(rule.validTo) < now) return false;
  return true;
}

/** Deterministic tie-break: specificity → confidence → narrower validity → stable id. */
export function compareRules(a: ClassificationRuleDTO, b: ClassificationRuleDTO): number {
  const spec = MATCH_PRIORITY.indexOf(a.matchType) - MATCH_PRIORITY.indexOf(b.matchType);
  if (spec !== 0) return spec;
  const conf = CONFIDENCE_PRIORITY[a.confidence] - CONFIDENCE_PRIORITY[b.confidence];
  if (conf !== 0) return conf;
  const aBounded = Number(Boolean(a.validFrom || a.validTo));
  const bBounded = Number(Boolean(b.validFrom || b.validTo));
  if (aBounded !== bBounded) return bBounded - aBounded;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function decide({ model, rules, now = new Date() }: ClassificationInput): ClassificationResult {
  const candidates = rules.filter((r) => isValidNow(r, now) && ruleMatches(r, model)).sort(compareRules);
  const winner = candidates[0];
  if (!winner) {
    // Section 21 — never invent a legal classification when no rule exists.
    return { proposal: null };
  }
  return {
    matchedRuleId: winner.id,
    proposal: {
      annex1: winner.annex1,
      annex2: winner.annex2,
      softwareClass: winner.softwareClass,
      radiation: winner.radiation,
      confidence: winner.confidence,
      source: winner.source,
      ruleId: winner.id,
    },
  };
}

/** Loads only the rules that could possibly match this model. */
export async function loadCandidateRules(model: DeviceModelDTO): Promise<ClassificationRuleDTO[]> {
  const or: { matchType: string; matchValue: string }[] = [];
  if (model.basicUdiDi) or.push({ matchType: "basicUdiDi", matchValue: model.basicUdiDi });
  if (model.emdnCode) or.push({ matchType: "emdn", matchValue: model.emdnCode });
  if (model.gmdnCode) or.push({ matchType: "gmdn", matchValue: model.gmdnCode });
  const mm = model.manufacturer && model.modelName ? `${model.manufacturer}|${model.modelName}` : null;
  if (mm) or.push({ matchType: "manufacturerModel", matchValue: mm });
  if (or.length === 0) return [];
  // Match values are compared case-insensitively in `decide`; load broadly by type.
  const rows = await prisma.classificationRule.findMany({
    where: { matchType: { in: [...new Set(or.map((o) => o.matchType))] } },
  });
  return rows.map(toClassificationRuleDTO);
}

export const classificationService = {
  decide,
  async proposeFor(model: DeviceModelDTO): Promise<ClassificationResult> {
    const request = {
      modelId: model.id,
      basicUdiDi: model.basicUdiDi,
      emdnCode: model.emdnCode,
      gmdnCode: model.gmdnCode,
      manufacturer: model.manufacturer,
      modelName: model.modelName,
    };
    logger.info("classification.request", request);

    const rules = await loadCandidateRules(model);
    const result = decide({ model, rules });

    logger.info("classification.response", {
      modelId: model.id,
      candidateRuleCount: rules.length,
      matchedRuleId: result.matchedRuleId ?? null,
      proposal: result.proposal,
    });

    if (result.proposal && !model.id.startsWith("oxid-article-")) {
      // Persist the proposal for audit (FA-400) — only for models we own a row for.
      await prisma.classificationProposal
        .create({
          data: {
            deviceModelId: model.id,
            ruleId: result.matchedRuleId ?? null,
            annex1: result.proposal.annex1,
            annex2: result.proposal.annex2,
            softwareClass: result.proposal.softwareClass,
            radiation: result.proposal.radiation,
            confidence: result.proposal.confidence,
            source: result.proposal.source,
          },
        })
        .catch(() => undefined);
    }
    return result;
  },
};
