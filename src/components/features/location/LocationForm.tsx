"use client";

import { useTranslations } from "next-intl";
import type { LocationFormProps } from "@/interfaces";
import { CUSTOM_DELIVERY } from "@/constants/location";
import { useLocationForm } from "@/components/hooks/location/useLocationForm";

export { buildLocationText } from "@/components/hooks/location/useLocationForm";

export function LocationForm({ errors }: LocationFormProps) {
  const t = useTranslations("serviceRequest");
  const tFilters = useTranslations("filters");
  const { form, patch, sites, site, deliveryOptions, customMode, selectValue, onSelectDelivery } = useLocationForm();

  return (
    <>
      <div className="p-sec" data-testid="location-section">
        <p className="p-sec-title">
          {t("placeOfUse")} <span className="p-req" aria-hidden="true">*</span>
        </p>
        <div className="p-grid2 p-grid2--always">
          <div className="p-field">
            <label htmlFor="loc-site">
              {t("site")} <span className="p-req" aria-hidden="true">*</span>
            </label>
            <select
              id="loc-site"
              value={form.siteId}
              onChange={(e) => patch({ siteId: e.target.value, areaId: "" })}
              aria-required="true"
              data-testid="site-select"
            >
              <option value="">{t("selectSite")}</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {errors.site && <p className="p-err">{errors.site}</p>}
          </div>
          <div className="p-field">
            <label htmlFor="loc-area">{t("area")}</label>
            <select
              id="loc-area"
              value={form.areaId}
              onChange={(e) => patch({ areaId: e.target.value })}
              disabled={!site}
              data-testid="area-select"
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
        <div className="p-field">
          <label htmlFor="loc-room">
            {t("room")} <span className="p-req" aria-hidden="true">*</span>
          </label>
          <input
            id="loc-room"
            value={form.room}
            onChange={(e) => patch({ room: e.target.value })}
            placeholder={t("roomPlaceholder")}
            aria-required="true"
            data-testid="room-input"
          />
          {errors.room && <p className="p-err">{errors.room}</p>}
        </div>

        <div className="p-field">
          <label htmlFor="loc-access">{t("accessNote")}</label>
          <textarea
            id="loc-access"
            value={form.accessHint}
            onChange={(e) => patch({ accessHint: e.target.value })}
            placeholder={t("accessPlaceholder")}
            data-testid="access-hint-input"
            rows={3}
          />
          <p className="p-field-hint">{t("accessHint")}</p>
        </div>
      </div>

      <div className="p-sec" data-testid="delivery-section">
        <div className="p-field">
          <label htmlFor="delivery-select">
            {t("delivery")} <span className="p-req" aria-hidden="true">*</span>
          </label>
          <select
            id="delivery-select"
            value={selectValue}
            onChange={(e) => onSelectDelivery(e.target.value)}
            aria-required="true"
            data-testid="delivery-select"
          >
            <option value="">{t("selectDelivery")}</option>
            {deliveryOptions.map((addr) => (
              <option key={addr} value={addr}>
                {addr}
              </option>
            ))}
            <option value={CUSTOM_DELIVERY}>{t("otherAddress")}</option>
          </select>

          {(customMode || selectValue === CUSTOM_DELIVERY) && (
            <textarea
              id="delivery"
              className="p-delivery-custom"
              value={form.deliveryAddress}
              onChange={(e) => patch({ deliveryAddress: e.target.value })}
              placeholder={tFilters("deliveryPlaceholder")}
              rows={3}
              data-testid="delivery-input"
            />
          )}

          {!customMode && selectValue !== CUSTOM_DELIVERY && (
            <input type="hidden" data-testid="delivery-input" value={form.deliveryAddress} readOnly />
          )}

          {errors.deliveryAddress && <p className="p-err">{errors.deliveryAddress}</p>}
          <p className="p-field-hint">{t("deliveryHint")}</p>
        </div>
      </div>
    </>
  );
}
