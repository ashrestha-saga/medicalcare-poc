import type { TenantWorkContext } from "@/interfaces";
import { actorFromContext } from "@/lib/auth/actorContext";
import { requirePermission } from "@/lib/auth/tenantContext";
import { recordAudit } from "@/services/audit/auditService";
import { notFound, unprocessable } from "@/lib/errors";
import { blobMetaFromDataUrl } from "@/lib/blobMeta";
import { prisma } from "@/lib/prisma";
import { computeNextMaintenanceDueAt } from "@/lib/maintenance/schedule";
import { characteristicConflicts } from "./conflicts";
import { computeReleaseLevel, deriveDuties, stkFlagFromDuties } from "./deriveDuties";
import {
  formatUnansweredMessage,
  hydrateAnswerMeta,
  unansweredVisibleFields,
} from "./answerMeta";
import { toProductKindDTO } from "./productKinds";
import { annex2MetaById } from "./annex2Meta";
import {
  buildPrerequisites,
  openMandatoryPrerequisites,
  type SiteSafetyStatus,
} from "./prerequisites";
import type { EvidenceKind, RegistrationCharacteristics } from "./types";
import { writeDuty } from "./writeDuty";
import { isReprocessingEquipmentDevice } from "./reprocessingLinkService";

const APP_VERSION = "reclassify-1.0";

function parseCharacteristics(raw: string | null | undefined): RegistrationCharacteristics {
  if (!raw) return { produktart: "" };
  try {
    return hydrateAnswerMeta(JSON.parse(raw) as RegistrationCharacteristics);
  } catch {
    return { produktart: "" };
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
    Boolean(officer) && Boolean(officer?.functionalEmail) && Boolean(officer?.publishedAt);
  return {
    headcount: count,
    officerRequired,
    officerOk,
    personName: officer?.personName ?? null,
  };
}

async function resolveAnnex2(characteristics: RegistrationCharacteristics) {
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
        confidence:
          item.confidence === "verified" || item.confidence === "derived"
            ? item.confidence
            : meta?.confidence ?? "derived",
        sourceRef: item.sourceRef ?? meta?.sourceRef ?? null,
        id: item.id,
      };
    }
  }
  if (characteristics.anlage2Ziffer) {
    const item = await prisma.refAnnex2Item.findFirst({
      where: { itemNo: characteristics.anlage2Ziffer, isGroup: false },
      orderBy: { id: "asc" },
    });
    if (item) {
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
        confidence:
          item.confidence === "verified" || item.confidence === "derived"
            ? item.confidence
            : meta?.confidence ?? "derived",
        sourceRef: item.sourceRef ?? meta?.sourceRef ?? null,
        id: item.id,
      };
    }
  }
  return null;
}

export interface ReclassifyContext {
  modelId: string;
  displayName: string;
  manufacturer: string | null;
  copyCount: number;
  siteCount: number;
  releasedCount: number;
  characteristics: RegistrationCharacteristics;
  sampleInventoryNumber: string | null;
}

export interface ReclassifyEvidenceInput {
  prerequisiteCode: string;
  evidenceKind: Extract<EvidenceKind, "document" | "third_party">;
  externalRecordRef?: string | null;
  dataUrl?: string | null;
}

export interface ReclassifyApplyInput {
  characteristics: RegistrationCharacteristics;
  checks: Record<string, boolean>;
  /** Admin must confirm model-wide impact. */
  acknowledgeImpact: boolean;
  /** Defaults to `verified` — the acknowledged apply is the Beleg. */
  classificationConfidence?: "verified" | "responsible" | "derived" | "guess";
  evidenceText?: string | null;
  /** Document / third-party evidence from the prerequisites step (copied to every instance). */
  evidence?: ReclassifyEvidenceInput[];
}

