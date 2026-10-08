"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useSession } from "@/hooks/useSession";
import { useSessionStore } from "@/store/sessionStore";
import { useSites } from "@/components/hooks/location/useSites";
import { OfflineBar } from "@/components/ui/OfflineBar";
import { LocaleToggle } from "@/components/features/shared/LocaleToggle";
import { PartnerActingBar } from "@/components/layout/PartnerActingBar";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { api } from "@/lib/http/apiClient";
import { useCapturerInventoryUi } from "@/store/capturerInventoryStore";
import {
  CatalogIcon,
  ClarificationsIcon,
  DueDatesIcon,
  InventoryIcon,
  LocationsIcon,
  LogoutIcon,
  ActivityIcon,
  ManagementIcon,
  MenuIcon,
  RegistrationIcon,
  RequestsIcon,
  RolesIcon,
  SecurityIcon,
  SettingsIcon,
  TrainingIcon,
  UsersIcon,
} from "./navIcons";

import type { FormFactor, MenuModule, MenuModuleId } from "@/interfaces";

const CLINIC_NAV_GROUPS = [
  { id: "work" as const, labelKey: "groupWork" as const },
  { id: "master" as const, labelKey: "groupMaster" as const },
  { id: "output" as const, labelKey: "groupOutput" as const },
];

function navItemClass(active: boolean): string {
  return ["p-nav__item", active ? "is-active" : ""].filter(Boolean).join(" ");
}

function AccountBar({
  subtitle,
  showLogout,
  onSignOut,
  showInventory,
  inventoryCount,
  onOpenInventory,
  showSecurity,
}: {
  subtitle?: string;
  showLogout?: boolean;
  onSignOut?: () => void;
  showInventory?: boolean;
  inventoryCount?: number | null;
  onOpenInventory?: () => void;
  showSecurity?: boolean;
}) {
  const t = useTranslations("nav");
  const tCap = useTranslations("capturer");
  const tRoles = useTranslations("roles");
  const user = useSessionStore((s) => s.user);
  const tenantName = useSessionStore((s) => s.tenantName);
  const sites = useSites();
  const site = sites[0];
  const area = site?.areas[0];
  const siteDelivery = site ? (area ? `${site.name} · ${area.name}` : site.name) : null;
  const org = user?.companyName?.trim() || tenantName || null;
  const deliveryLine = user?.deliveryLine || siteDelivery || "—";
  const countLabel = inventoryCount == null ? "…" : String(inventoryCount);
  const roleKey = user?.role;
  const roleText = roleKey ? tRoles(roleKey) : "—";

  return (
    <div className="p-acctbar on">
      <div className="a">
        <b data-testid="current-user">
          {user?.name}
          {org ? ` · ${org}` : ""}
        </b>
        <span>{subtitle ?? t("delivery", { line: deliveryLine })}</span>
      </div>
      {showInventory && onOpenInventory && (
        <button
          type="button"
          className="k p-acctbar__inventory"
          onClick={onOpenInventory}
          data-testid="capturer-inventory-button"
          title={tCap("buttonTitle")}
        >
          {tCap("button")}
          <span className="p-acctbar__inventory-count">{countLabel}</span>
        </button>
      )}
      {showSecurity && (
        <Link href="/security" className="k" data-testid="capturer-security-link" title={tCap("security")}>
          2FA
        </Link>
      )}
      <span className="k" data-testid="user-role">
        {roleText}
      </span>
      <LocaleToggle />
      {showLogout && (
        <button type="button" className="k" onClick={onSignOut} data-testid="sign-out" title={t("logout")}>
          {t("logout")}
        </button>
      )}
    </div>
  );
}

function NavIcon({ id }: { id: MenuModuleId }) {
  if (id === "registration") return <RegistrationIcon />;
  if (id === "due-dates") return <DueDatesIcon />;
  if (id === "training") return <TrainingIcon />;
  if (id === "catalog") return <CatalogIcon />;
  if (id === "clarifications") return <ClarificationsIcon />;
  if (id === "requests") return <RequestsIcon />;
  if (id === "users") return <UsersIcon />;
  if (id === "locations") return <LocationsIcon />;
  if (id === "roles") return <RolesIcon />;
  if (id === "management") return <ManagementIcon />;
  if (id === "activity") return <ActivityIcon />;
  if (id === "security") return <SecurityIcon />;
  if (id === "settings") return <SettingsIcon />;
  return <InventoryIcon />;
}

function isNavActive(id: MenuModuleId, pathname: string): boolean {
  if (id === "inventory") return pathname.startsWith("/devices");
  if (id === "registration") return pathname.startsWith("/registration");
  if (id === "due-dates") return pathname.startsWith("/due-dates");
  if (id === "training") return pathname.startsWith("/training");
  if (id === "catalog") return pathname.startsWith("/catalog");
  if (id === "clarifications") return pathname.startsWith("/clarifications");
  if (id === "requests") return pathname.startsWith("/requests");
  if (id === "users") return pathname.startsWith("/users");
  if (id === "locations") return pathname.startsWith("/locations");
  if (id === "roles") return pathname.startsWith("/roles");
  if (id === "management") return pathname.startsWith("/management");
  if (id === "activity") return pathname.startsWith("/activity");
  if (id === "security") return pathname.startsWith("/security");
  if (id === "settings") return pathname.startsWith("/settings");
  return false;
}

