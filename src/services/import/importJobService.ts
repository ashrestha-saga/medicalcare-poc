import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Prisma } from "@prisma/client";
import type { TenantWorkContext } from "@/interfaces/session";
import { forbidden, notFound, unprocessable } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import type { ActorContext } from "@/interfaces/audit";
import { recordAudit } from "@/services/audit/auditService";
import { allocateInventoryNumber } from "@/services/inventory/deviceInventoryService";
import { createAttachmentFromDataUrl } from "@/services/storage/attachmentBlobService";
import { notificationDedup } from "@/constants/notifications";
import { notifyService } from "@/services/notifications/notifyService";
import { loadActiveDictionary, proposeSheetMappings } from "./importDictionary";
import { resolveModelForImport } from "./importModelResolve";
import { impNorm } from "./importNorm";
import { iterMappedRows } from "./importNormalize";
import { parseImportBuffer } from "./importParse";
import {
  lastPerformancesFromNormalized,
  mergeImportPerformances,
} from "./importProvisionalDuties";
import { recomputeDutyProjection } from "@/services/duties/dutyProjection";
import type {
  ImportStats,
  ImportTargetField,
  JobMapping,
  NormalizedRow,
  ParsedSheet,
  RowOutcome,
  SheetMapping,
} from "./types";

type Ctx = TenantWorkContext;

function perms(ctx: Ctx): readonly string[] {
  return ctx.permissions ?? [];
}

function actorLabel(ctx: Ctx): string {
  return ctx.user?.name || ctx.user?.id || "import";
}

function userId(ctx: Ctx): string | undefined {
  return ctx.user?.id;
}

function orgId(ctx: Ctx): string | undefined {
  return ctx.user?.accountKind === "partner" ? ctx.user.organisationId : undefined;
}

function actorKindOf(ctx: Ctx): "clinic" | "partner" {
  return ctx.user?.accountKind === "partner" ? "partner" : "clinic";
}

function auditActor(ctx: Ctx): ActorContext {
  if (ctx.actor) return ctx.actor;
  return {
    tenantId: ctx.tenantId,
    actorUserId: userId(ctx) || null,
    actorKind: actorKindOf(ctx),
    actorRole: ctx.user?.role || ctx.user?.appRole || null,
    actorName: actorLabel(ctx),
    organisationId: orgId(ctx) || null,
    organisationName: null,
    serviceContractId: null,
    correlationId: ctx.correlationId || null,
    ip: null,
    userAgent: null,
  };
}

function emptyStats(sheets: number): ImportStats {
  return {
    rows: 0,
    deviceRows: 0,
    new: 0,
    updated: 0,
    green: 0,
    yellow: 0,
    red: 0,
    modelExact: 0,
    modelFuzzy: 0,
    modelNew: 0,
    duplicatesInFile: 0,
    releasedHits: 0,
    conflicts: 0,
    greenShare: 0,
    modelHitRate: 0,
    sheets,
  };
}

async function loadJobOrThrow(jobId: string) {
  const job = await prisma.importJob.findFirst({ where: { id: jobId } });
  if (!job) throw notFound("Import job not found");
  return job;
}

function mappingOf(job: { mapping: unknown }): JobMapping {
  const m = job.mapping as JobMapping | null;
  if (!m?.sheets?.length) throw unprocessable("Import mapping missing");
  return m;
}

async function loadParsedFromBlob(fileBlobId: string, fileName: string): Promise<ParsedSheet[]> {
  const blob = await prisma.attachmentBlob.findFirst({ where: { id: fileBlobId } });
  if (!blob) throw notFound("Import file blob missing");
  let buffer: Buffer;
  if (blob.storageKey) {
    const { readBlobBytes } = await import("@/lib/storage/blobStore");
    const bytes = await readBlobBytes(blob.storageKey);
    buffer = Buffer.from(bytes);
  } else if (blob.dataUrl) {
    const b64 = blob.dataUrl.split(",")[1] || "";
    buffer = Buffer.from(b64, "base64");
  } else {
    throw unprocessable("Import file has no payload");
  }
  return parseImportBuffer(fileName, buffer);
}

