import type { IdentifierKind, ParsedIdentifier } from "@/interfaces";

export type BarcodeCaptureOrigin = "camera" | "manual" | "wedge";

export type BarcodeCaptureResult = {
  raw: string;
  origin: BarcodeCaptureOrigin;
  identifier: ParsedIdentifier;
};

export type BarcodeCaptureVariant = "compact" | "field";

export type BarcodeAllowedKind = IdentifierKind;
