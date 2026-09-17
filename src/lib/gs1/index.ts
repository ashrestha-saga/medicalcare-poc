/**
 * FA-101 — isomorphic GS1 Application Identifier parser.
 *
 * Pure module: no I/O, no database, no network. Imported by both client
 * components (scan + manual entry) and the /api/resolve route handler, so the
 * browser and server always agree on what an identifier means.
 *
 * Supported Application Identifiers (and only these — Section 17):
 *   01  GTIN (14 digits, fixed)          17  expiry YYMMDD (fixed)
 *   10  lot / batch (variable ≤ 20)      21  serial (variable ≤ 20)
 *   11  production date YYMMDD (fixed)   240 additional product id (variable ≤ 30)
 *   91–99 company-internal (variable ≤ 90, parsed but only surfaced as `extras`)
 *
 * Accepted input syntaxes:
 *   - human readable with parentheses:   (01)04012345678901(21)SN10001
 *   - raw scanner output with FNC1/GS:   ]d20104012345678901\x1D21SN10001
 *   - plain GTIN-8/12/13/14 digit strings
 *   - anything else → kind "unknown" (or "inventory"/"serial" when it looks like one)
 */

import type { IdentifierKind, ParsedIdentifier } from "@/interfaces/resolve";

const GS = "\u001d"; // ASCII group separator, transmitted for FNC1 by most scanners

interface AiSpec {
  ai: string;
  fixedLength?: number;
  maxLength?: number;
}

const AI_TABLE: AiSpec[] = [
  { ai: "01", fixedLength: 14 },
  { ai: "11", fixedLength: 6 },
  { ai: "17", fixedLength: 6 },
  { ai: "10", maxLength: 20 },
  { ai: "21", maxLength: 20 },
  { ai: "240", maxLength: 30 },
  { ai: "91", maxLength: 90 },
  { ai: "92", maxLength: 90 },
  { ai: "93", maxLength: 90 },
  { ai: "94", maxLength: 90 },
  { ai: "95", maxLength: 90 },
  { ai: "96", maxLength: 90 },
  { ai: "97", maxLength: 90 },
  { ai: "98", maxLength: 90 },
  { ai: "99", maxLength: 90 },
];

export interface Gs1Elements {
  [ai: string]: string;
}

/** Collapses whitespace, strips symbology identifiers and normalizes FNC1 representations. */
export function normalizeScannerInput(input: string): string {
  let s = input.normalize("NFKC").trim();
  // Symbology identifiers such as ]d2 (GS1 DataMatrix), ]C1 (GS1-128), ]Q3 (GS1 QR), ]e0 (DataBar)
  s = s.replace(/^\](?:d2|C1|Q3|e0|d1|E0)/i, "");
  // Some keyboard-wedge scanners emit literal "<GS>" / "<FNC1>" / "\x1d" tokens
  s = s.replace(/<GS>|<FNC1>|\\x1d|\\u001d/gi, GS);
  // Collapse any internal whitespace runs; GS1 element strings never contain spaces
  s = s.replace(/\s+/g, "");
  return s;
}

/** Validates the mod-10 check digit of a GTIN (8/12/13/14 digits). */
export function isValidGtinCheckDigit(gtin: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(gtin)) return false;
  const digits = gtin.split("").map(Number);
  const check = digits.pop() as number;
  // Weight 3 applies to the digit immediately left of the check digit, alternating leftwards.
  let sum = 0;
  for (let i = digits.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) {
    sum += digits[i] * w;
  }
  return (10 - (sum % 10)) % 10 === check;
}

/** GTIN-8/12/13 → GTIN-14 by left-padding with zeros. */
export function normalizeGtin(gtin: string): string {
  return gtin.padStart(14, "0");
}

