import JsBarcode from "jsbarcode";
import type { InventoryLabelData } from "@/lib/inventory/label";

const IFRAME_ID = "inventory-label-print-frame";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** CODE128 SVG for the inventory number (payload scanners resolve). */
function barcodeSvgMarkup(inventoryNumber: string): string {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  JsBarcode(svg, inventoryNumber, {
    format: "CODE128",
    displayValue: false,
    margin: 4,
    width: 1.6,
    height: 44,
    background: "#ffffff",
    lineColor: "#111111",
  });
  svg.setAttribute("class", "label-barcode");
  svg.setAttribute("aria-hidden", "true");
  return svg.outerHTML;
}

function labelHtml(label: InventoryLabelData): string {
  const serialBlock = label.serialNumber
    ? `<div class="label-serial">SN: ${escapeHtml(label.serialNumber)}</div>`
    : "";
  const dueBlock = label.maintenanceDueLabel
    ? `<div class="label-due">Due: ${escapeHtml(label.maintenanceDueLabel)}</div>`
    : "";
  return `
    <article class="label">
      <div class="label-name">${escapeHtml(label.name)}</div>
      ${barcodeSvgMarkup(label.inventoryNumber)}
      <div class="label-inv">${escapeHtml(label.inventoryNumber)}</div>
      ${serialBlock}
      ${dueBlock}
    </article>
  `;
}

const PRINT_STYLES = `
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: #fff;
    color: #111;
    font-family: "IBM Plex Sans", "Segoe UI", Helvetica, Arial, sans-serif;
  }
  body { padding: 8mm; }
  h1 {
    font-size: 14px;
    font-weight: 600;
    margin: 0 0 12px;
  }
  .sheet {
    display: flex;
    flex-wrap: wrap;
    gap: 4mm;
    align-content: flex-start;
  }
  .label {
    width: 54mm;
    min-height: 28mm;
    padding: 2.5mm 3mm;
    border: 0.3mm solid #ccc;
    border-radius: 1mm;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 1mm;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .label-name {
    font-size: 9pt;
    font-weight: 600;
    line-height: 1.2;
    max-height: 2.4em;
    overflow: hidden;
  }
  .label-barcode {
    width: 100%;
    height: auto;
    max-height: 14mm;
  }
  .label-inv {
    font-family: ui-monospace, Consolas, Monaco, monospace;
    font-size: 9pt;
    font-weight: 600;
    letter-spacing: 0.02em;
  }
  .label-serial {
    font-family: ui-monospace, Consolas, Monaco, monospace;
    font-size: 8pt;
    color: #333;
  }
  .label-due {
    font-size: 8pt;
    font-weight: 600;
    color: #111;
  }
  @media print {
    body { padding: 4mm; }
    h1 { display: none; }
    .label { border-color: #999; }
  }
`;

function getOrCreatePrintFrame(): HTMLIFrameElement {
  let frame = document.getElementById(IFRAME_ID) as HTMLIFrameElement | null;
  if (!frame) {
    frame = document.createElement("iframe");
    frame.id = IFRAME_ID;
    frame.title = "Inventory label print";
    frame.setAttribute("aria-hidden", "true");
    Object.assign(frame.style, {
      position: "fixed",
      right: "0",
      bottom: "0",
      width: "0",
      height: "0",
      border: "0",
      opacity: "0",
      pointerEvents: "none",
    });
    document.body.appendChild(frame);
  }
  return frame;
}

/**
 * Prints inventory stickers via a hidden iframe (no popup window).
 * Barcode encodes inventoryNumber only (matches inventory scan lookup).
 */
export function printInventoryLabels(labels: InventoryLabelData[]): boolean {
  if (typeof window === "undefined" || typeof document === "undefined" || labels.length === 0) {
    return false;
  }

  const title =
    labels.length === 1
      ? `Label — ${labels[0].inventoryNumber}`
      : `Inventory labels (${labels.length})`;

  const frame = getOrCreatePrintFrame();
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) return false;

  const body = labels.map(labelHtml).join("\n");
  doc.open();
  doc.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>${PRINT_STYLES}</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="sheet">${body}</div>
</body>
</html>`);
  doc.close();

  // Let the iframe finish layout before opening the system print dialog.
  const triggerPrint = () => {
    try {
      win.focus();
      win.print();
    } catch {
      // Ignore — some browsers throw if print is cancelled mid-call.
    }
  };

  if (doc.readyState === "complete") {
    setTimeout(triggerPrint, 50);
  } else {
    frame.onload = () => setTimeout(triggerPrint, 50);
  }

  return true;
}
