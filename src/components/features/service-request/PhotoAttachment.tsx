"use client";

import { useRef, useState } from "react";
import type { PhotoAttachmentProps } from "@/interfaces";
import { downscaleImage, ImageProcessingError } from "@/lib/image";
import { newClientId } from "@/lib/http/apiClient";
import { Spinner } from "@/components/ui/Loading";
import { RequiredMark } from "@/components/ui/RequiredMark";
import { toast } from "@/store/toastStore";

export function PhotoAttachment({
  kind,
  label,
  photos,
  onAdd,
  onRemove,
  max = 1,
  required,
  error,
  hint,
  buttonLabel = "+ Photo",
}: PhotoAttachmentProps) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const mine = photos.filter((p) => p.kind === kind);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const file of Array.from(files).slice(0, max - mine.length)) {
        const dataUrl = await downscaleImage(file);
        onAdd({ id: newClientId(), kind, dataUrl });
      }
    } catch (e) {
      toast.error(
        e instanceof ImageProcessingError ? e.message : "The photo could not be processed. Please try another one.",
      );
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="p-photo-block">
      <label className="p-sec-title" style={{ marginBottom: 8 }}>
        {label}
        {required ? (
          <>
            {" "}
            <RequiredMark />
          </>
        ) : null}
      </label>
      {mine.length > 0 && (
        <div className="p-photos">
          {mine.map((p) => (
            <div key={p.id} className="p-thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.dataUrl} alt="" />
              <button type="button" onClick={() => onRemove(p.id)} aria-label="Remove photo">
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      {mine.length < max && (
        <button
          type="button"
          className="p-photobtn"
          onClick={() => input.current?.click()}
          disabled={busy}
          data-testid={`photo-add-${kind}`}
        >
          {busy ? (
            <Spinner />
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M4 8h3l1.5-2h7L17 8h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                <circle cx="12" cy="14" r="3.2" stroke="currentColor" strokeWidth="1.6" />
              </svg>
              {buttonLabel}
            </>
          )}
        </button>
      )}
      {hint && <p className="p-field-hint">{hint}</p>}
      {error && <p className="p-err">{error}</p>}
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void onFiles(e.target.files)}
        data-testid={`photo-input-${kind}`}
      />
    </div>
  );
}
