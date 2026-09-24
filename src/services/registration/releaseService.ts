import type { TenantContext } from "@/interfaces";
import { requirePermission } from "@/lib/auth/tenantContext";
import { notFound, unprocessable } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { computeNextMaintenanceDueAt } from "@/lib/maintenance/schedule";
import { characteristicConflicts } from "./conflicts";
import { deriveDuties, type Annex2Lookup } from "./deriveDuties";
import { annex2MetaById } from "./annex2Meta";
import { writeDuty } from "./writeDuty";
import { draftService, type CreateDraftInput } from "./draftService";
import {
  buildPrerequisites,
  openMandatoryPrerequisites,
  type SiteSafetyStatus,
} from "./prerequisites";
import {
  buildDecisionProtocol,
  countAnswerOrigins,
  formatUnansweredMessage,
  hydrateAnswerMeta,
  unansweredVisibleFields,
} from "./answerMeta";
import { toProductKindDTO } from "./productKinds";
import type { RegistrationCharacteristics } from "./types";

const APP_VERSION = "erstanlage-1.0";

function parseCharacteristics(raw: string | null | undefined): RegistrationCharacteristics {
  if (!raw) return { produktart: "" };
  try {
    return hydrateAnswerMeta(JSON.parse(raw) as RegistrationCharacteristics);
  } catch {
    return { produktart: "" };
  }
}

async function loadProductKind(code: string | undefined | null) {
  if (!code?.trim()) return null;
  const row = await prisma.refProductKind.findUnique({ where: { code } });
  return row ? toProductKindDTO(row) : null;
}

/** FA-215 — refuse derive while visible answers are open or only suggested. */
async function assertCharacteristicsAnswered(characteristics: RegistrationCharacteristics) {
  const kind = await loadProductKind(characteristics.produktart);
  const missing = unansweredVisibleFields(characteristics, kind);
  if (missing.length) {
    throw unprocessable(formatUnansweredMessage(missing), {
      field: "characteristics",
      open: missing.map((f) => f.field),
    });
  }
}

async function siteSafetyStatus(siteId: string): Promise<SiteSafetyStatus> {
  const headcount = await prisma.siteHeadcount.findFirst({
    where: { siteId, validTo: null },
    orderBy: { validFrom: "desc" },
  });
  const officer = await prisma.safetyOfficerAppointment.findFirst({
    where: { siteId, appointedTo: null },
    orderBy: { appointedFrom: "desc" },
  });
  const count = headcount?.headcount ?? null;
  const officerRequired = count != null && count > 20;
  const officerOk =
    Boolean(officer) &&
    Boolean(officer?.functionalEmail) &&
    Boolean(officer?.publishedAt);
  return {
    headcount: count,
    officerRequired,
    officerOk,
    personName: officer?.personName ?? null,
  };
}

export interface ReleaseInput {
  checks: Record<string, boolean>;
  /** Defaults to `verified` — release itself is the Beleg; pass to downgrade. */
  classificationConfidence?: "verified" | "derived" | "guess";
  evidenceText?: string | null;
}

export interface PreviewInput {
  characteristics: RegistrationCharacteristics;
  areaId?: string | null;
  purchaseYear?: number | string | null;
}

export interface CommitRegistrationInput extends CreateDraftInput, ReleaseInput {
  draftId?: string | null;
}

async function resolveAnnex2(characteristics: RegistrationCharacteristics): Promise<Annex2Lookup | null> {
  if (characteristics.anlage2ItemId) {
    const item = await prisma.refAnnex2Item.findUnique({ where: { id: characteristics.anlage2ItemId } });
    if (item && !item.isGroup) {
      const meta = annex2MetaById(item.id);
      return {
        itemNo: item.itemNo,
        label: item.label,
        intervalYears: item.intervalYears,
        isGroup: item.isGroup,
        restriction: item.restriction,
        hinweis: meta?.hinweis ?? item.conditionText,
        verfahren: meta?.verfahren ?? null,
        wahlweiseNach: meta?.wahlweiseNach ?? null,
      };
    }
  }
  if (characteristics.anlage2Ziffer) {
    const item = await prisma.refAnnex2Item.findFirst({
      where: { itemNo: characteristics.anlage2Ziffer, isGroup: false },
      orderBy: { id: "asc" },
    });
    if (!item) return null;
    const meta = annex2MetaById(item.id);
    return {
      itemNo: item.itemNo,
      label: item.label,
      intervalYears: item.intervalYears,
      isGroup: item.isGroup,
      restriction: item.restriction,
      hinweis: meta?.hinweis ?? item.conditionText,
      verfahren: meta?.verfahren ?? null,
      wahlweiseNach: meta?.wahlweiseNach ?? null,
    };
  }
  return null;
}