export const reclassifyService = {
  async getContext(ctx: TenantWorkContext, modelId: string): Promise<ReclassifyContext> {
    requirePermission(ctx, "catalog:update");
    const model = await prisma.deviceModel.findUnique({ where: { id: modelId } });
    if (!model) throw notFound("Model not found.");

    const instances = await prisma.deviceInstance.findMany({
      where: { modelId, tenantId: ctx.tenantId },
      select: {
        id: true,
        state: true,
        inventoryNumber: true,
        characteristicsJson: true,
        productKindCode: true,
        area: { select: { siteId: true } },
        releaseSnapshots: {
          orderBy: { releasedAt: "desc" },
          take: 1,
          select: { characteristics: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const siteIds = new Set(
      instances.map((i) => i.area?.siteId).filter((id): id is string => Boolean(id)),
    );
    const released = instances.filter((i) => i.state === "released");

    let characteristics: RegistrationCharacteristics = { produktart: "" };
    for (const inst of instances) {
      const fromSnap = inst.releaseSnapshots[0]?.characteristics;
      if (fromSnap) {
        characteristics = parseCharacteristics(fromSnap);
        if (characteristics.produktart) break;
      }
      if (inst.characteristicsJson) {
        characteristics = parseCharacteristics(inst.characteristicsJson);
        if (characteristics.produktart) break;
      }
      if (inst.productKindCode && !characteristics.produktart) {
        characteristics = { ...characteristics, produktart: inst.productKindCode };
      }
    }

    return {
      modelId,
      displayName:
        model.tradeName?.trim() || model.modelName?.trim() || model.basicUdiDi?.trim() || model.id,
      manufacturer: model.manufacturer,
      copyCount: instances.length,
      siteCount: siteIds.size,
      releasedCount: released.length,
      characteristics,
      sampleInventoryNumber: instances[0]?.inventoryNumber ?? null,
    };
  },

  async derive(ctx: TenantWorkContext, modelId: string, characteristics: RegistrationCharacteristics) {
    requirePermission(ctx, "catalog:update");
    const model = await prisma.deviceModel.findUnique({ where: { id: modelId } });
    if (!model) throw notFound("Model not found.");

    const hydrated = hydrateAnswerMeta(characteristics);
    const conflicts = characteristicConflicts(hydrated);
    if (conflicts.length) {
      throw unprocessable(conflicts.join(" · "), { field: "characteristics", conflicts });
    }

    const kindRow = hydrated.produktart
      ? await prisma.refProductKind.findUnique({ where: { code: hydrated.produktart } })
      : null;
    const kind = kindRow ? toProductKindDTO(kindRow) : null;
    const missing = unansweredVisibleFields(hydrated, kind);
    if (missing.length) {
      throw unprocessable(formatUnansweredMessage(missing), {
        field: "characteristics",
        open: missing.map((f) => f.field),
      });
    }

    const annex2 = await resolveAnnex2(hydrated);
    const duties = deriveDuties({
      characteristics: hydrated,
      annex2: annex2
        ? {
            itemNo: annex2.itemNo,
            label: annex2.label,
            intervalYears: annex2.intervalYears,
            isGroup: annex2.isGroup,
            restriction: annex2.restriction,
            hinweis: annex2.hinweis,
            verfahren: annex2.verfahren,
            wahlweiseNach: annex2.wahlweiseNach,
            confidence: annex2.confidence,
            sourceRef: annex2.sourceRef,
          }
        : null,
    });

    // Model-wide preview: site-agnostic prerequisites (admin confirms; § 6 checked per site on apply).
    const prerequisites = buildPrerequisites(hydrated, null);

    const instances = await prisma.deviceInstance.count({
      where: { modelId, tenantId: ctx.tenantId },
    });

    return { duties, prerequisites, copyCount: instances, conflicts: [] as string[] };
  },

  async apply(ctx: TenantWorkContext, modelId: string, input: ReclassifyApplyInput) {
    requirePermission(ctx, "catalog:update");
    if (!input.acknowledgeImpact) {
      throw unprocessable("Confirm that this change applies to all copies of the model.", {
        field: "acknowledgeImpact",
      });
    }

    const characteristics = input.characteristics;
    if (!characteristics.produktart?.trim()) {
      throw unprocessable("Product kind is required.", { field: "characteristics" });
    }

    const conflicts = characteristicConflicts(characteristics);
    if (conflicts.length) {
      throw unprocessable(conflicts.join(" · "), { field: "characteristics", conflicts });
    }

    const model = await prisma.deviceModel.findUnique({ where: { id: modelId } });
    if (!model) throw notFound("Model not found.");

    const preview = await this.derive(ctx, modelId, characteristics);
    const evidenceItems = (input.evidence ?? []).filter(
      (e) => Boolean(e.externalRecordRef?.trim()) || Boolean(e.dataUrl?.trim()),
    );
    for (const e of evidenceItems) {
      if (e.evidenceKind === "third_party" && !e.externalRecordRef?.trim() && !e.dataUrl?.trim()) {
        throw unprocessable(
          "Third-party evidence requires an external record reference (Prüfpartner / authority).",
          { field: "evidence", code: e.prerequisiteCode },
        );
      }
    }
    const evidenceByCode: Record<string, string> = {};
    for (const e of evidenceItems) {
      evidenceByCode[e.prerequisiteCode] = `pending:${e.prerequisiteCode}`;
    }
    const prerequisitesWithEvidence = preview.prerequisites.map((p) => {
      const id = evidenceByCode[p.k];
      if (!id) return p;
      return {
        ...p,
        evidenceId: id,
        erfuellt: p.evidenceKind === "confirmation" ? p.erfuellt : true,
      };
    });
    const releaseLevel = computeReleaseLevel(characteristics);
    const open = openMandatoryPrerequisites(prerequisitesWithEvidence, input.checks ?? {}, {
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
      throw unprocessable(`Reclassification blocked. Open: ${open.map((x) => x.t).join(" · ")}`, {
        field: "prerequisites",
        open: open.map((x) => x.k),
      });
    }

    const instances = await prisma.deviceInstance.findMany({
      where: { modelId, tenantId: ctx.tenantId },
      include: { area: true },
    });

    // Block if any released copy’s site fails mandatory § 6 when required.
    for (const inst of instances) {
      if (inst.state !== "released" || !inst.area?.siteId) continue;
      const site = await siteSafetyStatus(inst.area.siteId);
      const sitePrereqs = buildPrerequisites(characteristics, site);
      const siteOpen = openMandatoryPrerequisites(sitePrereqs, {
        ...input.checks,
        ...(sitePrereqs.find((p) => p.k === "bmps" && p.erfuellt) ? { bmps: true } : {}),
      });
      const blocking = siteOpen.filter((p) => p.k === "bmps");
      if (blocking.length) {
        throw unprocessable(
          `Site prerequisite open for ${inst.inventoryNumber}: ${blocking.map((x) => x.t).join(" · ")}`,
          { field: "prerequisites", inventoryNumber: inst.inventoryNumber },
        );
      }
    }

    const ruleSets = await prisma.refRuleSet.findMany({ where: { validTo: null } });
    const ruleSetIds = ruleSets.map((r) => r.id);
    const mpRule = ruleSets.find((r) => r.code === "MPBETREIBV") ?? ruleSets[0];
    if (!mpRule) throw unprocessable("Rule sets not loaded — please run the seed.");

    const annex2 = await resolveAnnex2(characteristics);
    const mtkItemId = annex2?.id ?? null;
    /** Same rule as initial registration: an acknowledged, prerequisite-gated act is the evidence. */
    const confidence = input.classificationConfidence ?? "verified";
    const evidenceText =
      input.evidenceText?.trim() ||
      `Reclassification by ${ctx.user.name} — prerequisites confirmed`;

    const duties = preview.duties;
    const tenantId = ctx.tenantId;
    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      await tx.deviceModelClassification.updateMany({
        where: { deviceModelId: modelId, validTo: null },
        data: { validTo: now, openClassificationKey: null },
      });

      const classification = await tx.deviceModelClassification.create({
        data: {
          deviceModelId: modelId,
          openClassificationKey: modelId,
          stk: stkFlagFromDuties(duties),
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
          confirmedAt: confidence === "verified" ? now : null,
        },
      });

      await tx.deviceModel.update({
        where: { id: modelId },
        data: { state: "released", version: { increment: 1 } },
      });

      let updatedCopies = 0;
      let reReleased = 0;

      /** One shared attachment blob per uploaded evidence item (reused across copies). */
      const blobIdsByCode: Record<string, string> = {};
      for (const e of evidenceItems) {
        if (!e.dataUrl?.trim()) continue;
        const dataUrl = e.dataUrl.trim();
        const meta = blobMetaFromDataUrl(dataUrl);
        const blob = await tx.attachmentBlob.create({
          data: {
            tenantId,
            kind: `evidence:${e.prerequisiteCode}`,
            dataUrl,
            contentType: meta.contentType,
            byteSize: meta.byteSize,
          },
        });
        blobIdsByCode[e.prerequisiteCode] = blob.id;
      }

      for (const inst of instances) {
        await tx.deviceInstance.update({
          where: { id: inst.id },
          data: {
            productKindCode: characteristics.produktart,
            characteristicsJson: JSON.stringify(characteristics),
            legacyMedgvGroup1: Boolean(characteristics.altgeraet),
            aedExemption: Boolean(characteristics.aedAusnahme),
          },
        });
        updatedCopies += 1;

        for (const e of evidenceItems) {
          const code = e.prerequisiteCode.trim();
          const evidenceData = {
            evidenceKind: e.evidenceKind,
            attachmentBlobId: blobIdsByCode[code] ?? null,
            externalRecordRef: e.externalRecordRef?.trim() || null,
            recordedBy: ctx.user.name,
            recordedAt: now,
          };
          const existing = await tx.deviceEvidence.findUnique({
            where: {
              deviceInstanceId_prerequisiteCode: {
                deviceInstanceId: inst.id,
                prerequisiteCode: code,
              },
            },
          });
          if (existing) {
            await tx.deviceEvidence.update({
              where: { id: existing.id },
              data: {
                ...evidenceData,
                attachmentBlobId: evidenceData.attachmentBlobId ?? existing.attachmentBlobId,
                externalRecordRef:
                  evidenceData.externalRecordRef ?? existing.externalRecordRef,
              },
            });
          } else {
            await tx.deviceEvidence.create({
              data: {
                tenantId,
                deviceInstanceId: inst.id,
                prerequisiteCode: code,
                ...evidenceData,
              },
            });
          }
        }

        // SWOT 3.5 — if this exemplar is no longer reprocessing equipment, close open links.
        const stillEquipment = isReprocessingEquipmentDevice({
          productKindCode: characteristics.produktart ?? null,
          characteristicsJson: JSON.stringify(characteristics),
        });
        if (!stillEquipment) {
          await tx.reprocessingOnDevice.updateMany({
            where: { tenantId, equipmentDeviceId: inst.id, validTo: null },
            data: { validTo: now, openLinkKey: null },
          });
        }

        if (inst.state !== "released") continue;

        await tx.deviceDuty.updateMany({
          where: { deviceInstanceId: inst.id, suspendedAt: null },
          data: { suspendedAt: now },
        });

        const referenceDate = inst.commissionedAt ?? now;
        const snapshot = await tx.deviceReleaseSnapshot.create({
          data: {
            tenantId,
            deviceInstanceId: inst.id,
            releasedBy: ctx.user.name,
            ruleSetIds: JSON.stringify(ruleSetIds),
            classificationId: classification.id,
            characteristics: JSON.stringify(characteristics),
            derivedDuties: JSON.stringify(duties),
            prerequisites: JSON.stringify({
              items: prerequisitesWithEvidence,
              checks: input.checks,
              evidenceCodes: evidenceItems.map((e) => e.prerequisiteCode),
              reclassify: true,
              modelId,
            }),
            appVersion: APP_VERSION,
          },
        });

        for (const d of duties) {
          await writeDuty(tx, {
            tenantId,
            deviceInstanceId: inst.id,
            snapshotId: snapshot.id,
            duty: d,
            referenceDate,
            lastMaintainedAt: inst.lastMaintainedAt,
          });
        }

        if (characteristics.aufbereitung && characteristics.aufbKlasse) {
          await tx.deviceReprocessingProfile.upsert({
            where: { deviceInstanceId: inst.id },
            update: {
              classCode: characteristics.aufbKlasse,
              outsourced: Boolean(characteristics.aufbExtern),
              assessedBy: ctx.user.name,
              assessedAt: now,
            },
            create: {
              deviceInstanceId: inst.id,
              tenantId,
              classCode: characteristics.aufbKlasse,
              outsourced: Boolean(characteristics.aufbExtern),
              assessedBy: ctx.user.name,
            },
          });
        }

        const maint = duties.find((d) => d.id === "wartung" && d.einschlaegig);
        const cycleMonths = maint?.frist ?? inst.maintenanceCycleMonths;
        await tx.deviceInstance.update({
          where: { id: inst.id },
          data: {
            maintenanceCycleMonths: cycleMonths,
            maintenanceAnchorAt: referenceDate,
            nextMaintenanceDueAt: computeNextMaintenanceDueAt({
              cycleMonths,
              anchorAt: referenceDate,
              lastMaintainedAt: inst.lastMaintainedAt,
            }),
          },
        });

        await tx.deviceUnitEvent.create({
          data: {
            tenantId,
            deviceInstanceId: inst.id,
            actor: ctx.user.name,
            action: "classification_reclassify",
            fromState: inst.state,
            toState: inst.state,
            note: `Model reclassification — snapshot ${snapshot.id} (all copies of ${modelId})`,
          },
        });

        reReleased += 1;
      }

      return {
        classificationId: classification.id,
        updatedCopies,
        reReleased,
      };
    });

    await recordAudit({
      actor: actorFromContext(ctx),
      resource: "catalog_model",
      resourceId: modelId,
      action: "update",
      summary: `Reclassified model (${result.updatedCopies} copies, ${result.reReleased} re-released)`,
      after: { classificationId: result.classificationId, updatedCopies: result.updatedCopies },
    });
    return {
      modelId,
      ...result,
      copyCount: instances.length,
    };
  },
};
