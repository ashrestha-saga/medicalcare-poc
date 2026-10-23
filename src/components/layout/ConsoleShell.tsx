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
  AssignmentsIcon,
  CustomersIcon,
  DispositionIcon,
  DueDatesIcon,
  ExternalInspectorsIcon,
  LogoutIcon,
  ManagementIcon,
  MySitesIcon,
  SettingsIcon,
  UsersIcon,
} from "@/components/layout/navIcons";

const MENU_I18N: Partial<
  Record<
    MenuModuleId,
    | "customers"
    | "dueDates"
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
  if (id === "console-customers") return <CustomersIcon />;
  if (id === "console-due-dates") return <DueDatesIcon />;
  if (id === "console-disposition") return <DispositionIcon />;
  if (id === "console-assignments") return <AssignmentsIcon />;
  if (id === "console-my-sites") return <MySitesIcon />;
  if (id === "console-staff") return <UsersIcon />;
  if (id === "console-external") return <ExternalInspectorsIcon />;
  if (id === "console-organisation") return <ManagementIcon />;
  if (id === "console-activity") return <ActivityIcon />;
  if (id === "console-settings") return <SettingsIcon />;
  return <CustomersIcon />;
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
        <LocaleToggle />
      </header>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {permissionsLoading ? (
          <div className="shrink-0 border-b border-border p-3 md:w-56 md:border-b-0 md:border-r">
            <Loading label="…" />
          </div>
        ) : showNav ? (
          <nav
            className="flex shrink-0 flex-col overflow-y-auto border-b border-border p-3 md:w-56 md:border-b-0 md:border-r"
            aria-label={t("navLabel")}
          >
            <div className="min-h-0 flex-1">
              {ops.length > 0 ? (
                <>
                  <p className="mb-1 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
                  <p className="mb-1 mt-4 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
            </div>
            <div className="mt-4 border-t border-border pt-3">
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm",
                  "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
                data-testid="partner-sign-out"
                onClick={() => void signOut({ redirectTo: "/login/partner" })}
              >
                <span className="inline-flex size-[20px] shrink-0 [&_svg]:size-full [&_svg]:stroke-current [&_svg]:fill-none [&_svg]:stroke-[1.75] [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round]">
                  <LogoutIcon />
                </span>
                <span>{t("signOut")}</span>
              </button>
            </div>
          </nav>
        ) : (
          <div className="shrink-0 border-b border-border p-3 md:w-56 md:border-b-0 md:border-r">
            <button
              type="button"
              className={cn(
                "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm",
                "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
              data-testid="partner-sign-out"
              onClick={() => void signOut({ redirectTo: "/login/partner" })}
            >
              <span className="inline-flex size-[20px] shrink-0 [&_svg]:size-full [&_svg]:stroke-current [&_svg]:fill-none [&_svg]:stroke-[1.75] [&_svg]:[stroke-linecap:round] [&_svg]:[stroke-linejoin:round]">
                <LogoutIcon />
              </span>
              <span>{t("signOut")}</span>
            </button>
          </div>
        )}
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
