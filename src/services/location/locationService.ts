import type { SiteDTO, TenantContext } from "@/interfaces";
import { requirePermission } from "@/lib/auth/tenantContext";
import { conflict, notFound, unprocessable } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import type { CreateSiteInput, UpdateSiteInput } from "@/schemas/site";
import { toSiteDTO } from "@/services/shared/mappers";
import type { Prisma } from "@prisma/client";

const siteInclude = {
  areas: {
    orderBy: { name: "asc" as const },
    include: { _count: { select: { instances: true } } },
  },
} satisfies Prisma.SiteInclude;

/** Site row + areas; fields include migration columns code / deliveryAddress. */
type SiteListRow = {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  deliveryAddress: string | null;
  areas: { id: string; name: string; _count?: { instances: number } }[];
};

function mapSite(row: SiteListRow): SiteDTO {
  return toSiteDTO(row);
}

async function assertUniqueCode(tenantId: string, code: string | null, excludeId?: string) {
  if (!code) return;
  const where = {
    tenantId,
    code,
    ...(excludeId ? { id: { not: excludeId } } : {}),
  } as Prisma.SiteWhereInput;
  const existing = await prisma.site.findFirst({
    where,
    select: { id: true },
  });
  if (existing) throw conflict("A location with this identifier already exists.");
}

async function syncAreas(siteId: string, areaNames: string[]) {
  const desired = [...new Set(areaNames.map((n) => n.trim()).filter(Boolean))];
  const existing = await prisma.area.findMany({
    where: { siteId },
    include: { _count: { select: { instances: true } } },
  });

  const keepIds = new Set<string>();
  for (const name of desired) {
    const hit = existing.find((a) => a.name.toLowerCase() === name.toLowerCase());
    if (hit) {
      keepIds.add(hit.id);
      if (hit.name !== name) {
        await prisma.area.update({ where: { id: hit.id }, data: { name } });
      }
    } else {
      const created = await prisma.area.create({ data: { siteId, name } });
      keepIds.add(created.id);
    }
  }

  for (const area of existing) {
    if (keepIds.has(area.id)) continue;
    if (area._count.instances > 0) {
      throw unprocessable(
        `Cannot remove area "${area.name}" — ${area._count.instances} device(s) are still assigned.`,
      );
    }
    await prisma.area.delete({ where: { id: area.id } });
  }
}

async function loadSite(id: string, tenantId: string): Promise<SiteDTO> {
  const row = await prisma.site.findFirst({
    where: { id, tenantId },
    include: siteInclude,
  });
  if (!row) throw notFound("Location not found.");
  return mapSite(row as unknown as SiteListRow);
}

/** FA-500..502 — sites/areas for location forms; admin CRUD behind locations:*. */
export const locationService = {
  async listSites(tenantId: string): Promise<SiteDTO[]> {
    const rows = await prisma.site.findMany({
      where: { tenantId },
      include: siteInclude,
      orderBy: { name: "asc" },
    });
    return (rows as unknown as SiteListRow[]).map(mapSite);
  },

  async list(ctx: TenantContext, q?: string): Promise<SiteDTO[]> {
    requirePermission(ctx, "locations:view");
    const needle = q?.trim().toLowerCase();
    const where = {
      tenantId: ctx.tenantId,
      ...(needle
        ? {
            OR: [
              { name: { contains: needle } },
              { code: { contains: needle } },
              { address: { contains: needle } },
              { deliveryAddress: { contains: needle } },
            ],
          }
        : {}),
    } as Prisma.SiteWhereInput;
    const rows = await prisma.site.findMany({
      where,
      include: siteInclude,
      orderBy: { name: "asc" },
    });
    return (rows as unknown as SiteListRow[]).map(mapSite);
  },

  async create(ctx: TenantContext, input: CreateSiteInput): Promise<SiteDTO> {
    requirePermission(ctx, "locations:create");
    await assertUniqueCode(ctx.tenantId, input.code);
    const data = {
      tenantId: ctx.tenantId,
      name: input.name.trim(),
      code: input.code,
      address: input.address,
      deliveryAddress: input.deliveryAddress,
    } as Prisma.SiteUncheckedCreateInput;
    const row = await prisma.site.create({ data });
    if (input.areaNames?.length) {
      await syncAreas(row.id, input.areaNames);
    }
    return loadSite(row.id, ctx.tenantId);
  },

  async update(ctx: TenantContext, siteId: string, input: UpdateSiteInput): Promise<SiteDTO> {
    requirePermission(ctx, "locations:update");
    const existing = await prisma.site.findFirst({
      where: { id: siteId, tenantId: ctx.tenantId },
      select: { id: true },
    });
    if (!existing) throw notFound("Location not found.");

    await assertUniqueCode(ctx.tenantId, input.code, siteId);
    const data = {
      name: input.name.trim(),
      code: input.code,
      address: input.address,
      deliveryAddress: input.deliveryAddress,
    } as Prisma.SiteUncheckedUpdateInput;
    await prisma.site.update({
      where: { id: siteId },
      data,
    });
    await syncAreas(siteId, input.areaNames ?? []);
    return loadSite(siteId, ctx.tenantId);
  },

  async remove(ctx: TenantContext, siteId: string): Promise<void> {
    requirePermission(ctx, "locations:delete");
    const row = await prisma.site.findFirst({
      where: { id: siteId, tenantId: ctx.tenantId },
      include: {
        areas: { include: { _count: { select: { instances: true } } } },
      },
    });
    if (!row) throw notFound("Location not found.");

    const devices = row.areas.reduce((sum, a) => sum + a._count.instances, 0);
    if (devices > 0) {
      throw unprocessable(`Cannot delete location — ${devices} device(s) are still assigned.`);
    }

    await prisma.area.deleteMany({ where: { siteId } });
    await prisma.site.delete({ where: { id: siteId } });
  },
};