export const importJobService = {
  async assertMayImport(ctx: Ctx) {
    const p = perms(ctx);
    if (actorKindOf(ctx) === "partner") {
      if (!p.includes("import:manage")) {
        throw forbidden("Partner import requires import:manage on the contract");
      }
    } else if (!p.includes("inventory:update")) {
      throw forbidden("Inventory import requires inventory:update");
    }
  },

  async list(ctx: Ctx) {
    await this.assertMayImport(ctx);
    return prisma.importJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        fileName: true,
        template: true,
        status: true,
        stats: true,
        mapping: true,
        createdAt: true,
        committedAt: true,
        createdBy: true,
        actorKind: true,
        organisationId: true,
      },
    });
  },

  async get(ctx: Ctx, jobId: string, filters?: { quality?: string; outcome?: string }) {
    await this.assertMayImport(ctx);
    const job = await loadJobOrThrow(jobId);
    const rows = await prisma.importRow.findMany({
      where: {
        jobId,
        ...(filters?.quality ? { quality: filters.quality } : {}),
        ...(filters?.outcome ? { outcome: filters.outcome } : {}),
      },
      orderBy: [{ sheet: "asc" }, { rowNo: "asc" }],
    });
    return { job, rows };
  },

  async upload(
    ctx: Ctx,
    args: { fileName: string; buffer: Buffer; template?: string },
  ) {
    await this.assertMayImport(ctx);
    if (!(prisma as { importJob?: unknown }).importJob) {
      throw unprocessable(
        "Import schema not loaded — restart the server after `npx prisma generate`.",
      );
    }
    const template = args.template || "excel_14";
    const sheets = parseImportBuffer(args.fileName, args.buffer);
    if (!sheets.length) throw unprocessable("File has no readable sheets");

    const contentType = args.fileName.toLowerCase().endsWith(".csv")
      ? "text/csv"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    const dataUrl = `data:${contentType};base64,${args.buffer.toString("base64")}`;
    const sha256 = createHash("sha256").update(args.buffer).digest("hex");

    const blob = await createAttachmentFromDataUrl(prisma, {
      tenantId: ctx.tenantId,
      kind: "import_file",
      dataUrl,
    });
    await prisma.attachmentBlob.update({
      where: { id: blob.id },
      data: { sha256 },
    });

    const sites = await prisma.site.findMany({
      where: { tenantId: ctx.tenantId },
      select: { id: true, name: true },
    });
    const dict = await loadActiveDictionary(template);
    const proposed = proposeSheetMappings(sheets, dict, sites);
    if (!proposed.length) {
      throw unprocessable(
        "No inventory sheet found. Use a sheet with § 14 headers (e.g. Bestandsverzeichnis). Instruction sheets like „Hinweise“ are skipped.",
      );
    }
    // Single sheet without site match → default first site
    if (proposed.length === 1 && !proposed[0]!.siteId && sites[0]) {
      proposed[0]!.siteId = sites[0].id;
      proposed[0]!.newSiteName = null;
    }

    const mapping: JobMapping = { sheets: proposed };
    const job = await prisma.importJob.create({
      data: {
        tenantId: ctx.tenantId,
        organisationId: orgId(ctx) || null,
        template,
        fileName: args.fileName,
        fileBlobId: blob.id,
        mapping: mapping as unknown as Prisma.InputJsonValue,
        status: "mapped",
        createdBy: actorLabel(ctx),
        createdByUserId: userId(ctx),
        actorKind: actorKindOf(ctx),
      },
    });

    // Persist raw rows (keys temporary until preview)
    const rowCreates: Prisma.ImportRowCreateManyInput[] = [];
    for (const sm of proposed) {
      const sheet = sheets.find((s) => s.name === sm.name)!;
      const data = sheet.zeilen.slice(sm.headerRowIndex + 1);
      data.forEach((cells, i) => {
        if (!cells.some((c) => String(c).trim())) return;
        const rowNo = sm.headerRowIndex + i + 2;
        rowCreates.push({
          tenantId: ctx.tenantId,
          jobId: job.id,
          sheet: sm.name,
          rowNo,
          rowKey: `row:${sm.name}:${rowNo}`,
          raw: cells as unknown as Prisma.InputJsonValue,
        });
      });
    }
    if (rowCreates.length) {
      await prisma.importRow.createMany({ data: rowCreates });
    }

    return { job, sheets: proposed.map((s) => s.name), rowCount: rowCreates.length };
  },

  async updateMapping(
    ctx: Ctx,
    jobId: string,
    patch: {
      sheets?: {
        name: string;
        siteId?: string | null;
        newSiteName?: string | null;
        columns?: { index: number; field: ImportTargetField | null; byUser?: boolean }[];
      }[];
    },
  ) {
    await this.assertMayImport(ctx);
    const job = await loadJobOrThrow(jobId);
    if (job.status === "committed") throw unprocessable("Committed import cannot change mapping");
    const mapping = mappingOf(job);
    for (const p of patch.sheets || []) {
      const sm = mapping.sheets.find((s) => s.name === p.name);
      if (!sm) continue;
      if (p.siteId !== undefined) sm.siteId = p.siteId;
      if (p.newSiteName !== undefined) sm.newSiteName = p.newSiteName;
      if (p.columns) {
        for (const c of p.columns) {
          const col = sm.columns.find((x) => x.index === c.index);
          if (col) {
            col.field = c.field;
            col.byUser = c.byUser ?? true;
          }
        }
      }
    }
    await prisma.importJob.update({
      where: { id: jobId },
      data: {
        mapping: mapping as unknown as Prisma.InputJsonValue,
        status: "mapped",
      },
    });
    return mapping;
  },

  async preview(ctx: Ctx, jobId: string) {
    await this.assertMayImport(ctx);
    const job = await loadJobOrThrow(jobId);
    const mapping = mappingOf(job);
    const sheets = await loadParsedFromBlob(job.fileBlobId, job.fileName);
    const sites = await prisma.site.findMany({
      where: { tenantId: ctx.tenantId },
      select: { id: true, name: true },
    });
    const catalog = await prisma.deviceModel.findMany({
      select: {
        id: true,
        manufacturer: true,
        modelName: true,
        tradeName: true,
        udiDi: true,
        gtins: true,
      },
    });
    const inventory = await prisma.deviceInstance.findMany({
      where: { tenantId: ctx.tenantId, state: { not: "retired" } },
      select: {
        id: true,
        inventoryNumber: true,
        serialNumber: true,
        state: true,
        room: true,
        responsiblePerson: true,
        udiDi: true,
      },
    });

    const stats = emptyStats(mapping.sheets.length);
    const seen = new Map<string, number>();
    const updates: {
      id: string;
      rowKey: string;
      normalized: NormalizedRow;
      quality: string;
      modelMatch: string;
      modelId: string | null;
      outcome: RowOutcome;
      note: string | null;
    }[] = [];

    const existingRows = await prisma.importRow.findMany({ where: { jobId } });
    const bySheetRow = new Map(existingRows.map((r) => [`${r.sheet}|${r.rowNo}`, r]));

    const iterated = iterMappedRows(sheets, mapping.sheets, sites);
    for (const item of iterated) {
      const { normalized, quality } = item;
      stats.rows++;
      stats.deviceRows++;
      if (quality.stufe === "gruen") stats.green++;
      else if (quality.stufe === "gelb") stats.yellow++;
      else stats.red++;

      let outcome: RowOutcome = "skipped";
      let modelMatch = "none";
      let modelId: string | null = null;
      const notes = [...normalized.hinweise, ...quality.fehlt];

      if (quality.stufe !== "rot") {
        const match = await resolveModelForImport({
          hersteller: normalized.hersteller,
          typ: normalized.typ || normalized.bezeichnung,
          gtin: normalized.gtin,
          catalog,
        });
        modelMatch = match.art;
        modelId = match.modelId;
        if (match.art === "exact") stats.modelExact++;
        else if (match.art === "fuzzy") stats.modelFuzzy++;
        else stats.modelNew++;

        const key = normalized.key!;
        if (seen.has(key)) {
          stats.duplicatesInFile++;
          outcome = "updated";
          notes.push(`Dublette in Datei (Zeile ${seen.get(key)})`);
        } else {
          seen.set(key, normalized.rowNo);
          const bySn = normalized.seriennummer
            ? inventory.find(
                (d) => d.serialNumber && impNorm(d.serialNumber) === impNorm(normalized.seriennummer),
              )
            : undefined;
          const byInv = normalized.inventarnummer
            ? inventory.find(
                (d) => impNorm(d.inventoryNumber) === impNorm(normalized.inventarnummer),
              )
            : undefined;

          if (bySn) {
            if (bySn.state === "released") {
              stats.releasedHits++;
              // Date-only merge is automatic; Klärliste only when identity drifts.
              if (importIdentityDrift(bySn, normalized).length) {
                outcome = "review";
              } else {
                outcome = "updated";
                stats.updated++;
              }
            } else {
              outcome = "updated";
              stats.updated++;
            }
          } else if (byInv) {
            if (normalized.seriennummer && byInv.serialNumber) {
              outcome = "conflict";
              stats.conflicts++;
              notes.push(
                `Inventarnummer ${normalized.inventarnummer} bereits an anderes Gerät — neue Nummer beim Import`,
              );
              stats.new++;
            } else if (byInv.state === "released") {
              stats.releasedHits++;
              if (importIdentityDrift(byInv, normalized).length) {
                outcome = "review";
              } else {
                outcome = "updated";
                stats.updated++;
              }
            } else {
              outcome = "updated";
              stats.updated++;
            }
          } else {
            outcome = "new";
            stats.new++;
          }
        }
      }

      const existing = bySheetRow.get(`${normalized.sheet}|${normalized.rowNo}`);
      if (existing) {
        updates.push({
          id: existing.id,
          rowKey:
            quality.stufe === "rot"
              ? `row:${normalized.sheet}:${normalized.rowNo}`
              : normalized.key || existing.rowKey,
          normalized,
          quality: quality.stufe,
          modelMatch,
          modelId,
          outcome,
          note: notes.length ? notes.join(" · ") : null,
        });
      }
    }

    stats.greenShare = stats.deviceRows ? stats.green / stats.deviceRows : 0;
    stats.modelHitRate = stats.deviceRows
      ? (stats.modelExact + stats.modelFuzzy) / Math.max(1, stats.deviceRows - stats.red)
      : 0;

    // Unique rowKey within job for non-red: if collision, suffix
    const usedKeys = new Set<string>();
    await prisma.$transaction(async (tx) => {
      for (const u of updates) {
        let key = u.rowKey;
        if (usedKeys.has(key)) key = `${key}#${u.id.slice(-6)}`;
        usedKeys.add(key);
        await tx.importRow.update({
          where: { id: u.id },
          data: {
            rowKey: key,
            normalized: u.normalized as unknown as Prisma.InputJsonValue,
            quality: u.quality,
            modelMatch: u.modelMatch,
            modelId: u.modelId,
            outcome: u.outcome,
            note: u.note,
          },
        });
      }
      await tx.importJob.update({
        where: { id: jobId },
        data: {
          status: "previewed",
          stats: stats as unknown as Prisma.InputJsonValue,
        },
      });
    });

    return { stats, rowCount: updates.length };
  },

  async commit(ctx: Ctx, jobId: string) {
    await this.assertMayImport(ctx);
    const job = await loadJobOrThrow(jobId);
    if (job.status === "committed") {
      return { job, already: true };
    }
    if (job.status !== "previewed") {
      await this.preview(ctx, jobId);
    }
    const mapping = mappingOf(await loadJobOrThrow(jobId));
    const rows = await prisma.importRow.findMany({ where: { jobId }, orderBy: { rowNo: "asc" } });
    const sites = await prisma.site.findMany({
      where: { tenantId: ctx.tenantId },
      include: { areas: true },
    });
    const siteById = new Map(sites.map((s) => [s.id, s]));

    // Multi-row commit (sites, devices, provisional duties) routinely exceeds Prisma's
    // default 5s interactive TX budget once E103 writes lastPerformances.
    const result = await prisma.$transaction(
      async (tx) => {
      const siteResolve = new Map<string, string>(); // sheet name → siteId
      for (const sm of mapping.sheets) {
        if (sm.siteId && siteById.has(sm.siteId)) {
          siteResolve.set(sm.name, sm.siteId);
          continue;
        }
        const name = sm.newSiteName || sm.name;
        const existing = sites.find((s) => impNorm(s.name) === impNorm(name));
        if (existing) {
          siteResolve.set(sm.name, existing.id);
          continue;
        }
        const created = await tx.site.create({
          data: {
            tenantId: ctx.tenantId,
            name,
          },
        });
        await tx.area.create({
          data: {
            tenantId: ctx.tenantId,
            siteId: created.id,
            name: "Allgemein",
          },
        });
        siteResolve.set(sm.name, created.id);
        sites.push({ ...created, areas: [] } as (typeof sites)[0]);
      }

      let neu = 0;
      let aktualisiert = 0;
      let klaer = 0;
      let modelle = 0;
      let rest = 0;
      let faellig = 0;
      const modelCache = new Map<string, string>(); // key → modelId

      for (const row of rows) {
        const n = row.normalized as unknown as NormalizedRow | null;
        if (!n || row.quality === "rot") {
          rest++;
          await tx.importRow.update({
            where: { id: row.id },
            data: { outcome: "skipped", deviceInstanceId: null },
          });
          continue;
        }
        // Resolve / create model
        let modelId = row.modelId;
        if (!modelId || row.modelMatch === "new") {
          const mkey = `${impNorm(n.hersteller)}|${impNorm(n.typ)}|${impNorm(n.bezeichnung)}`;
          if (modelCache.has(mkey)) modelId = modelCache.get(mkey)!;
          else {
            const created = await tx.deviceModel.create({
              data: {
                manufacturer: n.hersteller || "unbekannt",
                modelName: n.typ || n.bezeichnung || "Gerät",
                tradeName: n.bezeichnung || null,
                udiDi: n.gtin || null,
                gtins: n.gtin ? JSON.stringify([n.gtin]) : null,
                source: "import",
                state: "review",
              },
            });
            modelId = created.id;
            modelCache.set(mkey, modelId);
            modelle++;
          }
        }

        const siteId = siteResolve.get(n.sheet) || n.siteId || sites[0]?.id;
        if (!siteId) throw unprocessable("No site for import row");
        let areaId: string | null = null;
        const site = await tx.site.findFirst({
          where: { id: siteId },
          include: { areas: true },
        });
        if (site) {
          if (n.areaName) {
            const existingArea = site.areas.find(
              (a) => impNorm(a.name) === impNorm(n.areaName),
            );
            if (existingArea) areaId = existingArea.id;
            else {
              const area = await tx.area.create({
                data: {
                  tenantId: ctx.tenantId,
                  siteId: site.id,
                  name: n.areaName,
                },
              });
              areaId = area.id;
            }
          } else if (site.areas[0]) {
            areaId = site.areas[0].id;
          } else {
            const area = await tx.area.create({
              data: {
                tenantId: ctx.tenantId,
                siteId: site.id,
                name: "Allgemein",
              },
            });
            areaId = area.id;
          }
        }

        const hint = `aus ${job.fileName}, Blatt ${n.sheet}, Zeile ${n.rowNo}`;
        const commissionedAt = n.jahr ? new Date(Date.UTC(n.jahr, 0, 1)) : null;
        const performances = lastPerformancesFromNormalized(n);
        const clarIds: string[] = [];

        // Match existing unit for update / released date-merge (not on conflict → new inventar).
        const existing =
          row.outcome === "conflict"
            ? null
            : await findExistingForImport(tx, ctx.tenantId, n);

        // Preview said review but no match — do not invent a second unit.
        if (row.outcome === "review" && !existing) {
          rest++;
          await tx.importRow.update({
            where: { id: row.id },
            data: { outcome: "skipped", deviceInstanceId: null },
          });
          continue;
        }

        // Released: merge duty dates only; identity stays immutable; clar only when needed.
        if (existing?.state === "released") {
          aktualisiert++;
          const modelRow = modelId
            ? await tx.deviceModel.findFirst({
                where: { id: modelId },
                select: { maintenanceCycleMonths: true },
              })
            : null;
          const merge = await mergeImportPerformances(tx, {
            tenantId: ctx.tenantId,
            deviceInstanceId: existing.id,
            actorLabel: actorLabel(ctx),
            jobFileName: job.fileName,
            sheet: n.sheet,
            rowNo: n.rowNo,
            performances,
            maintenanceCycleMonths: modelRow?.maintenanceCycleMonths ?? null,
            requireReviewForNewKeys: true,
          });
          faellig += merge.updated;
          if (merge.updated > 0) {
            await recomputeDutyProjection(tx, existing.id);
            await tx.deviceUnitEvent.create({
              data: {
                tenantId: ctx.tenantId,
                deviceInstanceId: existing.id,
                actor: actorLabel(ctx),
                action: "import_duty_dates",
                note: `${hint} — Pflichttermine aktualisiert (${merge.updated})`,
              },
            });
          }

          const drift = importIdentityDrift(existing, n);
          const reviewBits = [
            ...drift,
            ...merge.pendingNewKeys.map((k) => `Neue Pflicht ${k.toUpperCase()} aus Datei — Freigabe prüfen`),
          ];
          if (reviewBits.length) {
            const clar = await tx.deviceClarification.create({
              data: {
                tenantId: ctx.tenantId,
                deviceInstanceId: existing.id,
                kind: "import_review",
                field: null,
                label: `Import-Prüfung (${job.fileName}, ${n.sheet} Z.${n.rowNo}): ${reviewBits.join(" · ")}`,
                deferredBy: actorLabel(ctx),
                deferredAt: new Date(),
              },
            });
            clarIds.push(clar.id);
            klaer++;
          }

          await tx.importRow.update({
            where: { id: row.id },
            data: {
              deviceInstanceId: existing.id,
              modelId,
              clarificationIds: clarIds as unknown as Prisma.InputJsonValue,
              outcome: reviewBits.length ? "review" : "updated",
            },
          });
          continue;
        }

        let device = existing;
        let updatedExisting = false;

        if (device) {
          aktualisiert++;
          updatedExisting = true;
          const changeBits: string[] = [];
          if (n.seriennummer && n.seriennummer !== (device.serialNumber || "")) {
            changeBits.push(`SN→${n.seriennummer}`);
          }
          if (n.gtin && n.gtin !== (device.udiDi || "")) {
            changeBits.push(`UDI→${n.gtin}`);
          }
          if (n.raum && n.raum !== (device.room || "")) {
            changeBits.push(`Raum→${n.raum}`);
          }
          if (n.verantwortlich && n.verantwortlich !== (device.responsiblePerson || "")) {
            changeBits.push(`Verantwortlich→${n.verantwortlich}`);
          }
          device = await tx.deviceInstance.update({
            where: { id: device.id },
            data: {
              modelId,
              serialNumber: n.seriennummer || device.serialNumber,
              udiDi: n.gtin || device.udiDi,
              areaId: areaId || device.areaId,
              room: n.raum || device.room,
              responsiblePerson: n.verantwortlich || device.responsiblePerson,
              commissionedAt: commissionedAt || device.commissionedAt,
              importJobId: job.id,
              importHint: hint,
              source: "import",
            },
          });
          await tx.deviceUnitEvent.create({
            data: {
              tenantId: ctx.tenantId,
              deviceInstanceId: device.id,
              actor: actorLabel(ctx),
              action: "import_updated",
              note: changeBits.length ? `${hint} (${changeBits.join(", ")})` : hint,
            },
          });
          // Drop stale missing-field / classification clars; never wipe duties.
          await tx.deviceClarification.deleteMany({
            where: {
              deviceInstanceId: device.id,
              resolvedAt: null,
              kind: { in: ["missing_field", "classification"] },
            },
          });
        } else {
          neu++;
          let inv = n.inventarnummer;
          if (!inv || (await tx.deviceInstance.findFirst({ where: { tenantId: ctx.tenantId, inventoryNumber: inv } }))) {
            inv = await allocateInventoryNumber(ctx.tenantId, tx);
          }
          device = await tx.deviceInstance.create({
            data: {
              tenantId: ctx.tenantId,
              inventoryNumber: inv,
              serialNumber: n.seriennummer || null,
              udiDi: n.gtin || null,
              modelId,
              areaId,
              room: n.raum || null,
              responsiblePerson: n.verantwortlich || null,
              commissionedAt,
              state: "draft",
              source: "import",
              importJobId: job.id,
              importHint: hint,
              createdByUserId: userId(ctx) || null,
            },
          });
          await tx.deviceUnitEvent.create({
            data: {
              tenantId: ctx.tenantId,
              deviceInstanceId: device.id,
              actor: actorLabel(ctx),
              action: "imported",
              toState: "draft",
              note: hint,
            },
          });
        }

        if (row.quality === "gelb" && row.note) {
          const fields = (row.note || "")
            .split(" · ")
            .filter((x) => x.includes("fehlt"));
          for (const f of fields.length ? fields : ["Pflichtangabe fehlt"]) {
            const clar = await tx.deviceClarification.create({
              data: {
                tenantId: ctx.tenantId,
                deviceInstanceId: device.id,
                kind: "missing_field",
                field: f.replace(" fehlt", ""),
                label: f,
                deferredBy: actorLabel(ctx),
                deferredAt: new Date(),
              },
            });
            clarIds.push(clar.id);
            klaer++;
          }
        }
        if (row.modelMatch === "new") {
          const clar = await tx.deviceClarification.create({
            data: {
              tenantId: ctx.tenantId,
              deviceInstanceId: device.id,
              kind: "classification",
              label: "Modell ohne Einstufung (Import)",
              deferredBy: actorLabel(ctx),
              deferredAt: new Date(),
            },
          });
          clarIds.push(clar.id);
          klaer++;
        }

        // Merge STK/MTK/… by duty key — never wipe Wartung or other duties.
        if (performances.length) {
          const modelRow = modelId
            ? await tx.deviceModel.findFirst({
                where: { id: modelId },
                select: { maintenanceCycleMonths: true },
              })
            : null;
          const merge = await mergeImportPerformances(tx, {
            tenantId: ctx.tenantId,
            deviceInstanceId: device.id,
            actorLabel: actorLabel(ctx),
            jobFileName: job.fileName,
            sheet: n.sheet,
            rowNo: n.rowNo,
            performances,
            maintenanceCycleMonths: modelRow?.maintenanceCycleMonths ?? null,
            requireReviewForNewKeys: false,
          });
          faellig += merge.updated + merge.createdProvisional;
          if (merge.updated + merge.createdProvisional > 0) {
            await recomputeDutyProjection(tx, device.id);
          }
        }

        await tx.importRow.update({
          where: { id: row.id },
          data: {
            deviceInstanceId: device.id,
            modelId,
            clarificationIds: clarIds as unknown as Prisma.InputJsonValue,
            outcome:
              row.outcome === "conflict"
                ? "conflict"
                : updatedExisting
                  ? "updated"
                  : "new",
          },
        });
      }

      const prevStats = (job.stats || {}) as ImportStats;
      const stats: ImportStats = {
        ...prevStats,
        new: neu,
        updated: aktualisiert,
        greenShare: prevStats.greenShare ?? 0,
        modelHitRate: prevStats.modelHitRate ?? 0,
      };

      const updatedJob = await tx.importJob.update({
        where: { id: job.id },
        data: {
          status: "committed",
          committedAt: new Date(),
          stats: {
            ...stats,
            neuAngelegt: neu,
            aktualisiert,
            klaer,
            modelle,
            rest,
            faellig,
          } as unknown as Prisma.InputJsonValue,
        },
      });

      return { job: updatedJob, neu, aktualisiert, klaer, modelle, rest, faellig };
      },
      { maxWait: 15_000, timeout: 120_000 },
    );

    if (!("already" in result) || !result.already) {
      const actor = auditActor(ctx);
      const neu = "neu" in result ? result.neu : 0;
      const aktualisiert = "aktualisiert" in result ? result.aktualisiert : 0;
      await recordAudit({
        actor,
        resource: "ImportJob",
        resourceId: job.id,
        action: "import.committed",
        summary: `Bestandsimport ${job.fileName}: ${neu} neu, ${aktualisiert} aktualisiert`,
        after: result.job.stats,
      });

      // E107 — tell the device admins the import finished (provisional duties need review).
      await notifyService.pushToRoles(
        ctx.tenantId,
        ["device_admin"],
        "import_review",
        notificationDedup.importFinished(job.id),
        `Import abgeschlossen: ${job.fileName}`,
        `${neu} neu, ${aktualisiert} aktualisiert`,
        { type: "import_job", id: job.id, focus: "klaerliste" },
        ctx.tenantId,
        null,
      );

      if (
        actorKindOf(ctx) === "clinic" &&
        (await prisma.tenant.findFirst({
          where: { id: ctx.tenantId },
          select: { operatingModel: true },
        }))?.operatingModel === "provider_operated"
      ) {
        await recordAudit({
          actor,
          resource: "ImportJob",
          resourceId: job.id,
          action: "import.by_institution",
          summary: "Import durch die Einrichtung — Betreuer informiert",
        });
      }
    }

    return result;
  },

  async restCsv(ctx: Ctx, jobId: string): Promise<string> {
    await this.assertMayImport(ctx);
    await loadJobOrThrow(jobId);
    const rows = await prisma.importRow.findMany({
      where: { jobId, quality: "rot" },
      orderBy: [{ sheet: "asc" }, { rowNo: "asc" }],
    });
    const lines = ["Blatt;Zeile;Zellen"];
    for (const r of rows) {
      const cells = Array.isArray(r.raw) ? (r.raw as string[]) : [];
      lines.push(
        [r.sheet || "", String(r.rowNo), cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")].join(";"),
      );
    }
    return lines.join("\n");
  },

  async unclassifiedModels(ctx: Ctx, jobId: string) {
    await this.assertMayImport(ctx);
    await loadJobOrThrow(jobId);
    const rows = await prisma.importRow.findMany({
      where: { jobId, modelMatch: "new", modelId: { not: null } },
      select: { modelId: true },
    });
    const ids = [...new Set(rows.map((r) => r.modelId!).filter(Boolean))];
    if (!ids.length) return [];
    const models = await prisma.deviceModel.findMany({
      where: { id: { in: ids } },
      include: { classifications: { orderBy: { validFrom: "desc" }, take: 1 } },
      orderBy: { createdAt: "desc" },
    });
    return models.filter((m) => !m.classifications[0]);
  },

  templatePath() {
    return join(process.cwd(), "public/import/devicecare-vorlage-bestandsverzeichnis.xlsx");
  },

  templateBytes() {
    return readFileSync(this.templatePath());
  },

  templateSha256() {
    return createHash("sha256").update(this.templateBytes()).digest("hex");
  },
};

