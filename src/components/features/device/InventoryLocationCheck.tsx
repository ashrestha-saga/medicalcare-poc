"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useSites } from "@/components/hooks/location/useSites";
import { useRequestStore } from "@/store/requestStore";

/**
 * Compact place-of-use fields for inventory-hit confirmation.
 * Writes into requestStore so ServiceRequestForm / submit reuse the same values.
 */
export function InventoryLocationCheck({ error }: { error?: string | null }) {
  const t = useTranslations("device");
  const form = useRequestStore((s) => s.form);
  const patch = useRequestStore((s) => s.patch);
  const sites = useSites();
  const site = sites.find((s) => s.id === form.siteId);

  useEffect(() => {
    const preset = site?.deliveryAddress?.trim() || site?.address?.trim();
    if (preset && !form.deliveryAddress) {
      patch({ deliveryAddress: preset });
    }
  }, [site, form.deliveryAddress, patch]);

  return (
    <div className="p-sec p-inv__loc" data-testid="inventory-location-check">
      <p className="p-sec-title">
        {t("placeOfUseTitle")} <span className="p-req" aria-hidden="true">*</span>
      </p>
      <div className="p-grid2 p-grid2--always p-inv__loc-row">
        <div className="p-field">
          <label htmlFor="inv-loc-site">
            {t("site")} <span className="p-req" aria-hidden="true">*</span>
          </label>
          <select
            id="inv-loc-site"
            value={form.siteId}
            onChange={(e) => patch({ siteId: e.target.value, areaId: "" })}
            aria-required="true"
            data-testid="inventory-site-select"
          >
            <option value="">{t("selectSite")}</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.code ? ` · ${s.code}` : ""}
              </option>
            ))}
          </select>
          {error && <p className="p-err">{error}</p>}
        </div>
        <div className="p-field">
          <label htmlFor="inv-loc-area">{t("area")}</label>
          <select
            id="inv-loc-area"
            value={form.areaId}
            onChange={(e) => patch({ areaId: e.target.value })}
            disabled={!site}
            data-testid="inventory-area-select"
          >
            <option value="">{t("selectArea")}</option>
            {site?.areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="p-field p-inv__room">
        <label htmlFor="inv-loc-room">{t("room")}</label>
        <input
          id="inv-loc-room"
          value={form.room}
          onChange={(e) => patch({ room: e.target.value })}
          placeholder={t("roomPlaceholder")}
          data-testid="inventory-room-input"
        />
      </div>
    </div>
  );
}
