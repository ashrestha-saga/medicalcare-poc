import { intlLocale, type AppLocale } from "@/lib/locale";

export function formatDate(iso: string | null | undefined, locale: AppLocale, opts?: Intl.DateTimeFormatOptions): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(intlLocale(locale), opts ?? {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export function formatDateTime(iso: string | null | undefined, locale: AppLocale): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(intlLocale(locale), {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** Parse disposition appointment input (date, datetime-local, or ISO) to a Date. */
export function parseAppointmentInput(value: string | null | undefined): Date | null {
  const v = value?.trim();
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    return new Date(`${v}T09:00:00.000Z`);
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) {
    return new Date(`${v}:00.000Z`);
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(v)) {
    return new Date(`${v}.000Z`);
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Value for `<input type="datetime-local">` from an ISO / date string. */
export function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso?.trim()) return "";
  const raw = iso.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw}T09:00`;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
