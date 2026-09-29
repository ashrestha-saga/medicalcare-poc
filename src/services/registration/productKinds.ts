import type { RefProductKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ProductKindDTO } from "./productKindTypes";

export type { ProductKindDTO } from "./productKindTypes";
export { applyProductKindPresets, blockVisible } from "./productKindLogic";

function parseJsonArray(raw: unknown): string[] {
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

function parseJsonObject(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === "string") {
    try {
      const v = JSON.parse(raw) as unknown;
      return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return {};
}

export function toProductKindDTO(row: RefProductKind): ProductKindDTO {
  return {
    code: row.code,
    label: row.label,
    hint: row.hint,
    sortGroup: row.sortGroup,
    shows: parseJsonArray(row.shows),
    blocks: parseJsonArray(row.blocks),
    presets: parseJsonObject(row.presets),
  };
}

export async function listProductKinds(): Promise<ProductKindDTO[]> {
  const rows = await prisma.refProductKind.findMany({ orderBy: [{ sortGroup: "asc" }, { code: "asc" }] });
  return rows.map(toProductKindDTO);
}
