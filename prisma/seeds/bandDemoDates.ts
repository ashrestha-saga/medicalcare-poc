/**
 * Demo due dates for the Today “When it falls due” band:
 * Authority findings + open Field Safety actions with dueAt.
 * Idempotent by stable ids / unique references.
 */
import type { PrismaClient } from "@prisma/client";

function daysFromToday(days: number): Date {
  const d = new Date();
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc;
}

export async function seedBandDemoDates(
  prisma: PrismaClient,
  tenantId: string,
): Promise<{ inspections: number; findings: number; fieldSafety: number }> {
  const inspectionId = `band-insp-${tenantId}`.slice(0, 64);
  await prisma.authorityInspection.upsert({
    where: { id: inspectionId },
    update: {
      authorityName: "Gesundheitsamt Demo",
      visitedAt: daysFromToday(-45),
      protocolReceivedAt: daysFromToday(-30),
      closedAt: null,
    },
    create: {
      id: inspectionId,
      tenantId,
      authorityKind: "health_office",
      authorityName: "Gesundheitsamt Demo",
      visitedAt: daysFromToday(-45),
      protocolReceivedAt: daysFromToday(-30),
      protocolRef: "PROT-BAND-DEMO",
      recordedBy: "seed",
    },
  });

  const findingSpecs = [
    {
      id: `band-find-overdue-${tenantId}`.slice(0, 64),
      itemNo: "1.1",
      description: "MPBetreibV-Nachweis unvollständig — Frist überschritten",
      dueAt: daysFromToday(-12),
      status: "open" as const,
    },
    {
      id: `band-find-soon-${tenantId}`.slice(0, 64),
      itemNo: "2.3",
      description: "Einweisungsnachweis nachreichen",
      dueAt: daysFromToday(18),
      status: "open" as const,
    },
    {
      id: `band-find-later-${tenantId}`.slice(0, 64),
      itemNo: "3.0",
      description: "Bestandsverzeichnis Abgleich mit Behörde",
      dueAt: daysFromToday(55),
      status: "remediated" as const,
    },
  ];

  for (const f of findingSpecs) {
    await prisma.authorityFinding.upsert({
      where: { id: f.id },
      update: {
        description: f.description,
        itemNo: f.itemNo,
        dueAt: f.dueAt,
        status: f.status,
      },
      create: {
        id: f.id,
        tenantId,
        inspectionId,
        itemNo: f.itemNo,
        description: f.description,
        dueAt: f.dueAt,
        status: f.status,
        recordedBy: "seed",
      },
    });
  }

  const fscaSpecs = [
    {
      reference: "FSCA-BAND-OVERDUE",
      title: "Infusionspumpe – Software-Update",
      dueAt: daysFromToday(-5),
      requiredAction: "Softwarestand prüfen und aktualisieren",
    },
    {
      reference: "FSCA-BAND-30",
      title: "Monitor – Kabeltausch",
      dueAt: daysFromToday(21),
      requiredAction: "Betroffene Serien tauschen",
    },
    {
      reference: "FSCA-BAND-LATER",
      title: "Beatmungsgerät – Filterhinweis",
      dueAt: daysFromToday(70),
      requiredAction: "Anwender informieren und dokumentieren",
    },
  ];

  let fieldSafety = 0;
  for (const a of fscaSpecs) {
    await prisma.fieldSafetyAction.upsert({
      where: { tenantId_reference: { tenantId, reference: a.reference } },
      update: {
        title: a.title,
        requiredAction: a.requiredAction,
        dueAt: a.dueAt,
        closedAt: null,
      },
      create: {
        tenantId,
        reference: a.reference,
        manufacturer: "Demo MedTech AG",
        title: a.title,
        requiredAction: a.requiredAction,
        issuedAt: daysFromToday(-40),
        receivedAt: daysFromToday(-35),
        dueAt: a.dueAt,
        affectedScope: "Demo-Modelle aus Seed",
        recordedBy: "seed",
      },
    });
    fieldSafety += 1;
  }

  return { inspections: 1, findings: findingSpecs.length, fieldSafety };
}
