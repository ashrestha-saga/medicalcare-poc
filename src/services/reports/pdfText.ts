/**
 * Tiny text-layout helper over pdf-lib (A4, Helvetica, WinAnsi-safe).
 * Shared by the inspection report and the device dossier cover document.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 48;

export type PdfWriter = {
  doc: PDFDocument;
  heading(text: string): void;
  title(text: string): void;
  line(text: string, opts?: { bold?: boolean; size?: number; indent?: number; gap?: number }): void;
  kv(label: string, value: string | null | undefined): void;
  rule(): void;
  space(h?: number): void;
  save(): Promise<Uint8Array>;
};

/** Replace characters the standard font cannot encode (keeps output deterministic). */
export function pdfSafe(font: PDFFont, text: string): string {
  const out: string[] = [];
  for (const ch of text.replace(/\r\n?/g, "\n")) {
    if (ch === "\n") {
      out.push(" ");
      continue;
    }
    try {
      font.encodeText(ch);
      out.push(ch);
    } catch {
      out.push("?");
    }
  }
  return out.join("");
}

function wrap(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    let word = w;
    // Hard-split overlong tokens (hashes, URLs).
    while (font.widthOfTextAtSize(word, size) > maxWidth && word.length > 1) {
      let cut = word.length - 1;
      while (cut > 1 && font.widthOfTextAtSize(word.slice(0, cut), size) > maxWidth) cut -= 1;
      if (cur) {
        lines.push(cur);
        cur = "";
      }
      lines.push(word.slice(0, cut));
      word = word.slice(cut);
    }
    const next = cur ? `${cur} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) cur = next;
    else {
      if (cur) lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

export async function createPdfWriter(meta: {
  title: string;
  author: string;
  subject: string;
  /** Fixed timestamp so identical input renders byte-identical output. */
  date: Date;
  footer: string;
}): Promise<PdfWriter> {
  const doc = await PDFDocument.create();
  doc.setTitle(meta.title);
  doc.setAuthor(meta.author);
  doc.setSubject(meta.subject);
  doc.setCreator("DeviceCare");
  doc.setProducer("DeviceCare / pdf-lib");
  doc.setCreationDate(meta.date);
  doc.setModificationDate(meta.date);

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page: PDFPage = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;
  const footer = pdfSafe(regular, meta.footer);

  function ensure(h: number) {
    if (y - h < MARGIN + 14) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  }

  function draw(text: string, size: number, font: PDFFont, indent: number, gap: number) {
    const safe = pdfSafe(font, text);
    const lines = wrap(font, safe, size, PAGE_W - 2 * MARGIN - indent);
    for (const l of lines) {
      ensure(size + gap);
      page.drawText(l, { x: MARGIN + indent, y: y - size, size, font, color: rgb(0.1, 0.1, 0.1) });
      y -= size + gap;
    }
  }

  const writer: PdfWriter = {
    doc,
    title(text) {
      draw(text, 18, bold, 0, 6);
    },
    heading(text) {
      y -= 8;
      draw(text, 12, bold, 0, 4);
    },
    line(text, opts) {
      draw(text, opts?.size ?? 10, opts?.bold ? bold : regular, opts?.indent ?? 0, opts?.gap ?? 3);
    },
    kv(label, value) {
      const v = value && value.trim() ? value : "-";
      draw(`${label}: ${v}`, 10, regular, 0, 3);
    },
    rule() {
      ensure(8);
      page.drawLine({
        start: { x: MARGIN, y: y - 2 },
        end: { x: PAGE_W - MARGIN, y: y - 2 },
        thickness: 0.5,
        color: rgb(0.6, 0.6, 0.6),
      });
      y -= 8;
    },
    space(h = 6) {
      y -= h;
    },
    async save() {
      const pages = doc.getPages();
      pages.forEach((p, i) => {
        p.drawText(`${footer}  -  ${i + 1}/${pages.length}`, {
          x: MARGIN,
          y: MARGIN - 20,
          size: 8,
          font: regular,
          color: rgb(0.45, 0.45, 0.45),
        });
      });
      return doc.save({ useObjectStreams: false });
    },
  };
  return writer;
}
