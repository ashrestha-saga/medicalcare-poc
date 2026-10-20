import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PrismaClient } from "@prisma/client";

type TileSeed = {
  RefDashboardTile: Array<{
    key: string;
    title: string;
    question: string;
    zone: "decides" | "worklist" | "watch";
    sortOrder: number;
    dutyKey: string | null;
    requiredPermission: string | null;
    partnerOnly: boolean;
    note?: string | null;
  }>;
  DashboardTileGrant: Array<{ role: "superadmin" | "device_admin" | "security_officer" | "user"; tileKey: string }>;
  RefAuthorityChecklist: Array<{
    code: string;
    authorityKind: "health_office" | "device_authority" | "occupational_safety" | "metrology" | "medical_board" | "other";
    stateCode: string | null;
    label: string;
    sourceRef: string;
    sourceDate?: string | null;
  }>;
  RefAuthorityChecklistItem: Array<{
    id?: string;
    checklistCode: string;
    position: number;
    label: string;
    legalBasis?: string | null;
    mapsToSection?: string | null;
    covered?: boolean;
    note?: string | null;
  }>;
};

function loadPayload(): TileSeed {
  const raw = readFileSync(join(__dirname, "../fixtures/seed-k10-kacheln.json"), "utf8");
  return JSON.parse(raw) as TileSeed;
}

/** Seeds dashboard tiles, role grants, and authority checklists. */
export async function seedK10Tiles(prisma: PrismaClient) {
  const data = loadPayload();

  for (const row of data.RefDashboardTile) {
    await prisma.refDashboardTile.upsert({
      where: { key: row.key },
      update: {
        title: row.title,
        question: row.question,
        zone: row.zone,
        sortOrder: row.sortOrder,
        dutyKey: (row.dutyKey as never) ?? null,
        requiredPermission: row.requiredPermission,
        partnerOnly: row.partnerOnly,
        note: row.note ?? null,
      },
      create: {
        key: row.key,
        title: row.title,
        question: row.question,
        zone: row.zone,
        sortOrder: row.sortOrder,
        dutyKey: (row.dutyKey as never) ?? null,
        requiredPermission: row.requiredPermission,
        partnerOnly: row.partnerOnly,
        note: row.note ?? null,
      },
    });
  }

  for (const row of data.DashboardTileGrant) {
    await prisma.dashboardTileGrant.upsert({
      where: { role_tileKey: { role: row.role, tileKey: row.tileKey } },
      update: {},
      create: { role: row.role, tileKey: row.tileKey },
    });
  }

  for (const row of data.RefAuthorityChecklist) {
    await prisma.refAuthorityChecklist.upsert({
      where: { code: row.code },
      update: {
        authorityKind: row.authorityKind,
        stateCode: row.stateCode,
        label: row.label,
        sourceRef: row.sourceRef,
        sourceDate: row.sourceDate ? new Date(`${row.sourceDate}T00:00:00.000Z`) : null,
      },
      create: {
        code: row.code,
        authorityKind: row.authorityKind,
        stateCode: row.stateCode,
        label: row.label,
        sourceRef: row.sourceRef,
        sourceDate: row.sourceDate ? new Date(`${row.sourceDate}T00:00:00.000Z`) : null,
      },
    });
  }

  for (const row of data.RefAuthorityChecklistItem) {
    const existing = await prisma.refAuthorityChecklistItem.findUnique({
      where: {
        checklistCode_position: { checklistCode: row.checklistCode, position: row.position },
      },
    });
    const payload = {
      label: row.label,
      legalBasis: row.legalBasis ?? null,
      mapsToSection: row.mapsToSection ?? null,
      covered: row.covered ?? true,
      note: row.note ?? null,
    };
    if (existing) {
      await prisma.refAuthorityChecklistItem.update({ where: { id: existing.id }, data: payload });
    } else {
      await prisma.refAuthorityChecklistItem.create({
        data: {
          id: row.id,
          checklistCode: row.checklistCode,
          position: row.position,
          ...payload,
        },
      });
    }
  }
}
