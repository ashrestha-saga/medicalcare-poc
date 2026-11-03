import type { PartnerContext } from "@/interfaces/session";
import type { PartnerAppRole } from "@/interfaces/management";
import { todayTilesForRole, type PartnerTileZone } from "@/constants/partnerConsoleNav";
import { runWithoutTenantAsync } from "@/lib/auth/tenantStore";
import { prisma } from "@/lib/prisma";
import { isLiveContract } from "@/services/access/partnerAccessService";
import { getCachedPartnerConsolePermissions } from "@/services/roles/roleGrantsService";
import { forbidden } from "@/lib/errors";

export type PartnerBoardTile = {
  id: string;
  key: string;
  labelKey: string;
  detailKey: string;
  ctaKey: string;
  count: number;
  /** Override shown instead of raw count (e.g. "18%"). */
  display?: string;
  href: string;
  zone: PartnerTileZone;
  /** stop | warn | ok | "" — for urgency sort / colour. */
  tone: "stop" | "warn" | "ok" | "";
  /** Optional sample lines under the detail (reference · customer). */
  samples?: string[];
  /** Hidden sample count when samples are truncated ("+5"). */
  moreCount?: number;
  /** Interpolation params for detailKey. */
  detailParams?: Record<string, string | number>;
};

type TileMetric = {
  count: number;
  tone: PartnerBoardTile["tone"];
  display?: string;
  samples?: string[];
  moreCount?: number;
  detailParams?: Record<string, string | number>;
};

function roleOf(ctx: PartnerContext): PartnerAppRole {
  const r = String(ctx.user.appRole);
  if (
    r === "management" ||
    r === "admin" ||
    r === "service_lead" ||
    r === "inspector" ||
    r === "order"
  ) {
    return r;
  }
  return "inspector";
}

function toneFor(count: number, kind: "stop" | "warn" = "warn"): PartnerBoardTile["tone"] {
  if (count <= 0) return "ok";
  return kind;
}

function sampleLine(reference: string, tenantName: string | null | undefined): string {
  return tenantName ? `${reference} · ${tenantName}` : reference;
}

