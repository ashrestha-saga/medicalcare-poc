"use client";

import { useMemo, useState } from "react";
import { CAPTURER_EXTRA_CAPABILITIES } from "@/constants/capturerCapabilities";
import type { PermissionSlug } from "@/interfaces/permissions";
import type { UserRole } from "@/interfaces/session";
import { useSites } from "@/components/hooks/location/useSites";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  role: UserRole | null;
  areaIds: string[];
  homeAreaId: string | null;
  permissions: PermissionSlug[];
  onAreaIdsChange: (ids: string[]) => void;
  onHomeAreaIdChange: (id: string | null) => void;
  onTogglePermission: (slug: PermissionSlug) => void;
  disabled?: boolean;
  fieldErrors?: Record<string, string>;
  showExtraCapabilities?: boolean;
};

export function UserWorkAreasFields({
  role,
  areaIds,
  homeAreaId,
  permissions,
  onAreaIdsChange,
  onHomeAreaIdChange,
  onTogglePermission,
  disabled,
  fieldErrors,
  showExtraCapabilities = true,
}: Props) {
  const sites = useSites();
  const [siteId, setSiteId] = useState<string>("");
  const [areaPick, setAreaPick] = useState<string>("");
  const requireAreas = role === "user";

  const siteAreas = useMemo(() => {
    const site = sites.find((s) => s.id === siteId);
    return site?.areas ?? [];
  }, [sites, siteId]);

  const areaLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sites) {
      for (const a of s.areas) {
        map.set(a.id, `${s.name} · ${a.name}`);
      }
    }
    return map;
  }, [sites]);

  const availableToAdd = siteAreas.filter((a) => !areaIds.includes(a.id));

  const addArea = (areaId: string) => {
    if (!areaId || areaIds.includes(areaId)) return;
    const next = [...areaIds, areaId];
    onAreaIdsChange(next);
    if (!homeAreaId) onHomeAreaIdChange(areaId);
    setAreaPick("");
  };

  const removeArea = (areaId: string) => {
    const next = areaIds.filter((id) => id !== areaId);
    onAreaIdsChange(next);
    if (homeAreaId === areaId) onHomeAreaIdChange(next[0] ?? null);
  };

  return (
    <div className="grid gap-4" data-testid="user-work-areas">
      <div className="grid gap-3">
        <div>
          <Label required={requireAreas}>Work areas</Label>
          <p className="text-xs text-muted-foreground">
            Devices in these places appear in inventory and Scan.
            {requireAreas ? " Required for User." : ""}
          </p>
        </div>

        {sites.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No locations yet — create them under Locations first.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div className="grid gap-1.5">
              <Label htmlFor="user-work-site" className="text-xs text-muted-foreground">
                Site
              </Label>
              <Select
                value={siteId || undefined}
                onValueChange={(v) => {
                  setSiteId(v);
                  setAreaPick("");
                }}
                disabled={disabled}
              >
                <SelectTrigger id="user-work-site" data-testid="user-work-site">
                  <SelectValue placeholder="Select site" />
                </SelectTrigger>
                <SelectContent>
                  {sites.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="user-work-area-add" className="text-xs text-muted-foreground">
                Area
              </Label>
              <Select
                value={areaPick || undefined}
                onValueChange={addArea}
                disabled={disabled || !siteId || availableToAdd.length === 0}
              >
                <SelectTrigger id="user-work-area-add" data-testid="user-work-area-add">
                  <SelectValue
                    placeholder={
                      !siteId
                        ? "Choose site first"
                        : availableToAdd.length === 0
                          ? "All areas added"
                          : "Add area"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableToAdd.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {areaIds.length > 0 && (
          <ul className="flex flex-wrap gap-2" data-testid="user-work-areas-selected">
            {areaIds.map((id) => (
              <li
                key={id}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs"
              >
                <span>{areaLabel.get(id) ?? id}</span>
                {!disabled && (
                  <button
                    type="button"
                    className="ml-0.5 text-muted-foreground hover:text-foreground"
                    onClick={() => removeArea(id)}
                    aria-label={`Remove ${areaLabel.get(id) ?? id}`}
                    data-testid={`user-area-remove-${id}`}
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {areaIds.length > 1 && (
          <div className="grid max-w-sm gap-1.5">
            <Label htmlFor="user-home-area" className="text-xs text-muted-foreground">
              Primary
            </Label>
            <Select
              value={homeAreaId ?? areaIds[0]}
              onValueChange={(v) => onHomeAreaIdChange(v)}
              disabled={disabled}
            >
              <SelectTrigger id="user-home-area" data-testid="user-home-area">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {areaIds.map((id) => (
                  <SelectItem key={id} value={id}>
                    {areaLabel.get(id) ?? id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {(fieldErrors?.areaIds || fieldErrors?.homeAreaId) && (
          <p className="text-xs text-destructive">
            {fieldErrors.areaIds || fieldErrors.homeAreaId}
          </p>
        )}
      </div>

      {showExtraCapabilities && role === "user" && (
        <div className="grid gap-2" data-testid="user-extra-capabilities">
          <Label>Extra capabilities</Label>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {CAPTURER_EXTRA_CAPABILITIES.map((cap) => (
              <label key={cap.slug} className="inline-flex items-center gap-2 text-sm">
                <Checkbox
                  checked={permissions.includes(cap.slug)}
                  disabled={disabled}
                  onCheckedChange={() => onTogglePermission(cap.slug)}
                  data-testid={`user-cap-${cap.slug}`}
                />
                <span>{cap.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
