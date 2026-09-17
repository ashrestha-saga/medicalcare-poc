import type { ServiceRequestDTO, SessionUser } from "@/interfaces";
import type {
  ServiceDispatchArticle,
  ServiceDispatchContext,
  ServiceDispatchEmail,
  ServiceDispatchExport,
} from "@/interfaces/serviceDispatch";
import { prisma } from "@/lib/prisma";

const DASH = "—";

function dash(value: string | null | undefined): string {
  const t = value?.trim();
  return t ? t : DASH;
}

function nullish(value: string | null | undefined): string | null {
  const t = value?.trim();
  return t ? t : null;
}

/** Split FA-500 locationText produced by buildLocationText(site, area, room). */
export function splitLocationText(
  locationText: string,
  siteName?: string | null,
): { site: string | null; area: string | null; room: string | null } {
  const parts = locationText
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return { site: null, area: null, room: null };
  if (siteName && parts[0] === siteName) {
    return { site: parts[0] ?? null, area: parts[1] ?? null, room: parts.slice(2).join(", ") || null };
  }
  if (parts.length === 1) return { site: parts[0] ?? null, area: null, room: null };
  if (parts.length === 2) return { site: parts[0] ?? null, area: parts[1] ?? null, room: null };
  return { site: parts[0] ?? null, area: parts[1] ?? null, room: parts.slice(2).join(", ") || null };
}

export function herkunftLabel(source: ServiceDispatchArticle["source"]): string {
  switch (source) {
    case "inventory":
      return "Gerätebestand";
    case "catalog":
    case "oxid-catalog":
      return "Artikelstamm (GTIN/UDI)";
    case "beudamed":
      return "BEUDAMED · EUDAMED-Spiegelung";
    case "manual":
      return "Manuell erfasst";
    default:
      return "Unbekannt";
  }
}