export const partnerDashboardService = {
  async board(ctx: PartnerContext): Promise<{
    tiles: PartnerBoardTile[];
    zones: { ent: PartnerBoardTile[]; vor: PartnerBoardTile[]; beob: PartnerBoardTile[] };
  }> {
    const granted = getCachedPartnerConsolePermissions(ctx.user.appRole);
    if (!granted.includes("console:today:view") && !granted.includes("console:nav")) {
      throw forbidden();
    }

    return runWithoutTenantAsync(async () => {
      const now = new Date();
      const horizon = new Date(now.getTime() + 90 * 86400000);
      const ago48h = new Date(now.getTime() - 48 * 3600000);
      const contracts = await prisma.serviceContract.findMany({
        where: { organisationId: ctx.organisationId },
        select: {
          id: true,
          tenantId: true,
          validFrom: true,
          validTo: true,
          suspendedAt: true,
          terminatedAt: true,
        },
      });
      const live = contracts.filter((c) => isLiveContract(c, now));
      const liveTenantIds = live.map((c) => c.tenantId);
      const allTenantIds = [...new Set(contracts.map((c) => c.tenantId))];

      const [
        overdue,
        befundOrders,
        needsSchedule,
        myWeekOrders,
        devices,
        drafts,
        externalsReady,
        externalsTotal,
        expiringQuals,
        contractsEnding,
        mpsbOpen,
        returnPending,
        visits,
        authoritySamples,
        returnSamples,
        outOfContract,
        setupMeta,
      ] = await Promise.all([
        liveTenantIds.length === 0
          ? 0
          : prisma.deviceDuty.count({
              where: {
                tenantId: { in: liveTenantIds },
                applicable: true,
                suspendedAt: null,
                dueAt: { lt: now },
              },
            }),
        prisma.serviceRequest.count({
          where: {
            executorOrg: { organisationId: ctx.organisationId },
            transmittedAt: { not: null },
            reason: "befund",
            state: { in: ["transmitted", "handed_off", "acknowledged", "scheduled", "in_progress"] },
          },
        }),
        prisma.serviceRequest.count({
          where: {
            executorOrg: { organisationId: ctx.organisationId },
            transmittedAt: { not: null },
            scheduledAt: null,
            state: { in: ["transmitted", "handed_off", "acknowledged"] },
          },
        }),
        prisma.serviceRequest.count({
          where: {
            assigneeUserId: ctx.user.id,
            scheduledAt: {
              gte: new Date(now.getTime() - now.getDay() * 86400000),
              lt: new Date(now.getTime() + (7 - now.getDay()) * 86400000),
            },
            state: { notIn: ["completed", "rejected"] },
          },
        }),
        liveTenantIds.length === 0
          ? 0
          : prisma.deviceInstance.count({
              where: { tenantId: { in: liveTenantIds }, state: { not: "retired" } },
            }),
        liveTenantIds.length === 0
          ? 0
          : prisma.deviceInstance.count({
              where: { tenantId: { in: liveTenantIds }, state: "draft" },
            }),
        prisma.orgMembership.count({
          where: {
            organisationId: ctx.organisationId,
            isExternal: true,
            commissionedTo: { gte: now },
            liabilityUntil: { gte: now },
          },
        }),
        prisma.orgMembership.count({
          where: {
            organisationId: ctx.organisationId,
            isExternal: true,
          },
        }),
        prisma.personQualification.count({
          where: {
            user: { orgMemberships: { some: { organisationId: ctx.organisationId } } },
            validUntil: { gte: now, lte: horizon },
          },
        }),
        live.filter((c) => c.validTo && c.validTo >= now && c.validTo <= horizon).length,
        liveTenantIds.length === 0
          ? 0
          : (async () => {
              const sites = await prisma.site.findMany({
                where: { tenantId: { in: liveTenantIds } },
                select: { id: true },
              });
              if (sites.length === 0) return 0;
              const siteIds = sites.map((s) => s.id);
              const appointed = await prisma.safetyOfficerAppointment.findMany({
                where: {
                  siteId: { in: siteIds },
                  publishedAt: { not: null },
                },
                select: { siteId: true },
              });
              const covered = new Set(appointed.map((a) => a.siteId));
              return siteIds.filter((id) => !covered.has(id)).length;
            })(),
        prisma.serviceRequest.count({
          where: {
            executorOrg: { organisationId: ctx.organisationId },
            state: "completed",
            updatedAt: { lt: ago48h },
          },
        }),
        prisma.serviceVisit.findMany({
          where: { organisationId: ctx.organisationId },
          select: { id: true, _count: { select: { requests: true } } },
        }),
        prisma.serviceRequest.findMany({
          where: {
            executorOrg: { organisationId: ctx.organisationId },
            transmittedAt: { not: null },
            reason: "befund",
            state: { in: ["transmitted", "handed_off", "acknowledged", "scheduled", "in_progress"] },
          },
          orderBy: { updatedAt: "desc" },
          take: 4,
          select: {
            reference: true,
            tenant: { select: { name: true } },
          },
        }),
        prisma.serviceRequest.findMany({
          where: {
            executorOrg: { organisationId: ctx.organisationId },
            state: "completed",
            updatedAt: { lt: ago48h },
          },
          orderBy: { updatedAt: "asc" },
          take: 3,
          select: {
            reference: true,
            tenant: { select: { name: true } },
          },
        }),
        prisma.serviceRequest.count({
          where: {
            executorOrg: { organisationId: ctx.organisationId },
            transmittedAt: { not: null },
            state: { not: "rejected" },
            ...(liveTenantIds.length > 0
              ? { tenantId: { notIn: liveTenantIds } }
              : {}),
          },
        }),
        liveTenantIds.length === 0
          ? Promise.resolve({
              tenants: [] as { id: string; siteCount: number; deviceCount: number }[],
              clarByTenant: new Map<string, number>(),
              mpsbByTenant: new Map<string, number>(),
            })
          : (async () => {
              const [tenants, clarGroups, sites, appointments] = await Promise.all([
                prisma.tenant.findMany({
                  where: { id: { in: liveTenantIds } },
                  select: {
                    id: true,
                    _count: { select: { sites: true, instances: true } },
                  },
                }),
                prisma.deviceClarification.groupBy({
                  by: ["tenantId"],
                  where: { tenantId: { in: liveTenantIds }, resolvedAt: null },
                  _count: { _all: true },
                }),
                prisma.site.findMany({
                  where: { tenantId: { in: liveTenantIds } },
                  select: { id: true, tenantId: true },
                }),
                prisma.safetyOfficerAppointment.findMany({
                  where: {
                    tenantId: { in: liveTenantIds },
                    publishedAt: { not: null },
                  },
                  select: { siteId: true },
                }),
              ]);
              const covered = new Set(appointments.map((a) => a.siteId));
              const mpsbByTenant = new Map<string, number>();
              for (const site of sites) {
                if (covered.has(site.id)) continue;
                mpsbByTenant.set(site.tenantId, (mpsbByTenant.get(site.tenantId) ?? 0) + 1);
              }
              const clarByTenant = new Map<string, number>();
              for (const row of clarGroups) clarByTenant.set(row.tenantId, row._count._all);
              return {
                tenants: tenants.map((t) => ({
                  id: t.id,
                  siteCount: t._count.sites,
                  deviceCount: t._count.instances,
                })),
                clarByTenant,
                mpsbByTenant,
              };
            })(),
      ]);

      const setupStuck = setupMeta.tenants.filter((t) => {
        const openMpsb = setupMeta.mpsbByTenant.get(t.id) ?? 0;
        const openClar = setupMeta.clarByTenant.get(t.id) ?? 0;
        return t.siteCount === 0 || t.deviceCount === 0 || openMpsb > 0 || openClar > 0;
      }).length;

      const tandemVisits = visits.filter((v) => v._count.requests >= 2).length;
      const visitTotal = visits.length;
      const tandemPct = visitTotal === 0 ? 0 : Math.round((tandemVisits / visitTotal) * 100);

      const authLines = authoritySamples.map((r) => sampleLine(r.reference, r.tenant.name));
      const returnLines = returnSamples.map((r) => sampleLine(r.reference, r.tenant.name));

      const counts: Record<string, TileMetric> = {
        ueberfaellig: { count: overdue, tone: toneFor(overdue, "stop") },
        behoerdenfrist: {
          count: befundOrders,
          tone: toneFor(befundOrders, "stop"),
          samples: authLines.slice(0, 3),
          moreCount: Math.max(0, befundOrders - Math.min(3, authLines.length)),
        },
        laeuftab: { count: expiringQuals, tone: toneFor(expiringQuals) },
        vertragende: { count: contractsEnding, tone: toneFor(contractsEnding) },
        p6: { count: mpsbOpen, tone: toneFor(mpsbOpen) },
        inbetriebnahme: { count: setupStuck, tone: toneFor(setupStuck) },
        ohneRueckfluss: {
          count: returnPending,
          tone: toneFor(returnPending),
          samples: returnLines.slice(0, 2),
          moreCount: Math.max(0, returnPending - Math.min(2, returnLines.length)),
        },
        ausserhalb: { count: outOfContract, tone: toneFor(outOfContract, "stop") },
        zuterm: { count: needsSchedule, tone: toneFor(needsSchedule) },
        tandem: {
          count: tandemPct,
          tone: "",
          display: `${tandemPct}%`,
          detailParams: { tandem: tandemVisits, visits: visitTotal },
        },
        entwuerfe: { count: drafts, tone: toneFor(drafts) },
        meineAuftraege: { count: myWeekOrders, tone: toneFor(myWeekOrders) },
        meineNachweise: { count: expiringQuals, tone: toneFor(expiringQuals) },
        meineRueckfluss: {
          count: returnPending,
          tone: toneFor(returnPending),
          samples: returnLines.slice(0, 2),
        },
        kunden: {
          count: liveTenantIds.length,
          tone: "",
          detailParams: { total: allTenantIds.length },
        },
        geraete: { count: devices, tone: "" },
        fremd: {
          count: externalsReady,
          tone: "",
          detailParams: { ready: externalsReady, total: externalsTotal },
        },
        pipeline: { count: setupStuck, tone: toneFor(setupStuck) },
      };

      const role = roleOf(ctx);
      const defs = todayTilesForRole(role);
      const ranked = defs.map((d) => {
        const c = counts[d.id] ?? { count: 0, tone: "" as const };
        return {
          id: d.id,
          key: d.id,
          labelKey: d.labelKey,
          detailKey: `${d.labelKey}Detail`,
          ctaKey: `${d.labelKey}Cta`,
          count: c.count,
          display: c.display,
          href: d.href,
          zone: d.zone,
          tone: c.tone,
          samples: c.samples,
          moreCount: c.moreCount,
          detailParams: c.detailParams,
        } satisfies PartnerBoardTile;
      });

      const urgency = { stop: 3, warn: 2, "": 1, ok: 0 };
      const entAll = ranked
        .filter((t) => t.zone === "ent")
        .sort((a, b) => {
          const u = (urgency[b.tone] || 0) - (urgency[a.tone] || 0);
          if (u !== 0) return u;
          return b.count - a.count;
        });
      const ent = entAll.slice(0, 3);
      const spilled = entAll.slice(3);
      const vor = [...spilled, ...ranked.filter((t) => t.zone === "vor")].sort((a, b) => {
        const u = (urgency[b.tone] || 0) - (urgency[a.tone] || 0);
        if (u !== 0) return u;
        return b.count - a.count;
      });
      const beob = ranked.filter((t) => t.zone === "beob");

      return {
        tiles: [...ent, ...vor, ...beob],
        zones: { ent, vor, beob },
      };
    });
  },
};
