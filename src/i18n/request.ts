import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, LOCALE_DEFAULT, isAppLocale, type AppLocale } from "@/lib/locale";

async function loadMessages(locale: AppLocale) {
  switch (locale) {
    case "de":
      return (await import("../../messages/de.json")).default;
    default:
      return (await import("../../messages/en.json")).default;
  }
}

export default getRequestConfig(async () => {
  const jar = await cookies();
  const raw = jar.get(LOCALE_COOKIE)?.value;
  const locale: AppLocale = isAppLocale(raw) ? raw : LOCALE_DEFAULT;
  return {
    locale,
    messages: await loadMessages(locale),
  };
});
