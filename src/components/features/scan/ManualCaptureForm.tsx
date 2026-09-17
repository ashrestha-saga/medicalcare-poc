"use client";

import type { CapturedNumberType } from "@/interfaces";
import { Spinner } from "@/components/ui/Loading";
import { PhotoAttachment } from "@/components/features/service-request/PhotoAttachment";
import { useManualCapture } from "@/components/hooks/scan/useManualCapture";

/**
 * Stage 4 — manual capture (Section 20). Name + nameplate photo are required.
 */
export function ManualCaptureForm() {
  const {
    name,
    setName,
    manufacturer,
    setManufacturer,
    number,
    setNumber,
    numberType,
    setNumberType,
    photos,
    addPhoto,
    removePhoto,
    errors,
    busy,
    save,
    cancelCapture,
  } = useManualCapture();

  return (
    <div data-testid="manual-capture">
      <div className="p-src" data-s="manual" style={{ margin: "14px 18px" }}>
        Manually captured, service only
        <br />
        We couldn&apos;t identify this device automatically.
      </div>
      <div className="p-sec">
        <p className="p-sec-title">Manual capture</p>
        <div className="p-field">
          <label htmlFor="cap-name">
            Device name <span className="p-req" aria-hidden="true">*</span>
          </label>
          <input
            id="cap-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Infusion pump"
            data-testid="capture-name"
          />
          {errors.name && <p className="p-err">{errors.name}</p>}
        </div>
        <div className="p-field">
          <label htmlFor="cap-manufacturer">Manufacturer</label>
          <input
            id="cap-manufacturer"
            value={manufacturer}
            onChange={(e) => setManufacturer(e.target.value)}
          />
        </div>
        <div className="p-grid2">
          <div className="p-field">
            <label htmlFor="cap-number">Number</label>
            <input
              id="cap-number"
              className="t-mono"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
            />
          </div>
          <div className="p-field">
            <label htmlFor="cap-number-type">Type</label>
            <select
              id="cap-number-type"
              value={numberType}
              onChange={(e) => setNumberType(e.target.value as CapturedNumberType)}
            >
              <option value="gtin">GTIN</option>
              <option value="pzn">PZN</option>
              <option value="manufacturer">Manufacturer no.</option>
              <option value="none">None</option>
            </select>
          </div>
        </div>
        <PhotoAttachment
          kind="nameplate"
          label="Nameplate photo"
          required
          photos={photos}
          onAdd={addPhoto}
          onRemove={removePhoto}
          error={errors.photo}
        />
        <p style={{ fontSize: 11, color: "var(--on-dark-soft)", margin: "12px 0" }}>
          Manually captured devices are available for service requests only, not for spare-parts orders.
        </p>
        <div className="p-actions">
          <button type="button" className="p-cta ghost" onClick={cancelCapture} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="p-cta" onClick={() => void save()} disabled={busy} data-testid="capture-save">
            {busy ? <Spinner /> : "Save and continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
