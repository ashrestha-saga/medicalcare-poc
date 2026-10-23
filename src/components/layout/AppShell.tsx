"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useSession } from "@/hooks/useSession";
import { useSessionStore } from "@/store/sessionStore";
import { useSites } from "@/components/hooks/location/useSites";
import { OfflineBar } from "@/components/ui/OfflineBar";
import { LocaleToggle } from "@/components/features/shared/LocaleToggle";
import { AccountCornerMenu } from "@/components/layout/AccountCornerMenu";
import { PartnerActingBar } from "@/components/layout/PartnerActingBar";
import { NavBestandSearch } from "@/components/layout/NavBestandSearch";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { api } from "@/lib/http/apiClient";
import { ScanTabBar } from "@/components/features/scan/ScanTabBar";
import { useCapturerInventoryUi } from "@/store/capturerInventoryStore";
import { useCapturerScanNav } from "@/store/capturerScanNavStore";
import { useSetupProgress } from "@/components/hooks/nav/useSetupProgress";
import {
  ActivityIcon,
  AuthorityIcon,
  CatalogIcon,
  ClarificationsIcon,
  ConstancyIcon,
  DashboardIcon,
  DeviceBookIcon,
  DueDatesIcon,
  DutyOverlapIcon,
  FieldSafetyIcon,
  IncidentsIcon,
  InventoryIcon,
  LocationsIcon,
  LogoutIcon,
  ManagementIcon,
  NavCollapseIcon,
  NavExpandIcon,
  RegistrationIcon,
  ReprocessingIcon,
  RequestsIcon,
  RolesIcon,
  SecurityIcon,
  SettingsIcon,
  TrainingIcon,
  UsersIcon,
} from "./navIcons";

import type { FormFactor, MenuModule, MenuModuleId } from "@/interfaces";
import { APP_HOME_PATH } from "@/constants/permissions";
import { MENU_ID_TO_NAV_COUNT, type NavCountEntry, type NavCountsResponse } from "@/constants/navCounts";
import { useNavCounts } from "@/components/hooks/nav/useNavCounts";

/** Group order and labels match mockup v26 (`Überblick` … `Verwaltung`). */
const CLINIC_NAV_GROUPS = [
  { id: "overview" as const, labelKey: "groupOverview" as const, collapsible: false },
  { id: "devices" as const, labelKey: "groupDevices" as const, collapsible: false },
  { id: "records" as const, labelKey: "groupRecords" as const, collapsible: false },
  { id: "reports" as const, labelKey: "groupReports" as const, collapsible: false },
  { id: "admin" as const, labelKey: "groupAdmin" as const, collapsible: true },
] as const;

const ADMIN_COLLAPSE_KEY = "dc.nav.adminCollapsed";

