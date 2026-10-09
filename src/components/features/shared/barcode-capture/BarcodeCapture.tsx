"use client";

import { useId, useState } from "react";
import { Camera } from "lucide-react";
import { useTranslations } from "next-intl";
import type { IdentifierKind } from "@/interfaces";
import { CameraScanner } from "@/components/features/scan/CameraScanner";
import { useBarcodeCapture } from "@/components/hooks/barcode/useBarcodeCapture";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BarcodeCaptureResult, BarcodeCaptureVariant } from "@/lib/barcode/types";
import { cn } from "@/lib/utils";
import { toast } from "@/store/toastStore";

export type BarcodeCaptureProps = {
  variant?: BarcodeCaptureVariant;
  onCapture: (result: BarcodeCaptureResult) => void | Promise<void>;
  /** When set, only these identifier kinds are accepted. */
  allowedKinds?: readonly IdentifierKind[];
  placeholder?: string;
  submitLabel?: string;
  label?: string;
  busy?: boolean;
  disabled?: boolean;
  /** Show camera dialog button (default true for compact). */
  showCamera?: boolean;
  /** Open the camera dialog immediately when mounted. */
  defaultCameraOpen?: boolean;
  showKindHint?: boolean;
  autoFocus?: boolean;
  className?: string;
  inputClassName?: string;
  "data-testid"?: string;
};

function kindLabel(
  kind: IdentifierKind,
  t: ReturnType<typeof useTranslations<"scan">>,
): string {
  switch (kind) {
    case "gtin":
      return t("kindGtin");
    case "udi-di":
      return t("kindUdiDi");
    case "inventory":
      return t("kindInventory");
    case "serial":
      return t("kindSerial");
    default:
      return t("kindUnknown");
  }
}

/**
 * Shared barcode / identifier capture: manual + optional camera + keyboard wedge.
 * Does not touch scanStore — callers decide the intent in onCapture.
 */
export function BarcodeCapture({
  variant = "compact",
  onCapture,
  allowedKinds,
  placeholder,
  submitLabel,
  label,
  busy = false,
  disabled = false,
  showCamera = true,
  defaultCameraOpen = false,
  showKindHint = true,
  autoFocus = false,
  className,
  inputClassName,
  "data-testid": testId = "barcode-capture",
}: BarcodeCaptureProps) {
  const tScan = useTranslations("scan");
  const t = useTranslations("barcode");
  const inputId = useId();
  const [cameraOpen, setCameraOpen] = useState(defaultCameraOpen);

  const { value, setValue, parsed, emit, submitManual } = useBarcodeCapture({
    allowedKinds,
    busy: busy || disabled,
    onCapture: async (result) => {
      setCameraOpen(false);
      await onCapture(result);
    },
    onRejectedKind: () => {
      toast.error(t("kindNotAllowed"));
    },
  });

  const locked = busy || disabled;

  return (
    <div className={cn("space-y-2", className)} data-testid={testId}>
      {label ? (
        <Label htmlFor={inputId} className="text-sm">
          {label}
        </Label>
      ) : null}

      <div
        className={cn(
          "flex flex-col gap-2",
          variant === "compact" && "sm:flex-row sm:items-center",
        )}
      >
        <Input
          id={inputId}
          value={value}
          disabled={locked}
          autoFocus={autoFocus}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder={placeholder ?? t("placeholder")}
          className={cn("flex-1 font-mono text-sm", inputClassName)}
          data-testid={`${testId}-input`}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              // Keyboard-wedge scanners typically end with Enter.
              void emit(value, value.includes("\u001d") || value.length > 20 ? "wedge" : "manual");
            }
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={variant === "field" ? "default" : "secondary"}
            size="sm"
            className="h-9"
            disabled={locked || !value.trim()}
            onClick={submitManual}
            data-testid={`${testId}-submit`}
          >
            {submitLabel ?? t("submit")}
          </Button>
          {showCamera ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              disabled={locked}
              onClick={() => setCameraOpen(true)}
              data-testid={`${testId}-camera`}
            >
              <Camera className="h-3.5 w-3.5" />
              {t("scanWithCamera")}
            </Button>
          ) : null}
        </div>
      </div>

      {showKindHint && parsed ? (
        <p className="text-xs text-muted-foreground" data-testid={`${testId}-kind`}>
          {tScan("detected", { kind: kindLabel(parsed.kind, tScan) })}
          {parsed.gtin ? ` · ${parsed.gtin}` : ""}
          {parsed.serial ? ` · SN ${parsed.serial}` : ""}
        </p>
      ) : null}

      <Dialog open={cameraOpen} onOpenChange={setCameraOpen}>
        <DialogContent className="max-w-md gap-3 p-4" data-testid={`${testId}-camera-dialog`}>
          <DialogHeader>
            <DialogTitle className="text-base">{t("cameraTitle")}</DialogTitle>
            <DialogDescription className="text-xs">{t("cameraHint")}</DialogDescription>
          </DialogHeader>
          <div className="relative min-h-[240px] overflow-hidden rounded-lg border border-border bg-black">
            <CameraScanner
              active={cameraOpen && !locked}
              onScan={(raw) => {
                void emit(raw, "camera");
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
