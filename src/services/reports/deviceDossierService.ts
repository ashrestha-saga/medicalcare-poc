/**
 * E106 / RD45 — device dossier ("Gerätemappe") as ZIP: cover PDF + report files + manifest.
 * Logged in ExportLog(kind = dossier).
 */
import { createHash } from "node:crypto";
import type { TenantWorkContext } from "@/interfaces";
import { actorFromContext } from "@/lib/auth/actorContext";
import { requirePermission } from "@/lib/auth/tenantContext";
import { notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { buildStoreZip, type ZipEntry } from "@/lib/zip/storeZip";
import { recordAudit } from "@/services/audit/auditService";
import { readAttachmentBytes } from "@/services/storage/attachmentBlobService";
import { createPdfWriter } from "./pdfText";

const MAX_FILES = 200;

function extFor(contentType: string): string {
  const ct = contentType.toLowerCase();
  if (ct.includes("pdf")) return "pdf";
  if (ct.includes("png")) return "png";
  if (ct.includes("jpeg") || ct.includes("jpg")) return "jpg";
  if (ct.includes("webp")) return "webp";
  return "bin";
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

const ymd = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);

export const deviceDossierService = {
  async exportZip(
    ctx: TenantWorkContext,
    deviceId: string,
  ): Promise<{ body: Buffer; filename: string; fileCount: number; sha256: string; logId: string }> {
    requirePermission(ctx, "export:dossier");

    const device = await prisma.deviceInstance.findFirst({
      where: { id: deviceId },
      include: {
        model: { select: { tradeName: true, modelName: true, manufacturer: true } },
        area: { select: { name: true, site: { select: { name: true } } } },
        duties: {
          where: { applicable: true, suspendedAt: null },
          orderBy: { dueAt: "asc" },
          select: { id: true, title: true, dutyKey: true, dueAt: true, lastCompletedAt: true, provisional: true },
        },
      },
    });
    if (!device) throw notFound("Device not found.");

    const tenant = await prisma.tenant.findUnique({
      where: { id: ctx.tenantId },
      select: { name: true },
    });

    const performances = await prisma.dutyPerformance.findMany({
      where: { deviceDuty: { deviceInstanceId: deviceId } },
      orderBy: [{ performedAt: "desc" }, { recordedAt: "desc" }],
      take: MAX_FILES,
      include: {
        deviceDuty: { select: { title: true, dutyKey: true } },
        inspectionRun: { select: { id: true, reportBlobId: true, reportSha256: true } },
      },
    });

    const now = new Date();
    const files: ZipEntry[] = [];
    const manifest: Array<{ path: string; sha256: string; bytes: number; performanceId: string | null }> = [];

    for (const p of performances) {
      const blobId = p.inspectionRun?.reportBlobId ?? p.attachmentBlobId;
      if (!blobId) continue;
      const stored = await readAttachmentBytes(prisma, blobId);
      if (!stored) continue;
      const folder = p.inspectionRun ? "Berichte" : "Nachweise";
      const path = `${folder}/${ymd(p.performedAt)}_${p.id}.${extFor(stored.contentType)}`;
      files.push({ name: path, data: stored.bytes, modifiedAt: p.recordedAt });
      manifest.push({ path, sha256: sha256Hex(stored.bytes), bytes: stored.bytes.length, performanceId: p.id });
    }

    // Cover document (device master data, duties, performances).
    const label = device.model?.tradeName || device.model?.modelName || device.inventoryNumber;
    const w = await createPdfWriter({
      title: `Gerätemappe ${device.inventoryNumber}`,
      author: ctx.user.name,
      subject: "Gerätemappe",
      date: now,
      footer: `${tenant?.name ?? ""} - Gerätemappe ${device.inventoryNumber}`,
    });
    w.title("Gerätemappe");
    w.line(`${device.inventoryNumber} - ${label}`, { bold: true, size: 12 });
    w.rule();
    w.heading("Stammdaten");
    w.kv("Hersteller", device.model?.manufacturer);
    w.kv("Modell", device.model?.modelName);
    w.kv("Seriennummer", device.serialNumber);
    w.kv("UDI-DI", device.udiDi);
    w.kv(
      "Standort",
      [device.area?.site?.name, device.area?.name, device.room].filter(Boolean).join(" · "),
    );
    w.kv("Status", device.state);
    w.kv("Inbetriebnahme", ymd(device.commissionedAt));
    w.kv("Erstellt am", now.toISOString());
    w.kv("Erstellt von", ctx.user.name);

    w.heading("Pflichten");
    if (device.duties.length === 0) w.line("Keine anwendbaren Pflichten.");
    for (const d of device.duties) {
      w.line(
        `${d.title ?? d.dutyKey}: fällig ${ymd(d.dueAt) ?? "-"}, zuletzt ${ymd(d.lastCompletedAt) ?? "-"}${d.provisional ? " (vorläufig)" : ""}`,
      );
    }

    w.heading("Prüfungen und Nachweise");
    if (performances.length === 0) w.line("Keine Durchführungen erfasst.");
    for (const p of performances) {
      const entry = manifest.find((m) => m.performanceId === p.id);
      w.line(
        `${ymd(p.performedAt)} - ${p.deviceDuty.title ?? p.deviceDuty.dutyKey} - ${p.result} - ${p.performedBy}${p.source === "external" ? " (extern)" : ""}`,
        { bold: true },
      );
      w.line(
        `Bestätigt: ${p.acknowledgedAt ? `${p.acknowledgedBy ?? ""} ${ymd(p.acknowledgedAt)}` : "nein"}${entry ? ` · Datei ${entry.path}` : " · keine Datei"}`,
        { indent: 14, size: 9 },
      );
      if (entry) w.line(`SHA-256 ${entry.sha256}`, { indent: 14, size: 8 });
    }
    const cover = await w.save();
    const coverEntry: ZipEntry = { name: "Gerätemappe.pdf", data: cover, modifiedAt: now };
    files.unshift(coverEntry);
    manifest.unshift({
      path: coverEntry.name,
      sha256: sha256Hex(cover),
      bytes: cover.length,
      performanceId: null,
    });

    const manifestBytes = Buffer.from(
      JSON.stringify(
        {
          kind: "dossier",
          deviceInstanceId: device.id,
          inventoryNumber: device.inventoryNumber,
          generatedAt: now.toISOString(),
          generatedBy: ctx.user.name,
          files: manifest,
        },
        null,
        2,
      ),
      "utf8",
    );
    files.push({ name: "manifest.json", data: manifestBytes, modifiedAt: now });

    const body = buildStoreZip(files, now);
    const sha256 = sha256Hex(body);
    const safeInv = device.inventoryNumber.replace(/[^\w.-]+/g, "_");
    const filename = `Geraetemappe_${safeInv}_${now.toISOString().slice(0, 10)}.zip`;

    const log = await prisma.exportLog.create({
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.user.id,
        format: "zip",
        kind: "dossier",
        deviceInstanceId: device.id,
        filters: JSON.stringify({ deviceInstanceId: device.id }),
        rowCount: files.length,
        sha256,
      },
    });

    await recordAudit({
      actor: actorFromContext(ctx),
      resource: "device_dossier_export",
      resourceId: log.id,
      action: "export",
      summary: `Device dossier ${device.inventoryNumber} (${files.length} files)`,
      after: { format: "zip", fileCount: files.length, sha256, deviceInstanceId: device.id },
    });

    return { body, filename, fileCount: files.length, sha256, logId: log.id };
  },
};