function GroupChevron({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      className="p-nav__group-chevron"
      viewBox="0 0 16 16"
      aria-hidden
      data-collapsed={collapsed ? "true" : "false"}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

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
  showDeviceBook,
  showHome,
  showScanTabs,
  useCornerMenu,
}: {
  subtitle?: string;
  showLogout?: boolean;
  onSignOut?: () => void;
  showInventory?: boolean;
  inventoryCount?: number | null;
  onOpenInventory?: () => void;
  showSecurity?: boolean;
  showDeviceBook?: boolean;
  showHome?: boolean;
  /** Desktop capturer: Scan · Today · Inventory · Batches pills in the status bar. */
  showScanTabs?: boolean;
  /** Capturer chrome: 2FA / language / logout in hamburger corner menu. */
  useCornerMenu?: boolean;
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
  const scanTabs = useCapturerScanNav((s) => s.tabs);
  const scanActive = useCapturerScanNav((s) => s.active);
  const setScanActive = useCapturerScanNav((s) => s.setActive);
  const scanNavReady = showScanTabs && scanTabs.length > 0;

  return (
    <div className={["p-acctbar", "on", scanNavReady ? "p-acctbar--scan-tabs" : ""].filter(Boolean).join(" ")}>
      <div className="a">
        <b data-testid="current-user">
          {user?.name}
          {org ? ` · ${org}` : ""}
        </b>
        <span>{subtitle ?? t("delivery", { line: deliveryLine })}</span>
      </div>
      <div className="p-acctbar__right">
        {scanNavReady ? (
          <ScanTabBar variant="top" tabs={scanTabs} active={scanActive} onChange={setScanActive} />
        ) : null}
        {showHome && (
          <Link href={APP_HOME_PATH} className="k" data-testid="capturer-home-link" title={t("home")}>
            {t("home")}
          </Link>
        )}
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
        {useCornerMenu ? (
          <AccountCornerMenu
            showSecurity={showSecurity}
            showDeviceBook={showDeviceBook}
            showLogout={showLogout}
            onSignOut={onSignOut}
            roleText={roleText}
          />
        ) : (
          <>
            {showDeviceBook && (
              <Link
                href="/device-book"
                className="k"
                data-testid="capturer-device-book-link"
                title={tCap("deviceBook")}
              >
                {t("device-book")}
              </Link>
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
          </>
        )}
      </div>
    </div>
  );
}

function NavIcon({ id }: { id: MenuModuleId }) {
  if (id === "dashboard") return <DashboardIcon />;
  if (id === "inventory") return <InventoryIcon />;
  if (id === "registration") return <RegistrationIcon />;
  if (id === "due-dates") return <DueDatesIcon />;
  if (id === "duty-overlap") return <DutyOverlapIcon />;
  if (id === "training") return <TrainingIcon />;
  if (id === "catalog") return <CatalogIcon />;
  if (id === "clarifications") return <ClarificationsIcon />;
  if (id === "requests") return <RequestsIcon />;
  if (id === "device-book") return <DeviceBookIcon />;
  if (id === "incidents") return <IncidentsIcon />;
  if (id === "field-safety") return <FieldSafetyIcon />;
  if (id === "reprocessing") return <ReprocessingIcon />;
  if (id === "constancy-cadence") return <ConstancyIcon />;
  if (id === "authority") return <AuthorityIcon />;
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
  if (id === "dashboard") {
    return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  }
  if (id === "inventory") return pathname.startsWith("/devices");
  if (id === "registration") return pathname.startsWith("/registration");
  if (id === "due-dates") return pathname.startsWith("/due-dates");
  if (id === "duty-overlap") return pathname.startsWith("/duty-overlap");
  if (id === "training") return pathname.startsWith("/training");
  if (id === "catalog") return pathname.startsWith("/catalog");
  if (id === "clarifications") return pathname.startsWith("/clarifications");
  if (id === "requests") return pathname.startsWith("/requests");
  if (id === "device-book") return pathname.startsWith("/device-book");
  if (id === "incidents") return pathname.startsWith("/incidents");
  if (id === "field-safety") return pathname.startsWith("/field-safety");
  if (id === "reprocessing") return pathname.startsWith("/reprocessing");
  if (id === "constancy-cadence") return pathname.startsWith("/constancy-cadence");
  if (id === "authority") return pathname.startsWith("/authority");
  if (id === "users") return pathname.startsWith("/users");
  if (id === "locations") return pathname.startsWith("/locations");
  if (id === "roles") return pathname.startsWith("/roles");
  if (id === "management") return pathname.startsWith("/management");
  if (id === "activity") return pathname.startsWith("/activity");
  if (id === "security") return pathname.startsWith("/security");
  // Security lives under Settings (v26) — keep secondary rail highlighted.
  if (id === "settings") return pathname.startsWith("/settings") || pathname.startsWith("/security");
  return false;
}

function NavBadge({ entry, label }: { entry: NavCountEntry | undefined; label: string }) {
  if (!entry) return null;
  if (entry.mark) {
    return (
      <span
        className={["p-nav__badge", entry.warn ? "is-warn" : ""].filter(Boolean).join(" ")}
        aria-label={label}
        data-testid="nav-badge-mark"
      >
        {entry.mark}
      </span>
    );
  }
  if (entry.count == null) return null;
  return (
    <span
      className={["p-nav__badge", entry.warn ? "is-warn" : ""].filter(Boolean).join(" ")}
      aria-label={label}
      data-testid="nav-badge-count"
    >
      {entry.count > 99 ? "99+" : entry.count}
    </span>
  );
}

function NavLink({
  item,
  pathname,
  label,
  countEntry,
}: {
  item: MenuModule;
  pathname: string;
  label: string;
  countEntry?: NavCountEntry;
}) {
  const active = isNavActive(item.id, pathname);
  const t = useTranslations("nav");
  const badgeAria =
    countEntry?.mark && countEntry.warn
      ? t("badgeWarn", { label })
      : countEntry?.count != null
        ? t("badgeCount", { label, count: countEntry.count })
        : undefined;
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
      <NavBadge entry={countEntry} label={badgeAria ?? label} />
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
  const tCommissioning = useTranslations("commissioning");
  const [open, setOpen] = useState(true);
  const [adminCollapsed, setAdminCollapsed] = useState(false);
  const pathname = usePathname();
  const { signOut } = useSession();
  const { permissionData, checkPermission } = usePermissions();
  useOnlineStatus();

  const showNav = checkPermission("shell:nav");
  const canSearchBestand = checkPermission("inventory:view");
  const isCapturerChrome = !showNav;
  const onHome = pathname === APP_HOME_PATH;
  const showCapturerInventory = !showNav && onHome && checkPermission("inventory:view");
  const showCapturerSecurity = !showNav && checkPermission("account:security");
  const showCapturerDeviceBook = !showNav && checkPermission("devicebook:view");
  const showCapturerHome = !showNav && !onHome;
  /** Desktop status-bar Scan tabs; phone/tablet use bottom bar — Inventory lives in those tabs. */
  const showDesktopScanTabs = showCapturerInventory && form === "full";
  const inventoryCount = useCapturerInventoryUi((s) => s.count);
  const openInventory = useCapturerInventoryUi((s) => s.openPanel);
  const setInventoryCount = useCapturerInventoryUi((s) => s.setCount);
  const scanNavEnabled = useCapturerScanNav((s) => s.enabled);
  const menu = showNav ? (permissionData?.menu ?? []) : [];
  const primary = menu.filter((m) => m.id !== "settings");
  const settingsItem = menu.find((m) => m.id === "settings");
  const settingsActive = Boolean(settingsItem && isNavActive("settings", pathname));
  const { counts } = useNavCounts(showNav);
  const { progress, loading: setupLoading } = useSetupProgress(showNav);
  /** Mockup: chip above nav while open criteria remain (`showChip` from API). */
  const showSetupChip =
    showNav && (setupLoading || !progress || progress.showChip);
  const grouped = CLINIC_NAV_GROUPS.map((g) => ({
    ...g,
    items: primary.filter((m) => m.group === g.id),
  })).filter((g) => g.items.length > 0);
  const ungrouped = primary.filter(
    (m) => !m.group || !CLINIC_NAV_GROUPS.some((g) => g.id === m.group),
  );

  function countFor(id: MenuModuleId): NavCountEntry | undefined {
    const key = MENU_ID_TO_NAV_COUNT[id];
    if (!key || !counts) return undefined;
    return (counts as NavCountsResponse)[key];
  }

  useEffect(() => {
    try {
      setAdminCollapsed(window.localStorage.getItem(ADMIN_COLLAPSE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

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

  const toggleAdmin = () => {
    setAdminCollapsed((v) => {
      const next = !v;
      try {
        window.localStorage.setItem(ADMIN_COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const nextStepLabel =
    progress?.nextStepTitleKey != null
      ? tCommissioning(`steps.${progress.nextStepTitleKey}` as "steps.sites")
      : null;

  return (
    <div
      className={["p-screen", showNav ? "p-screen--nav" : ""].filter(Boolean).join(" ")}
      data-form={form}
      data-nav={showNav ? (open ? "open" : "collapsed") : undefined}
      data-testid={testId}
    >
      {showNav && (
        <aside className="p-nav" aria-label={t("main")} data-testid="app-nav">
          <div className="p-nav__tools">
            {canSearchBestand && (
              <Suspense fallback={<div className="p-nav__search" aria-hidden />}>
                <NavBestandSearch navOpen={open} onEnsureNavOpen={() => setOpen(true)} />
              </Suspense>
            )}
            {showSetupChip && (
              <Link
                href="/commissioning"
                className="p-nav__setup"
                data-testid="nav-setup-chip"
                title={
                  progress
                    ? t("setupTitle", { done: progress.done, total: progress.total })
                    : t("setupTitle", { done: 0, total: 10 })
                }
              >
                <span className="p-nav__setup-label">
                  {progress
                    ? t("setupTitle", { done: progress.done, total: progress.total })
                    : t("setupLoading")}
                </span>
                <span className="p-nav__setup-track" aria-hidden>
                  <span
                    className="p-nav__setup-fill"
                    style={{
                      width: progress
                        ? `${Math.round((progress.done / Math.max(progress.total, 1)) * 100)}%`
                        : "0%",
                    }}
                  />
                </span>
                {nextStepLabel ? (
                  <span className="p-nav__setup-next">
                    {t("setupNext", { step: nextStepLabel })}
                  </span>
                ) : null}
              </Link>
            )}
          </div>

          <nav className="p-nav__primary">
            {grouped.map((g) => {
              const collapsed = g.collapsible && adminCollapsed;
              return (
                <div
                  key={g.id}
                  className="p-nav__group"
                  data-testid={`nav-group-${g.id}`}
                  data-collapsed={collapsed ? "true" : "false"}
                >
                  {g.collapsible ? (
                    <button
                      type="button"
                      className="p-nav__group-head"
                      aria-expanded={!collapsed}
                      data-testid={`nav-group-toggle-${g.id}`}
                      onClick={toggleAdmin}
                    >
                      <span className="p-nav__group-head-label">{t(g.labelKey)}</span>
                      <GroupChevron collapsed={collapsed} />
                    </button>
                  ) : (
                    <p className="p-nav__group-label">{t(g.labelKey)}</p>
                  )}
                  <div className="p-nav__group-items">
                    {g.items.map((item) => (
                      <NavLink
                        key={item.id}
                        item={item}
                        pathname={pathname}
                        label={t(item.id as "inventory")}
                        countEntry={countFor(item.id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
            {ungrouped.map((item) => (
              <NavLink
                key={item.id}
                item={item}
                pathname={pathname}
                label={t(item.id as "inventory")}
                countEntry={countFor(item.id)}
              />
            ))}
          </nav>

          <div className="p-nav__chrome">
            <button
              type="button"
              className="p-nav-toggle"
              aria-label={open ? t("collapse") : t("expand")}
              aria-expanded={open}
              data-testid="nav-toggle"
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <NavCollapseIcon /> : <NavExpandIcon />}
            </button>
          </div>

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
      )}

      <div className="p-screen-body">
        <PartnerActingBar />
        <AccountBar
          subtitle={accountSubtitle}
          showLogout={!showNav}
          onSignOut={() => void signOut()}
          showInventory={false}
          inventoryCount={inventoryCount}
          onOpenInventory={openInventory}
          showSecurity={showCapturerSecurity}
          showDeviceBook={showCapturerDeviceBook}
          showHome={showCapturerHome}
          showScanTabs={showDesktopScanTabs && scanNavEnabled}
          useCornerMenu={isCapturerChrome}
        />
        <OfflineBar />
        {children}
      </div>
    </div>
  );
}
