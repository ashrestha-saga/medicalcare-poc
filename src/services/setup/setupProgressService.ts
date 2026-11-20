import type { TenantWorkContext } from "@/interfaces";
import type {
  SetupProgressDTO,
  SetupStepDTO,
  SetupStepId,
  SetupStepStatus,
} from "@/interfaces/setup";
import { requirePermission } from "@/lib/auth/tenantContext";
import { prisma } from "@/lib/prisma";
import { countMissingConstancyCadences } from "@/services/constancy/missingCadenceMetrics";
import { countDatedDuties } from "@/services/dueDates/dutyDueMetrics";
import { countKlarlisteDevices } from "@/services/nav/klarlisteIssues";

export type {
  SetupProgressDTO,
  SetupStepDTO,
  SetupStepId,
  SetupStepStatus,
} from "@/interfaces/setup";

/** MPSB threshold: regularly more than 20 employees → appointment required. */
const MPSB_HEADCOUNT = 20;

function todayUtc(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

/**
 * Mandanten-Inbetriebnahme — ten criteria from DeviceCare backoffice v26.
 * Status is computed from live data, not a checklist.
 */
export const setupProgressService = {
  async getProgress(ctx: TenantWorkContext): Promise<SetupProgressDTO> {
    requirePermission(ctx, "shell:nav");
    const today = todayUtc();

    const sites = await prisma.site.findMany({
      include: {
        areas: { select: { id: true } },
        headcounts: {
          where: { OR: [{ validTo: null }, { validTo: { gte: today } }] },
          orderBy: { validFrom: "desc" },
          take: 1,
        },
        safetyOfficerAppointments: {
          where: {
            appointedFrom: { lte: today },
            OR: [{ appointedTo: null }, { appointedTo: { gte: today } }],
          },
          orderBy: { appointedFrom: "desc" },
          take: 1,
        },
      },
    });

    const siteCount = sites.length;
    let mpsbOffen = 0;
    for (const site of sites) {
      const head = site.headcounts[0]?.headcount ?? 0;
      if (head <= MPSB_HEADCOUNT) continue;
      const appt = site.safetyOfficerAppointments[0];
      if (!appt || !appt.publishedAt) mpsbOffen += 1;
    }

    const [
      activeStaff,
      tileCount,
      contract,
      erfasst,
      klarCount,
      dutiesWithDue,
      konstanzMissingTakt,
      reprocEquipment,
      reprocActivity,
      exportCount,
      derivedCls,
      missingCls,
      importJobsCommitted,
      instanceCount,
      importDeferred,
    ] = await Promise.all([
      prisma.user.count({
        where: { tenantId: ctx.tenantId, accountKind: "clinic", active: true },
      }),
      prisma.userDashboardTile.count().catch(() => 0),
      prisma.serviceContract
        .findFirst({
          where: { terminatedAt: null, suspendedAt: null },
          orderBy: { validFrom: "desc" },
        })
        .catch(() => null),
      prisma.deviceInstance.count({ where: { state: { not: "draft" } } }),
      countKlarlisteDevices(ctx).catch(() => 0),
      countDatedDuties().catch(() => 0),
      countMissingConstancyCadences().catch(() => 0),
      prisma.deviceInstance
        .count({
          where: {
            state: { not: "retired" },
            OR: [
              { productKindCode: { contains: "aufb" } },
              { reprocessingProfile: { isNot: null } },
            ],
          },
        })
        .catch(() => 0),
      Promise.all([
        prisma.reprocessingCheck.count().catch(() => 0),
        prisma.reprocessingBatch.count().catch(() => 0),
      ]).then(([a, b]) => a + b),
      prisma.exportLog.count().catch(() => 0),
      prisma.deviceInstance
        .count({
          where: {
            state: { not: "retired" },
            model: {
              classifications: {
                some: { validTo: null, confidence: { in: ["derived", "guess"] } },
              },
            },
          },
        })
        .catch(() => 0),
      prisma.deviceInstance
        .count({
          where: {
            state: { not: "retired" },
            modelId: { not: null },
            model: { classifications: { none: { validTo: null } } },
          },
        })
        .catch(() => 0),
      // Guard: stale Prisma client before generate+restart has no importJob delegate
      (
        (prisma as { importJob?: { count: (a: object) => Promise<number> } }).importJob?.count({
          where: { status: "committed" },
        }) ?? Promise.resolve(0)
      ).catch(() => 0),
      prisma.deviceInstance.count().catch(() => 0),
      (
        (
          prisma as {
            userPreference?: { findFirst: (a: object) => Promise<unknown> };
          }
        ).userPreference
          ?.findFirst({
            where: {
              userId: ctx.user.id,
              scope: "general",
              key: "setup.inventory_import.deferred",
            },
          })
          .then((r) => Boolean(r)) ?? Promise.resolve(false)
      ).catch(() => false),
    ]);

    const aufbRelevant = reprocEquipment > 0 || reprocActivity > 0;
    // Proxy for Sachkunde Aufbereitung: users who can release batches
    const sachkunde = await prisma.user.count({
      where: {
        tenantId: ctx.tenantId,
        accountKind: "clinic",
        active: true,
        role: { in: ["device_admin", "superadmin"] },
      },
    });

    const steps: SetupStepDTO[] = [];

    // 1 sites
    steps.push({
      id: "sites",
      titleKey: "sites",
      status: siteCount > 0 ? "ok" : "open",
      whyKey: siteCount > 0 ? "sitesOk" : "sitesOpen",
      whyParams: siteCount > 0 ? { count: siteCount } : undefined,
      href: "/locations",
    });

    // 2 personen + MPSB
    const personenOk = activeStaff > 0 && mpsbOffen === 0;
    steps.push({
      id: "personen",
      titleKey: "personen",
      status: personenOk ? "ok" : "open",
      whyKey: mpsbOffen ? "personenMpsbOpen" : "personenOk",
      whyParams: mpsbOffen ? { count: mpsbOffen } : { count: activeStaff },
      href: mpsbOffen ? "/locations?mpsb=missing" : "/users",
    });

    // 3 Traägerschaft
    const tl = tileCount === 0 ? 1 : 0;
    steps.push({
      id: "traegerschaft",
      titleKey: "traegerschaft",
      status: tl === 0 ? "ok" : "open",
      whyKey: tl ? "traegerschaftOpen" : "traegerschaftOk",
      href: "/today/assignments",
    });

    // 4 Betreuung
    const betreuungOk = Boolean(contract);
    steps.push({
      id: "betreuung",
      titleKey: "betreuung",
      status: betreuungOk ? "ok" : "open",
      whyKey: contract ? "betreuungOk" : "betreuungOpen",
      whyParams: contract
        ? { since: contract.validFrom.toISOString().slice(0, 10) }
        : undefined,
      href: "/management",
    });

    // 5 Bestand — ok when ≥1 committed import, ≥5 instances, legacy non-draft, or deferred
    const bestandOk =
      importJobsCommitted > 0 || instanceCount >= 5 || erfasst > 0 || importDeferred;
    steps.push({
      id: "bestand",
      titleKey: "bestand",
      status: bestandOk ? "ok" : "open",
      whyKey: importDeferred
        ? "bestandDeferred"
        : importJobsCommitted
          ? "bestandImportOk"
          : erfasst || instanceCount
            ? "bestandOk"
            : "bestandOpen",
      whyParams: importJobsCommitted
        ? { count: importJobsCommitted }
        : erfasst || instanceCount
          ? { count: Math.max(erfasst, instanceCount) }
          : undefined,
      href: bestandOk ? "/devices" : "/devices/import",
    });

    // 6 Einstufung
    const einstufungOk = derivedCls === 0 && missingCls === 0;
    steps.push({
      id: "einstufung",
      titleKey: "einstufung",
      status: einstufungOk ? "ok" : "open",
      whyKey: derivedCls || missingCls ? "einstufungOpen" : "einstufungOk",
      whyParams:
        derivedCls || missingCls
          ? { derived: derivedCls, missing: missingCls }
          : undefined,
      href: "/catalog",
    });

    // 7 Klärliste
    steps.push({
      id: "klaerliste",
      titleKey: "klaerliste",
      status: klarCount === 0 ? "ok" : "open",
      whyKey: klarCount ? "klaerlisteOpen" : "klaerlisteOk",
      whyParams: klarCount ? { count: klarCount } : undefined,
      href: "/devices?tab=klaerliste",
    });

    // 8 Takte
    const takteOk = konstanzMissingTakt === 0 && dutiesWithDue > 0;
    steps.push({
      id: "takte",
      titleKey: "takte",
      status: takteOk ? "ok" : "open",
      whyKey: konstanzMissingTakt
        ? "takteMissing"
        : dutiesWithDue
          ? "takteOk"
          : "takteNone",
      whyParams: konstanzMissingTakt
        ? { count: konstanzMissingTakt }
        : dutiesWithDue
          ? { count: dutiesWithDue }
          : undefined,
      href: konstanzMissingTakt ? "/constancy-cadence?section=missing" : "/due-dates",
    });

    // 9 Aufbereitung
    if (!aufbRelevant) {
      steps.push({
        id: "aufbereitung",
        titleKey: "aufbereitung",
        status: "na",
        whyKey: "aufbereitungNa",
        href: "/reprocessing?section=checks&openToday=1",
      });
    } else {
      steps.push({
        id: "aufbereitung",
        titleKey: "aufbereitung",
        status: sachkunde > 0 ? "ok" : "open",
        whyKey: sachkunde > 0 ? "aufbereitungOk" : "aufbereitungOpen",
        whyParams: sachkunde > 0 ? { count: sachkunde } : undefined,
        href: "/reprocessing?section=checks&openToday=1",
      });
    }

    // 10 Export §14
    steps.push({
      id: "export",
      titleKey: "export",
      status: exportCount > 0 ? "ok" : "open",
      whyKey: exportCount ? "exportOk" : "exportOpen",
      whyParams: exportCount ? { count: exportCount } : undefined,
      href: "/devices?tab=released",
    });

    const done = steps.filter((s) => s.status === "ok" || s.status === "na").length;
    const open = steps.filter((s) => s.status === "open");
    const complete = open.length === 0;

    const tenant = await prisma.tenant.findUnique({
      where: { id: ctx.tenantId },
      select: { setupDismissedAt: true },
    });
    let dismissedAt = tenant?.setupDismissedAt ?? null;

    // Criterion reopened → bring the chip back (mockup: meldet sich wieder).
    if (open.length > 0 && dismissedAt) {
      await prisma.tenant.update({
        where: { id: ctx.tenantId },
        data: { setupDismissedAt: null },
      });
      dismissedAt = null;
    }

    const dismissed = Boolean(dismissedAt);
    // Chip only while open criteria remain (v26). At 10/10 it disappears; dismiss is the page stamp.
    const showChip = open.length > 0;

    return {
      done,
      total: steps.length,
      complete,
      showChip,
      dismissed,
      nextStepTitleKey: open[0]?.titleKey ?? null,
      nextStepHref: open[0]?.href ?? null,
      steps,
    };
  },

  /** Acknowledge Inbetriebnahme at 10/10 (stamp); chip already hidden when complete. */
  async dismiss(ctx: TenantWorkContext): Promise<SetupProgressDTO> {
    requirePermission(ctx, "shell:nav");
    const progress = await this.getProgress(ctx);
    if (!progress.complete) {
      return progress;
    }
    await prisma.tenant.update({
      where: { id: ctx.tenantId },
      data: { setupDismissedAt: new Date() },
    });
    return this.getProgress(ctx);
  },
};
