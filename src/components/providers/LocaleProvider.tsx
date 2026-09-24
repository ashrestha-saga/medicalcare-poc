"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import { persistLocale, type AppLocale } from "@/lib/locale";

type LocaleContextValue = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => Promise<void>;
  pending: boolean;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function useLocaleSwitch(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocaleSwitch must be used within LocaleProvider");
  return ctx;
}

async function loadMessages(locale: AppLocale): Promise<AbstractIntlMessages> {
  switch (locale) {
    case "de":
      return (await import("../../../messages/de.json")).default as AbstractIntlMessages;
    default:
      return (await import("../../../messages/en.json")).default as AbstractIntlMessages;
  }
}

/**
 * Client-side locale + messages so language can change without a full page reload
 * (preserves in-memory form state such as the registration wizard).
 */
export function LocaleProvider({
  children,
  initialLocale,
  initialMessages,
}: {
  children: ReactNode;
  initialLocale: AppLocale;
  initialMessages: AbstractIntlMessages;
}) {
  const [locale, setLocaleState] = useState(initialLocale);
  const [messages, setMessages] = useState(initialMessages);
  const [pending, startTransition] = useTransition();

  const setLocale = useCallback(
    async (next: AppLocale) => {
      if (next === locale) return;
      const nextMessages = await loadMessages(next);
      persistLocale(next);
      startTransition(() => {
        setLocaleState(next);
        setMessages(nextMessages);
      });
    },
    [locale],
  );

  const value = useMemo(
    () => ({ locale, setLocale, pending }),
    [locale, setLocale, pending],
  );

  return (
    <LocaleContext.Provider value={value}>
      <NextIntlClientProvider locale={locale} messages={messages}>
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}
