"use client";

import { useMemo, useState } from "react";
import type { CreateServiceRequestDTO } from "@/interfaces";
import { INSPECTION_TYPES } from "@/constants/inspectionTypes";
import { newClientId } from "@/lib/http/apiClient";
import { useSites } from "@/components/hooks/location/useSites";
import { useSubmitServiceRequest } from "@/components/hooks/service-request/useSubmitServiceRequest";
import { proposalSuggestedCodes, useRequestStore } from "@/store/requestStore";
import { currentSubject, useScanStore } from "@/store/scanStore";
import { useSessionStore } from "@/store/sessionStore";
import { ClassificationConfirm, ClassificationPanel, ProposalBanner } from "@/components/features/classification/ClassificationPanel";
import { DeviceHeader } from "@/components/features/device/DeviceHeader";
import { buildLocationText, LocationForm } from "@/components/features/location/LocationForm";
import { Spinner } from "@/components/ui/Loading";
import { PhotoAttachment } from "./PhotoAttachment";
import { serviceRequestFormSchema } from "@/schemas/forms";
import { zodFieldErrors } from "@/schemas/formErrors";

/**
 * Section 36 — collects device, service type, classification, location of use,
 * access hint, delivery address, note and photos. Client-side checks
 * mirror the server's rules; the server remains the authority.
 */
export function ServiceRequestForm() {
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

  const proposal = resolution?.classificationProposal ?? null;
  const subject = useMemo(() => currentSubject({ resolution, captured }), [resolution, captured]);
  const busy = phase === "submitting";

  const validate = (): boolean => {
    const parsed = serviceRequestFormSchema.safeParse({
      serviceType: form.serviceType ?? "",
      site: form.siteId,
      room: form.room,
      deliveryAddress: form.deliveryAddress,
      classificationConfirmed: form.proposalConfirmed,
      requiresClassificationConfirm: proposal?.confidence === "verified",
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
    const suggested = proposalSuggestedCodes(proposal);
    const overridden = Boolean(proposal) && (suggested.some((c) => !form.selectedTypes.includes(c)) || form.selectedTypes.some((c) => !suggested.includes(c)));
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
      classification: proposal
        ? {
            proposed: proposal,
            selected: form.selectedTypes.map((c) => INSPECTION_TYPES.findIndex((t) => t.code === c)).filter((i) => i >= 0),
            confirmed: form.proposalConfirmed,
            overridden,
          }
        : undefined,
      attachments: form.photos.map((p) => ({ kind: p.kind, url: p.dataUrl })),
      raisedBy: user.name,
      correlationId: newClientId(),
    };
    const title = captured?.name ?? resolution?.model?.tradeName ?? resolution?.device?.inventoryNumber ?? "device";
    await submit(payload, `${form.serviceType} for ${title}`);
  };

  const allErrors = { ...errors, ...fieldErrors };

  return (
    <div data-testid="service-request-form">
      <DeviceHeader
        resolution={resolution}
        captured={captured}
        actions={
          <button type="button" className="p-close" onClick={backToDevice} disabled={busy} aria-label="Change">
            ×
          </button>
        }
      />

      <div className="p-sec p-sr-fields">
        {proposal && <ProposalBanner proposal={proposal} />}
        <div className="p-sr-row">
          <ClassificationPanel
            proposal={proposal}
            alreadyConfirmed={Boolean(resolution?.device?.classification)}
            error={allErrors.classification ?? allErrors["classification.confirmed"] ?? allErrors.serviceType}
          />
          <div className="p-field p-sr-note">
            <label htmlFor="note">Hinweis (optional)</label>
            <textarea
              id="note"
              value={form.note}
              onChange={(e) => patch({ note: e.target.value })}
              placeholder="Zugang, Wunschtermin, Fehlerbild"
              data-testid="note-input"
              rows={4}
            />
          </div>
        </div>
        {proposal && <ClassificationConfirm proposal={proposal} />}
      </div>

      <LocationForm errors={{ site: allErrors.site, room: allErrors.room ?? allErrors.locationText, deliveryAddress: allErrors.deliveryAddress }} />

      <div className="p-sec">
        <PhotoAttachment
          kind="fault_photo"
          label="Fotos"
          photos={form.photos}
          onAdd={addPhoto}
          onRemove={removePhoto}
          max={4}
          buttonLabel="Foto aufnehmen"
          hint="Ein Foto ersetzt drei Sätze Freitext und halbiert die Rückfragen des Servicepartners."
        />
      </div>

      <div className="p-sec">
        <div className="p-actions">
          <button type="button" className="p-cta ghost" onClick={backToDevice} disabled={busy}>
            Zurück
          </button>
          <button type="button" className="p-cta" onClick={() => void onSubmit()} disabled={busy || !subject} data-testid="submit-service-request">
            {busy ? <Spinner /> : "Beauftragen"}
          </button>
        </div>
        <p className="p-via">
          Übertragung an <b>service@plusorder.de</b>
        </p>
      </div>
    </div>
  );
}