/** Converts a GS1 YYMMDD date to ISO YYYY-MM-DD. DD=00 means "end of month". */
export function gs1DateToIso(yymmdd: string): string | undefined {
  if (!/^\d{6}$/.test(yymmdd)) return undefined;
  const yy = Number(yymmdd.slice(0, 2));
  const mm = Number(yymmdd.slice(2, 4));
  let dd = Number(yymmdd.slice(4, 6));
  if (mm < 1 || mm > 12) return undefined;
  // GS1 general specification: 51-99 → 19xx, 00-50 → 20xx
  const year = yy >= 51 ? 1900 + yy : 2000 + yy;
  if (dd === 0) {
    dd = new Date(Date.UTC(year, mm, 0)).getUTCDate();
  }
  if (dd < 1 || dd > 31) return undefined;
  return `${year}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

function parseParenthesized(s: string): Gs1Elements | null {
  if (!s.startsWith("(")) return null;
  const re = /\((\d{2,4})\)([^(]*)/g;
  const out: Gs1Elements = {};
  let match: RegExpExecArray | null;
  let consumed = 0;
  while ((match = re.exec(s)) !== null) {
    out[match[1]] = match[2];
    consumed = re.lastIndex;
  }
  if (consumed !== s.length || Object.keys(out).length === 0) return null;
  return out;
}

function parseElementString(s: string): Gs1Elements | null {
  const out: Gs1Elements = {};
  let i = 0;
  while (i < s.length) {
    if (s[i] === GS) {
      i++;
      continue;
    }
    const spec = AI_TABLE.find((a) => s.startsWith(a.ai, i));
    if (!spec) return null;
    i += spec.ai.length;
    if (spec.fixedLength !== undefined) {
      const value = s.slice(i, i + spec.fixedLength);
      if (value.length !== spec.fixedLength) return null;
      out[spec.ai] = value;
      i += spec.fixedLength;
    } else {
      const gsIndex = s.indexOf(GS, i);
      const end = gsIndex === -1 ? s.length : gsIndex;
      const value = s.slice(i, end);
      if (value.length === 0 || (spec.maxLength && value.length > spec.maxLength)) return null;
      out[spec.ai] = value;
      i = end;
    }
  }
  return Object.keys(out).length ? out : null;
}

const INVENTORY_PATTERN = /^INV[-_]?\d{3,}$/i;
const SERIAL_PATTERN = /^SN[-_]?[A-Z0-9]{3,}$/i;

function classifyFreeText(raw: string, normalized: string): ParsedIdentifier {
  let kind: IdentifierKind = "unknown";
  if (INVENTORY_PATTERN.test(normalized)) kind = "inventory";
  else if (SERIAL_PATTERN.test(normalized)) kind = "serial";
  return Object.freeze({ raw, kind, text: normalized });
}

function buildFromElements(raw: string, elements: Gs1Elements): ParsedIdentifier | null {
  const gtinRaw = elements["01"];
  const result: {
    raw: string;
    kind: IdentifierKind;
    gtin?: string;
    udiDi?: string;
    lot?: string;
    serial?: string;
    expiry?: string;
    text?: string;
  } = { raw, kind: "unknown" };

  if (gtinRaw !== undefined) {
    if (!isValidGtinCheckDigit(gtinRaw)) return null;
    const gtin = normalizeGtin(gtinRaw);
    result.gtin = gtin;
    // A GS1 GTIN in a medical-device label is the UDI-DI.
    result.udiDi = gtin;
    result.kind = "gtin";
  }
  if (elements["10"]) result.lot = elements["10"];
  if (elements["21"]) result.serial = elements["21"];
  if (elements["17"]) {
    const iso = gs1DateToIso(elements["17"]);
    if (iso) result.expiry = iso;
  }
  if (result.gtin && (result.serial || result.lot || result.expiry)) {
    result.kind = "udi-di";
  }
  if (!result.gtin) return null;
  return Object.freeze(result);
}

/**
 * Parses any scanner or keyboard input into an immutable ParsedIdentifier.
 * Never throws — malformed input yields kind "unknown" with the normalized text.
 */
export function parseIdentifier(input: string): ParsedIdentifier {
  const raw = input;
  const normalized = normalizeScannerInput(input);

  if (normalized.length === 0) {
    return Object.freeze({ raw, kind: "unknown" as IdentifierKind, text: "" });
  }

  // 1. Human readable "(01)...(21)..."
  const paren = parseParenthesized(normalized);
  if (paren) {
    const built = buildFromElements(raw, paren);
    if (built) return built;
    return classifyFreeText(raw, normalized);
  }

  // 2. Plain GTIN-8/12/13/14
  if (/^\d{8}$|^\d{12,14}$/.test(normalized)) {
    if (isValidGtinCheckDigit(normalized)) {
      const gtin = normalizeGtin(normalized);
      return Object.freeze({ raw, kind: "gtin" as IdentifierKind, gtin, udiDi: gtin });
    }
    return classifyFreeText(raw, normalized);
  }

  // 3. Raw element string starting with a known AI (with or without GS separators)
  if (/^(01|11|17|10|21|240|9\d)/.test(normalized)) {
    const elements = parseElementString(normalized);
    if (elements) {
      const built = buildFromElements(raw, elements);
      if (built) return built;
    }
  }

  return classifyFreeText(raw, normalized);
}

/** Stable key for cache/rate-limit purposes: prefers UDI-DI, else the normalized text. */
export function identifierKey(id: ParsedIdentifier): string {
  return id.udiDi ?? id.gtin ?? id.text ?? normalizeScannerInput(id.raw);
}
