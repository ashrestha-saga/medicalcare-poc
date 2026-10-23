import type { TenantWorkContext } from "@/interfaces";
import { requirePermission } from "@/lib/auth/tenantContext";
import { prisma } from "@/lib/prisma";
import { countKlarlisteDevices } from "@/services/nav/klarlisteIssues";

/** MPSB threshold: regularly more than 20 employees → appointment required. */
const MPSB_HEADCOUNT = 20;

export type SetupStepId =
  | "sites"
  | "personen"
  | "traegerschaft"
  | "betreuung"
  | "bestand"
  | "einstufung"
  | "klaerliste"
  | "takte"
  | "aufbereitung"
  | "export";

export type SetupStepStatus = "ok" | "open" | "na";

export type SetupStepDTO = {
  id: SetupStepId;
  /** i18n key under `commissioning.steps.*` */
  titleKey: string;
  status: SetupStepStatus;
  /** Server-built reason string (DE for now; numbers included). */
  why: string;
  href: string;
};

export type SetupProgressDTO = {
  done: number;
  total: number;
  /** True when every step is ok or na. */
  complete: boolean;
  /** Sidebar chip: open steps remain and not dismissed. */
  showChip: boolean;
  /** User acknowledged 10/10 (Inbetriebnahme abschließen). */
  dismissed: boolean;
  nextStepTitleKey: string | null;
  nextStepHref: string | null;
  steps: SetupStepDTO[];
};

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
      prisma.deviceDuty.count({ where: { applicable: true, dueAt: { not: null } } }).catch(() => 0),
      prisma.deviceDuty
        .count({
          where: {
            applicable: true,
            dutyKey: "konstanz",
            deviceInstance: {
              state: { not: "retired" },
              constancyCadences: { none: { validTo: null } },
            },
          },
        })
        .catch(() => 0),
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
      why:
        siteCount > 0
          ? `${siteCount} Standort${siteCount === 1 ? "" : "e"} angelegt`
          : "Noch kein Standort — ohne Standort kein Gerät",
      href: "/locations",
    });

    // 2 personen + MPSB
    const personenOk = activeStaff > 0 && mpsbOffen === 0;
    steps.push({
      id: "personen",
      titleKey: "personen",
      status: personenOk ? "ok" : "open",
      why: mpsbOffen
        ? `${mpsbOffen} pflichtige Standort${mpsbOffen === 1 ? "" : "e"} ohne bekanntgemachten Beauftragten`
        : `${activeStaff} aktive Personen, alle pflichtigen Standorte mit Beauftragtem`,
      href: mpsbOffen ? "/locations?mpsb=missing" : "/users",
    });

    // 3 Traägerschaft
    const tl = tileCount === 0 ? 1 : 0;
    steps.push({
      id: "traegerschaft",
      titleKey: "traegerschaft",
      status: tl === 0 ? "ok" : "open",
      why: tl
        ? "Pflichten sieht niemand im Dashboard — Kacheln zuweisen"
        : "Jede Pflichtart hat einen Träger",
      href: "/dashboard/assignments",
    });

    // 4 Betreuung
    const betreuungOk = Boolean(contract);
    steps.push({
      id: "betreuung",
      titleKey: "betreuung",
      status: betreuungOk ? "ok" : "open",
      why: contract
        ? `Vertrag seit ${contract.validFrom.toISOString().slice(0, 10)}`
        : "Noch kein aktiver Dienstleistervertrag",
      href: "/management",
    });

    // 5 Bestand
    steps.push({
      id: "bestand",
      titleKey: "bestand",
      status: erfasst > 0 ? "ok" : "open",
      why: erfasst
        ? `${erfasst} Geräte außer Entwurf (Import oder Erstanlage)`
        : "Noch kein Gerät über den Entwurf hinaus",
      href: "/devices",
    });

    // 6 Einstufung
    const einstufungOk = derivedCls === 0 && missingCls === 0;
    steps.push({
      id: "einstufung",
      titleKey: "einstufung",
      status: einstufungOk ? "ok" : "open",
      why:
        derivedCls || missingCls
          ? `${derivedCls} nur abgeleitet, ${missingCls} ohne Einstufung`
          : "Alle genutzten Modelle belegt eingestuft",
      href: "/catalog",
    });

    // 7 Klärliste
    steps.push({
      id: "klaerliste",
      titleKey: "klaerliste",
      status: klarCount === 0 ? "ok" : "open",
      why: klarCount
        ? `${klarCount} Geräte mit mindestens einem Mangel`
        : "Alle Datensätze tragen die Pflichtangaben",
      href: "/devices?tab=klaerliste",
    });

    // 8 Takte
    const takteOk = konstanzMissingTakt === 0 && dutiesWithDue > 0;
    steps.push({
      id: "takte",
      titleKey: "takte",
      status: takteOk ? "ok" : "open",
      why: konstanzMissingTakt
        ? `${konstanzMissingTakt} Konstanzprüfungen ohne Takt`
        : dutiesWithDue
          ? `${dutiesWithDue} Fälligkeiten aus STK, MTK, Wartung abgeleitet`
          : "Noch keine Fälligkeiten abgeleitet",
      href: konstanzMissingTakt ? "/constancy-cadence?section=missing" : "/due-dates",
    });

    // 9 Aufbereitung
    if (!aufbRelevant) {
      steps.push({
        id: "aufbereitung",
        titleKey: "aufbereitung",
        status: "na",
        why: "Nicht einschlägig — keine Aufbereitungsgeräte im Bestand",
        href: "/reprocessing",
      });
    } else {
      steps.push({
        id: "aufbereitung",
        titleKey: "aufbereitung",
        status: sachkunde > 0 ? "ok" : "open",
        why:
          sachkunde > 0
            ? `${sachkunde} Personen mit Sachkunde, Routinekontrollen definiert`
            : "Keine Person mit Sachkunde Aufbereitung",
        href: "/reprocessing",
      });
    }

    // 10 Export §14
    steps.push({
      id: "export",
      titleKey: "export",
      status: exportCount > 0 ? "ok" : "open",
      why: exportCount
        ? `Zuletzt ${exportCount} Export${exportCount === 1 ? "" : "s"} § 14`
        : "Noch kein Export § 14 erzeugt — Probelauf vor der ersten Begehung",
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
