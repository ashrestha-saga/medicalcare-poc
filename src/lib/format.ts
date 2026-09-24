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
