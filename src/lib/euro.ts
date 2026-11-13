/**
 * Shared EUR helpers (quotes, cart, invoices).
 * Accepts DE-style (`1.234,56`) and EN-style (`1,234.56`) input; formats with `Intl`.
 */

const EUR = "EUR" as const;

/** Format a finite amount as euro currency (default `de-DE` → `1.234,56 €`). */
export function formatEuro(amount: number, locale = "de-DE"): string {
  if (!Number.isFinite(amount)) return "";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: EUR,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Number-only euro formatting for inputs (suffix/`€` shown separately). */
export function formatEuroPlain(amount: number, locale = "de-DE"): string {
  if (!Number.isFinite(amount)) return "";
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Parse user/API euro text to a non-negative number with 2 decimal places.
 * Returns `null` for empty or invalid input.
 */
export function parseEuro(raw: string): number | null {
  let s = raw.trim().replace(/\u00a0/g, " ").replace(/\s+/g, "");
  if (!s) return null;
  s = s.replace(/€/g, "").replace(/EUR/gi, "").trim();
  if (!s || !/^\d([0-9.,]*\d)?$|^[.,]\d+$/.test(s)) return null;

  let normalized = s;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // Last separator is decimal: 1.234,56 or 1,234.56
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      normalized = s.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    // 1234,56 or 1.234 → treat comma as decimal when ≤2 digits after
    const parts = s.split(",");
    if (parts.length === 2 && parts[1]!.length <= 2) {
      normalized = `${parts[0]!.replace(/\./g, "")}.${parts[1]}`;
    } else {
      normalized = s.replace(/,/g, "");
    }
  } else if (hasDot) {
    const parts = s.split(".");
    if (parts.length === 2 && parts[1]!.length <= 2) {
      normalized = s;
    } else if (parts.every((p, i) => (i === 0 ? p.length > 0 : p.length === 3))) {
      normalized = s.replace(/\./g, "");
    }
  }

  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

/** True when `raw` parses as a valid euro amount. */
export function isValidEuroInput(raw: string): boolean {
  return parseEuro(raw) != null;
}

/** Parse then format; `null` if invalid. Canonical storage form for amountText. */
export function normalizeEuroText(raw: string, locale = "de-DE"): string | null {
  const n = parseEuro(raw);
  if (n == null) return null;
  return formatEuro(n, locale);
}

/**
 * Display helper for stored amount text (already euro or legacy free text).
 * Prefer formatted euro when parseable.
 */
export function displayEuroText(raw: string | null | undefined, locale = "de-DE"): string {
  if (!raw?.trim()) return "—";
  const formatted = normalizeEuroText(raw, locale);
  return formatted ?? raw.trim();
}
