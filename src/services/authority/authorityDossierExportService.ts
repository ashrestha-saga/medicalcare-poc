import { createHash } from "node:crypto";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import type { TenantWorkContext } from "@/interfaces";
import { actorFromContext } from "@/lib/auth/actorContext";
import { requirePermission } from "@/lib/auth/tenantContext";
import { notFound } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import {
  DOSSIER_SECTION_KEYS,
  dossierSectionLabel,
  isDossierSectionKey,
  type DossierSectionKey,
} from "@/constants/authorityDossier";
import type { DossierPdfInput } from "@/schemas/k10";
import { recordAudit } from "@/services/audit/auditService";
import {
  authorityPreparationService,
  type PreparationItemDTO,
  type PrepItemState,
} from "@/services/authority/authorityPreparationService";

/** A4 points */
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 44;
const MARGIN_TOP = 48;
const MARGIN_BOTTOM = 44;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const FOOTER_Y = 26;

const C = {
  ink: rgb(0.12, 0.13, 0.15),
  muted: rgb(0.42, 0.44, 0.48),
  faint: rgb(0.62, 0.64, 0.68),
  rule: rgb(0.88, 0.89, 0.91),
  ruleStrong: rgb(0.78, 0.8, 0.83),
  surface: rgb(0.965, 0.968, 0.972),
  accent: rgb(0.12, 0.35, 0.42),
  ready: rgb(0.12, 0.48, 0.32),
  readyBg: rgb(0.9, 0.96, 0.92),
  gap: rgb(0.72, 0.28, 0.18),
  gapBg: rgb(0.98, 0.93, 0.91),
  external: rgb(0.45, 0.38, 0.18),
  externalBg: rgb(0.97, 0.95, 0.88),
  white: rgb(1, 1, 1),
} as const;

type PdfCtx = {
  doc: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  fontBold: PDFFont;
  y: number;
  locale: "de" | "en";
};