export function herkunftLabelEn(source: ServiceDispatchArticle["source"]): string {
  switch (source) {
    case "inventory":
      return "Equipment inventory";
    case "catalog":
    case "oxid-catalog":
      return "Article master (GTIN/UDI)";
    case "beudamed":
      return "BEUDAMED · EUDAMED mirror";
    case "manual":
      return "Manually captured";
    default:
      return "Unknown";
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function htmlDash(value: string | null | undefined): string {
  return escapeHtml(dash(value));
}

function htmlMultiline(value: string | null | undefined): string {
  const t = value?.trim();
  if (!t) return escapeHtml(DASH);
  return escapeHtml(t).replace(/\n/g, "<br>");
}

function locationHtml(site: string | null, area: string | null, room: string | null): string {
  const parts = [site, area, room].filter(Boolean) as string[];
  if (parts.length === 0) return escapeHtml(DASH);
  const [first, ...rest] = parts;
  let html = `<strong>${escapeHtml(first)}</strong>`;
  for (const p of rest) {
    html += `<span style="color:#607d8b;"> · </span>${escapeHtml(p)}`;
  }
  return html;
}

function classificationNote(
  request: ServiceRequestDTO,
  article: ServiceDispatchArticle,
): { confirmed: boolean; note: string | null } {
  const confirmed = Boolean(request.classification?.confirmed);
  if (!article.name && !article.number) {
    return { confirmed, note: "keine Modelldaten" };
  }
  if (request.classification?.overridden) {
    return { confirmed, note: "Vorschlag überschrieben" };
  }
  if (request.classification?.proposed && !confirmed) {
    return { confirmed, note: "Vorschlag nicht bestätigt" };
  }
  return { confirmed, note: null };
}

async function resolveArticle(request: ServiceRequestDTO): Promise<{
  article: ServiceDispatchArticle;
  deviceName: string | null;
  deviceCode: string | null;
  inventoryNumber: string | null;
  serialNumber: string | null;
  inventoryLocation: string | null;
}> {
  if (request.subjectType === "instance") {
    const row = await prisma.deviceInstance.findUnique({
      where: { id: request.subjectId },
      include: { model: true, area: { include: { site: true } } },
    });
    const model = row?.model;
    let gtins: string[] = [];
    try {
      gtins = model?.gtins ? (JSON.parse(model.gtins) as string[]) : [];
    } catch {
      gtins = [];
    }
    const name = model?.tradeName ?? model?.modelName ?? row?.inventoryNumber ?? null;
    const code = model?.udiDi ?? gtins[0] ?? row?.serialNumber ?? row?.inventoryNumber ?? null;
    const locParts = [row?.area?.site?.name, row?.area?.name, row?.room].filter(Boolean);
    return {
      article: {
        source: "inventory",
        name,
        manufacturer: model?.manufacturer ?? null,
        number: code,
        numberType: model?.udiDi ? "udi-di" : code ? "inventory" : null,
        articleId: model?.id ?? null,
      },
      deviceName: name,
      deviceCode: code,
      inventoryNumber: row?.inventoryNumber ?? null,
      serialNumber: row?.serialNumber ?? null,
      inventoryLocation: locParts.length ? locParts.join(" · ") : null,
    };
  }

  if (request.subjectType === "model") {
    const model = await prisma.deviceModel.findUnique({ where: { id: request.subjectId } });
    if (model) {
      let gtins: string[] = [];
      try {
        gtins = model.gtins ? (JSON.parse(model.gtins) as string[]) : [];
      } catch {
        gtins = [];
      }
      const code = model.udiDi ?? gtins[0] ?? null;
      const source: ServiceDispatchArticle["source"] = model.source === "beudamed" ? "beudamed" : "catalog";
      return {
        article: {
          source,
          name: model.tradeName ?? model.modelName,
          manufacturer: model.manufacturer,
          number: code,
          numberType: model.udiDi ? "udi-di" : code ? "gtin" : null,
          articleId: model.id,
        },
        deviceName: model.tradeName ?? model.modelName,
        deviceCode: code,
        inventoryNumber: null,
        serialNumber: null,
        inventoryLocation: null,
      };
    }
    return {
      article: {
        source: "oxid-catalog",
        name: null,
        manufacturer: null,
        number: null,
        numberType: null,
        articleId: request.subjectId,
      },
      deviceName: null,
      deviceCode: null,
      inventoryNumber: null,
      serialNumber: null,
      inventoryLocation: null,
    };
  }

  if (request.subjectType === "captured") {
    const cap = await prisma.capturedArticle.findUnique({ where: { id: request.subjectId } });
    return {
      article: {
        source: "manual",
        name: cap?.name ?? null,
        manufacturer: cap?.manufacturer ?? null,
        number: cap?.number ?? null,
        numberType: cap?.numberType ?? null,
        articleId: cap?.id ?? null,
      },
      deviceName: cap?.name ?? null,
      deviceCode: cap?.number ?? null,
      inventoryNumber: null,
      serialNumber: null,
      inventoryLocation: null,
    };
  }

  return {
    article: { source: "unknown", name: null, manufacturer: null, number: null, numberType: null, articleId: null },
    deviceName: null,
    deviceCode: null,
    inventoryNumber: null,
    serialNumber: null,
    inventoryLocation: null,
  };
}

export function contextFromUser(user?: SessionUser | null): ServiceDispatchContext {
  return {
    customerNumber: user?.customerNumber ?? null,
    companyName: user?.companyName ?? null,
    deliveryLine: user?.deliveryLine ?? null,
  };
}

export function formatKundeLine(ctx: ServiceDispatchContext): string {
  const parts = [ctx.customerNumber?.trim(), ctx.companyName?.trim()].filter(Boolean);
  return parts.length ? parts.join(" ") : DASH;
}

export async function buildServiceDispatchExport(
  request: ServiceRequestDTO,
  ctx: ServiceDispatchContext = {},
): Promise<ServiceDispatchExport> {
  const siteRow = request.siteId
    ? await prisma.site.findUnique({ where: { id: request.siteId }, select: { name: true, address: true } })
    : null;
  const { site, area, room } = splitLocationText(request.locationText, siteRow?.name);
  const resolved = await resolveArticle(request);
  const classification = classificationNote(request, resolved.article);

  return {
    reference: request.reference,
    customer: nullish(ctx.customerNumber),
    shipTo: nullish(ctx.deliveryLine) ?? nullish(request.deliveryAddress),
    deviceCode: resolved.deviceCode,
    deviceName: resolved.deviceName,
    inventoryNumber: resolved.inventoryNumber,
    serialNumber: resolved.serialNumber,
    location: resolved.inventoryLocation,
    service: request.serviceType,
    note: nullish(request.note),
    classification,
    site: site ?? siteRow?.name ?? null,
    area,
    room,
    accessHint: nullish(request.accessHint),
    deliveryAddress: request.deliveryAddress,
    article: resolved.article,
    raisedBy: request.raisedBy,
    createdAt: request.createdAt,
  };
}

export function formatServiceRequestEmailHtml(
  exportBody: ServiceDispatchExport,
  ctx: ServiceDispatchContext = {},
): string {
  const title = dash(exportBody.deviceName ?? exportBody.article.name);
  const kunde = formatKundeLine(ctx);
  const code = dash(exportBody.deviceCode ?? exportBody.article.number);
  const item = dash(exportBody.article.name ?? exportBody.deviceName);
  const placeOfUse = [exportBody.site, exportBody.area, exportBody.room].filter(Boolean).join(" · ") || DASH;
  const origin = herkunftLabelEn(exportBody.article.source);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(`Service Request - ${title}`)}</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f6f8; font-family:Arial, Helvetica, sans-serif; color:#263238;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f6f8; padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:720px; background-color:#ffffff; border-radius:10px; overflow:hidden;">
          <tr>
            <td style="background-color:#17324d; padding:28px 32px;">
              <div style="font-size:13px; color:#b9c9d8; text-transform:uppercase; letter-spacing:1px; font-weight:bold;">
                Service Request
              </div>
              <div style="font-size:13px; color:#9eb3c4; margin-top:6px; font-family:Consolas, Monaco, monospace;">
                ${escapeHtml(exportBody.reference)}
              </div>
              <div style="font-size:24px; line-height:32px; color:#ffffff; font-weight:bold; margin-top:8px;">
                ${escapeHtml(title)}
              </div>
              <div style="font-size:14px; color:#dce6ee; margin-top:8px;">
                Equipment service request · ${escapeHtml(exportBody.service)}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 12px 32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td width="50%" valign="top" style="padding-bottom:20px;">
                    <div style="font-size:12px; color:#78909c; text-transform:uppercase; font-weight:bold;">Customer</div>
                    <div style="font-size:15px; color:#263238; font-weight:bold; margin-top:5px;">${escapeHtml(kunde)}</div>
                  </td>
                  <td width="50%" valign="top" style="padding-bottom:20px;">
                    <div style="font-size:12px; color:#78909c; text-transform:uppercase; font-weight:bold;">Reporter</div>
                    <div style="font-size:15px; color:#263238; font-weight:bold; margin-top:5px;">${htmlDash(exportBody.raisedBy)}</div>
                  </td>
                </tr>
                <tr>
                  <td width="50%" valign="top">
                    <div style="font-size:12px; color:#78909c; text-transform:uppercase; font-weight:bold;">Service</div>
                    <div style="font-size:15px; color:#263238; font-weight:bold; margin-top:5px;">${escapeHtml(exportBody.service)}</div>
                  </td>
                  <td width="50%" valign="top">
                    <div style="font-size:12px; color:#78909c; text-transform:uppercase; font-weight:bold;">Identifier</div>
                    <div style="font-size:15px; color:#263238; font-weight:bold; margin-top:5px;">${escapeHtml(code)}</div>
                  </td>
                </tr>
                ${
                  exportBody.inventoryNumber || exportBody.serialNumber
                    ? `<tr>
                  <td width="50%" valign="top" style="padding-top:20px;">
                    <div style="font-size:12px; color:#78909c; text-transform:uppercase; font-weight:bold;">Inventory No.</div>
                    <div style="font-size:15px; color:#263238; font-weight:bold; margin-top:5px; font-family:Consolas, Monaco, monospace;">${htmlDash(exportBody.inventoryNumber)}</div>
                  </td>
                  <td width="50%" valign="top" style="padding-top:20px;">
                    <div style="font-size:12px; color:#78909c; text-transform:uppercase; font-weight:bold;">Serial No.</div>
                    <div style="font-size:15px; color:#263238; font-weight:bold; margin-top:5px; font-family:Consolas, Monaco, monospace;">${htmlDash(exportBody.serialNumber)}</div>
                  </td>
                </tr>`
                    : ""
                }
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 8px 32px;">
              <div style="font-size:12px; color:#78909c; text-transform:uppercase; font-weight:bold; margin-bottom:8px;">Location</div>
              <div style="background-color:#f1f5f8; border-left:4px solid #2f80ed; padding:14px 16px; font-size:15px; line-height:22px;">
                ${locationHtml(exportBody.site, exportBody.area, exportBody.room)}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px 32px;">
              <div style="font-size:18px; color:#17324d; font-weight:bold; margin-bottom:14px;">Equipment Details</div>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #e1e7eb; border-radius:8px; overflow:hidden;">
                <tr>
                  <td style="padding:12px 14px; background-color:#f8fafb; width:35%; font-size:13px; color:#607d8b; border-bottom:1px solid #e1e7eb;">Item</td>
                  <td style="padding:12px 14px; font-size:14px; color:#263238; border-bottom:1px solid #e1e7eb;">${escapeHtml(item)}</td>
                </tr>
                <tr>
                  <td style="padding:12px 14px; background-color:#f8fafb; font-size:13px; color:#607d8b; border-bottom:1px solid #e1e7eb;">Manufacturer</td>
                  <td style="padding:12px 14px; font-size:14px; color:#263238; border-bottom:1px solid #e1e7eb;">${htmlDash(exportBody.article.manufacturer)}</td>
                </tr>
                <tr>
                  <td style="padding:12px 14px; background-color:#f8fafb; font-size:13px; color:#607d8b; border-bottom:1px solid #e1e7eb;">Number</td>
                  <td style="padding:12px 14px; font-size:14px; color:#263238; border-bottom:1px solid #e1e7eb;">${escapeHtml(code)}</td>
                </tr>
                ${
                  exportBody.inventoryNumber
                    ? `<tr>
                  <td style="padding:12px 14px; background-color:#f8fafb; font-size:13px; color:#607d8b; border-bottom:1px solid #e1e7eb;">Inventory No.</td>
                  <td style="padding:12px 14px; font-size:14px; color:#263238; border-bottom:1px solid #e1e7eb; font-family:Consolas, Monaco, monospace;">${escapeHtml(exportBody.inventoryNumber)}</td>
                </tr>`
                    : ""
                }
                ${
                  exportBody.serialNumber
                    ? `<tr>
                  <td style="padding:12px 14px; background-color:#f8fafb; font-size:13px; color:#607d8b; border-bottom:1px solid #e1e7eb;">Serial No.</td>
                  <td style="padding:12px 14px; font-size:14px; color:#263238; border-bottom:1px solid #e1e7eb; font-family:Consolas, Monaco, monospace;">${escapeHtml(exportBody.serialNumber)}</td>
                </tr>`
                    : ""
                }
                <tr>
                  <td style="padding:12px 14px; background-color:#f8fafb; font-size:13px; color:#607d8b; border-bottom:1px solid #e1e7eb;">Place of use</td>
                  <td style="padding:12px 14px; font-size:14px; color:#263238; border-bottom:1px solid #e1e7eb;">${escapeHtml(placeOfUse)}</td>
                </tr>
                <tr>
                  <td style="padding:12px 14px; background-color:#f8fafb; font-size:13px; color:#607d8b;">Access note</td>
                  <td style="padding:12px 14px; font-size:14px; color:#263238;">${htmlDash(exportBody.accessHint)}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px 32px;">
              <div style="font-size:18px; color:#17324d; font-weight:bold; margin-bottom:14px;">Request Information</div>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td width="50%" valign="top" style="padding-right:10px;">
                    <div style="font-size:12px; color:#78909c; text-transform:uppercase; font-weight:bold;">Origin</div>
                    <div style="font-size:14px; margin-top:5px;">${escapeHtml(origin)}</div>
                  </td>
                  <td width="50%" valign="top" style="padding-left:10px;">
                    <div style="font-size:12px; color:#78909c; text-transform:uppercase; font-weight:bold;">Note</div>
                    <div style="font-size:14px; margin-top:5px; color:#607d8b;">${htmlDash(exportBody.note)}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px 32px;">
              <div style="font-size:18px; color:#17324d; font-weight:bold; margin-bottom:14px;">Delivery Information</div>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="padding:14px 16px; background-color:#f8fafb; border:1px solid #e1e7eb;">
                    <div style="font-size:12px; color:#78909c; text-transform:uppercase; font-weight:bold;">Delivery Address</div>
                    <div style="font-size:14px; line-height:21px; margin-top:6px;">${htmlMultiline(exportBody.deliveryAddress)}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px; background-color:#f8fafb; border-top:1px solid #e5eaee;">
              <div style="font-size:13px; color:#607d8b; line-height:20px;">
                This email was generated automatically from the equipment inventory system.
                Please use the information above when processing this service request.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function formatServiceRequestEmail(
  exportBody: ServiceDispatchExport,
  to: string,
  ctx: ServiceDispatchContext = {},
): ServiceDispatchEmail {
  const subject = `Serviceanforderung ${exportBody.reference} — ${exportBody.service}`;
  const einsatzort = [exportBody.site, exportBody.area, exportBody.room].filter(Boolean).join(" · ") || DASH;
  const kunde = formatKundeLine(ctx);

  const body = [
    `Gerät:  ${dash(exportBody.deviceName)}`,
    `Kennung:      ${dash(exportBody.deviceCode)}`,
    ...(exportBody.inventoryNumber || exportBody.serialNumber
      ? [
          `Inventarnummer: ${dash(exportBody.inventoryNumber)}`,
          `Seriennummer:   ${dash(exportBody.serialNumber)}`,
        ]
      : []),
    `Standort:     ${exportBody.location == null ? "null" : dash(exportBody.location)}`,
    `Leistung:     ${exportBody.service}`,
    `Hinweis:    ${dash(exportBody.note)}`,
    `Kunde:    ${kunde}`,
    `Melder:      ${dash(exportBody.raisedBy)}`,
    `Herkunft:  ${herkunftLabel(exportBody.article.source)}`,
    `Artikel:    ${dash(exportBody.article.name)}`,
    `Hersteller:   ${dash(exportBody.article.manufacturer)}`,
    `Nummer:  ${dash(exportBody.article.number)}`,
    `Einsatzort:  ${einsatzort}`,
    `Zugangshinweis: ${dash(exportBody.accessHint)}`,
    `Lieferanschrift: ${dash(exportBody.deliveryAddress)}`,
  ].join("\n");

  return {
    to,
    subject,
    body,
    html: formatServiceRequestEmailHtml(exportBody, ctx),
  };
}
