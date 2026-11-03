"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQueryParam } from "@/lib/navigation/searchParams";

/**
 * Partner console nav search (v14-A): type in-field; Enter opens
 * /partner/orders?tab=disposition&q=… and filters disposition assignments.
 * ⌘/Ctrl+K focuses the field — same pattern as clinic NavBestandSearch.
 */
export function NavPartnerSearch({
  navOpen = true,
  onEnsureNavOpen,
}: {
  navOpen?: boolean;
  onEnsureNavOpen?: () => void;
} = {}) {
  const t = useTranslations("console");
  const router = useRouter();
  const pathname = usePathname();
  const qParam = useQueryParam("q");
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pathname.startsWith("/partner/orders")) {
      setValue(qParam ?? "");
    }
  }, [pathname, qParam]);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (!navOpen) onEnsureNavOpen?.();
        window.setTimeout(() => {
          const el = inputRef.current;
          if (!el) return;
          el.focus();
          el.select();
        }, navOpen ? 0 : 220);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navOpen, onEnsureNavOpen]);

  const go = (raw: string) => {
    const q = raw.trim();
    const base = "/partner/orders?tab=disposition";
    router.push(q ? `${base}&q=${encodeURIComponent(q)}` : base);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    go(value);
  };

  const onInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      go(value);
    }
  };

  return (
    <form
      className="mb-3 flex min-h-9 w-full items-center gap-2 rounded-md border border-border bg-background px-2.5 text-[12.5px] shadow-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20"
      onSubmit={onSubmit}
      data-testid="partner-nav-search"
    >
      <span className="shrink-0 text-muted-foreground" aria-hidden>
        ⌕
      </span>
      <input
        ref={inputRef}
        className="min-w-0 flex-1 border-0 bg-transparent py-2 text-foreground outline-none placeholder:text-muted-foreground"
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onInputKeyDown}
        placeholder={t("searchPlaceholder")}
        aria-label={t("searchOrders")}
        autoComplete="off"
        spellCheck={false}
        data-testid="partner-nav-search-input"
      />
      <kbd
        className="pointer-events-none shrink-0 rounded border border-border bg-muted px-1 py-0.5 font-mono text-[9px] font-semibold tracking-wide text-muted-foreground"
        aria-hidden
      >
        {t("searchShortcut")}
      </kbd>
    </form>
  );
}
