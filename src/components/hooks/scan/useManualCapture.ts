"use client";

import { useCallback, useState } from "react";
import type { CapturedArticleDTO, CapturedNumberType, ManualCaptureFieldErrors, PhotoDraft } from "@/interfaces";
import { api, ApiError, NetworkError } from "@/lib/http/apiClient";
import { manualCaptureFormSchema } from "@/schemas/forms";
import { zodFieldErrors } from "@/schemas/formErrors";
import { useScanStore } from "@/store/scanStore";
import { useLogStore } from "@/store/logStore";
import { toast } from "@/store/toastStore";

/**
 * Stage 4 manual capture form state + POST /api/captures.
 */
export function useManualCapture() {
  const resolution = useScanStore((s) => s.resolution);
  const captureSaved = useScanStore((s) => s.captureSaved);
  const cancelCapture = useScanStore((s) => s.cancelCapture);
  const identifier = resolution?.identifier;

  const [name, setName] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [number, setNumber] = useState(identifier?.gtin ?? identifier?.text ?? "");
  const [numberType, setNumberType] = useState<CapturedNumberType>(
    identifier?.gtin ? "gtin" : identifier?.text ? "manufacturer" : "none",
  );
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [errors, setErrors] = useState<ManualCaptureFieldErrors>({});
  const [busy, setBusy] = useState(false);

  const addPhoto = useCallback((p: PhotoDraft) => {
    setPhotos((cur) => [...cur, p]);
  }, []);

  const removePhoto = useCallback((id: string) => {
    setPhotos((cur) => cur.filter((p) => p.id !== id));
  }, []);

  const validate = useCallback(() => {
    const parsed = manualCaptureFormSchema.safeParse({
      name,
      hasNameplatePhoto: photos.some((p) => p.kind === "nameplate"),
    });
    if (!parsed.success) {
      const fields = zodFieldErrors(parsed.error);
      setErrors({
        name: fields.name,
        photo: fields.hasNameplatePhoto,
      });
      return false;
    }
    setErrors({});
    return true;
  }, [name, photos]);

  const save = useCallback(async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      const captured = await api<CapturedArticleDTO>("/api/captures", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          manufacturer: manufacturer.trim(),
          number: number.trim(),
          numberType: number.trim() ? numberType : "none",
          rawIdentifier: identifier?.raw,
          nameplatePhoto: photos.find((p) => p.kind === "nameplate")!.dataUrl,
        }),
      });
      useLogStore.getState().log("resolve", `Manual capture saved (${captured.id}) — service-only`);
      captureSaved(captured);
    } catch (e) {
      if (e instanceof NetworkError) {
        toast.error("You're offline. Manual capture needs a connection to create the device record.", true);
      } else {
        toast.error(e instanceof ApiError ? e.message : "Could not save the capture.");
      }
    } finally {
      setBusy(false);
    }
  }, [validate, name, manufacturer, number, numberType, identifier, photos, captureSaved]);

  return {
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
  };
}
