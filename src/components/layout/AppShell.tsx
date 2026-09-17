"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useSession } from "@/hooks/useSession";
import { useSessionStore } from "@/store/sessionStore";
import { useSites } from "@/components/hooks/location/useSites";
import { OfflineBar } from "@/components/ui/OfflineBar";
import { roleLabel } from "@/constants/roles";
import { usePermissions } from "@/lib/providers/PermissionProvider";
import { api } from "@/lib/http/apiClient";
import { useCapturerInventoryUi } from "@/store/capturerInventoryStore";
import {
  CatalogIcon,
  InventoryIcon,
  LocationsIcon,
  LogoutIcon,
  MenuIcon,
  RequestsIcon,
  RolesIcon,
  SecurityIcon,
  SettingsIcon,
  UsersIcon,
} from "./navIcons";

import type { FormFactor, MenuModuleId } from "@/interfaces";

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
  const user = useSessionStore((s) => s.user);
  const tenantName = useSessionStore((s) => s.tenantName);
  const lock = useSessionStore((s) => s.lock);
  const pinHash = useSessionStore((s) => s.pinHash);
  const sites = useSites();
  const site = sites[0];
  const area = site?.areas[0];
  const siteDelivery = site ? (area ? `${site.name} · ${area.name}` : site.name) : null;
  const org = user?.companyName?.trim() || tenantName || null;
  const deliveryLine = user?.deliveryLine || siteDelivery || "—";
  const countLabel =
    inventoryCount == null ? "…" : String(inventoryCount);

  return (
    <div className="p-acctbar on">
      <div className="a">
        <b data-testid="current-user">
          {user?.name}
          {org ? ` · ${org}` : ""}
        </b>
        <span>{subtitle ?? `Lieferung: ${deliveryLine}`}</span>
      </div>
      {showInventory && onOpenInventory && (
        <button
          type="button"
          className="k p-acctbar__inventory"
          onClick={onOpenInventory}
          data-testid="capturer-inventory-button"
          title="Bestandsverzeichnis"
        >
          Bestand
          <span className="p-acctbar__inventory-count">{countLabel}</span>
        </button>
      )}
      {showSecurity && (
        <Link href="/security" className="k" data-testid="capturer-security-link" title="Security">
          2FA
        </Link>
      )}
      <span className="k" data-testid="user-role">
        {roleLabel(user?.role)}
      </span>
      {pinHash && (
        <button type="button" className="k" onClick={lock} data-testid="lock-button">
          LOCK
        </button>
      )}
      {showLogout && (
        <button type="button" className="k" onClick={onSignOut} data-testid="sign-out" title="Logout">
          Logout
        </button>
      )}
    </div>
  );
}

function NavIcon({ id }: { id: MenuModuleId }) {
  if (id === "catalog") return <CatalogIcon />;
  if (id === "requests") return <RequestsIcon />;
  if (id === "users") return <UsersIcon />;
  if (id === "locations") return <LocationsIcon />;
  if (id === "roles") return <RolesIcon />;
  if (id === "security") return <SecurityIcon />;
  if (id === "settings") return <SettingsIcon />;
  return <InventoryIcon />;
}

function isNavActive(id: MenuModuleId, pathname: string): boolean {
  if (id === "inventory") return pathname.startsWith("/devices");
  if (id === "catalog") return pathname.startsWith("/catalog");
  if (id === "requests") return pathname.startsWith("/requests");
  if (id === "users") return pathname.startsWith("/users");
  if (id === "locations") return pathname.startsWith("/locations");
  if (id === "roles") return pathname.startsWith("/roles");
  if (id === "security") return pathname.startsWith("/security");
  if (id === "settings") return pathname.startsWith("/settings");
  return false;
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
            aria-label={open ? "Collapse navigation" : "Expand navigation"}
            aria-expanded={open}
            data-testid="nav-toggle"
            onClick={() => setOpen((v) => !v)}
          >
            <MenuIcon />
          </button>

          <aside className="p-nav" aria-label="Main navigation" data-testid="app-nav">
            <nav className="p-nav__primary">
              {primary.map((item) => {
                const active = isNavActive(item.id, pathname);
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={navItemClass(active)}
                    aria-current={active ? "page" : undefined}
                    title={item.label}
                    data-testid={`nav-${item.id}`}
                  >
                    <NavIcon id={item.id} />
                    <span className="p-nav__label">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="p-nav__secondary">
              {settingsItem && (
                <Link
                  href={settingsItem.href}
                  className={navItemClass(settingsActive)}
                  title="Settings"
                  data-testid="settings-button"
                  aria-current={settingsActive ? "page" : undefined}
                >
                  <SettingsIcon />
                  <span className="p-nav__label">Settings</span>
                </Link>
              )}
              <button
                type="button"
                className={navItemClass(false)}
                title="Logout"
                data-testid="sign-out"
                onClick={() => void signOut()}
              >
                <LogoutIcon />
                <span className="p-nav__label">Logout</span>
              </button>
            </div>
          </aside>
        </>
      )}

      <div className="p-screen-body">
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
