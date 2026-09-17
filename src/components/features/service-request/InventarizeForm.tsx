"use client";

import type { InventarizeOffer } from "@/interfaces";
import { useInventarize } from "@/components/hooks/service-request/useInventarize";
import { RequiredMark } from "@/components/ui/RequiredMark";

export function InventarizeForm({
  offer,
  deviceTitle,
  onDone,
}: {
  offer: InventarizeOffer;
  deviceTitle: string;
  onDone: () => void;
}) {
  const form = useInventarize(offer, onDone);

  return (
    <div className="p-inventarize" data-testid="inventarize-form">
      <header className="p-inventarize__head">
        <h2>Gerät ins Bestandsverzeichnis aufnehmen</h2>
        <p className="p-inventarize__device">{deviceTitle}</p>
      </header>

      <div className="p-inventarize__info" data-testid="inventarize-info">
        Der Auftrag ist übermittelt. Möchten Sie das Gerät dauerhaft im Bestandsverzeichnis
        führen? Die Angaben aus der Anforderung sind übernommen.
      </div>

      <div className="p-inventarize__body">
        <div className="p-field">
          <label htmlFor="inv-person">Verantwortliche Person</label>
          <input
            id="inv-person"
            value={form.responsiblePerson}
            onChange={(e) => form.setResponsiblePerson(e.target.value)}
            placeholder="Name"
            autoComplete="name"
            data-testid="inventarize-responsible"
          />
          {form.fieldErrors.responsiblePerson && (
            <p className="p-err">{form.fieldErrors.responsiblePerson}</p>
          )}
        </div>

        <div className="p-grid2 p-grid2--always">
          <div className="p-field">
            <label htmlFor="inv-type">Art und Typ</label>
            <input id="inv-type" value={form.artUndTyp} readOnly data-testid="inventarize-type" />
          </div>

          <div className="p-field">
            <label htmlFor="inv-serial">
              Seriennummer <RequiredMark />
            </label>
            <input
              id="inv-serial"
              className="t-mono"
              value={form.serialNumber}
              onChange={(e) => form.setSerialNumber(e.target.value)}
              placeholder="Seriennummer vom Typenschild"
              autoComplete="off"
              aria-required="true"
              aria-invalid={Boolean(form.fieldErrors.serialNumber) || Boolean(form.duplicate)}
              data-invalid={form.fieldErrors.serialNumber || form.duplicate ? "1" : undefined}
              data-testid="inventarize-serial"
            />
            {form.checking && <p className="p-inventarize__hint">Prüfe Bestand…</p>}
            {form.fieldErrors.serialNumber && (
              <p className="p-err" data-testid="inventarize-serial-error">
                {form.fieldErrors.serialNumber}
              </p>
            )}
            {form.duplicate && (
              <p className="p-warn" data-testid="inventarize-duplicate">
                Bereits im Bestandsverzeichnis · {form.duplicate.inventoryNumber}
                {form.duplicate.serialNumber ? ` · SN ${form.duplicate.serialNumber}` : ""}
              </p>
            )}
          </div>
        </div>

        <div className="p-grid2 p-grid2--always">
          <div className="p-field">
            <label htmlFor="inv-udi">UDI-DI</label>
            <input
              id="inv-udi"
              className="t-mono"
              value={form.udiDi ?? ""}
              readOnly
              data-testid="inventarize-udi"
            />
          </div>

          <div className="p-field">
            <label htmlFor="inv-year">Anschaffungsjahr</label>
            <input
              id="inv-year"
              className="t-mono"
              value={form.commissionedYear}
              onChange={(e) => form.setCommissionedYear(e.target.value)}
              placeholder="JJJJ"
              inputMode="numeric"
              data-testid="inventarize-year"
            />
            {form.fieldErrors.commissionedAt && (
              <p className="p-err">{form.fieldErrors.commissionedAt}</p>
            )}
          </div>
        </div>

        <div className="p-inventarize__meta">
          <div className="p-inventarize__meta-row">
            <span className="p-inventarize__meta-label">Standort</span>
            <p className="t-mono" data-testid="inventarize-location">
              {form.locationText || "—"}
            </p>
          </div>
          <div className="p-inventarize__meta-row">
            <span className="p-inventarize__meta-label">Einstufung</span>
            <p className="p-inventarize__badge">Keine Einstufung hinterlegt</p>
          </div>
        </div>

        {form.error && (
          <p className="p-err" data-testid="inventarize-error">
            {form.error}
          </p>
        )}
      </div>

      <div className="p-inventarize__actions">
        <button
          type="button"
          className="p-cta ghost"
          onClick={form.skip}
          disabled={form.busy}
          data-testid="inventarize-skip"
        >
          Nicht aufnehmen
        </button>
        <button
          type="button"
          className="p-cta"
          onClick={() => void form.submit()}
          disabled={form.busy}
          data-testid="inventarize-submit"
        >
          {form.busy ? "Speichern…" : "Aufnehmen"}
        </button>
      </div>
    </div>
  );
}
