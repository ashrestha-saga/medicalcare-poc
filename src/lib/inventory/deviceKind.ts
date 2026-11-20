/**
 * Nachtrag 4 — DeviceKind helpers.
 * § 14 export, book, release criteria, and classification assume medical products.
 */
import type { DeviceKind, Prisma } from "@prisma/client";

export const DEVICE_KIND_MP: DeviceKind = "mp";
export const DEVICE_KIND_EQUIPMENT: DeviceKind = "equipment";

/** Prisma where-clause fragment: medical devices only. */
export function mpKindWhere(): Prisma.DeviceInstanceWhereInput {
  return { kind: DEVICE_KIND_MP };
}

export function isEquipmentKind(kind: DeviceKind | string | null | undefined): boolean {
  return kind === DEVICE_KIND_EQUIPMENT;
}
