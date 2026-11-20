import { prisma } from "@/lib/prisma";
import { impNorm, levenshteinRatio, parseGtinsJson } from "./importNorm";
import type { ModelMatchResult } from "./types";

type ModelRow = {
  id: string;
  manufacturer: string | null;
  modelName: string | null;
  tradeName: string | null;
  udiDi: string | null;
  gtins: string | null;
};

function label(m: ModelRow): string {
  return impNorm(`${m.manufacturer || ""} ${m.modelName || m.tradeName || ""}`);
}

/**
 * GTIN exact → manufacturer+type normalised exact → Levenshtein ≥ 0.8 → new.
 */
export async function resolveModelForImport(args: {
  hersteller: string;
  typ: string;
  gtin: string;
  /** Optional preloaded catalog (tests / commit batch). */
  catalog?: ModelRow[];
}): Promise<ModelMatchResult> {
  const catalog =
    args.catalog ??
    (await prisma.deviceModel.findMany({
      select: {
        id: true,
        manufacturer: true,
        modelName: true,
        tradeName: true,
        udiDi: true,
        gtins: true,
      },
    }));

  const gtin = String(args.gtin || "").replace(/\D/g, "");
  if (gtin) {
    for (const m of catalog) {
      const list = parseGtinsJson(m.gtins);
      if (m.udiDi === gtin || list.includes(gtin) || list.some((g) => g.replace(/\D/g, "") === gtin)) {
        return {
          art: "exact",
          modelId: m.id,
          manufacturer: m.manufacturer || undefined,
          modelName: m.modelName || undefined,
        };
      }
    }
  }

  const want = impNorm(`${args.hersteller} ${args.typ}`);
  const wantTypOnly = impNorm(args.typ);
  if (want) {
    for (const m of catalog) {
      if (label(m) === want) {
        return {
          art: "exact",
          modelId: m.id,
          manufacturer: m.manufacturer || undefined,
          modelName: m.modelName || undefined,
        };
      }
    }
  }
  if (!args.hersteller && wantTypOnly) {
    for (const m of catalog) {
      if (impNorm(m.modelName || "") === wantTypOnly || impNorm(m.tradeName || "") === wantTypOnly) {
        return {
          art: "exact",
          modelId: m.id,
          manufacturer: m.manufacturer || undefined,
          modelName: m.modelName || undefined,
        };
      }
    }
  }

  let best: { m: ModelRow; ratio: number } | null = null;
  if (want) {
    for (const m of catalog) {
      const ratio = levenshteinRatio(want, label(m));
      if (ratio >= 0.8 && (!best || ratio > best.ratio)) best = { m, ratio };
    }
  }
  if (best) {
    return {
      art: "fuzzy",
      modelId: best.m.id,
      manufacturer: best.m.manufacturer || undefined,
      modelName: best.m.modelName || undefined,
    };
  }

  return { art: "new", modelId: null };
}
