/**
 * Staff skills / qualifications catalogue + sample holds for seeded partner users.
 */
import type { PrismaClient } from "@prisma/client";

const QUALIFICATIONS = [
  { code: "fachkunde_elektro", label: "Elektrofachkraft, Fachkunde nach § 5 MPBetreibV" },
  { code: "messtechnik", label: "Messtechnisch befähigte Person" },
  { code: "fachkunde_strlsch", label: "Fachkunde im Strahlenschutz" },
  { code: "sachverstaendiger", label: "Behördlich bestimmter Sachverständiger" },
  { code: "akkreditierung_val", label: "Akkreditierung als Validierdienstleister" },
] as const;

const SKILLS = [
  { code: "infusion", label: "Infusions- und Spritzenpumpen" },
  { code: "defi", label: "Defibrillatoren und AED" },
  { code: "nibp", label: "Blutdruckmessung, nicht invasiv" },
  { code: "thermometrie", label: "Thermometrie" },
  { code: "ultraschall", label: "Ultraschallsysteme" },
  { code: "roentgen", label: "Röntgen und Durchleuchtung" },
  { code: "sterilisation", label: "Sterilisatoren und Reinigungs-Desinfektionsgeräte" },
  { code: "ergometrie", label: "Ergometrie und Funktionsdiagnostik" },
  { code: "absaugung", label: "Absaug- und Vakuumtechnik" },
  { code: "beatmung", label: "Beatmung und Anästhesie" },
] as const;

const LEVELS = [
  { code: "eingewiesen", label: "Eingewiesen", rank: 1 },
  { code: "geuebt", label: "Geübt", rank: 2 },
  { code: "hersteller", label: "Herstellerschulung", rank: 3 },
] as const;

export async function seedStaffSkillsRefs(prisma: PrismaClient) {
  for (const q of QUALIFICATIONS) {
    await prisma.refQualification.upsert({
      where: { code: q.code },
      update: { label: q.label },
      create: { code: q.code, label: q.label },
    });
  }
  for (const s of SKILLS) {
    await prisma.refSkill.upsert({
      where: { code: s.code },
      update: { label: s.label },
      create: { code: s.code, label: s.label },
    });
  }
  for (const l of LEVELS) {
    await prisma.refSkillLevel.upsert({
      where: { code: l.code },
      update: { label: l.label, rank: l.rank },
      create: { code: l.code, label: l.label, rank: l.rank },
    });
  }

  // Sample holds for J. Reinhardt (from handover testdaten).
  const reinhardtId = "user-partner-msr-reinhardt";
  const existing = await prisma.user.findUnique({ where: { id: reinhardtId } });
  if (!existing) return;

  await prisma.personQualification.upsert({
    where: {
      userId_qualificationCode: { userId: reinhardtId, qualificationCode: "fachkunde_elektro" },
    },
    update: {},
    create: {
      id: "pq-reinhardt-elektro",
      userId: reinhardtId,
      qualificationCode: "fachkunde_elektro",
      validUntil: null,
      evidenceRef: "Nachweis fachkunde_elektro · J. Reinhardt",
      recordedBy: "seed",
    },
  });
  await prisma.personQualification.upsert({
    where: {
      userId_qualificationCode: { userId: reinhardtId, qualificationCode: "fachkunde_strlsch" },
    },
    update: {},
    create: {
      id: "pq-reinhardt-strlsch",
      userId: reinhardtId,
      qualificationCode: "fachkunde_strlsch",
      validUntil: new Date("2027-05-31"),
      evidenceRef: "Nachweis fachkunde_strlsch · J. Reinhardt",
      recordedBy: "seed",
    },
  });
  await prisma.personSkill.upsert({
    where: { userId_skillCode: { userId: reinhardtId, skillCode: "infusion" } },
    update: {},
    create: {
      id: "ps-reinhardt-infusion",
      userId: reinhardtId,
      skillCode: "infusion",
      levelCode: "geuebt",
      validUntil: new Date("2027-12-31"),
      evidenceRef: "Einweisung Infusionspumpen",
      recordedBy: "seed",
    },
  });

  await prisma.orgMembership.updateMany({
    where: { id: "c3801898-f975-5a60-b87c-c34e48a6e50c" },
    data: {
      dispatchOrigin: "home",
      originPostalCode: "53111",
      originCity: "Bonn",
      radiusKm: 80,
    },
  });
}
