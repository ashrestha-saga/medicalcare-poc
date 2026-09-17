"use client";

import { useSites } from "@/components/hooks/location/useSites";
import { useRequestStore } from "@/store/requestStore";
import type { SiteDTO } from "@/interfaces";
import { CUSTOM_DELIVERY } from "@/constants/location";
import { useEffect, useMemo, useState } from "react";

export { CUSTOM_DELIVERY };

export function buildLocationText(sites: SiteDTO[] | undefined, siteId: string, areaId: string, room: string): string {
  const site = sites?.find((s) => s.id === siteId);
  const area = site?.areas.find((a) => a.id === areaId);
  return [site?.name, area?.name, room.trim()].filter(Boolean).join(", ");
}

/**
 * Site / area / delivery address state for the service-request location section.
 */
export function useLocationForm() {
  const form = useRequestStore((s) => s.form);
  const patch = useRequestStore((s) => s.patch);
  const sites = useSites();
  const site = sites.find((s) => s.id === form.siteId);

  const deliveryOptions = useMemo(() => {
    const fromSites = sites
      .map((s) => (s.deliveryAddress?.trim() || s.address?.trim() || "").trim())
      .filter(Boolean);
    return [...new Set(fromSites)];
  }, [sites]);

  const isKnownAddress = Boolean(form.deliveryAddress && deliveryOptions.includes(form.deliveryAddress));
  const [customMode, setCustomMode] = useState(false);

  useEffect(() => {
    const preset = site?.deliveryAddress?.trim() || site?.address?.trim();
    if (preset && !form.deliveryAddress && !customMode) {
      patch({ deliveryAddress: preset });
    }
  }, [site, form.deliveryAddress, patch, customMode]);

  useEffect(() => {
    if (form.deliveryAddress && !deliveryOptions.includes(form.deliveryAddress)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- enter custom mode when address is not a preset
      setCustomMode(true);
    }
  }, [form.deliveryAddress, deliveryOptions]);

  const selectValue =
    customMode || (!isKnownAddress && form.deliveryAddress) ? CUSTOM_DELIVERY : form.deliveryAddress;

  const onSelectDelivery = (value: string) => {
    if (value === CUSTOM_DELIVERY) {
      setCustomMode(true);
      if (isKnownAddress) patch({ deliveryAddress: "" });
      return;
    }
    setCustomMode(false);
    patch({ deliveryAddress: value });
  };

  return {
    form,
    patch,
    sites,
    site,
    deliveryOptions,
    customMode,
    selectValue,
    onSelectDelivery,
  };
}
