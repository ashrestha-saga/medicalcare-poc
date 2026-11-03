"use client";

import { Suspense, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { MenuModule, MenuModuleId } from "@/interfaces/permissions";
import { useSession } from "@/hooks/useSession";
import { useSessionStore } from "@/store/sessionStore";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { usePartnerNavCounts } from "@/components/hooks/partner/usePartnerNavCounts";
import { LocaleToggle } from "@/components/features/shared/LocaleToggle";
import { NavPartnerSearch } from "@/components/layout/NavPartnerSearch";
import { cn } from "@/lib/utils";
import { Loading } from "@/components/ui/Loading";
import {
  ActivityIcon,
  AssignmentsIcon,
  CustomersIcon,
  DashboardIcon,
  DispositionIcon,
  DueDatesIcon,
  ExternalInspectorsIcon,
  LogoutIcon,
  ManagementIcon,
  MySitesIcon,
  NavCollapseIcon,
  NavExpandIcon,
  SettingsIcon,
  UsersIcon,
} from "@/components/layout/navIcons";
import {
  CONSOLE_NAV_KEY_TO_MODULE,
  consoleNavPresetFor,
  type ConsoleNavBand,
  type ConsoleNavKey,
} from "@/constants/partnerConsoleNav";
import type { PartnerNavCountEntry } from "@/constants/partnerNavCounts";

const MENU_I18N: Partial<
  Record<
    MenuModuleId,
    | "navToday"
    | "customers"
    | "dueDates"
    | "navOrders"
    | "mySites"
    | "navFieldSafety"
    | "staff"
    | "external"
    | "organisation"
    | "activity"
    | "settings"
  >
> = {
  "console-today": "navToday",
  "console-customers": "customers",
  "console-due-dates": "dueDates",
  "console-orders": "navOrders",
  "console-my-sites": "mySites",
  "console-field-safety": "navFieldSafety",
  "console-staff": "staff",
  "console-external": "external",
  "console-organisation": "organisation",
  "console-activity": "activity",
  "console-settings": "settings",
};

function ConsoleNavIcon({ id }: { id: MenuModuleId }) {
  if (id === "console-today") return <DashboardIcon />;
  if (id === "console-customers") return <CustomersIcon />;
  if (id === "console-due-dates") return <DueDatesIcon />;
  if (id === "console-orders") return <DispositionIcon />;
  if (id === "console-my-sites") return <MySitesIcon />;
  if (id === "console-field-safety") return <ActivityIcon />;
  if (id === "console-staff") return <UsersIcon />;
  if (id === "console-external") return <ExternalInspectorsIcon />;
  if (id === "console-organisation") return <ManagementIcon />;
  if (id === "console-activity") return <ActivityIcon />;
  if (id === "console-settings") return <SettingsIcon />;
  return <AssignmentsIcon />;
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/partner/orders") {
    return (
      pathname.startsWith("/partner/orders") ||
      pathname.startsWith("/partner/disposition") ||
      pathname.startsWith("/partner/inspection-orders")
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Visible hide/unhide control for the Rarely band. */
function BandChevron({ open }: { open: boolean }) {
  return (
    <svg
      className={cn(
        "ml-auto size-3.5 shrink-0 text-foreground/70 transition-transform duration-150",
        open ? "rotate-0" : "-rotate-90",
      )}
      viewBox="0 0 16 16"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

/** Operator-console chrome: role bands Täglich · Regelmäßig · Selten (v14-A). */
export function ConsoleShell({ children }: { children: ReactNode }) {
  const t = useTranslations("console");
  const { signOut } = useSession();
  const user = useSessionStore((s) => s.user);
  const pathname = usePathname();
  const { permissionsLoading, permissionData, checkPermission } = usePermissions();
  const [navOpen, setNavOpen] = useState(true);
  const [seltenOpen, setSeltenOpen] = useState(false);

  const showNav = checkPermission("console:nav");
  const { counts } = usePartnerNavCounts(showNav);
  const menu = showNav ? (permissionData?.menu ?? []) : [];
  const byId = useMemo(() => {
    const m = new Map<MenuModuleId, MenuModule>();
    for (const item of menu) m.set(item.id, item);
    return m;
  }, [menu]);

  const settingsItem = byId.get("console-settings");

  const bands = useMemo(() => {
    const preset = consoleNavPresetFor(user?.appRole ?? "inspector");
    const resolve = (keys: ConsoleNavKey[]) =>
      keys
        .map((key) => {
          const id = CONSOLE_NAV_KEY_TO_MODULE[key];
          return byId.get(id);
        })
        .filter((x): x is MenuModule => x != null && x.id !== "console-settings");
    return {
      taeglich: resolve(preset.taeglich),
      regel: resolve(preset.regel),
      selten: resolve(preset.selten),
    };
  }, [byId, user?.appRole]);

  const bandLabel = (band: ConsoleNavBand) =>
    band === "taeglich" ? t("navBandDaily") : band === "regel" ? t("navBandRegular") : t("navBandRare");

  const navWidth = navOpen ? "md:w-56" : "md:w-16";

  function renderBand(band: ConsoleNavBand, items: MenuModule[], collapsible?: boolean) {
    if (items.length === 0) return null;
    const open = band !== "selten" || seltenOpen || !collapsible || !navOpen;
    return (
      <div className="mb-3">
        {navOpen ? (
          <button
            type="button"
            className={cn(
              "mb-1 flex w-full items-center gap-2 rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground",
              collapsible &&
                "cursor-pointer hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
            )}
            aria-expanded={collapsible ? open : undefined}
            aria-label={
              collapsible
                ? open
                  ? t("navBandRareHide")
                  : t("navBandRareShow")
                : undefined
            }
            onClick={collapsible ? () => setSeltenOpen((v) => !v) : undefined}
            disabled={!collapsible}
          >
            <span className="min-w-0 flex-1 text-left">{bandLabel(band)}</span>
            {collapsible ? <BandChevron open={open} /> : null}
          </button>
        ) : null}
        {open
          ? items.map((item) => {
              const label = t(MENU_I18N[item.id] ?? "customers");
              return (
                <NavLink
                  key={item.href}
                  href={item.href}
                  active={isActive(pathname, item.href)}
                  icon={<ConsoleNavIcon id={item.id} />}
                  label={label}
                  navOpen={navOpen}
                  countEntry={counts?.[item.id]}
                />
              );
            })
          : null}
      </div>
    );
  }

  const signOutButton = (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm",
        "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
        !navOpen && "justify-center px-0",
      )}
      title={t("signOut")}
      data-testid="partner-sign-out"
      onClick={() => void signOut({ redirectTo: "/login/partner" })}
    >
      <span className="inline-flex size-[20px] shrink-0 [&_svg]:size-full [&_svg]:stroke-current [&_svg]:fill-none [&_svg]:stroke-[1.75] [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round]">
        <LogoutIcon />
      </span>
      {navOpen ? <span>{t("signOut")}</span> : <span className="sr-only">{t("signOut")}</span>}
    </button>
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background" data-testid="console-shell">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-4 py-3 sm:px-5">
        <div>
          <div className="text-sm font-semibold">{t("title")}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {user?.organisationName ?? user?.name}
            {user?.appRole
              ? ` · ${
                  user.appRole === "admin"
                    ? t("staffRoleAdmin")
                    : user.appRole === "service_lead"
                      ? t("staffRoleServiceLead")
                      : user.appRole === "management"
                        ? t("staffRoleManagement")
                        : user.appRole === "order"
                          ? t("staffRoleOrder")
                          : t("staffRoleInspector")
                }`
              : ""}
          </div>
        </div>
        <LocaleToggle />
      </header>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {permissionsLoading ? (
          <div className={cn("shrink-0 border-b border-border p-3 md:border-b-0 md:border-r", navWidth)}>
            <Loading label="…" />
          </div>
        ) : showNav ? (
          <nav
            className={cn(
              "flex shrink-0 flex-col overflow-y-auto border-b border-border p-3 transition-[width] duration-200 md:border-b-0 md:border-r",
              navWidth,
            )}
            aria-label={t("navLabel")}
            data-nav={navOpen ? "open" : "collapsed"}
          >
            <div className="min-h-0 flex-1">
              <div className={cn(!navOpen && "hidden")}>
                <Suspense fallback={<div className="mb-3 h-9" aria-hidden />}>
                  <NavPartnerSearch
                    navOpen={navOpen}
                    onEnsureNavOpen={() => setNavOpen(true)}
                  />
                </Suspense>
              </div>
              {renderBand("taeglich", bands.taeglich)}
              {renderBand("regel", bands.regel)}
              {renderBand("selten", bands.selten, true)}
            </div>
            <div
              className={cn(
                "mt-auto flex min-h-8 shrink-0 items-center pt-2",
                navOpen ? "justify-end" : "justify-center",
              )}
            >
              <button
                type="button"
                className={cn(
                  "inline-grid size-8 place-items-center rounded-md border border-transparent text-muted-foreground",
                  "hover:border-border hover:bg-muted/60 hover:text-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                  "[&_svg]:size-[18px] [&_svg]:stroke-current [&_svg]:fill-none [&_svg]:stroke-2",
                  "[&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round]",
                )}
                aria-label={navOpen ? t("navCollapse") : t("navExpand")}
                aria-expanded={navOpen}
                data-testid="partner-nav-toggle"
                onClick={() => setNavOpen((v) => !v)}
              >
                {navOpen ? <NavCollapseIcon /> : <NavExpandIcon />}
              </button>
            </div>
            <div className="mt-1 space-y-0.5 border-t border-border pt-3">
              {settingsItem ? (
                <NavLink
                  href={settingsItem.href}
                  active={isActive(pathname, settingsItem.href)}
                  icon={<SettingsIcon />}
                  label={t("settings")}
                  navOpen={navOpen}
                  countEntry={counts?.[settingsItem.id]}
                />
              ) : null}
              {signOutButton}
            </div>
          </nav>
        ) : (
          <div className={cn("shrink-0 border-b border-border p-3 md:border-b-0 md:border-r", navWidth)}>
            {signOutButton}
          </div>
        )}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}

function PartnerNavBadge({
  entry,
  ariaLabel,
}: {
  entry: PartnerNavCountEntry;
  ariaLabel: string;
}) {
  return (
    <span
      className={cn(
        "ml-auto inline-flex h-[1.15rem] min-w-[1.25rem] shrink-0 items-center justify-center rounded-full px-[0.35rem]",
        "text-[10px] font-semibold leading-none",
        entry.warn
          ? "bg-[color-mix(in_srgb,var(--warn,#f5a524)_22%,transparent)] text-[var(--warn,#f5a524)]"
          : "bg-muted text-muted-foreground",
      )}
      aria-label={ariaLabel}
      data-testid="partner-nav-badge"
    >
      {entry.count > 99 ? "99+" : entry.count}
    </span>
  );
}

function NavLink({
  href,
  active,
  icon,
  label,
  navOpen,
  countEntry,
}: {
  href: string;
  active: boolean;
  icon: ReactNode;
  label: string;
  navOpen: boolean;
  countEntry?: PartnerNavCountEntry;
}) {
  const t = useTranslations("console");
  const badgeAria =
    countEntry == null
      ? undefined
      : countEntry.warn
        ? t("badgeWarn", { label })
        : t("badgeCount", { label, count: countEntry.count });

  return (
    <Link
      href={href}
      title={badgeAria ?? label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-[34px] items-center gap-2 rounded-md px-2 text-[14.5px] font-medium tracking-tight transition-[background,color,box-shadow] duration-150",
        active
          ? "bg-[color-mix(in_srgb,var(--accent)_20%,transparent)] font-semibold text-foreground shadow-[inset_3px_0_0_var(--accent)]"
          : "text-muted-foreground hover:bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] hover:text-foreground",
        !navOpen && "justify-center gap-0 px-0",
      )}
    >
      <span className="inline-flex size-[18px] shrink-0 [&_svg]:size-full [&_svg]:stroke-current [&_svg]:fill-none [&_svg]:stroke-[1.75] [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round]">
        {icon}
      </span>
      {navOpen ? <span className="min-w-0 flex-1 truncate">{label}</span> : <span className="sr-only">{label}</span>}
      {navOpen && countEntry ? <PartnerNavBadge entry={countEntry} ariaLabel={badgeAria ?? label} /> : null}
    </Link>
  );
}
