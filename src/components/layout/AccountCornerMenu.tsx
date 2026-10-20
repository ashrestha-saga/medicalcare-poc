"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { LocaleToggle } from "@/components/features/shared/LocaleToggle";
import { MenuIcon } from "@/components/layout/navIcons";

/** Status-bar corner menu: 2FA · language · logout. */
export function AccountCornerMenu({
  showSecurity,
  showLogout,
  onSignOut,
  roleText,
}: {
  showSecurity?: boolean;
  showLogout?: boolean;
  onSignOut?: () => void;
  roleText?: string | null;
}) {
  const t = useTranslations("nav");
  const tCap = useTranslations("capturer");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="p-acct-corner" ref={rootRef} data-open={open ? "1" : "0"} data-testid="account-corner-menu">
      <button
        type="button"
        className="p-acct-corner__toggle"
        aria-label={t("accountMenu")}
        aria-expanded={open}
        aria-controls={menuId}
        data-testid="account-corner-toggle"
        onClick={() => setOpen((v) => !v)}
      >
        <MenuIcon />
      </button>
      {open ? (
        <div className="p-acct-corner__panel" id={menuId} role="menu" data-testid="account-corner-panel">
          {roleText ? (
            <p className="p-acct-corner__role" data-testid="user-role">
              {roleText}
            </p>
          ) : null}

          <div className="p-acct-corner__stack">
            {showSecurity ? (
              <Link
                href="/security"
                className="p-acct-corner__btn"
                role="menuitem"
                data-testid="capturer-security-link"
                onClick={() => setOpen(false)}
              >
                <span className="p-acct-corner__btn-k">{tCap("security")}</span>
                <span className="p-acct-corner__btn-v">2FA</span>
              </Link>
            ) : null}

            <div className="p-acct-corner__btn p-acct-corner__btn--locale" role="none">
              <span className="p-acct-corner__btn-k">{t("language")}</span>
              <LocaleToggle className="p-acct-corner__locale-toggle" />
            </div>

            {showLogout && onSignOut ? (
              <button
                type="button"
                className="p-acct-corner__btn p-acct-corner__btn--logout"
                role="menuitem"
                data-testid="sign-out"
                onClick={() => {
                  setOpen(false);
                  onSignOut();
                }}
              >
                <span className="p-acct-corner__btn-k">{t("logout")}</span>
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
