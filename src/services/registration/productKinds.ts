import type { RefProductKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ProductKindDTO } from "./productKindTypes";

export type { ProductKindDTO } from "./productKindTypes";
export { applyProductKindPresets, blockVisible } from "./productKindLogic";

function parseJsonArray(raw: string): string[] {
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

function parseJsonObject(raw: string): Record<string, unknown> {
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
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
