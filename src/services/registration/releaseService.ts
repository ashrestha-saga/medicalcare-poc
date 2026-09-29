import type { TenantWorkContext } from "@/interfaces";
import { actorFromContext } from "@/lib/auth/actorContext";
import { requirePermission } from "@/lib/auth/tenantContext";
import { recordAudit } from "@/services/audit/auditService";
import { notFound, unprocessable } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { computeNextMaintenanceDueAt } from "@/lib/maintenance/schedule";
import { characteristicConflicts } from "./conflicts";
import { computeReleaseLevel, deriveDuties, type Annex2Lookup } from "./deriveDuties";
import { annex2MetaById } from "./annex2Meta";
import { writeDuty } from "./writeDuty";
import { draftService, type CreateDraftInput } from "./draftService";
import {
  buildPrerequisites,
  buildPrerequisitesFromRef,
  FALLBACK_PREREQUISITES,
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
import { extractModelCharacteristics } from "./modelCharacteristics";
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

/** FA-215 — refuse derive while visible answers are open or only suggested (unless deferred). */
async function assertCharacteristicsAnswered(
  characteristics: RegistrationCharacteristics,
  opts?: { allowDeferred?: boolean },
) {
  const kind = await loadProductKind(characteristics.produktart);
  const missing = unansweredVisibleFields(characteristics, kind);
  const blocking = opts?.allowDeferred
    ? missing.filter((f) => {
        const meta = characteristics.answerMeta?.[f.field];
        return meta?.state !== "deferred";
      })
    : missing;
  if (blocking.length) {
    throw unprocessable(formatUnansweredMessage(blocking), {
      field: "characteristics",
      open: blocking.map((f) => f.field),
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

async function loadPrerequisiteRows() {
  const rows = await prisma.refCommissioningPrerequisite.findMany({
    where: { ruleSetId: "rs-mpbetreibv" },
    orderBy: { code: "asc" },
  });
  if (!rows.length) return FALLBACK_PREREQUISITES;
  return rows.map((r) => ({
    code: r.code,
    label: r.label,
    legalBasis: r.legalBasis,
    note: r.note,
    mandatory: r.mandatory,
    evidenceKind: r.evidenceKind,
    appliesWhen: r.appliesWhen,
    releaseLevel: r.releaseLevel,
  }));
}

export interface ReleaseInput {
  checks: Record<string, boolean>;
  /**
   * Erstanlage gated release defaults to `responsible` (named person + protocol).
   * `verified` reserved for statute/norm-backed ref data and explicit catalogue confirmations.
   */
  classificationConfidence?: "verified" | "responsible" | "derived" | "guess";
  evidenceText?: string | null;
}

export interface PreviewInput {
  characteristics: RegistrationCharacteristics;
  areaId?: string | null;
  purchaseYear?: number | string | null;
  deviceInstanceId?: string | null;
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
  async previewFromPayload(ctx: TenantWorkContext, input: PreviewInput) {
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
    let radiationRef = null;
    if (characteristics.strahlung && characteristics.strahlenArt) {
      const rad = await prisma.refRadiationApplication.findUnique({
        where: { code: characteristics.strahlenArt },
      });
      if (rad) {
        radiationRef = {
          code: rad.code,
          qualityGuideline: rad.qualityGuideline,
          expertInspectionApplies: rad.expertInspectionApplies,
        };
      }
    }

    let linkedEquipmentDeviceIds: string[] = [];
    let requiresValidatedProcess = true;
    if (input.deviceInstanceId) {
      const links = await prisma.reprocessingOnDevice.findMany({
        where: { tenantId: ctx.tenantId, profileDeviceId: input.deviceInstanceId },
        select: { equipmentDeviceId: true },
      });
      linkedEquipmentDeviceIds = links.map((l) => l.equipmentDeviceId);
    }
    if (characteristics.aufbKlasse) {
      const cls = await prisma.refReprocessingClass.findUnique({
        where: { code: characteristics.aufbKlasse },
      });
      if (cls) requiresValidatedProcess = cls.requiresValidatedProcess;
    }

    const duties = deriveDuties({
      characteristics,
      annex2,
      radiationRef,
      linkedEquipmentDeviceIds,
      requiresValidatedProcess,
    });

    let site: SiteSafetyStatus | null = null;
    if (input.areaId) {
      const area = await prisma.area.findFirst({
        where: { id: input.areaId, site: { tenantId: ctx.tenantId } },
      });
      if (!area) throw unprocessable("Area does not belong to this tenant.", { field: "areaId" });
      site = await siteSafetyStatus(area.siteId);
    }

    const evidenceByCode: Record<string, string> = {};
    if (input.deviceInstanceId) {
      const evidence = await prisma.deviceEvidence.findMany({
        where: { tenantId: ctx.tenantId, deviceInstanceId: input.deviceInstanceId },
      });
      for (const e of evidence) {
        if (e.attachmentBlobId || e.externalRecordRef) {
          evidenceByCode[e.prerequisiteCode] = e.id;
        }
      }
    }

    const refRows = await loadPrerequisiteRows();
    const prerequisites = buildPrerequisitesFromRef(refRows, characteristics, site, evidenceByCode);
    const releaseLevel = computeReleaseLevel(characteristics);
    return {
      duties,
      prerequisites,
      site,
      conflicts: [] as string[],
      releaseLevel,
    };
  },

  async derivePreview(ctx: TenantWorkContext, draftId: string) {
    requirePermission(ctx, "inventory:update");
    const row = await prisma.deviceInstance.findFirst({
      where: { id: draftId, tenantId: ctx.tenantId },
    });
    if (!row) throw notFound("Draft not found.");
    return this.previewFromPayload(ctx, {
      characteristics: parseCharacteristics(row.characteristicsJson),
      areaId: row.areaId,
      purchaseYear: row.commissionedAt ? row.commissionedAt.getUTCFullYear() : null,
      deviceInstanceId: row.id,
    });
  },

  async commit(ctx: TenantWorkContext, input: CommitRegistrationInput) {
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

  async release(ctx: TenantWorkContext, draftId: string, input: ReleaseInput) {
    requirePermission(ctx, "inventory:update");
    const tenantId = ctx.tenantId;

    const row = await prisma.deviceInstance.findFirst({
      where: { id: draftId, tenantId },
      include: { area: true, model: true },
    });
    if (!row) throw notFound("Draft not found.");
    if (row.state === "released") throw unprocessable("Already released.");
    if (row.state === "retired") throw unprocessable("Retired record.");

    const openClarifications = await prisma.deviceClarification.count({
      where: {
        tenantId,
        deviceInstanceId: row.id,
        resolvedAt: null,
        kind: { in: ["classification", "evidence"] },
      },
    });
    if (openClarifications > 0) {
      throw unprocessable(
        "Release blocked while classification or evidence clarifications remain open.",
        { field: "clarifications", open: openClarifications },
      );
    }

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
    const releaseLevel = preview.releaseLevel ?? computeReleaseLevel(characteristics);
    const open = openMandatoryPrerequisites(preview.prerequisites, input.checks ?? {}, {
      releaseLevel,
      requireEvidence: releaseLevel >= 2,
    });
    if (open.length) {
      const thirdParty = open.filter((x) => x.evidenceKind === "third_party");
      if (thirdParty.length && releaseLevel >= 3) {
        throw unprocessable(
          `Release level 3 requires third-party evidence (external record). Open: ${thirdParty.map((x) => x.t).join(" · ")}`,
          { field: "prerequisites", open: thirdParty.map((x) => x.k), code: "third_party_required" },
        );
      }
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

    const confidence = input.classificationConfidence ?? "responsible";
    const evidenceText =
      input.evidenceText?.trim() ||
      (confidence === "responsible" || confidence === "verified"
        ? `Initial registration release by ${ctx.user.name} — prerequisites confirmed (level ${releaseLevel})`
        : null);

    const modelChars = extractModelCharacteristics(characteristicsFrozen);
    const evidenceRows = await prisma.deviceEvidence.findMany({
      where: { tenantId, deviceInstanceId: row.id },
    });

    const referenceDate = row.commissionedAt ?? new Date();

    const result = await prisma.$transaction(async (tx) => {
      if (row.modelId) {
        await tx.deviceModelClassification.updateMany({
          where: { deviceModelId: row.modelId, validTo: null },
          data: { validTo: new Date(), openClassificationKey: null },
        });
      }

      const fieldStates: Record<string, string> = {};
      const deferredFields: string[] = [];
      for (const [field, meta] of Object.entries(characteristicsFrozen.answerMeta ?? {})) {
        fieldStates[field] = meta.state === "deferred" ? "deferred" : meta.state === "selbst_gewaehlt" ? "chosen" : meta.state === "vorschlag_bestaetigt" ? "confirmed" : meta.state === "vorschlag" ? "proposed" : "open";
        if (meta.state === "deferred") deferredFields.push(field);
      }

      const classification =
        row.modelId != null
          ? await tx.deviceModelClassification.create({
              data: {
                deviceModelId: row.modelId,
                openClassificationKey: row.modelId,
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
                confirmedBy:
                  confidence === "verified" || confidence === "responsible" ? ctx.user.name : null,
                confirmedAt:
                  confidence === "verified" || confidence === "responsible" ? new Date() : null,
                productKindCode: characteristics.produktart || row.productKindCode,
                characteristics: JSON.stringify(modelChars),
                fieldStates: JSON.stringify(fieldStates),
                decisions: JSON.stringify(protocol),
                deferredFields: deferredFields.length ? JSON.stringify(deferredFields) : null,
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
            releaseLevel,
            evidenceIds: evidenceRows.map((e) => e.id),
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
        if (characteristics.aufbExtern) {
          const links = await tx.reprocessingOnDevice.count({
            where: { profileDeviceId: row.id, tenantId },
          });
          if (links > 0) {
            throw unprocessable(
              "Cannot mark reprocessing as outsourced while in-house equipment links exist.",
              { field: "aufbExtern" },
            );
          }
        }
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
          releaseLevel,
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
          note: `Release with snapshot ${snapshot.id} (level ${releaseLevel}) — answers: ${answerCounts.confirmed} confirmed, ${answerCounts.changed} changed, ${answerCounts.selfChosen} self-chosen`,
        },
      });

      return { snapshotId: snapshot.id, classificationId: classification?.id ?? null, releaseLevel };
    });

    await recordAudit({
      actor: actorFromContext(ctx),
      resource: "device",
      resourceId: row.id,
      action: "transition",
      summary: `Released ${row.inventoryNumber}`,
      before: { state: row.state },
      after: { state: "released", snapshotId: result.snapshotId, releaseLevel: result.releaseLevel },
    });
    return {
      id: row.id,
      inventoryNumber: row.inventoryNumber,
      state: "released" as const,
      ...result,
    };
  },
};

/** Re-export for tests that still import the sync builder. */
export { buildPrerequisites };
