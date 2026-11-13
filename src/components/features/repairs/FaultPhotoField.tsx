"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { downscaleImage, ImageProcessingError } from "@/lib/image";
import { toast } from "@/store/toastStore";

type Props = {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
};

/**
 * Optional fault photo — upload or camera capture, compressed via downscaleImage
 * (≤1600px edge, JPEG ~0.82) before the parent posts photoDataUrl.
 */
export function FaultPhotoField({ value, onChange }: Props) {
  const t = useTranslations("repairs.fault");
  const uploadRef = useRef<HTMLInputElement>(null);
  const captureRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await downscaleImage(file);
      onChange(dataUrl);
    } catch (e) {
      toast.error(e instanceof ImageProcessingError ? e.message : t("photoProcessError"));
    } finally {
      setBusy(false);
      if (uploadRef.current) uploadRef.current.value = "";
      if (captureRef.current) captureRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2" data-testid="fault-photo-field">
      <Label>{t("photoLabel")}</Label>
      <p className="text-xs text-muted-foreground">{t("photoHint")}</p>

      {value ? (
        <div className="relative inline-block overflow-hidden rounded-md border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="h-28 w-auto max-w-full object-cover" />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="absolute right-1 top-1 h-7 px-2"
            onClick={() => onChange(null)}
            data-testid="fault-photo-remove"
          >
            {t("photoRemove")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => uploadRef.current?.click()}
            data-testid="fault-photo-upload"
          >
            {busy ? t("photoProcessing") : t("photoUpload")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => captureRef.current?.click()}
            data-testid="fault-photo-capture"
          >
            {busy ? t("photoProcessing") : t("photoCapture")}
          </Button>
        </div>
      )}

      <input
        ref={uploadRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void onFiles(e.target.files)}
        data-testid="fault-photo-upload-input"
      />
      <input
        ref={captureRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void onFiles(e.target.files)}
        data-testid="fault-photo-capture-input"
      />
    </div>
  );
}
