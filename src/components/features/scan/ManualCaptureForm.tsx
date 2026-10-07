"use client";

import { useTranslations } from "next-intl";
import type { CapturedNumberType } from "@/interfaces";
import { Spinner } from "@/components/ui/Loading";
import { PhotoAttachment } from "@/components/features/service-request/PhotoAttachment";
import { useManualCapture } from "@/components/hooks/scan/useManualCapture";

/**
 * Stage 4 — manual capture (Section 20). Name + nameplate photo are required.
 */
export function ManualCaptureForm() {
  const t = useTranslations("scan");
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
        {t("manualCaptureBanner")}
        <br />
        {t("manualCaptureBannerSub")}
      </div>
      <div className="p-sec">
        <p className="p-sec-title">{t("manualCaptureTitle")}</p>
        <div className="p-field">
          <label htmlFor="cap-name">
            {t("deviceName")} <span className="p-req" aria-hidden="true">*</span>
          </label>
          <input
            id="cap-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("deviceNamePlaceholder")}
            data-testid="capture-name"
          />
          {errors.name && <p className="p-err">{errors.name}</p>}
        </div>
        <div className="p-field">
          <label htmlFor="cap-manufacturer">{t("manufacturer")}</label>
          <input
            id="cap-manufacturer"
            value={manufacturer}
            onChange={(e) => setManufacturer(e.target.value)}
          />
        </div>
        <div className="p-grid2">
          <div className="p-field">
            <label htmlFor="cap-number">{t("number")}</label>
            <input
              id="cap-number"
              className="t-mono"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
            />
          </div>
          <div className="p-field">
            <label htmlFor="cap-number-type">{t("numberType")}</label>
            <select
              id="cap-number-type"
              value={numberType}
              onChange={(e) => setNumberType(e.target.value as CapturedNumberType)}
            >
              <option value="gtin">{t("numberTypeGtin")}</option>
              <option value="pzn">{t("numberTypePzn")}</option>
              <option value="manufacturer">{t("numberTypeManufacturer")}</option>
              <option value="none">{t("numberTypeNone")}</option>
            </select>
          </div>
        </div>
        <PhotoAttachment
          kind="nameplate"
          label={t("nameplatePhoto")}
          required
          photos={photos}
          onAdd={addPhoto}
          onRemove={removePhoto}
          error={errors.photo}
        />
        <p style={{ fontSize: 11, color: "var(--on-dark-soft)", margin: "12px 0" }}>
          {t("manualCaptureOnlyHint")}
        </p>
        <div className="p-actions">
          <button type="button" className="p-cta ghost" onClick={cancelCapture} disabled={busy}>
            {t("cancel")}
          </button>
          <button type="button" className="p-cta" onClick={() => void save()} disabled={busy} data-testid="capture-save">
            {busy ? <Spinner /> : t("saveAndContinue")}
          </button>
        </div>
      </div>
    </div>
  );
}
