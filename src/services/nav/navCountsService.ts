import type { PermissionSlug, TenantContext, TenantWorkContext } from "@/interfaces";
import type { NavCountEntry, NavCountsResponse } from "@/constants/navCounts";
import { requirePermission } from "@/lib/auth/tenantContext";
import { prisma } from "@/lib/prisma";
import { countMissingConstancyCadences } from "@/services/constancy/missingCadenceMetrics";
import { countDatedDuties, countOverdueDuties } from "@/services/dueDates/dutyDueMetrics";
import { countKlarlisteDevices } from "@/services/nav/klarlisteIssues";
import { reprocessingEvidenceService } from "@/services/reprocessingEvidence/reprocessingEvidenceService";

function entry(count: number | null, warn: boolean, extra?: Partial<NavCountEntry>): NavCountEntry {
  return { count, warn, ...extra };
}

function startOfTodayUtc(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

function can(ctx: TenantWorkContext, ...slugs: PermissionSlug[]): boolean {
  const granted = ctx.permissions ?? [];
  return slugs.some((s) => granted.includes(s));
}

/**
 * Aggregate sidebar counters for the acting clinic tenant.
 * Omits keys the caller cannot open (permission-gated).
 */
export const navCountsService = {
  async getCounts(ctx: TenantWorkContext): Promise<NavCountsResponse> {
    requirePermission(ctx, "shell:nav");
    const out: NavCountsResponse = {};
    const today = startOfTodayUtc();
    const tasks: Array<Promise<void>> = [];

    if (can(ctx, "duties:view")) {
      tasks.push(
        (async () => {
          const overdue = await countOverdueDuties();
          out.dash = entry(overdue > 0 ? overdue : null, overdue > 0);
        })(),
      );

      tasks.push(
        (async () => {
          const overdue = await countOverdueDuties();
          if (overdue > 0) {
            out.faelligkeiten = entry(overdue, true, { mode: "overdue" });
            return;
          }
          const due = await countDatedDuties();
          out.faelligkeiten = entry(due, due > 0, { mode: "due" });
        })(),
      );

      tasks.push(
        (async () => {
          const missing = await countMissingConstancyCadences();
          out.konstanztakt = entry(missing, missing > 0);
        })(),
      );
    }

    if (can(ctx, "inventory:view", "clarifications:view")) {
      tasks.push(
        (async () => {
          const n = await countKlarlisteDevices(ctx);
          // Volume only — amber is reserved for action-required counts.
          out.list = entry(n, false);
        })(),
      );
    }

    if (can(ctx, "requests:view-mine", "requests:view-open", "requests:view-all")) {
      tasks.push(
        (async () => {
          const open = await prisma.serviceRequest.count({
            where: {
              state: {
                in: ["captured", "queued", "transmitted", "handed_off", "acknowledged", "scheduled", "in_progress"],
              },
            },
          });
          out.auftraege = entry(open, false);
        })(),
      );
    }

    if (can(ctx, "reprocessing:view")) {
      tasks.push(
        (async () => {
          const [openChecks, openBatches] = await Promise.all([
            reprocessingEvidenceService.countOpenDailyChecks(ctx as TenantContext).catch(() => 0),
            prisma.reprocessingBatch.count({ where: { releaseResult: null } }),
          ]);
          const n = openChecks + openBatches;
          out.aufbnachweis = entry(n, openBatches > 0 || openChecks > 0);
        })(),
      );
    }

    if (can(ctx, "training:view")) {
      tasks.push(
        (async () => {
          const due = await prisma.trainingRecord.count({
            where: { validUntil: { lte: today } },
          });
          out.schulungen = entry(due, due > 0);
        })(),
      );
    }

    if (can(ctx, "incidents:view")) {
      tasks.push(
        (async () => {
          const n = await prisma.deviceIncident.count({
            where: { closedAt: null },
          });
          out.vorkommnisse = entry(n, n > 0);
        })(),
      );
    }

    if (can(ctx, "fieldsafety:view")) {
      tasks.push(
        (async () => {
          const n = await prisma.fieldSafetyAction.count({
            where: { closedAt: null },
          });
          out.rueckrufe = entry(n, n > 0);
        })(),
      );
    }

    if (can(ctx, "authority:view")) {
      tasks.push(
        (async () => {
          const findingsOpen = await prisma.authorityFinding.count({
            where: { status: "open" },
          });
          let gapItems = 0;
          try {
            const { authorityPreparationService } = await import(
              "@/services/authority/authorityPreparationService"
            );
            const prep = await authorityPreparationService.preparation(
              ctx as TenantContext,
              "CL-MP-DE",
            );
            gapItems = prep.progress.gap;
          } catch {
            gapItems = 0;
          }
          const n = findingsOpen + gapItems;
          out.begehung = entry(n, n > 0);
        })(),
      );
    }

    if (can(ctx, "catalog:view")) {
      tasks.push(
        (async () => {
          const hit = await prisma.deviceModelClassification.findFirst({
            where: {
              validTo: null,
              confidence: { in: ["derived", "guess"] },
            },
            select: { id: true },
          });
          // Mark only — not amber; derived classifications are informational.
          out.models = entry(
            null,
            false,
            hit ? { mark: "!", hintKey: "catalogBadgeDerived" } : undefined,
          );
        })(),
      );
    }

    if (can(ctx, "users:view")) {
      tasks.push(
        (async () => {
          const n = await prisma.user.count({
            where: { tenantId: ctx.tenantId, active: true, accountKind: "clinic" },
          });
          out.personen = entry(n, false);
        })(),
      );
    }

    if (can(ctx, "locations:view")) {
      tasks.push(
        (async () => {
          const n = await prisma.site.count();
          out.sites = entry(n, false);
        })(),
      );
    }

    await Promise.all(tasks);
    return out;
  },
};