function NavLink({
  item,
  pathname,
  label,
}: {
  item: MenuModule;
  pathname: string;
  label: string;
}) {
  const active = isNavActive(item.id, pathname);
  return (
    <Link
      href={item.href}
      className={navItemClass(active)}
      aria-current={active ? "page" : undefined}
      title={label}
      data-testid={`nav-${item.id}`}
    >
      <NavIcon id={item.id} />
      <span className="p-nav__label">{label}</span>
    </Link>
  );
}

/**
 * Shared authenticated chrome: collapsible left nav + account strip.
 * Nav rail requires `shell:nav`; without it, Logout lives in the account bar.
 */
export function AppShell({
  children,
  form = "phone",
  accountSubtitle,
  testId,
}: {
  children: ReactNode;
  form?: FormFactor;
  accountSubtitle?: string;
  testId?: string;
}) {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { signOut } = useSession();
  const { permissionData, checkPermission } = usePermissions();
  useOnlineStatus();

  const showNav = checkPermission("shell:nav");
  const showCapturerInventory = !showNav && checkPermission("inventory:view");
  const showCapturerSecurity = !showNav && checkPermission("account:security");
  const inventoryCount = useCapturerInventoryUi((s) => s.count);
  const openInventory = useCapturerInventoryUi((s) => s.openPanel);
  const setInventoryCount = useCapturerInventoryUi((s) => s.setCount);
  const menu = showNav ? (permissionData?.menu ?? []) : [];
  const primary = menu.filter((m) => m.id !== "settings");
  const settingsItem = menu.find((m) => m.id === "settings");
  const settingsActive = Boolean(settingsItem && isNavActive("settings", pathname));
  const grouped = CLINIC_NAV_GROUPS.map((g) => ({
    ...g,
    items: primary.filter((m) => m.group === g.id),
  })).filter((g) => g.items.length > 0);
  const ungrouped = primary.filter(
    (m) => !m.group || !CLINIC_NAV_GROUPS.some((g) => g.id === m.group),
  );

  useEffect(() => {
    if (!showCapturerInventory) return;
    let alive = true;
    void api<{ devices: { id: string }[] }>("/api/devices")
      .then((res) => {
        if (alive) setInventoryCount(res.devices.length);
      })
      .catch(() => {
        if (alive) setInventoryCount(0);
      });
    return () => {
      alive = false;
    };
  }, [showCapturerInventory, setInventoryCount]);

  return (
    <div
      className={["p-screen", showNav ? "p-screen--nav" : ""].filter(Boolean).join(" ")}
      data-form={form}
      data-nav={showNav ? (open ? "open" : "collapsed") : undefined}
      data-testid={testId}
    >
      {showNav && (
        <>
          <button
            type="button"
            className="p-nav-toggle"
            aria-label={open ? t("collapse") : t("expand")}
            aria-expanded={open}
            data-testid="nav-toggle"
            onClick={() => setOpen((v) => !v)}
          >
            <MenuIcon />
          </button>

          <aside className="p-nav" aria-label={t("main")} data-testid="app-nav">
            <nav className="p-nav__primary">
              {grouped.map((g) => (
                <div key={g.id} className="p-nav__group" data-testid={`nav-group-${g.id}`}>
                  <p className="p-nav__group-label">{t(g.labelKey)}</p>
                  {g.items.map((item) => (
                    <NavLink
                      key={item.id}
                      item={item}
                      pathname={pathname}
                      label={t(item.id as "inventory")}
                    />
                  ))}
                </div>
              ))}
              {ungrouped.map((item) => (
                <NavLink
                  key={item.id}
                  item={item}
                  pathname={pathname}
                  label={t(item.id as "inventory")}
                />
              ))}
            </nav>

            <div className="p-nav__secondary">
              {settingsItem && (
                <Link
                  href={settingsItem.href}
                  className={navItemClass(settingsActive)}
                  title={t("settings")}
                  data-testid="settings-button"
                  aria-current={settingsActive ? "page" : undefined}
                >
                  <SettingsIcon />
                  <span className="p-nav__label">{t("settings")}</span>
                </Link>
              )}
              <button
                type="button"
                className={navItemClass(false)}
                title={t("logout")}
                data-testid="sign-out"
                onClick={() => void signOut()}
              >
                <LogoutIcon />
                <span className="p-nav__label">{t("logout")}</span>
              </button>
            </div>
          </aside>
        </>
      )}

      <div className="p-screen-body">
        <PartnerActingBar />
        <AccountBar
          subtitle={accountSubtitle}
          showLogout={!showNav}
          onSignOut={() => void signOut()}
          showInventory={showCapturerInventory}
          inventoryCount={inventoryCount}
          onOpenInventory={openInventory}
          showSecurity={showCapturerSecurity}
        />
        <OfflineBar />
        {children}
      </div>
    </div>
  );
}
