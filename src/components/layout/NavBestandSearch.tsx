"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQueryParam } from "@/lib/navigation/searchParams";

/**
 * Sidebar Bestand search (v26): type in-field; Enter opens /devices?q=.
 * ⌘/Ctrl+K focuses and selects the field — no modal.
 */
export function NavBestandSearch({
  navOpen,
  onEnsureNavOpen,
}: {
  navOpen: boolean;
  onEnsureNavOpen?: () => void;
}) {
  const t = useTranslations("nav");
  const router = useRouter();
  const pathname = usePathname();
  const qParam = useQueryParam("q");
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pathname.startsWith("/devices")) {
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
    router.push(q ? `/devices?q=${encodeURIComponent(q)}` : "/devices");
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
    <form className="p-nav__search" onSubmit={onSubmit} data-testid="nav-search">
      <span className="p-nav__search-icon" aria-hidden>
        ⌕
      </span>
      <input
        ref={inputRef}
        className="p-nav__search-input"
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onInputKeyDown}
        placeholder={t("searchPlaceholder")}
        aria-label={t("searchBestand")}
        autoComplete="off"
        spellCheck={false}
        data-testid="nav-search-input"
      />
      <kbd className="p-nav__search-kbd" aria-hidden>
        {t("searchShortcut")}
      </kbd>
    </form>
  );
}