function t(s: string, max = 140): string {
  const cleaned = (s ?? "").replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1)}…`;
}

function ensureSpace(ctx: PdfCtx, need: number) {
  if (ctx.y - need >= MARGIN_BOTTOM + 12) return;
  ctx.page = ctx.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  ctx.y = PAGE_HEIGHT - MARGIN_TOP;
}

function drawText(
  ctx: PdfCtx,
  content: string,
  opts: {
    x?: number;
    size?: number;
    bold?: boolean;
    color?: RGB;
    maxWidth?: number;
  } = {},
) {
  const size = opts.size ?? 10;
  const x = opts.x ?? MARGIN_X;
  ctx.page.drawText(content, {
    x,
    y: ctx.y - size,
    size,
    font: opts.bold ? ctx.fontBold : ctx.font,
    color: opts.color ?? C.ink,
    maxWidth: opts.maxWidth ?? CONTENT_WIDTH,
  });
}

function advance(ctx: PdfCtx, amount: number) {
  ctx.y -= amount;
}

function hairline(ctx: PdfCtx, color: RGB = C.rule, inset = 0) {
  ctx.page.drawLine({
    start: { x: MARGIN_X + inset, y: ctx.y },
    end: { x: MARGIN_X + CONTENT_WIDTH - inset, y: ctx.y },
    thickness: 0.6,
    color,
  });
}

function statusMeta(
  state: PrepItemState,
  locale: "de" | "en",
  gapCount?: number,
  externalReady?: boolean,
): { label: string; fg: RGB; bg: RGB } {
  if (state === "ready") {
    return {
      label: locale === "de" ? "Bereit" : "Ready",
      fg: C.ready,
      bg: C.readyBg,
    };
  }
  if (state === "gap") {
    const n = gapCount && gapCount > 0 ? ` (${gapCount})` : "";
    return {
      label: (locale === "de" ? "Lücke" : "Gap") + n,
      fg: C.gap,
      bg: C.gapBg,
    };
  }
  if (externalReady) {
    return {
      label: locale === "de" ? "Außerhalb · bereit" : "Outside · ready",
      fg: C.ready,
      bg: C.readyBg,
    };
  }
  return {
    label: locale === "de" ? "Außerhalb" : "Outside",
    fg: C.external,
    bg: C.externalBg,
  };
}

/** Pill badge; returns width drawn. Text baseline is at ctx.y - size (caller manages y). */
function drawBadge(
  page: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
  opts: {
    x: number;
    baselineY: number;
    label: string;
    fg: RGB;
    bg: RGB;
    size?: number;
  },
): number {
  const size = opts.size ?? 7.5;
  const padX = 5;
  const padY = 2.5;
  const label = t(opts.label, 28);
  const tw = fontBold.widthOfTextAtSize(label, size);
  const w = tw + padX * 2;
  const h = size + padY * 2;
  const boxY = opts.baselineY - size - padY + 1;
  page.drawRectangle({
    x: opts.x,
    y: boxY,
    width: w,
    height: h,
    color: opts.bg,
    borderColor: opts.fg,
    borderWidth: 0.4,
  });
  page.drawText(label, {
    x: opts.x + padX,
    y: opts.baselineY - size,
    size,
    font: fontBold,
    color: opts.fg,
  });
  return w;
}

function sectionTitle(ctx: PdfCtx, title: string, subtitle?: string) {
  ensureSpace(ctx, 40);
  advance(ctx, 10);
  drawText(ctx, t(title, 80), { size: 12, bold: true, color: C.ink });
  advance(ctx, 16);
  if (subtitle) {
    drawText(ctx, t(subtitle, 100), { size: 8.5, color: C.muted });
    advance(ctx, 12);
  }
  hairline(ctx, C.ruleStrong);
  advance(ctx, 10);
}

function metaRow(ctx: PdfCtx, label: string, value: string) {
  ensureSpace(ctx, 16);
  drawText(ctx, label, { size: 8.5, color: C.muted, maxWidth: 120 });
  drawText(ctx, t(value, 90), {
    x: MARGIN_X + 118,
    size: 9.5,
    bold: true,
    color: C.ink,
    maxWidth: CONTENT_WIDTH - 118,
  });
  advance(ctx, 16);
}

function progressBar(
  ctx: PdfCtx,
  progress: { ready: number; gap: number; external: number; total: number },
) {
  const total = Math.max(progress.total, 1);
  const barH = 8;
  const barW = CONTENT_WIDTH;
  ensureSpace(ctx, 28);
  const y = ctx.y - barH;
  ctx.page.drawRectangle({
    x: MARGIN_X,
    y,
    width: barW,
    height: barH,
    color: C.surface,
  });
  let x = MARGIN_X;
  const segs: { n: number; color: RGB }[] = [
    { n: progress.ready, color: C.ready },
    { n: progress.external, color: C.external },
    { n: progress.gap, color: C.gap },
  ];
  for (const seg of segs) {
    if (seg.n <= 0) continue;
    const w = (seg.n / total) * barW;
    ctx.page.drawRectangle({ x, y, width: Math.max(w, 0.5), height: barH, color: seg.color });
    x += w;
  }
  advance(ctx, barH + 10);
}

function legendChips(ctx: PdfCtx, progress: { ready: number; gap: number; external: number }) {
  ensureSpace(ctx, 22);
  const locale = ctx.locale;
  const chips: { label: string; fg: RGB; bg: RGB }[] = [
    {
      label: `${progress.ready} ${locale === "de" ? "bereit" : "ready"}`,
      fg: C.ready,
      bg: C.readyBg,
    },
    {
      label: `${progress.gap} ${locale === "de" ? "Lücke" : "gap"}`,
      fg: C.gap,
      bg: C.gapBg,
    },
    {
      label: `${progress.external} ${locale === "de" ? "außerhalb" : "outside"}`,
      fg: C.external,
      bg: C.externalBg,
    },
  ];
  let x = MARGIN_X;
  const baseline = ctx.y - 8;
  for (const chip of chips) {
    const w = drawBadge(ctx.page, ctx.font, ctx.fontBold, {
      x,
      baselineY: baseline,
      label: chip.label,
      fg: chip.fg,
      bg: chip.bg,
      size: 8,
    });
    x += w + 8;
  }
  advance(ctx, 22);
}

function drawCover(
  ctx: PdfCtx,
  opts: {
    title: string;
    tenantName: string;
    checklistLabel: string;
    checklistCode: string;
    siteLabel: string;
    generatedAt: string;
    progress: { ready: number; gap: number; external: number; total: number };
  },
) {
  // Accent strip at top of page
  ctx.page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 6,
    width: PAGE_WIDTH,
    height: 6,
    color: C.accent,
  });

  advance(ctx, 8);
  drawText(ctx, ctx.locale === "de" ? "DEVICECARE" : "DEVICECARE", {
    size: 8,
    bold: true,
    color: C.accent,
  });
  advance(ctx, 14);

  drawText(ctx, opts.title, { size: 22, bold: true, color: C.ink });
  advance(ctx, 28);
  hairline(ctx, C.accent);
  advance(ctx, 18);

  metaRow(ctx, ctx.locale === "de" ? "Einrichtung" : "Organisation", opts.tenantName);
  metaRow(ctx, ctx.locale === "de" ? "Prüfliste" : "Checklist", `${opts.checklistCode} · ${opts.checklistLabel}`);
  metaRow(ctx, ctx.locale === "de" ? "Standort" : "Site", opts.siteLabel);
  metaRow(ctx, ctx.locale === "de" ? "Erzeugt" : "Generated", opts.generatedAt);

  advance(ctx, 8);
  drawText(ctx, ctx.locale === "de" ? "Vorbereitungsstand" : "Preparation status", {
    size: 9,
    bold: true,
    color: C.muted,
  });
  advance(ctx, 14);
  progressBar(ctx, opts.progress);
  legendChips(ctx, opts.progress);

  // Soft summary card
  ensureSpace(ctx, 56);
  const cardH = 48;
  const cardY = ctx.y - cardH;
  ctx.page.drawRectangle({
    x: MARGIN_X,
    y: cardY,
    width: CONTENT_WIDTH,
    height: cardH,
    color: C.surface,
  });
  const pct = opts.progress.total
    ? Math.round((opts.progress.ready / opts.progress.total) * 100)
    : 0;
  ctx.page.drawText(String(pct) + "%", {
    x: MARGIN_X + 16,
    y: cardY + 18,
    size: 20,
    font: ctx.fontBold,
    color: C.accent,
  });
  ctx.page.drawText(
    ctx.locale === "de" ? "der Prüfpunkte bereit" : "of checklist items ready",
    {
      x: MARGIN_X + 78,
      y: cardY + 22,
      size: 10,
      font: ctx.font,
      color: C.ink,
    },
  );
  ctx.page.drawText(
    ctx.locale === "de"
      ? `${opts.progress.ready} von ${opts.progress.total} Punkten`
      : `${opts.progress.ready} of ${opts.progress.total} items`,
    {
      x: MARGIN_X + 78,
      y: cardY + 10,
      size: 8.5,
      font: ctx.font,
      color: C.muted,
    },
  );
  advance(ctx, cardH + 16);
}

type Col = { key: string; label: string; width: number; align?: "left" | "right" };

function tableHeader(ctx: PdfCtx, cols: Col[]) {
  ensureSpace(ctx, 22);
  const rowH = 18;
  const y = ctx.y - rowH;
  ctx.page.drawRectangle({
    x: MARGIN_X,
    y,
    width: CONTENT_WIDTH,
    height: rowH,
    color: C.surface,
  });
  let x = MARGIN_X + 6;
  for (const col of cols) {
    ctx.page.drawText(col.label, {
      x,
      y: y + 5,
      size: 7.5,
      font: ctx.fontBold,
      color: C.muted,
      maxWidth: col.width - 8,
    });
    x += col.width;
  }
  ctx.y = y;
  hairline(ctx, C.ruleStrong);
  advance(ctx, 4);
}

function prepTable(
  ctx: PdfCtx,
  items: PreparationItemDTO[],
) {
  const locale = ctx.locale;
  const cols: Col[] = [
    { key: "pos", label: "#", width: 28 },
    {
      key: "label",
      label: locale === "de" ? "Prüfpunkt" : "Item",
      width: 220,
    },
    {
      key: "section",
      label: locale === "de" ? "Abschnitt" : "Section",
      width: 130,
    },
    {
      key: "status",
      label: locale === "de" ? "Status" : "Status",
      width: CONTENT_WIDTH - 28 - 220 - 130,
    },
  ];

  tableHeader(ctx, cols);

  for (const item of items) {
    const meta = statusMeta(
      item.state,
      locale,
      item.gapCount,
      item.readiness?.externalReady,
    );
    const section = item.mapsToSection
      ? dossierSectionLabel(item.mapsToSection, locale)
      : "—";
    const hasDetail = Boolean(item.legalBasis || item.readiness?.documentRef);
    const rowH = hasDetail ? 28 : 18;
    ensureSpace(ctx, rowH + 6);

    const top = ctx.y;
    const baseline = top - 11;
    let x = MARGIN_X + 6;

    ctx.page.drawText(String(item.position), {
      x,
      y: baseline,
      size: 8,
      font: ctx.font,
      color: C.faint,
      maxWidth: cols[0]!.width - 6,
    });
    x += cols[0]!.width;

    ctx.page.drawText(t(item.label, 48), {
      x,
      y: baseline,
      size: 8.5,
      font: ctx.font,
      color: C.ink,
      maxWidth: cols[1]!.width - 8,
    });
    x += cols[1]!.width;

    ctx.page.drawText(t(section, 28), {
      x,
      y: baseline,
      size: 8,
      font: ctx.font,
      color: C.muted,
      maxWidth: cols[2]!.width - 8,
    });
    x += cols[2]!.width;

    drawBadge(ctx.page, ctx.font, ctx.fontBold, {
      x,
      baselineY: baseline + 1,
      label: meta.label,
      fg: meta.fg,
      bg: meta.bg,
    });

    if (hasDetail) {
      const detailParts: string[] = [];
      if (item.legalBasis) detailParts.push(item.legalBasis);
      if (item.readiness?.documentRef) {
        detailParts.push(
          locale === "de"
            ? `Ablage: ${item.readiness.documentRef}`
            : `Filing: ${item.readiness.documentRef}`,
        );
      }
      ctx.page.drawText(t(detailParts.join(" · "), 100), {
        x: MARGIN_X + cols[0]!.width + 6,
        y: top - 22,
        size: 7,
        font: ctx.font,
        color: C.faint,
        maxWidth: CONTENT_WIDTH - cols[0]!.width - 12,
      });
    }

    advance(ctx, rowH);
    hairline(ctx, C.rule);
    advance(ctx, 2);
  }
}

function inventoryTable(
  ctx: PdfCtx,
  devices: Array<{
    inventoryNumber: string | null;
    model: {
      manufacturer: string | null;
      modelName: string | null;
      tradeName: string | null;
    } | null;
    area: { name: string; site: { name: string } | null } | null;
  }>,
) {
  const locale = ctx.locale;
  const cols: Col[] = [
    { key: "inv", label: locale === "de" ? "Inv.-Nr." : "Inv. no.", width: 72 },
    { key: "mfr", label: locale === "de" ? "Hersteller" : "Manufacturer", width: 110 },
    { key: "model", label: locale === "de" ? "Modell" : "Model", width: 140 },
    { key: "site", label: locale === "de" ? "Standort" : "Site", width: 90 },
    {
      key: "area",
      label: locale === "de" ? "Bereich" : "Area",
      width: CONTENT_WIDTH - 72 - 110 - 140 - 90,
    },
  ];

  tableHeader(ctx, cols);

  for (const d of devices) {
    ensureSpace(ctx, 16);
    const baseline = ctx.y - 10;
    const cells = [
      d.inventoryNumber ?? "—",
      d.model?.manufacturer ?? "—",
      d.model?.modelName ?? d.model?.tradeName ?? "—",
      d.area?.site?.name ?? "—",
      d.area?.name ?? "—",
    ];
    let x = MARGIN_X + 6;
    for (let i = 0; i < cols.length; i += 1) {
      const col = cols[i]!;
      ctx.page.drawText(t(cells[i] ?? "—", 36), {
        x,
        y: baseline,
        size: 8,
        font: ctx.font,
        color: C.ink,
        maxWidth: col.width - 8,
      });
      x += col.width;
    }
    advance(ctx, 14);
    hairline(ctx, C.rule);
    advance(ctx, 2);
  }
}

function sectionExcerpt(ctx: PdfCtx, key: DossierSectionKey, items: PreparationItemDTO[]) {
  sectionTitle(ctx, dossierSectionLabel(key, ctx.locale));
  if (items.length === 0) {
    ensureSpace(ctx, 16);
    drawText(
      ctx,
      ctx.locale === "de"
        ? "Kein Prüfpunkt dieser Liste mappt auf diesen Abschnitt."
        : "No checklist item on this list maps to this section.",
      { size: 9, color: C.muted },
    );
    advance(ctx, 16);
    return;
  }

  for (const item of items) {
    const meta = statusMeta(
      item.state,
      ctx.locale,
      item.gapCount,
      item.readiness?.externalReady,
    );
    ensureSpace(ctx, 20);
    const baseline = ctx.y - 10;
    ctx.page.drawText(`${item.position}.`, {
      x: MARGIN_X,
      y: baseline,
      size: 8.5,
      font: ctx.fontBold,
      color: C.faint,
    });
    const badgeLabel = t(meta.label, 28);
    const badgeTw = ctx.fontBold.widthOfTextAtSize(badgeLabel, 7.5);
    const badgeW = badgeTw + 10;
    ctx.page.drawText(t(item.label, 70), {
      x: MARGIN_X + 22,
      y: baseline,
      size: 9,
      font: ctx.font,
      color: C.ink,
      maxWidth: CONTENT_WIDTH - 28 - badgeW - 12,
    });
    drawBadge(ctx.page, ctx.font, ctx.fontBold, {
      x: MARGIN_X + CONTENT_WIDTH - badgeW,
      baselineY: baseline + 1,
      label: badgeLabel,
      fg: meta.fg,
      bg: meta.bg,
    });
    advance(ctx, 16);
    hairline(ctx, C.rule);
    advance(ctx, 4);
  }

  ensureSpace(ctx, 14);
  drawText(
    ctx,
    ctx.locale === "de"
      ? "Auszug aus der Vorbereitung — Detailnachweise in DeviceCare."
      : "Excerpt from preparation — detailed evidence lives in DeviceCare.",
    { size: 7.5, color: C.faint },
  );
  advance(ctx, 14);
}

function applyFooters(ctx: PdfCtx, label: string) {
  const pages = ctx.doc.getPages();
  const total = pages.length;
  for (let i = 0; i < total; i += 1) {
    const page = pages[i]!;
    page.drawLine({
      start: { x: MARGIN_X, y: FOOTER_Y + 12 },
      end: { x: MARGIN_X + CONTENT_WIDTH, y: FOOTER_Y + 12 },
      thickness: 0.5,
      color: C.rule,
    });
    page.drawText(t(label, 60), {
      x: MARGIN_X,
      y: FOOTER_Y,
      size: 7.5,
      font: ctx.font,
      color: C.faint,
    });
    const pageLabel = `${i + 1} / ${total}`;
    const tw = ctx.font.widthOfTextAtSize(pageLabel, 7.5);
    page.drawText(pageLabel, {
      x: MARGIN_X + CONTENT_WIDTH - tw,
      y: FOOTER_Y,
      size: 7.5,
      font: ctx.font,
      color: C.faint,
    });
  }
}

export const authorityDossierExportService = {
  async exportPdf(
    ctx: TenantWorkContext,
    input: DossierPdfInput,
  ): Promise<{ body: Buffer; filename: string; rowCount: number; sha256: string }> {
    requirePermission(ctx, "authority:view");

    const locale = input.locale ?? "en";
    const prep = await authorityPreparationService.preparation(
      ctx as Parameters<typeof authorityPreparationService.preparation>[0],
      input.list,
    );

    const tenant = await prisma.tenant.findFirst({
      where: { id: ctx.tenantId },
      select: { name: true },
    });
    if (!tenant) throw notFound("Tenant not found");

    const site = input.siteId
      ? await prisma.site.findFirst({
          where: { id: input.siteId },
          select: { id: true, name: true },
        })
      : null;

    const fromChecklist = new Set(
      prep.items
        .map((i) => i.mapsToSection)
        .filter((k): k is DossierSectionKey => Boolean(k && isDossierSectionKey(k))),
    );
    const requested = input.sections?.length
      ? new Set(input.sections.filter(isDossierSectionKey))
      : null;
    /** Default: checklist-mapped sections + inventory; optional request overrides. */
    const orderedSections = DOSSIER_SECTION_KEYS.filter((k) => {
      if (requested) return requested.has(k);
      return k === "deckblatt" || k === "bestandsverzeichnis" || fromChecklist.has(k);
    });

    const devices = await prisma.deviceInstance.findMany({
      where: {
        state: "released",
        ...(input.siteId ? { area: { siteId: input.siteId } } : {}),
      },
      include: {
        model: { select: { manufacturer: true, modelName: true, tradeName: true } },
        area: { include: { site: { select: { name: true } } } },
      },
      orderBy: [{ inventoryNumber: "asc" }],
      take: 500,
    });

    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const pdfCtx: PdfCtx = {
      doc,
      page: doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]),
      font,
      fontBold,
      y: PAGE_HEIGHT - MARGIN_TOP,
      locale,
    };

    const generatedAt = new Date().toISOString().slice(0, 16).replace("T", " ");
    const title =
      locale === "de" ? "Begehungsmappe" : "Authority dossier";
    const siteLabel =
      site?.name ??
      (locale === "de" ? "Alle Standorte" : "All sites");

    drawCover(pdfCtx, {
      title,
      tenantName: tenant.name,
      checklistLabel: prep.checklistLabel,
      checklistCode: prep.checklistCode,
      siteLabel,
      generatedAt,
      progress: prep.progress,
    });

    // Fresh page for preparation table
    pdfCtx.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pdfCtx.y = PAGE_HEIGHT - MARGIN_TOP;

    sectionTitle(
      pdfCtx,
      locale === "de" ? "Vorbereitung" : "Preparation",
      locale === "de"
        ? "Prüfpunkte der ausgewählten Liste"
        : "Checklist items for the selected list",
    );
    prepTable(pdfCtx, prep.items);

    if (prep.unmapped.length > 0) {
      sectionTitle(
        pdfCtx,
        locale === "de" ? "Weitere offene Zustände" : "Further open conditions",
      );
      for (const u of prep.unmapped) {
        ensureSpace(pdfCtx, 16);
        drawText(pdfCtx, t(`${u.label} (${u.count})`, 90), {
          size: 9,
          color: C.ink,
        });
        advance(pdfCtx, 14);
        hairline(pdfCtx);
        advance(pdfCtx, 4);
      }
    }

    if (orderedSections.includes("bestandsverzeichnis")) {
      sectionTitle(
        pdfCtx,
        locale === "de" ? "Bestandsverzeichnis" : "Inventory",
        locale === "de"
          ? `${devices.length} freigegebene Geräte`
          : `${devices.length} released devices`,
      );
      if (devices.length === 0) {
        drawText(
          pdfCtx,
          locale === "de" ? "Keine freigegebenen Geräte." : "No released devices.",
          { size: 9, color: C.muted },
        );
        advance(pdfCtx, 14);
      } else {
        inventoryTable(pdfCtx, devices);
        if (devices.length >= 500) {
          ensureSpace(pdfCtx, 14);
          drawText(
            pdfCtx,
            locale === "de"
              ? "Hinweis: auf 500 Geräte begrenzt."
              : "Note: capped at 500 devices.",
            { size: 7.5, color: C.faint },
          );
          advance(pdfCtx, 12);
        }
      }
    }

    for (const key of orderedSections) {
      if (key === "bestandsverzeichnis" || key === "deckblatt") continue;
      const itemsInSection = prep.items.filter((i) => i.mapsToSection === key);
      sectionExcerpt(pdfCtx, key, itemsInSection);
    }

    const footerLabel =
      locale === "de"
        ? `Begehungsmappe · ${prep.checklistCode} · DeviceCare`
        : `Authority dossier · ${prep.checklistCode} · DeviceCare`;
    applyFooters(pdfCtx, footerLabel);

    const body = Buffer.from(await doc.save());
    const sha256 = createHash("sha256").update(body).digest("hex");
    const rowCount = prep.items.length + devices.length;
    const filterJson = JSON.stringify({
      kind: "authority_dossier",
      list: input.list,
      siteId: input.siteId ?? null,
      sections: orderedSections,
      locale,
    });

    const log = await prisma.exportLog.create({
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.user.id,
        format: "pdf",
        filters: filterJson,
        rowCount,
        sha256,
      },
    });

    await recordAudit({
      actor: actorFromContext(ctx),
      resource: "authority_dossier_export",
      resourceId: log.id,
      action: "export",
      summary:
        locale === "de"
          ? `Begehungsmappe PDF (${prep.checklistCode})`
          : `Authority dossier PDF (${prep.checklistCode})`,
      after: { format: "pdf", rowCount, sha256, filters: filterJson },
    });

    const date = new Date().toISOString().slice(0, 10);
    const filename =
      locale === "de"
        ? `Begehungsmappe_${prep.checklistCode}_${date}.pdf`
        : `Authority_dossier_${prep.checklistCode}_${date}.pdf`;

    return { body, filename, rowCount, sha256 };
  },
};
