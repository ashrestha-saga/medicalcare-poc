"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { CreateServiceRequestDTO } from "@/interfaces";
import { newClientId } from "@/lib/http/apiClient";
import { useSites } from "@/components/hooks/location/useSites";
import { useSubmitServiceRequest } from "@/components/hooks/service-request/useSubmitServiceRequest";
import { useRequestStore } from "@/store/requestStore";
import { currentSubject, useScanStore } from "@/store/scanStore";
import { useSessionStore } from "@/store/sessionStore";
import { ClassificationPanel } from "@/components/features/classification/ClassificationPanel";
import { DeviceHeader } from "@/components/features/device/DeviceHeader";
import { buildLocationText, LocationForm } from "@/components/features/location/LocationForm";
import { Spinner } from "@/components/ui/Loading";
import { PhotoAttachment } from "./PhotoAttachment";
import { serviceRequestFormSchema } from "@/schemas/forms";
import { zodFieldErrors } from "@/schemas/formErrors";

/**
 * Collects device, service type, location of use, access hint, delivery address,
 * note and photos. Service type is chosen manually (no proposal engine).
 */
export function ServiceRequestForm() {
  const t = useTranslations("serviceRequest");
  const tScan = useTranslations("scan");
  const resolution = useScanStore((s) => s.resolution);
  const captured = useScanStore((s) => s.captured);
  const phase = useScanStore((s) => s.phase);
  const backToDevice = useScanStore((s) => s.backToDevice);
  const form = useRequestStore((s) => s.form);
  const patch = useRequestStore((s) => s.patch);
  const addPhoto = useRequestStore((s) => s.addPhoto);
  const removePhoto = useRequestStore((s) => s.removePhoto);
  const user = useSessionStore((s) => s.user);
  const sites = useSites();
  const { submit, fieldErrors } = useSubmitServiceRequest();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const subject = useMemo(() => currentSubject({ resolution, captured }), [resolution, captured]);
  const busy = phase === "submitting";

  const validate = (): boolean => {
    const parsed = serviceRequestFormSchema.safeParse({
      serviceType: form.serviceType ?? "",
      site: form.siteId,
      room: form.room,
      deliveryAddress: form.deliveryAddress,
    });
    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error));
      return false;
    }
    setErrors({});
    return true;
  };

  const onSubmit = async () => {
    if (!subject || !user) return;
    if (!validate()) return;
    const payload: CreateServiceRequestDTO = {
      idempotencyKey: form.idempotencyKey,
      subjectType: subject.subjectType,
      subjectId: subject.subjectId,
      serviceType: form.serviceType!,
      priority: form.priority,
      note: form.note.trim() || undefined,
      site: form.siteId,
      locationText: buildLocationText(sites, form.siteId, form.areaId, form.room),
      accessHint: form.accessHint.trim() || undefined,
      contact: form.contact.trim() || undefined,
      deliveryAddress: form.deliveryAddress.trim(),
      attachments: form.photos.map((p) => ({ kind: p.kind, url: p.dataUrl })),
      raisedBy: user.name,
      correlationId: newClientId(),
    };
    const title =
      captured?.name ??
      resolution?.model?.tradeName ??
      resolution?.model?.modelName ??
      resolution?.model?.udiDi ??
      resolution?.device?.inventoryNumber ??
      tScan("deviceFallback");
    await submit(
      payload,
      tScan("submitTitleTemplate", { serviceType: form.serviceType!, title }),
    );
  };

  const allErrors = { ...errors, ...fieldErrors };

  return (
    <div data-testid="service-request-form">
      <DeviceHeader
        resolution={resolution}
        captured={captured}
        actions={
          <button type="button" className="p-close" onClick={backToDevice} disabled={busy} aria-label={tScan("changeDeviceAria")}>
            ×
          </button>
        }
      />

      <div className="p-sec p-sr-fields">
        <div className="p-sr-row">
          <ClassificationPanel error={allErrors.serviceType} />
          <div className="p-field p-sr-note">
            <label htmlFor="note">{t("note")}</label>
            <textarea
              id="note"
              value={form.note}
              onChange={(e) => patch({ note: e.target.value })}
              rows={3}
              disabled={busy}
            />
          </div>
        </div>

        <LocationForm errors={allErrors} />

        <PhotoAttachment
          kind="fault_photo"
          label={t("photos")}
          photos={form.photos}
          onAdd={addPhoto}
          onRemove={removePhoto}
          max={4}
        />

        <div className="p-sr-actions">
          <button type="button" className="p-cta" onClick={() => void onSubmit()} disabled={busy} data-testid="submit-service-request">
            {busy ? (
              <>
                <Spinner /> {t("sending")}
              </>
            ) : (
              t("send")
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