type ImportIdentityDevice = {
  inventoryNumber: string;
  serialNumber: string | null;
  room: string | null;
  responsiblePerson: string | null;
  udiDi: string | null;
};

/** Identity fields that differ between file and released inventory (for review clar). */
function importIdentityDrift(device: ImportIdentityDevice, n: NormalizedRow): string[] {
  const bits: string[] = [];
  if (n.raum?.trim() && device.room?.trim() && impNorm(n.raum) !== impNorm(device.room)) {
    bits.push(`Raum Datei=${n.raum.trim()} / Bestand=${device.room.trim()}`);
  }
  if (
    n.verantwortlich?.trim() &&
    device.responsiblePerson?.trim() &&
    impNorm(n.verantwortlich) !== impNorm(device.responsiblePerson)
  ) {
    bits.push(
      `Verantwortlich Datei=${n.verantwortlich.trim()} / Bestand=${device.responsiblePerson.trim()}`,
    );
  }
  const fileGtin = (n.gtin || "").replace(/\D/g, "");
  const stockGtin = (device.udiDi || "").replace(/\D/g, "");
  if (fileGtin && stockGtin && fileGtin !== stockGtin && !n.gtin.includes("E+")) {
    bits.push(`UDI Datei≠Bestand`);
  }
  if (
    n.inventarnummer?.trim() &&
    device.inventoryNumber &&
    impNorm(n.inventarnummer) !== impNorm(device.inventoryNumber)
  ) {
    bits.push(
      `Inventar Datei=${n.inventarnummer.trim()} / Bestand=${device.inventoryNumber}`,
    );
  }
  return bits;
}

/** Match by serial then inventory number — any non-retired state. */
async function findExistingForImport(
  tx: Prisma.TransactionClient,
  tenantId: string,
  n: NormalizedRow,
) {
  if (n.seriennummer) {
    const bySn = await tx.deviceInstance.findFirst({
      where: {
        tenantId,
        serialNumber: n.seriennummer,
        state: { not: "retired" },
      },
    });
    if (bySn) return bySn;
  }
  if (n.inventarnummer) {
    return tx.deviceInstance.findFirst({
      where: {
        tenantId,
        inventoryNumber: n.inventarnummer,
        state: { not: "retired" },
      },
    });
  }
  return null;
}

export type { ImportStats };