export const releaseService = {
  async previewFromPayload(ctx: TenantContext, input: PreviewInput) {
    requirePermission(ctx, "inventory:update");
    const characteristics = hydrateAnswerMeta(input.characteristics);
    const conflicts = characteristicConflicts(characteristics, {
      purchaseYear: input.purchaseYear,
    });
    if (conflicts.length) {
      throw unprocessable(conflicts.join(" · "), { field: "characteristics", conflicts });
    }
    if (!characteristics.produktart?.trim()) {
      throw unprocessable("Product kind is required.", { field: "produktart" });
    }
    await assertCharacteristicsAnswered(characteristics);

    const annex2 = await resolveAnnex2(characteristics);
    const duties = deriveDuties({ characteristics, annex2 });

    let site: SiteSafetyStatus | null = null;
    if (input.areaId) {
      const area = await prisma.area.findFirst({
        where: { id: input.areaId, site: { tenantId: ctx.tenantId } },
      });
      if (!area) throw unprocessable("Area does not belong to this tenant.", { field: "areaId" });
      site = await siteSafetyStatus(area.siteId);
    }
    const prerequisites = buildPrerequisites(characteristics, site);
    return { duties, prerequisites, site, conflicts: [] as string[] };
  },

  async derivePreview(ctx: TenantContext, draftId: string) {
    requirePermission(ctx, "inventory:update");
    const row = await prisma.deviceInstance.findFirst({
      where: { id: draftId, tenantId: ctx.tenantId },
    });
    if (!row) throw notFound("Draft not found.");
    return this.previewFromPayload(ctx, {
      characteristics: parseCharacteristics(row.characteristicsJson),
      areaId: row.areaId,
      purchaseYear: row.commissionedAt ? row.commissionedAt.getUTCFullYear() : null,
    });
  },

  async commit(ctx: TenantContext, input: CommitRegistrationInput) {
    requirePermission(ctx, "inventory:update");
    let id = input.draftId?.trim() || null;
    if (id) {
      await draftService.update(ctx, id, input);
    } else {
      const created = await draftService.create(ctx, input);
      id = created.id;
    }
    return this.release(ctx, id, input);
  },

  async release(ctx: TenantContext, draftId: string, input: ReleaseInput) {
    requirePermission(ctx, "inventory:update");
    const tenantId = ctx.tenantId;

    const row = await prisma.deviceInstance.findFirst({
      where: { id: draftId, tenantId },
      include: { area: true, model: true },
    });
    if (!row) throw notFound("Draft not found.");
    if (row.state === "released") throw unprocessable("Already released.");
    if (row.state === "retired") throw unprocessable("Retired record.");

    const characteristics = parseCharacteristics(row.characteristicsJson);
    const conflicts = characteristicConflicts(characteristics, {
      purchaseYear: row.commissionedAt ? row.commissionedAt.getUTCFullYear() : null,
    });
    if (conflicts.length) {
      throw unprocessable(conflicts.join(" · "), { field: "characteristics", conflicts });
    }
    await assertCharacteristicsAnswered(characteristics);
    if (!row.serialNumber && !row.udiDi) {
      throw unprocessable("Serial number or UDI-DI is required.");
    }
    if (!row.areaId) throw unprocessable("Site/area is required.", { field: "areaId" });

    const preview = await this.derivePreview(ctx, draftId);
    const open = openMandatoryPrerequisites(preview.prerequisites, input.checks ?? {});
    if (open.length) {
      throw unprocessable(`Release not possible. Open: ${open.map((x) => x.t).join(" · ")}`, {
        field: "prerequisites",
        open: open.map((x) => x.k),
      });
    }

    const protocol = characteristics.decisionProtocol?.length
      ? characteristics.decisionProtocol
      : buildDecisionProtocol(characteristics);
    const answerCounts = characteristics.answerCounts ?? countAnswerOrigins(protocol);
    const characteristicsFrozen: RegistrationCharacteristics = {
      ...characteristics,
      decisionProtocol: protocol,
      answerCounts,
    };

    const ruleSets = await prisma.refRuleSet.findMany({ where: { validTo: null } });
    const ruleSetIds = ruleSets.map((r) => r.id);
    const mpRule = ruleSets.find((r) => r.code === "MPBETREIBV") ?? ruleSets[0];
    if (!mpRule) throw unprocessable("Rule sets not loaded — please run the seed.");

    let mtkItemId: string | null = characteristics.anlage2ItemId ?? null;
    if (!mtkItemId && characteristics.anlage2Ziffer) {
      const item = await prisma.refAnnex2Item.findFirst({
        where: { itemNo: characteristics.anlage2Ziffer, isGroup: false },
      });
      mtkItemId = item?.id ?? null;
    }

    /**
     * Initial registration release is an explicit, prerequisite-gated act by the operator,
     * so the resulting classification counts as documented ("verified") unless the caller
     * deliberately downgrades it.
     */
    const confidence = input.classificationConfidence ?? "verified";
    const evidenceText =
      input.evidenceText?.trim() ||
      (confidence === "verified"
        ? `Initial registration release by ${ctx.user.name} — prerequisites confirmed`
        : null);

    const referenceDate = row.commissionedAt ?? new Date();

    const result = await prisma.$transaction(async (tx) => {
      if (row.modelId) {
        await tx.deviceModelClassification.updateMany({
          where: { deviceModelId: row.modelId, validTo: null },
          data: { validTo: new Date() },
        });
      }

      const classification =
        row.modelId != null
          ? await tx.deviceModelClassification.create({
              data: {
                deviceModelId: row.modelId,
                stk: Boolean(characteristics.anlage1 || characteristics.altgeraet),
                mtkItemId,
                radiation: Boolean(characteristics.strahlung),
                softwareClass:
                  characteristics.software && characteristics.swKlasse && characteristics.swKlasse !== "keine"
                    ? characteristics.swKlasse
                    : null,
                confidence,
                evidenceText,
                ruleSetId: mpRule.id,
                confirmedBy: confidence === "verified" ? ctx.user.name : null,
                confirmedAt: confidence === "verified" ? new Date() : null,
              },
            })
          : null;

      const snapshot = await tx.deviceReleaseSnapshot.create({
        data: {
          tenantId,
          deviceInstanceId: row.id,
          releasedBy: ctx.user.name,
          ruleSetIds: JSON.stringify(ruleSetIds),
          classificationId: classification?.id ?? null,
          characteristics: JSON.stringify(characteristicsFrozen),
          derivedDuties: JSON.stringify(preview.duties),
          prerequisites: JSON.stringify({
            items: preview.prerequisites,
            checks: input.checks,
          }),
          appVersion: APP_VERSION,
        },
      });

      for (const d of preview.duties) {
        await writeDuty(tx, {
          tenantId,
          deviceInstanceId: row.id,
          snapshotId: snapshot.id,
          duty: d,
          referenceDate,
          lastMaintainedAt: row.lastMaintainedAt,
        });
      }

      if (characteristics.aufbereitung && characteristics.aufbKlasse) {
        await tx.deviceReprocessingProfile.upsert({
          where: { deviceInstanceId: row.id },
          update: {
            classCode: characteristics.aufbKlasse,
            outsourced: Boolean(characteristics.aufbExtern),
            assessedBy: ctx.user.name,
            assessedAt: new Date(),
          },
          create: {
            deviceInstanceId: row.id,
            tenantId,
            classCode: characteristics.aufbKlasse,
            outsourced: Boolean(characteristics.aufbExtern),
            assessedBy: ctx.user.name,
          },
        });
      }

      const maint = preview.duties.find((d) => d.id === "wartung" && d.einschlaegig);
      const cycleMonths = maint?.frist ?? row.maintenanceCycleMonths;

      await tx.deviceInstance.update({
        where: { id: row.id },
        data: {
          state: "released",
          maintenanceCycleMonths: cycleMonths,
          maintenanceAnchorAt: referenceDate,
          nextMaintenanceDueAt: computeNextMaintenanceDueAt({
            cycleMonths,
            anchorAt: referenceDate,
            lastMaintainedAt: row.lastMaintainedAt,
          }),
        },
      });

      if (row.modelId) {
        await tx.deviceModel.update({
          where: { id: row.modelId },
          data: { state: "released" },
        });
      }

      await tx.deviceUnitEvent.create({
        data: {
          tenantId,
          deviceInstanceId: row.id,
          actor: ctx.user.name,
          action: "state_change",
          fromState: row.state,
          toState: "released",
          note: `Release with snapshot ${snapshot.id} — answers: ${answerCounts.confirmed} confirmed, ${answerCounts.changed} changed, ${answerCounts.selfChosen} self-chosen`,
        },
      });

      return { snapshotId: snapshot.id, classificationId: classification?.id ?? null };
    });

    return {
      id: row.id,
      inventoryNumber: row.inventoryNumber,
      state: "released" as const,
      ...result,
    };
  },
};
