"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { MenuModuleId } from "@/interfaces/permissions";
import { useSession } from "@/hooks/useSession";
import { useSessionStore } from "@/store/sessionStore";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { LocaleToggle } from "@/components/features/shared/LocaleToggle";
import { cn } from "@/lib/utils";
import { Loading } from "@/components/ui/Loading";
import {
  ActivityIcon,
  DueDatesIcon,
  LocationsIcon,
  LogoutIcon,
  ManagementIcon,
  RequestsIcon,
  SettingsIcon,
  UsersIcon,
} from "@/components/layout/navIcons";

const MENU_I18N: Partial<
  Record<
    MenuModuleId,
    | "customers"
    | "dueDates"
    | "requests"
    | "disposition"
    | "mySites"
    | "assignments"
    | "staff"
    | "external"
    | "organisation"
    | "activity"
    | "settings"
  >
> = {
  "console-customers": "customers",
  "console-due-dates": "dueDates",
  "console-requests": "requests",
  "console-disposition": "disposition",
  "console-my-sites": "mySites",
  "console-assignments": "assignments",
  "console-staff": "staff",
  "console-external": "external",
  "console-organisation": "organisation",
  "console-activity": "activity",
  "console-settings": "settings",
};

function ConsoleNavIcon({ id }: { id: MenuModuleId }) {
  if (id === "console-due-dates") return <DueDatesIcon />;
  if (id === "console-requests" || id === "console-disposition" || id === "console-assignments") {
    return <RequestsIcon />;
  }
  if (id === "console-my-sites") return <LocationsIcon />;
  if (id === "console-staff" || id === "console-external") return <UsersIcon />;
  if (id === "console-organisation") return <ManagementIcon />;
  if (id === "console-activity") return <ActivityIcon />;
  if (id === "console-settings") return <SettingsIcon />;
  return <LocationsIcon />;
}

/** Operator-console chrome: nav from console:* capabilities. */
export function ConsoleShell({ children }: { children: ReactNode }) {
  const t = useTranslations("console");
  const { signOut } = useSession();
  const user = useSessionStore((s) => s.user);
  const pathname = usePathname();
  const { permissionsLoading, permissionData, checkPermission } = usePermissions();

  const showNav = checkPermission("console:nav");
  const menu = showNav ? (permissionData?.menu ?? []) : [];
  const ops = menu.filter((m) => m.group === "ops");
  const org = menu.filter((m) => m.group === "org");

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background" data-testid="console-shell">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-4 py-3 sm:px-5">
        <div>
          <div className="text-sm font-semibold">{t("title")}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {user?.organisationName ?? user?.name}
            {user?.appRole ? ` · ${user.appRole}` : ""}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LocaleToggle />
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            data-testid="partner-sign-out"
            onClick={() => void signOut({ redirectTo: "/login/partner" })}
          >
            <span className="inline-flex size-[18px] shrink-0 [&_svg]:size-full [&_svg]:stroke-current [&_svg]:fill-none [&_svg]:stroke-[1.75] [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round]">
              <LogoutIcon />
            </span>
            {t("signOut")}
          </button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {permissionsLoading ? (
          <div className="shrink-0 border-b border-border p-3 md:w-56 md:border-b-0 md:border-r">
            <Loading label="…" />
          </div>
        ) : showNav ? (
          <nav
            className="shrink-0 overflow-y-auto border-b border-border p-3 md:w-56 md:border-b-0 md:border-r"
            aria-label={t("navLabel")}
          >
            {ops.length > 0 ? (
              <>
                <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("navOps")}
                </p>
                {ops.map((item) => (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    active={pathname.startsWith(item.href)}
                    icon={<ConsoleNavIcon id={item.id} />}
                  >
                    {t(MENU_I18N[item.id] ?? "customers")}
                  </NavLink>
                ))}
              </>
            ) : null}
            {org.length > 0 ? (
              <>
                <p className="mb-1 mt-4 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("navOrg")}
                </p>
                {org.map((item) => (
                  <NavLink
                    key={item.href}
                    href={item.href}
                    active={pathname.startsWith(item.href)}
                    icon={<ConsoleNavIcon id={item.id} />}
                  >
                    {t(MENU_I18N[item.id] ?? "organisation")}
                  </NavLink>
                ))}
              </>
            ) : null}
          </nav>
        ) : null}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}

function NavLink({
  href,
  active,
  icon,
  children,
}: {
  href: string;
  active: boolean;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm",
        active
          ? "bg-muted font-semibold text-foreground"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      <span className="inline-flex size-[20px] shrink-0 [&_svg]:size-full [&_svg]:stroke-current [&_svg]:fill-none [&_svg]:stroke-[1.75] [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round]">
        {icon}
      </span>
      <span>{children}</span>
    </Link>
  );
}
