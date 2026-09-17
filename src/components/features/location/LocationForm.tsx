"use client";

import type { LocationFormProps } from "@/interfaces";
import { CUSTOM_DELIVERY } from "@/constants/location";
import { useLocationForm } from "@/components/hooks/location/useLocationForm";

export { buildLocationText } from "@/components/hooks/location/useLocationForm";

export function LocationForm({ errors }: LocationFormProps) {
  const { form, patch, sites, site, deliveryOptions, customMode, selectValue, onSelectDelivery } = useLocationForm();

  return (
    <>
      <div className="p-sec" data-testid="location-section">
        <p className="p-sec-title">
          Einsatzort <span className="p-req" aria-hidden="true">*</span>
        </p>
        <div className="p-grid2 p-grid2--always">
          <div className="p-field">
            <label htmlFor="loc-site">
              Standort <span className="p-req" aria-hidden="true">*</span>
            </label>
            <select
              id="loc-site"
              value={form.siteId}
              onChange={(e) => patch({ siteId: e.target.value, areaId: "" })}
              aria-required="true"
              data-testid="site-select"
            >
              <option value="">Standort wählen…</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {errors.site && <p className="p-err">{errors.site}</p>}
          </div>
          <div className="p-field">
            <label htmlFor="loc-area">Bereich</label>
            <select
              id="loc-area"
              value={form.areaId}
              onChange={(e) => patch({ areaId: e.target.value })}
              disabled={!site}
              data-testid="area-select"
            >
              <option value="">Bereich wählen…</option>
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
            Raum <span className="p-req" aria-hidden="true">*</span>
          </label>
          <input
            id="loc-room"
            value={form.room}
            onChange={(e) => patch({ room: e.target.value })}
            placeholder="Raum — z. B. 3.02"
            aria-required="true"
            data-testid="room-input"
          />
          {errors.room && <p className="p-err">{errors.room}</p>}
        </div>

        <div className="p-field">
          <label htmlFor="loc-access">Zugangshinweis</label>
          <textarea
            id="loc-access"
            value={form.accessHint}
            onChange={(e) => patch({ accessHint: e.target.value })}
            placeholder="Pforte, Schlüssel, Öffnungszeiten, Ansprechpartner"
            data-testid="access-hint-input"
            rows={3}
          />
          <p className="p-field-hint">Entscheidet darüber, ob der Techniker das Gerät erreicht.</p>
        </div>
      </div>

      <div className="p-sec" data-testid="delivery-section">
        <div className="p-field">
          <label htmlFor="delivery-select">
            Lieferanschrift <span className="p-req" aria-hidden="true">*</span>
          </label>
          <select
            id="delivery-select"
            value={selectValue}
            onChange={(e) => onSelectDelivery(e.target.value)}
            aria-required="true"
            data-testid="delivery-select"
          >
            <option value="">Lieferanschrift wählen…</option>
            {deliveryOptions.map((addr) => (
              <option key={addr} value={addr}>
                {addr}
              </option>
            ))}
            <option value={CUSTOM_DELIVERY}>Andere Anschrift…</option>
          </select>

          {(customMode || selectValue === CUSTOM_DELIVERY) && (
            <textarea
              id="delivery"
              className="p-delivery-custom"
              value={form.deliveryAddress}
              onChange={(e) => patch({ deliveryAddress: e.target.value })}
              placeholder="Straße, Hausnummer, PLZ Ort — z. B. Warenannahme Haus B"
              rows={3}
              data-testid="delivery-input"
            />
          )}

          {!customMode && selectValue !== CUSTOM_DELIVERY && (
            <input type="hidden" data-testid="delivery-input" value={form.deliveryAddress} readOnly />
          )}

          {errors.deliveryAddress && <p className="p-err">{errors.deliveryAddress}</p>}
          <p className="p-field-hint">Ersatzteile gehen an die Warenannahme, nicht an den Einsatzort.</p>
        </div>
      </div>
    </>
  );
}
